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

export interface HttpHeader {
  name: string;
  value: string;
}
export interface HttpGetAction {
  path?: string;
  port: number | string;
  scheme?: 'HTTP' | 'HTTPS';
  httpHeaders?: HttpHeader[];
}
export interface ExecAction {
  command: string[];
}
export interface TcpSocketAction {
  port: number | string;
}
export interface Probe {
  httpGet?: HttpGetAction;
  exec?: ExecAction;
  tcpSocket?: TcpSocketAction;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
}

export interface EnvFromSource {
  configMapRef?: string;
  secretRef?: string;
}
export interface VolumeSourceSpec {
  name: string;
  configMap?: string;
  secret?: string;
  persistentVolumeClaim?: string;
}
export interface VolumeMountSpec {
  name: string;
  mountPath: string;
  readOnly?: boolean;
  subPath?: string;
}
export interface ResourceRequirements {
  limits?: { cpu?: string; memory?: string };
  requests?: { cpu?: string; memory?: string };
}

export interface DeploymentSpec {
  name: string;
  image: string;
  replicas?: number;
  containerPort?: number;
  env?: Record<string, string>;
  envFrom?: EnvFromSource[];
  volumes?: VolumeSourceSpec[];
  volumeMounts?: VolumeMountSpec[];
  resources?: ResourceRequirements;
  livenessProbe?: Probe;
  readinessProbe?: Probe;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  serviceAccountName?: string;
  matchLabels?: Record<string, string>;
}

export interface ReplicaSetSpec {
  name: string;
  image: string;
  replicas?: number;
  containerPort?: number;
  env?: Record<string, string>;
  matchLabels?: Record<string, string>;
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

export interface ConfigMapSpec {
  name: string;
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
  immutable?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretSpec {
  name: string;
  type?: string; // e.g., Opaque (default), kubernetes.io/dockerconfigjson, kubernetes.io/tls
  stringData?: Record<string, string>; // unencoded strings (kube encodes to data)
  data?: Record<string, string>; // base64-encoded values
}

export interface ServiceAccountSpec {
  name: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: string[]; // names of Secrets
  secrets?: string[]; // names of Secrets to mount as tokens/files
  /**
   * EKS IRSA support: if set, adds annotation eks.amazonaws.com/role-arn
   * Example: arn:aws:iam::<account-id>:role/<role-name>
   */
  awsRoleArn?: string;
  /**
   * Optional custom audience for IRSA (default is sts.amazonaws.com)
   * Adds annotation eks.amazonaws.com/audience when provided.
   */
  awsAudience?: string;
}

export interface ChartFactoryProps {
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  /** Optional Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
  /** Optional NOTES.txt content */
  notesTpl?: string;
  /** Optional values.schema.json object */
  valuesSchema?: Record<string, unknown>;
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

  private static readonly LABEL_NAME = 'app.kubernetes.io/name';
  private static readonly LABEL_INSTANCE = 'app.kubernetes.io/instance';
  private static readonly LABEL_VERSION = 'app.kubernetes.io/version';
  private static readonly HELPER_NAME = 'timonel.name';

