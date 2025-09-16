import { Chart } from 'cdk8s';
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
  private rutter: Rutter;

  constructor(scope: Construct, id: string, props: BasicChartProps = {}) {
    super(scope, id, props);

    const {
      appName = 'my-app',
      image = 'nginx:latest',
      port = 80,
      replicas = 1,
      createNamespace = false,
    } = props;

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

  // Method to write Helm chart
  writeHelmChart(outDir: string): void {
    this.rutter.write(outDir);
  }
}

// Template function for CLI usage
export function generateBasicChart(appName: string = 'my-app'): string {
  return `import { App, YamlOutputType } from 'cdk8s';
import { BasicChart } from './lib/templates/basic-chart';

const app = new App({
  outdir: 'dist',
  outputFileExtension: '.yaml',
  yamlOutputType: YamlOutputType.FILE_PER_RESOURCE
});

new BasicChart(app, '${appName}', {
  appName: '${appName}',
  image: 'nginx:latest',
  port: 80,
  replicas: 1,
  createNamespace: true // Set to true to create namespace, false to skip
});

app.synth();
`;
}
