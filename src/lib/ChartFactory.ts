import { App, Chart, Testing, ApiObject } from 'cdk8s';
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

export type AccessMode = 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod';
export type VolumeMode = 'Filesystem' | 'Block';
export type ReclaimPolicy = 'Retain' | 'Recycle' | 'Delete';

export interface CsiVolumeSource {
  driver: string;
  volumeHandle: string;
  fsType?: string;
  readOnly?: boolean;
  volumeAttributes?: Record<string, string>;
}

export interface NfsVolumeSource {
  server: string;
  path: string;
  readOnly?: boolean;
}

export interface AwsElasticBlockStoreSource {
  volumeID: string;
  fsType?: string;
  partition?: number;
  readOnly?: boolean;
}

export interface HostPathSource {
  path: string;
  type?: string;
}

export interface PersistentVolumeSourceSpec {
  csi?: CsiVolumeSource;
  nfs?: NfsVolumeSource;
  awsElasticBlockStore?: AwsElasticBlockStoreSource;
  hostPath?: HostPathSource;
  azureDisk?: {
    diskName: string;
    diskURI: string;
    cachingMode?: string;
    fsType?: string;
    readOnly?: boolean;
  };
  azureFile?: { secretName: string; shareName: string; readOnly?: boolean };
  gcePersistentDisk?: { pdName: string; fsType?: string; partition?: number; readOnly?: boolean };
  // Allow custom volume sources
  [key: string]: unknown;
}

export interface PersistentVolumeSpec {
  name: string;
  capacity: string; // e.g., '10Gi'
  accessModes: AccessMode[];
  storageClassName?: string;
  volumeMode?: VolumeMode;
  reclaimPolicy?: ReclaimPolicy;
  mountOptions?: string[];
  nodeAffinity?: Record<string, unknown>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  source: PersistentVolumeSourceSpec;
  /** Reference to related PVC for binding */
  claimRef?: { name: string; namespace?: string };
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
  /** Optional extra labels on the Deployment metadata */
  labels?: Record<string, string>;
  /** Optional annotations on the Deployment metadata */
  annotations?: Record<string, string>;
  /** Optional extra labels on the pod template (merged with matchLabels) */
  podLabels?: Record<string, string>;
  /** Optional annotations on the pod template (useful for reloaders, etc.) */
  podAnnotations?: Record<string, string>;
}

export interface ReplicaSetSpec {
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
  /** Optional extra labels on the ReplicaSet metadata */
  labels?: Record<string, string>;
  /** Optional annotations on the ReplicaSet metadata */
  annotations?: Record<string, string>;
  /** Optional extra labels on the pod template (merged with matchLabels) */
  podLabels?: Record<string, string>;
  /** Optional annotations on the pod template (useful for reloaders, etc.) */
  podAnnotations?: Record<string, string>;
}

export interface ServiceSpec {
  name: string;
  ports: Array<{
    port: number;
    targetPort?: number;
    protocol?: 'TCP' | 'UDP' | 'SCTP';
    name?: string;
    nodePort?: number;
  }>;
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector?: Record<string, string>;
  clusterIP?: string;
  externalName?: string;
  sessionAffinity?: 'None' | 'ClientIP';
  loadBalancerIP?: string;
  loadBalancerSourceRanges?: string[];
  loadBalancerClass?: string;
  externalTrafficPolicy?: 'Cluster' | 'Local';
  internalTrafficPolicy?: 'Cluster' | 'Local';
  ipFamilyPolicy?: 'SingleStack' | 'PreferDualStack' | 'RequireDualStack';
  ipFamilies?: Array<'IPv4' | 'IPv6'>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
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
  immutable?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PersistentVolumeClaimSpec {
  name: string;
  accessModes: AccessMode[];
  resources: { requests: { storage: string } };
  storageClassName?: string;
  volumeMode?: VolumeMode;
  selector?: { matchLabels?: Record<string, string>; matchExpressions?: unknown[] };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  /** Reference to specific PV for static binding */
  volumeName?: string;
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
  /**
   * AKS Workload Identity: Azure application client ID.
   * Adds annotation azure.workload.identity/client-id when provided.
   */
  azureClientId?: string;
  /**
   * AKS Workload Identity: Azure tenant ID.
   * Adds annotation azure.workload.identity/tenant-id when provided.
   */
  azureTenantId?: string;
  /**
   * AKS Workload Identity: projected SA token expiration (seconds).
   * Adds annotation azure.workload.identity/service-account-token-expiration.
   */
  azureServiceAccountTokenExpiration?: number;
  /**
   * GKE Workload Identity: Google service account email.
   * Adds annotation iam.gke.io/gcp-service-account when provided.
   */
  gcpServiceAccountEmail?: string;
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

    const templateLabels = { ...match, ...(spec.podLabels ?? {}) };

    const dep = new ApiObject(this.chart, spec.name, {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        replicas: spec.replicas ?? 1,
        selector: { matchLabels: match },
        template: {
          metadata: {
            labels: templateLabels,
            ...(spec.podAnnotations ? { annotations: spec.podAnnotations } : {}),
          },
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
    const svc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        type: spec.type ?? 'ClusterIP',
        selector: spec.selector,
        ports: spec.ports.map((p) => ({
          port: p.port,
          targetPort: p.targetPort ?? p.port,
          protocol: p.protocol ?? 'TCP',
          name: p.name,
          nodePort: p.nodePort,
        })),
        clusterIP: spec.clusterIP,
        externalName: spec.externalName,
        sessionAffinity: spec.sessionAffinity,
        loadBalancerIP: spec.loadBalancerIP,
        loadBalancerSourceRanges: spec.loadBalancerSourceRanges,
        loadBalancerClass: spec.loadBalancerClass,
        externalTrafficPolicy: spec.externalTrafficPolicy,
        internalTrafficPolicy: spec.internalTrafficPolicy,
        ipFamilyPolicy: spec.ipFamilyPolicy,
        ipFamilies: spec.ipFamilies,
      },
    });
    this.capture(svc, `${spec.name}-service`);
    return svc;
  }

