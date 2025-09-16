import { Chart, ApiObject } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Construct } from 'constructs';

import { Rutter } from '../rutter.js';
import type { ChartMetadata } from '../rutter.js';

export interface BasicChartProps extends ChartProps {
  appName?: string;
  image?: string;
  port?: number;
  replicas?: number;
  createNamespace?: boolean;
}

export class BasicChart extends Chart {
  private rutter!: Rutter;
  private props: BasicChartProps;

  /**
   * Creates a new BasicChart instance.
   * Following CDK8s best practices, only generates CDK8s manifests in constructor.
   * Helm files are generated separately via writeHelmChart() method during synth.
   * @param scope - The scope in which to define this construct
   * @param id - The scoped construct ID
   * @param props - Chart configuration properties
   * @since 2.8.4
   */
  constructor(scope: Construct, id: string, props: BasicChartProps = {}) {
    super(scope, id, props);
    this.props = props;

    // Initialize Rutter for potential Helm template generation (lazy initialization)
    this.initializeRutter();

    // Generate Kubernetes manifests for CDK8s synthesis
    this.generateKubernetesManifests();
  }

  /**
   * Initialize Rutter for Helm template generation.
   * This is called lazily to prepare Helm templates without generating files.
   * @since 2.8.4
   * @private
   */
  private initializeRutter(): void {
    const {
      appName = 'my-app',
      image = 'nginx:latest',
      port = 80,
      replicas = 1,
      createNamespace = false,
    } = this.props;

    // Initialize Rutter for Helm template generation
    const meta: ChartMetadata = {
      name: appName,
      version: '1.0.0',
      description: `Helm chart for ${appName}`,
    };

    this.rutter = new Rutter({
      meta,
      scope: this,
      defaultValues: {
        appName,
        image,
        port,
        replicas,
        createNamespace,
      },
    });

    // Conditionally create namespace using Helm template
    if (createNamespace) {
      this.rutter.addConditionalManifest(
        {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: {
            name: `{{ .Values.appName }}`,
          },
        },
        'createNamespace',
        'namespace',
      );
    }

    // Create deployment manifest
    this.rutter.addManifest(
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `{{ .Values.appName }}`,
          labels: {
            app: `{{ .Values.appName }}`,
          },
        },
        spec: {
          replicas: `{{ .Values.replicas }}`,
          selector: {
            matchLabels: {
              app: `{{ .Values.appName }}`,
            },
          },
          template: {
            metadata: {
              labels: {
                app: `{{ .Values.appName }}`,
              },
            },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: `{{ .Values.image }}`,
                  ports: [
                    {
                      containerPort: `{{ .Values.port }}`,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      'deployment',
    );

    // Create service manifest
    this.rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `{{ .Values.appName }}`,
          labels: {
            app: `{{ .Values.appName }}`,
          },
        },
        spec: {
          ports: [
            {
              port: `{{ .Values.port }}`,
              targetPort: `{{ .Values.port }}`,
            },
          ],
          selector: {
            app: `{{ .Values.appName }}`,
          },
        },
      },
      'service',
    );
  }

  /**
   * Write Helm chart files (Chart.yaml and values.yaml) to the specified directory.
   * This method should only be called during synth command, not during init.
   * @param outDir - Output directory for Helm files
   * @since 2.8.4
   */
  writeHelmChart(outDir: string): void {
    this.rutter.write(outDir);
  }

  /**
   * Generate Kubernetes manifests directly for CDK8s synthesis.
   * Creates deployment, service, and optionally namespace resources.
   *
   * @since 2.8.4
   * @private
   */
  private generateKubernetesManifests(): void {
    const {
      appName = 'my-app',
      image = 'nginx:latest',
      port = 80,
      replicas = 1,
      createNamespace = false,
    } = this.props;

    // Create namespace if requested
    if (createNamespace) {
      new ApiObject(this, 'namespace', {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: appName,
        },
      });
    }

    // Create deployment
    new ApiObject(this, 'deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: appName,
        labels: {
          app: appName,
        },
      },
      spec: {
        replicas,
        selector: {
          matchLabels: {
            app: appName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: appName,
            },
          },
          spec: {
            containers: [
              {
                name: 'app',
                image,
                ports: [
                  {
                    containerPort: port,
                  },
                ],
              },
            ],
          },
        },
      },
    });

    // Create service
    new ApiObject(this, 'service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: appName,
        labels: {
          app: appName,
        },
      },
      spec: {
        ports: [
          {
            port,
            targetPort: port,
          },
        ],
        selector: {
          app: appName,
        },
      },
    });
  }
}

/**
 * Generates a basic chart template for CLI usage.
 * Following CDK8s best practices, generates both CDK8s manifests and Helm files during synth.
 * @param appName - The name of the application
 * @returns TypeScript code string for the chart
 * @since 2.8.4
 */
export function generateBasicChart(appName: string = 'my-app'): string {
  return `import { App, YamlOutputType } from 'cdk8s';
import { BasicChart } from 'timonel';

const app = new App({
  outdir: 'dist',
  outputFileExtension: '.yaml',
  yamlOutputType: YamlOutputType.FILE_PER_RESOURCE
});

const chart = new BasicChart(app, '${appName}', {
  appName: '${appName}',
  image: 'nginx:latest',
  port: 80,
  replicas: 1,
  createNamespace: true // Set to true to create namespace, false to skip
});

// Synthesize CDK8s manifests
app.synth();

// Generate Helm files (Chart.yaml and values.yaml) following CDK8s best practices
chart.writeHelmChart('.');
`;
}
