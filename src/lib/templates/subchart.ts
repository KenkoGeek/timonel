import { App, Chart } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Construct } from 'constructs';

import { Rutter } from '../rutter.js';
import type { ChartMetadata } from '../rutter.js';

export interface SubchartProps extends ChartProps {
  appName?: string;
  image?: string;
  port?: number;
  replicas?: number;
  serviceType?: string;
  enableIngress?: boolean;
  ingressHost?: string;
  env?: Record<string, string>;
  persistentVolume?: {
    enabled: boolean;
    size: string;
    storageClass?: string;
  };
}

export class Subchart extends Chart {
  private rutter: Rutter;

  constructor(scope: Construct, id: string, props: SubchartProps = {}) {
    super(scope, id, props);

    const {
      appName = 'subchart-app',
      image = 'nginx:latest',
      port = 80,
      replicas = 1,
      serviceType = 'ClusterIP',
      enableIngress = false,
      ingressHost = 'example.com',
      env = {},
      persistentVolume = { enabled: false, size: '1Gi' },
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
        serviceType,
        enableIngress,
        ingressHost,
        env,
        persistentVolume,
        ingress: {
          annotations: {},
          className: '',
          hosts: [
            {
              host: ingressHost,
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                },
              ],
            },
          ],
          tls: [],
        },
      },
    });

    // Create a ConfigMap for application configuration
    this.rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `{{ .Values.appName }}-config`,
          labels: {
            app: `{{ .Values.appName }}`,
            component: 'config',
          },
        },
        data: {
          'app.name': `{{ .Values.appName }}`,
          'app.port': `{{ .Values.port }}`,
          'app.environment': 'production',
        },
      },
      'configmap',
    );

    // Create a Secret for sensitive data
    this.rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: `{{ .Values.appName }}-secret`,
          labels: {
            app: `{{ .Values.appName }}`,
            component: 'secret',
          },
        },
        stringData: {
          'database.password': 'changeme',
          'api.key': 'your-api-key-here',
        },
      },
      'secret',
    );

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
          type: `{{ .Values.serviceType }}`,
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

    // Add ingress
    this.rutter.addTemplateManifest(
      `{{- if .Values.enableIngress }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if and .Values.ingress.className (not (hasKey .Values.ingress.annotations "kubernetes.io/ingress.class")) }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            {{- if and .pathType (semverCompare ">=1.18-0" $.Capabilities.KubeVersion.GitVersion) }}
            pathType: {{ .pathType }}
            {{- end }}
            backend:
              {{- if semverCompare ">=1.19-0" $.Capabilities.KubeVersion.GitVersion }}
              service:
                name: {{ include "chart.fullname" $ }}
                port:
                  number: {{ $.Values.port | int }}
              {{- else }}
              serviceName: {{ include "chart.fullname" $ }}
              servicePort: {{ $.Values.port | int }}
              {{- end }}
          {{- end }}
    {{- end }}
{{- end }}`,
      'ingress',
    );
  }

  // Getter to access the rutter instance
  get rutterInstance(): Rutter {
    return this.rutter;
  }

  // Method to write Helm chart
  writeHelmChart(outDir: string): void {
    this.rutter.write(outDir);
  }
}

export function generateSubchart(props: SubchartProps = {}, outDir: string = 'dist'): void {
  // Create a temporary scope for the subchart
  const app = new App();
  const subchart = new Subchart(app, 'subchart', props);
  subchart.writeHelmChart(outDir);
}

/**
 * Generate a subchart template for CLI usage
 * @param name Subchart name
 * @returns Template string for subchart.ts
 */
export function generateSubchartTemplate(name: string): string {
  return `import { App } from 'cdk8s';
import { Subchart } from 'timonel';

export default function createChart() {
  const app = new App({
    outdir: 'dist'
  });

  return new Subchart(app, '${name}', {
    appName: '${name}',
    image: 'nginx:latest',
    port: 80,
    replicas: 1,
    serviceType: 'ClusterIP',
    enableIngress: false,
    ingressHost: 'example.com'
  });
}

// Auto-execute when run directly
if (import.meta.url === new URL(import.meta.url).href) {
  const chart = createChart();
  chart.node.root.synth();
}
`;
}