  addReplicaSet(spec: ReplicaSetSpec) {
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

    const templateLabels = { ...match, ...(spec.podLabels ?? {}) };

    const rs = new ApiObject(this.chart, spec.name, {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        replicas: spec.replicas ?? 1,
        selector: { matchLabels: match },
        template: {
          metadata: {
            labels: templateLabels,
            ...(spec.podAnnotations ? { annotations: spec.podAnnotations } : {}),
          },
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

  addPersistentVolume(spec: PersistentVolumeSpec) {
    const pvSpec: Record<string, unknown> = {
      capacity: { storage: spec.capacity },
      accessModes: spec.accessModes,
      storageClassName: spec.storageClassName,
      volumeMode: spec.volumeMode,
      persistentVolumeReclaimPolicy: spec.reclaimPolicy,
      mountOptions: spec.mountOptions,
      nodeAffinity: spec.nodeAffinity,
      claimRef: spec.claimRef,
    };

    // Handle known volume sources
    const knownSources = [
      'csi',
      'nfs',
      'awsElasticBlockStore',
      'hostPath',
      'azureDisk',
      'azureFile',
      'gcePersistentDisk',
    ];
    for (const sourceType of knownSources) {
      if (spec.source[sourceType]) {
        pvSpec[sourceType] = spec.source[sourceType];
      }
    }

    // Handle custom volume sources
    for (const [key, value] of Object.entries(spec.source)) {
      if (!knownSources.includes(key) && value !== undefined) {
        pvSpec[key] = value;
      }
    }

    const pv = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: pvSpec,
    });
    this.capture(pv, `${spec.name}-pv`);
    return pv;
  }

  addPersistentVolumeClaim(spec: PersistentVolumeClaimSpec) {
    const pvc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        accessModes: spec.accessModes,
        resources: spec.resources,
        storageClassName: spec.storageClassName,
        volumeMode: spec.volumeMode,
        selector: spec.selector,
        volumeName: spec.volumeName,
      },
    });
    this.capture(pvc, `${spec.name}-pvc`);
    return pvc;
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
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      type: spec.type ?? 'Opaque',
      stringData: spec.stringData,
      data: spec.data,
      immutable: spec.immutable,
    });
    this.capture(sec, `${spec.name}-secret`);
    return sec;
  }

  addServiceAccount(spec: ServiceAccountSpec) {
    const ann: Record<string, string> = {
      ...(spec.annotations ?? {}),
      ...(spec.awsRoleArn ? { 'eks.amazonaws.com/role-arn': spec.awsRoleArn } : {}),
      ...(spec.awsAudience ? { 'eks.amazonaws.com/audience': spec.awsAudience } : {}),
      ...(spec.azureClientId ? { 'azure.workload.identity/client-id': spec.azureClientId } : {}),
      ...(spec.azureTenantId ? { 'azure.workload.identity/tenant-id': spec.azureTenantId } : {}),
      ...(spec.azureServiceAccountTokenExpiration !== undefined
        ? {
            'azure.workload.identity/service-account-token-expiration': String(
              spec.azureServiceAccountTokenExpiration,
            ),
          }
        : {}),
      ...(spec.gcpServiceAccountEmail
        ? { 'iam.gke.io/gcp-service-account': spec.gcpServiceAccountEmail }
        : {}),
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
