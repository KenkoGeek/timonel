import { App, Chart, Testing, ApiObject } from 'cdk8s';
import * as kplus from 'cdk8s-plus-28';
import YAML from 'yaml';

import { include, helm } from './helm';
import { HelmChartWriter } from './HelmChartWriter';
import type {
  HelmChartMeta,
  HelmChartWriteOptions,
  SynthAsset,
  HelperDefinition,
} from './HelmChartWriter';

export interface DeploymentSpec {
  name: string;
  image: string;
  replicas?: number;
  containerPort?: number;
  env?: Record<string, string>;
}

export interface ServiceSpec {
  name: string;
  port: number;
  targetPort?: number;
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
}

export interface IngressSpec {
  name: string;
  host: string;
  serviceName: string;
  servicePort: number;
  className?: string;
}

export interface ChartFactoryProps {
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  /** Optional Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
}

/**
 * ChartFactory builds Kubernetes manifests using cdk8s and writes a Helm chart.
 */
export class ChartFactory {
  private readonly props: ChartFactoryProps;
  private readonly app: App;
  private readonly chart: Chart;
  private readonly assets: SynthAsset[] = [];

  constructor(props: ChartFactoryProps) {
    this.props = props;
    this.app = new App();
    this.chart = new Chart(this.app, props.meta.name);
  }

  addDeployment(spec: DeploymentSpec) {
    const dep = new kplus.Deployment(this.chart, spec.name, {
      replicas: spec.replicas ?? 1,
      containers: [
        {
          image: spec.image,
          portNumber: spec.containerPort ?? 3000,
          envVariables: Object.fromEntries(
            Object.entries(spec.env ?? {}).map(([k, v]) => [k, kplus.EnvValue.fromValue(v)]),
          ),
        },
      ],
    });
    this.capture(dep, `${spec.name}-deployment`);
    return dep;
  }

  addService(spec: ServiceSpec) {
    const typeMap: Record<'ClusterIP' | 'NodePort' | 'LoadBalancer', kplus.ServiceType> = {
      ClusterIP: kplus.ServiceType.CLUSTER_IP,
      NodePort: kplus.ServiceType.NODE_PORT,
      LoadBalancer: kplus.ServiceType.LOAD_BALANCER,
    };
    const svc = new kplus.Service(this.chart, spec.name, {
      type: spec.type ? typeMap[spec.type] : kplus.ServiceType.CLUSTER_IP,
      ports: [{ port: spec.port, targetPort: spec.targetPort ?? spec.port }],
    });
    this.capture(svc, `${spec.name}-service`);
    return svc;
  }

  addIngress(spec: IngressSpec) {
    // Use a raw ApiObject for broader compatibility across kplus versions
    const ing = new ApiObject(this.chart, spec.name, {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: spec.name },
      spec: {
        ingressClassName: spec.className,
        rules: [
          {
            host: spec.host,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: spec.serviceName,
                      port: { number: spec.servicePort },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
    this.capture(ing, `${spec.name}-ingress`);
    return ing;
  }

  /**
   * Capture the YAML of an ApiObject or Construct into assets.
   */
  private capture(_obj: unknown, id: string) {
    // Ensure the app can synth
    // We defer synth until write(), but we can capture logical ids now
    this.assets.push({ id, yaml: `# captured:${id}` });
  }

  /**
   * Synthesize the cdk8s app and write a Helm chart to outDir.
   */
  write(outDir: string) {
    // Use cdk8s Testing.synth to obtain manifest objects
    const manifestObjs = Testing.synth(this.chart) as unknown[];

    // Enforce common labels best-practice on all rendered objects
    const enriched = manifestObjs.map((obj: unknown) => {
      if (obj && typeof obj === 'object') {
        const o = obj as { metadata?: { labels?: Record<string, unknown> } };
        o.metadata = o.metadata ?? {};
        o.metadata.labels = o.metadata.labels ?? {};
        const labels = o.metadata.labels as Record<string, unknown>;
        const defaults: Record<string, string> = {
          'helm.sh/chart': '{{ .Chart.Name }}-{{ .Chart.Version }}',
          'app.kubernetes.io/name': include('timonel.name'),
          'app.kubernetes.io/instance': helm.releaseName,
          'app.kubernetes.io/version': helm.chartVersion,
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'app.kubernetes.io/part-of': helm.chartName,
        };
        for (const [k, v] of Object.entries(defaults)) {
          if (labels[k] === undefined) labels[k] = v;
        }
      }
      return obj as Record<string, unknown>;
    });

    const combinedYaml = enriched
      .map((obj) => YAML.stringify(obj).trim())
      .filter(Boolean)
      .map((y) => `---\n${y}`)
      .join('\n');
    this.assets.length = 0;
    this.assets.push({ id: 'manifests', yaml: combinedYaml });

    const options: HelmChartWriteOptions = {
      outDir,
      meta: this.props.meta,
      defaultValues: this.props.defaultValues,
      envValues: this.props.envValues,
      assets: this.assets,
      ...(this.props.helpersTpl !== undefined
        ? { helpersTpl: this.props.helpersTpl }
        : {
            helpersTpl: [
              {
                name: 'timonel.name',
                body: '{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}',
              },
              {
                name: 'timonel.fullname',
                body:
                  '{{- if .Values.fullnameOverride -}}\n' +
                  '{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}\n' +
                  '{{- else -}}\n' +
                  '{{- printf "%s-%s" .Chart.Name .Release.Name | trunc 63 | trimSuffix "-" -}}\n' +
                  '{{- end -}}',
              },
              {
                name: 'timonel.chart',
                body: '{{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}',
              },
              {
                name: 'timonel.labels',
                body:
                  'helm.sh/chart: {{ include "timonel.chart" . }}\n' +
                  'app.kubernetes.io/name: {{ include "timonel.name" . }}\n' +
                  'app.kubernetes.io/instance: {{ .Release.Name }}\n' +
                  'app.kubernetes.io/version: {{ .Chart.Version }}\n' +
                  'app.kubernetes.io/managed-by: {{ .Release.Service }}\n' +
                  'app.kubernetes.io/part-of: {{ .Chart.Name }}',
              },
              {
                name: 'timonel.selectorLabels',
                body:
                  'app.kubernetes.io/name: {{ include "timonel.name" . }}\n' +
                  'app.kubernetes.io/instance: {{ .Release.Name }}',
              },
            ],
          }),
    } as HelmChartWriteOptions;
    HelmChartWriter.write(options);
  }
}