  addDeployment(spec: DeploymentSpec) {
    const match = spec.matchLabels ?? {
      [ChartFactory.LABEL_NAME]: include(ChartFactory.HELPER_NAME),
      [ChartFactory.LABEL_INSTANCE]: helm.releaseName,
    };

    const envEntries = spec.env
      ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
      : undefined;
    const envFromEntries = spec.envFrom
      ? spec.envFrom.map((s) => ({
          configMapRef: s.configMapRef ? { name: s.configMapRef } : undefined,
          secretRef: s.secretRef ? { name: s.secretRef } : undefined,
        }))
      : undefined;
    const volumeDefs = spec.volumes
      ? spec.volumes.map((v) => ({
          name: v.name,
          configMap: v.configMap ? { name: v.configMap } : undefined,
          secret: v.secret ? { secretName: v.secret } : undefined,
          persistentVolumeClaim: v.persistentVolumeClaim
            ? { claimName: v.persistentVolumeClaim }
            : undefined,
        }))
      : undefined;
    const volumeMountDefs = spec.volumeMounts
      ? spec.volumeMounts.map((m) => ({
          name: m.name,
          mountPath: m.mountPath,
          readOnly: m.readOnly,
          subPath: m.subPath,
        }))
      : undefined;

    const dep = new ApiObject(this.chart, spec.name, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: spec.name },
      spec: {
        replicas: spec.replicas ?? 1,
        selector: { matchLabels: match },
        template: {
          metadata: { labels: match },
          spec: {
            serviceAccountName: spec.serviceAccountName,
            volumes: volumeDefs,
            containers: [
              {
                name: spec.name,
                image: spec.image,
                imagePullPolicy: spec.imagePullPolicy,
                ports: spec.containerPort ? [{ containerPort: spec.containerPort }] : undefined,
                env: envEntries,
                envFrom: envFromEntries,
                volumeMounts: volumeMountDefs,
                resources: spec.resources,
                livenessProbe: spec.livenessProbe,
                readinessProbe: spec.readinessProbe,
              },
            ],
          },
        },
      },
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

  addReplicaSet(spec: ReplicaSetSpec) {
    const match = spec.matchLabels ?? {
      [ChartFactory.LABEL_NAME]: include(ChartFactory.HELPER_NAME),
      [ChartFactory.LABEL_INSTANCE]: helm.releaseName,
    };
    const rs = new ApiObject(this.chart, spec.name, {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: { name: spec.name },
      spec: {
        replicas: spec.replicas ?? 1,
        selector: { matchLabels: match },
        template: {
          metadata: { labels: match },
          spec: {
            containers: [
              {
                name: spec.name,
                image: spec.image,
                ports: spec.containerPort ? [{ containerPort: spec.containerPort }] : undefined,
                env: spec.env && Object.entries(spec.env).map(([name, value]) => ({ name, value })),
              },
            ],
          },
        },
      },
    });
    this.capture(rs, `${spec.name}-replicaset`);
    return rs;
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

  addConfigMap(spec: ConfigMapSpec) {
    const cm = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      data: spec.data,
      binaryData: spec.binaryData,
      immutable: spec.immutable,
    });
    this.capture(cm, `${spec.name}-configmap`);
    return cm;
  }

  addSecret(spec: SecretSpec) {
    const sec = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: spec.name },
      type: spec.type ?? 'Opaque',
      stringData: spec.stringData,
      data: spec.data,
    });
    this.capture(sec, `${spec.name}-secret`);
    return sec;
  }

  addServiceAccount(spec: ServiceAccountSpec) {
    const ann: Record<string, string> = {
      ...(spec.annotations ?? {}),
      ...(spec.awsRoleArn ? { 'eks.amazonaws.com/role-arn': spec.awsRoleArn } : {}),
      ...(spec.awsAudience ? { 'eks.amazonaws.com/audience': spec.awsAudience } : {}),
    };

    const sa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        ...(Object.keys(ann).length ? { annotations: ann } : {}),
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      automountServiceAccountToken: spec.automountServiceAccountToken,
      imagePullSecrets: spec.imagePullSecrets?.map((n) => ({ name: n })),
      secrets: spec.secrets?.map((n) => ({ name: n })),
    });
    this.capture(sa, `${spec.name}-serviceaccount`);
    return sa;
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
   * Add a raw CRD manifest to the chart (written under crds/).
   */
  addCrd(yaml: string, id = 'crd') {
    this.assets.push({ id, yaml, target: 'crds' });
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
          'app.kubernetes.io/name': include(ChartFactory.HELPER_NAME),
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
      ...(this.props.notesTpl !== undefined ? { notesTpl: this.props.notesTpl } : {}),
      ...(this.props.valuesSchema !== undefined ? { valuesSchema: this.props.valuesSchema } : {}),
    } as HelmChartWriteOptions;
    HelmChartWriter.write(options);
  }
}
