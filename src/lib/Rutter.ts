/**
 * @fileoverview Rutter - Main class for building Kubernetes manifests and Helm charts
 * @since 1.0.0
 */

import { App, Chart, Testing, ApiObject } from 'cdk8s';
import YAML from 'yaml';

import { include, helm } from './helm.js';
import { HelmChartWriter } from './HelmChartWriter.js';
import { SecurityUtils } from './security.js';
import type {
  HelmChartMeta,
  HelmChartWriteOptions,
  SynthAsset,
  HelperDefinition,
} from './HelmChartWriter.js';

/**
 * HTTP header for health probes
 *
 * @interface HttpHeader
 * @since 0.1.0
 */
export interface HttpHeader {
  /** Header name */
  name: string;
  /** Header value */
  value: string;
}

/**
 * HTTP GET action for health probes
 *
 * @interface HttpGetAction
 * @since 0.1.0
 */
export interface HttpGetAction {
  /** HTTP path to probe */
  path?: string;
  /** Port number or name */
  port: number | string;
  /** HTTP or HTTPS scheme */
  scheme?: 'HTTP' | 'HTTPS';
  /** Additional HTTP headers */
  httpHeaders?: HttpHeader[];
}

/**
 * Exec action for health probes
 *
 * @interface ExecAction
 * @since 0.1.0
 */
export interface ExecAction {
  /** Command to execute */
  command: string[];
}

/**
 * TCP socket action for health probes
 *
 * @interface TcpSocketAction
 * @since 0.1.0
 */
export interface TcpSocketAction {
  /** Port number or name */
  port: number | string;
}

/**
 * Kubernetes probe configuration
 *
 * @interface Probe
 * @since 0.1.0
 */
export interface Probe {
  /** HTTP GET probe */
  httpGet?: HttpGetAction;
  /** Exec probe */
  exec?: ExecAction;
  /** TCP socket probe */
  tcpSocket?: TcpSocketAction;
  /** Initial delay before probing */
  initialDelaySeconds?: number;
  /** Probe frequency */
  periodSeconds?: number;
  /** Probe timeout */
  timeoutSeconds?: number;
  /** Success threshold */
  successThreshold?: number;
  /** Failure threshold */
  failureThreshold?: number;
}

/**
 * Environment variable source from ConfigMap or Secret
 *
 * @interface EnvFromSource
 * @since 0.1.0
 */
export interface EnvFromSource {
  /** ConfigMap reference */
  configMapRef?: string;
  /** Secret reference */
  secretRef?: string;
}

/**
 * Volume source specification
 *
 * @interface VolumeSourceSpec
 * @since 0.1.0
 */
export interface VolumeSourceSpec {
  /** Volume name */
  name: string;
  /** ConfigMap volume source */
  configMap?: string;
  /** Secret volume source */
  secret?: string;
  /** PersistentVolumeClaim source */
  persistentVolumeClaim?: string;
}

/**
 * Volume mount specification
 *
 * @interface VolumeMountSpec
 * @since 0.1.0
 */
export interface VolumeMountSpec {
  /** Volume name to mount */
  name: string;
  /** Mount path in container */
  mountPath: string;
  /** Mount as read-only */
  readOnly?: boolean;
  /** Sub-path within volume */
  subPath?: string;
}

/**
 * Kubernetes resource requirements
 *
 * @interface ResourceRequirements
 * @since 0.1.0
 */
export interface ResourceRequirements {
  /** Resource limits */
  limits?: { cpu?: string; memory?: string };
  /** Resource requests */
  requests?: { cpu?: string; memory?: string };
}

/**
 * Kubernetes PersistentVolume access modes
 *
 * @typedef {string} AccessMode
 * @since 1.0.0
 */
export type AccessMode = 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod';

/**
 * Kubernetes volume modes
 *
 * @typedef {string} VolumeMode
 * @since 1.0.0
 */
export type VolumeMode = 'Filesystem' | 'Block';

/**
 * Kubernetes PersistentVolume reclaim policies
 *
 * @typedef {string} ReclaimPolicy
 * @since 1.0.0
 */
export type ReclaimPolicy = 'Retain' | 'Recycle' | 'Delete';

/**
 * CSI volume source specification
 *
 * @interface CsiVolumeSource
 * @since 1.0.0
 */
export interface CsiVolumeSource {
  /** CSI driver name */
  driver: string;
  /** Volume handle */
  volumeHandle: string;
  /** Filesystem type */
  fsType?: string;
  /** Read-only volume */
  readOnly?: boolean;
  /** Volume attributes */
  volumeAttributes?: Record<string, string>;
  /** Controller publish secret reference */
  controllerPublishSecretRef?: { name: string; namespace?: string };
  /** Node stage secret reference */
  nodeStageSecretRef?: { name: string; namespace?: string };
  /** Node publish secret reference */
  nodePublishSecretRef?: { name: string; namespace?: string };
  /** Controller expand secret reference */
  controllerExpandSecretRef?: { name: string; namespace?: string };
}

/**
 * NFS volume source specification
 *
 * @interface NfsVolumeSource
 * @since 1.0.0
 */
export interface NfsVolumeSource {
  /** NFS server */
  server: string;
  /** NFS path */
  path: string;
  /** Read-only mount */
  readOnly?: boolean;
}

/**
 * AWS Elastic Block Store volume source
 *
 * @interface AwsElasticBlockStoreSource
 * @since 1.0.0
 */
export interface AwsElasticBlockStoreSource {
  /** EBS volume ID */
  volumeID: string;
  /** Filesystem type */
  fsType?: string;
  /** Partition number */
  partition?: number;
  /** Read-only volume */
  readOnly?: boolean;
}

/**
 * Host path volume source
 *
 * @interface HostPathSource
 * @since 1.0.0
 */
export interface HostPathSource {
  /** Host path */
  path: string;
  /** Path type */
  type?: string;
}

/**
 * PersistentVolume source specification
 *
 * @interface PersistentVolumeSourceSpec
 * @since 1.0.0
 */
export interface PersistentVolumeSourceSpec {
  /** CSI volume source */
  csi?: CsiVolumeSource;
  /** NFS volume source */
  nfs?: NfsVolumeSource;
  /** AWS EBS volume source */
  awsElasticBlockStore?: AwsElasticBlockStoreSource;
  /** Host path volume source */
  hostPath?: HostPathSource;
  /** Azure Disk volume source */
  azureDisk?: {
    /** Disk name */
    diskName: string;
    /** Disk URI */
    diskURI: string;
    /** Caching mode */
    cachingMode?: 'None' | 'ReadOnly' | 'ReadWrite';
    /** Filesystem type */
    fsType?: string;
    /** Read-only disk */
    readOnly?: boolean;
    /** Disk kind */
    kind?: 'Shared' | 'Dedicated' | 'Managed';
  };
  /** Azure File volume source */
  azureFile?: {
    /** Secret name */
    secretName: string;
    /** Share name */
    shareName: string;
    /** Read-only file */
    readOnly?: boolean;
    /** Secret namespace */
    secretNamespace?: string;
  };
  /** GCE Persistent Disk volume source */
  gcePersistentDisk?: {
    /** Persistent disk name */
    pdName: string;
    /** Filesystem type */
    fsType?: string;
    /** Partition number */
    partition?: number;
    /** Read-only disk */
    readOnly?: boolean;
  };
  /** Custom volume sources */
  [key: string]: unknown;
}

/**
 * Kubernetes PersistentVolume specification
 *
 * @interface PersistentVolumeSpec
 * @since 1.0.0
 */
export interface PersistentVolumeSpec {
  /** PersistentVolume name */
  name: string;
  /** Storage capacity (e.g., '10Gi') */
  capacity: string;
  /** Access modes */
  accessModes: AccessMode[];
  /** Storage class name */
  storageClassName?: string;
  /** Volume mode */
  volumeMode?: VolumeMode;
  /** Reclaim policy */
  reclaimPolicy?: ReclaimPolicy;
  /** Mount options */
  mountOptions?: string[];
  /** Node affinity */
  nodeAffinity?: Record<string, unknown>;
  /** PersistentVolume labels */
  labels?: Record<string, string>;
  /** PersistentVolume annotations */
  annotations?: Record<string, string>;
  /** Volume source */
  source: PersistentVolumeSourceSpec;
  /** Reference to related PVC for binding */
  claimRef?: { name: string; namespace?: string };
  /** Cloud provider for optimized defaults */
  cloudProvider?: 'aws' | 'azure' | 'gcp';
}

/**
 * Kubernetes Deployment specification
 *
 * @interface DeploymentSpec
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const deployment: DeploymentSpec = {
 *   name: 'web-app',
 *   image: 'nginx:1.21',
 *   replicas: 3,
 *   containerPort: 80,
 *   env: { NODE_ENV: 'production' }
 * };
 * ```
 */
export interface DeploymentSpec {
  /** Deployment name */
  name: string;
  /** Container image */
  image: string;
  /** Number of replicas */
  replicas?: number;
  /** Container port */
  containerPort?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment from ConfigMap/Secret */
  envFrom?: EnvFromSource[];
  /** Volume sources */
  volumes?: VolumeSourceSpec[];
  /** Volume mounts */
  volumeMounts?: VolumeMountSpec[];
  /** Resource requirements */
  resources?: ResourceRequirements;
  /** Liveness probe */
  livenessProbe?: Probe;
  /** Readiness probe */
  readinessProbe?: Probe;
  /** Image pull policy */
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  /** Service account name */
  serviceAccountName?: string;
  /** Pod selector labels */
  matchLabels?: Record<string, string>;
  /** Deployment metadata labels */
  labels?: Record<string, string>;
  /** Deployment metadata annotations */
  annotations?: Record<string, string>;
  /** Pod template labels */
  podLabels?: Record<string, string>;
  /** Pod template annotations */
  podAnnotations?: Record<string, string>;
}

/**
 * Kubernetes ReplicaSet specification
 *
 * @interface ReplicaSetSpec
 * @since 1.0.0
 */
export interface ReplicaSetSpec {
  /** ReplicaSet name */
  name: string;
  /** Container image */
  image: string;
  /** Number of replicas */
  replicas?: number;
  /** Container port */
  containerPort?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment from ConfigMap/Secret */
  envFrom?: EnvFromSource[];
  /** Volume sources */
  volumes?: VolumeSourceSpec[];
  /** Volume mounts */
  volumeMounts?: VolumeMountSpec[];
  /** Resource requirements */
  resources?: ResourceRequirements;
  /** Liveness probe */
  livenessProbe?: Probe;
  /** Readiness probe */
  readinessProbe?: Probe;
  /** Image pull policy */
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  /** Service account name */
  serviceAccountName?: string;
  /** Pod selector labels */
  matchLabels?: Record<string, string>;
  /** ReplicaSet metadata labels */
  labels?: Record<string, string>;
  /** ReplicaSet metadata annotations */
  annotations?: Record<string, string>;
  /** Pod template labels */
  podLabels?: Record<string, string>;
  /** Pod template annotations */
  podAnnotations?: Record<string, string>;
}

/**
 * Kubernetes Job specification
 *
 * @interface JobSpec
 * @since 2.1.0
 */
export interface JobSpec {
  /** Job name */
  name: string;
  /** Container image */
  image: string;
  /** Command to run */
  command?: string[];
  /** Arguments to command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment from ConfigMap/Secret */
  envFrom?: EnvFromSource[];
  /** Volume sources */
  volumes?: VolumeSourceSpec[];
  /** Volume mounts */
  volumeMounts?: VolumeMountSpec[];
  /** Resource requirements */
  resources?: ResourceRequirements;
  /** Restart policy */
  restartPolicy?: 'Never' | 'OnFailure';
  /** Backoff limit for retries */
  backoffLimit?: number;
  /** Active deadline in seconds */
  activeDeadlineSeconds?: number;
  /** TTL after finished in seconds */
  ttlSecondsAfterFinished?: number;
  /** Number of completions */
  completions?: number;
  /** Parallelism level */
  parallelism?: number;
  /** Completion mode */
  completionMode?: 'NonIndexed' | 'Indexed';
  /** Suspend job execution */
  suspend?: boolean;
  /** Image pull policy */
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  /** Service account name */
  serviceAccountName?: string;
  /** Job metadata labels */
  labels?: Record<string, string>;
  /** Job metadata annotations */
  annotations?: Record<string, string>;
  /** Pod template labels */
  podLabels?: Record<string, string>;
  /** Pod template annotations */
  podAnnotations?: Record<string, string>;
}

/**
 * Kubernetes CronJob specification
 *
 * @interface CronJobSpec
 * @since 2.1.0
 */
export interface CronJobSpec {
  /** CronJob name */
  name: string;
  /** Cron schedule expression */
  schedule: string;
  /** Container image */
  image: string;
  /** Command to run */
  command?: string[];
  /** Arguments to command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Environment from ConfigMap/Secret */
  envFrom?: EnvFromSource[];
  /** Volume sources */
  volumes?: VolumeSourceSpec[];
  /** Volume mounts */
  volumeMounts?: VolumeMountSpec[];
  /** Resource requirements */
  resources?: ResourceRequirements;
  /** Restart policy */
  restartPolicy?: 'Never' | 'OnFailure';
  /** Backoff limit for retries */
  backoffLimit?: number;
  /** Active deadline in seconds */
  activeDeadlineSeconds?: number;
  /** TTL after finished in seconds */
  ttlSecondsAfterFinished?: number;
  /** Number of completions */
  completions?: number;
  /** Parallelism level */
  parallelism?: number;
  /** Completion mode */
  completionMode?: 'NonIndexed' | 'Indexed';
  /** Suspend job execution */
  suspend?: boolean;
  /** Starting deadline in seconds */
  startingDeadlineSeconds?: number;
  /** Concurrency policy */
  concurrencyPolicy?: 'Allow' | 'Forbid' | 'Replace';
  /** Successful jobs history limit */
  successfulJobsHistoryLimit?: number;
  /** Failed jobs history limit */
  failedJobsHistoryLimit?: number;
  /** Time zone */
  timeZone?: string;
  /** Image pull policy */
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  /** Service account name */
  serviceAccountName?: string;
  /** CronJob metadata labels */
  labels?: Record<string, string>;
  /** CronJob metadata annotations */
  annotations?: Record<string, string>;
  /** Pod template labels */
  podLabels?: Record<string, string>;
  /** Pod template annotations */
  podAnnotations?: Record<string, string>;
}

/**
 * Kubernetes Service specification
 *
 * @interface ServiceSpec
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const service: ServiceSpec = {
 *   name: 'web-service',
 *   ports: [{ port: 80, targetPort: 8080 }],
 *   type: 'LoadBalancer'
 * };
 * ```
 */
export interface ServiceSpec {
  /** Service name */
  name: string;
  /** Service ports */
  ports: Array<{
    /** Service port */
    port: number;
    /** Target port on pods */
    targetPort?: number;
    /** Protocol */
    protocol?: 'TCP' | 'UDP' | 'SCTP';
    /** Port name */
    name?: string;
    /** NodePort (for NodePort/LoadBalancer) */
    nodePort?: number;
  }>;
  /** Service type */
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  /** Pod selector */
  selector?: Record<string, string>;
  /** Cluster IP */
  clusterIP?: string;
  /** External name (for ExternalName type) */
  externalName?: string;
  /** Session affinity */
  sessionAffinity?: 'None' | 'ClientIP';
  /** Load balancer IP */
  loadBalancerIP?: string;
  /** Load balancer source ranges */
  loadBalancerSourceRanges?: string[];
  /** Load balancer class */
  loadBalancerClass?: string;
  /** External traffic policy */
  externalTrafficPolicy?: 'Cluster' | 'Local';
  /** Internal traffic policy */
  internalTrafficPolicy?: 'Cluster' | 'Local';
  /** IP family policy */
  ipFamilyPolicy?: 'SingleStack' | 'PreferDualStack' | 'RequireDualStack';
  /** IP families */
  ipFamilies?: Array<'IPv4' | 'IPv6'>;
  /** Service labels */
  labels?: Record<string, string>;
  /** Service annotations */
  annotations?: Record<string, string>;
}

/**
 * Kubernetes Ingress rule specification
 *
 * @interface IngressRule
 * @since 1.0.0
 */
export interface IngressRule {
  /** Host name */
  host?: string;
  /** Path rules */
  paths: Array<{
    /** URL path */
    path: string;
    /** Path matching type */
    pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
    /** Backend service */
    backend: {
      service: { name: string; port: { number?: number; name?: string } };
    };
  }>;
}

/**
 * Kubernetes Ingress TLS specification
 *
 * @interface IngressTLS
 * @since 1.0.0
 */
export interface IngressTLS {
  /** TLS hosts */
  hosts?: string[];
  /** Secret name containing TLS certificate */
  secretName?: string;
}

/**
 * Kubernetes Ingress specification
 *
 * @interface IngressSpec
 * @since 1.0.0
 */
export interface IngressSpec {
  /** Ingress name */
  name: string;
  /** Ingress rules */
  rules: IngressRule[];
  /** TLS configuration */
  tls?: IngressTLS[];
  /** Ingress class name */
  ingressClassName?: string;
  /** Default backend */
  defaultBackend?: {
    service: { name: string; port: { number?: number; name?: string } };
  };
  /** Ingress labels */
  labels?: Record<string, string>;
  /** Ingress annotations */
  annotations?: Record<string, string>;
}

/**
 * Kubernetes ConfigMap specification
 *
 * @interface ConfigMapSpec
 * @since 1.0.0
 */
export interface ConfigMapSpec {
  /** ConfigMap name */
  name: string;
  /** String data */
  data?: Record<string, string>;
  /** Binary data */
  binaryData?: Record<string, string>;
  /** Immutable ConfigMap */
  immutable?: boolean;
  /** ConfigMap labels */
  labels?: Record<string, string>;
  /** ConfigMap annotations */
  annotations?: Record<string, string>;
}

/**
 * Kubernetes Secret specification
 *
 * @interface SecretSpec
 * @since 1.0.0
 */
export interface SecretSpec {
  /** Secret name */
  name: string;
  /** Secret type */
  type?: string;
  /** String data (unencoded) */
  stringData?: Record<string, string>;
  /** Base64-encoded data */
  data?: Record<string, string>;
  /** Immutable Secret */
  immutable?: boolean;
  /** Secret labels */
  labels?: Record<string, string>;
  /** Secret annotations */
  annotations?: Record<string, string>;
}

/**
 * Kubernetes PersistentVolumeClaim specification
 *
 * @interface PersistentVolumeClaimSpec
 * @since 1.0.0
 */
export interface PersistentVolumeClaimSpec {
  /** PersistentVolumeClaim name */
  name: string;
  /** Access modes */
  accessModes: AccessMode[];
  /** Resource requirements */
  resources: { requests: { storage: string }; limits?: { storage: string } };
  /** Storage class name */
  storageClassName?: string;
  /** Volume mode */
  volumeMode?: VolumeMode;
  /** Volume selector */
  selector?: { matchLabels?: Record<string, string>; matchExpressions?: unknown[] };
  /** PersistentVolumeClaim labels */
  labels?: Record<string, string>;
  /** PersistentVolumeClaim annotations */
  annotations?: Record<string, string>;
  /** Reference to specific PV for static binding */
  volumeName?: string;
  /** Cloud provider for optimized defaults */
  cloudProvider?: 'aws' | 'azure' | 'gcp';
}

/**
 * Kubernetes ServiceAccount specification with multi-cloud workload identity support
 *
 * @interface ServiceAccountSpec
 * @since 1.0.0
 */
export interface ServiceAccountSpec {
  /** ServiceAccount name */
  name: string;
  /** ServiceAccount annotations */
  annotations?: Record<string, string>;
  /** ServiceAccount labels */
  labels?: Record<string, string>;
  /** Automount service account token */
  automountServiceAccountToken?: boolean;
  /** Image pull secrets */
  imagePullSecrets?: string[];
  /** Secrets to mount */
  secrets?: string[];
  /** EKS IRSA: IAM role ARN */
  awsRoleArn?: string;
  /** IRSA audience for token validation */
  awsAudience?: string;
  /** AWS STS endpoint type */
  awsStsEndpointType?: 'regional' | 'legacy';
  /** AWS region for regional STS endpoint */
  awsRegion?: string;
  /** Token expiration time in seconds */
  awsTokenExpiration?: number;
  /** AKS Workload Identity: Azure client ID */
  azureClientId?: string;
  /** AKS Workload Identity: Azure tenant ID */
  azureTenantId?: string;
  /** AKS Workload Identity: token expiration */
  azureServiceAccountTokenExpiration?: number;
  /** GKE Workload Identity: service account email */
  gcpServiceAccountEmail?: string;
}

/**
 * HorizontalPodAutoscaler metric specification
 *
 * @interface HorizontalPodAutoscalerMetric
 * @since 1.0.0
 */
export interface HorizontalPodAutoscalerMetric {
  /** Metric type */
  type: 'Resource' | 'Pods' | 'Object' | 'External';
  /** Resource metric */
  resource?: {
    /** Resource name */
    name: 'cpu' | 'memory';
    /** Target specification */
    target: {
      /** Target type */
      type: 'Utilization' | 'AverageValue';
      /** Average utilization percentage */
      averageUtilization?: number;
      /** Average value */
      averageValue?: string;
    };
  };
  /** Pods metric */
  pods?: {
    /** Metric specification */
    metric: { name: string; selector?: Record<string, unknown> };
    /** Target specification */
    target: { type: 'AverageValue'; averageValue: string };
  };
  /** Object metric */
  object?: {
    /** Metric specification */
    metric: { name: string; selector?: Record<string, unknown> };
    /** Described object */
    describedObject: { apiVersion: string; kind: string; name: string };
    /** Target specification */
    target: { type: 'Value' | 'AverageValue'; value?: string; averageValue?: string };
  };
  /** External metric */
  external?: {
    /** Metric specification */
    metric: { name: string; selector?: Record<string, unknown> };
    /** Target specification */
    target: { type: 'Value' | 'AverageValue'; value?: string; averageValue?: string };
  };
}

/**
 * HorizontalPodAutoscaler behavior specification
 *
 * @interface HorizontalPodAutoscalerBehavior
 * @since 1.0.0
 */
export interface HorizontalPodAutoscalerBehavior {
  /** Scale up behavior */
  scaleUp?: {
    /** Stabilization window in seconds */
    stabilizationWindowSeconds?: number;
    /** Policy selection */
    selectPolicy?: 'Max' | 'Min' | 'Disabled';
    /** Scaling policies */
    policies?: Array<{
      /** Policy type */
      type: 'Pods' | 'Percent';
      /** Policy value */
      value: number;
      /** Period in seconds */
      periodSeconds: number;
    }>;
  };
  /** Scale down behavior */
  scaleDown?: {
    /** Stabilization window in seconds */
    stabilizationWindowSeconds?: number;
    /** Policy selection */
    selectPolicy?: 'Max' | 'Min' | 'Disabled';
    /** Scaling policies */
    policies?: Array<{
      /** Policy type */
      type: 'Pods' | 'Percent';
      /** Policy value */
      value: number;
      /** Period in seconds */
      periodSeconds: number;
    }>;
  };
}

/**
 * Kubernetes HorizontalPodAutoscaler specification
 *
 * @interface HorizontalPodAutoscalerSpec
 * @since 1.0.0
 */
export interface HorizontalPodAutoscalerSpec {
  /** HPA name */
  name: string;
  /** Scale target reference */
  scaleTargetRef: {
    /** API version */
    apiVersion: string;
    /** Resource kind */
    kind: 'Deployment' | 'StatefulSet' | 'ReplicaSet';
    /** Resource name */
    name: string;
  };
  /** Minimum replicas */
  minReplicas?: number;
  /** Maximum replicas */
  maxReplicas: number;
  /** Scaling metrics */
  metrics?: HorizontalPodAutoscalerMetric[];
  /** Scaling behavior */
  behavior?: HorizontalPodAutoscalerBehavior;
  /** HPA labels */
  labels?: Record<string, string>;
  /** HPA annotations */
  annotations?: Record<string, string>;
}

export interface VerticalPodAutoscalerResourcePolicy {
  containerName?: string;
  mode?: 'Auto' | 'Off';
  minAllowed?: { cpu?: string; memory?: string };
  maxAllowed?: { cpu?: string; memory?: string };
  controlledResources?: Array<'cpu' | 'memory'>;
  controlledValues?: 'RequestsAndLimits' | 'RequestsOnly';
}

export interface VerticalPodAutoscalerUpdatePolicy {
  updateMode?: 'Off' | 'Initial' | 'Recreation' | 'Auto';
  minReplicas?: number;
}

export interface PodDisruptionBudgetSpec {
  name: string;
  minAvailable?: number | string;
  maxUnavailable?: number | string;
  selector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * AWS EBS StorageClass specification
 *
 * @interface AWSEBSStorageClassSpec
 * @extends CloudResourceTags
 * @since 1.0.0
 */
export interface AWSEBSStorageClassSpec extends CloudResourceTags {
  /** StorageClass name */
  name: string;
  /** EBS volume type */
  volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
  /** Filesystem type */
  fsType?: 'ext4' | 'xfs';
  /** Enable encryption */
  encrypted?: boolean;
  /** KMS key ID for encryption */
  kmsKeyId?: string;
  /** IOPS for io1/io2 volumes */
  iops?: number;
  /** Throughput for gp3 volumes */
  throughput?: number;
  /** Volume reclaim policy */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** Allow volume expansion */
  allowVolumeExpansion?: boolean;
  /** Volume binding mode */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** StorageClass labels */
  labels?: Record<string, string>;
  /** StorageClass annotations */
  annotations?: Record<string, string>;
}

export interface AWSEBSPersistentVolumeClaimSpec {
  name: string;
  storageClassName: string;
  size: string;
  accessModes?: AccessMode[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSEFSStorageClassSpec {
  name: string;
  reclaimPolicy?: 'Delete' | 'Retain';
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSEFSPersistentVolumeSpec {
  name: string;
  fileSystemId: string;
  accessPoint?: string;
  directoryPerms?: string;
  gidRangeStart?: number;
  gidRangeEnd?: number;
  basePath?: string;
  subPath?: string;
  capacity?: string;
  accessModes?: AccessMode[];
  storageClassName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSEFSPersistentVolumeClaimSpec {
  name: string;
  storageClassName: string;
  size?: string;
  accessModes?: AccessMode[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSIRSAServiceAccountSpec {
  name: string;
  roleArn: string;
  audience?: string;
  stsEndpointType?: 'regional' | 'legacy';
  region?: string;
  tokenExpiration?: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: string[];
  secrets?: string[];
}

export interface AWSSecretsManagerObject {
  objectName: string;
  objectType: 'secretsmanager';
  objectAlias?: string;
  jmesPath?: string;
}

export interface AWSParameterStoreObject {
  objectName: string;
  objectType: 'ssmparameter';
  objectAlias?: string;
}

export interface AWSSecretProviderClassSpec {
  name: string;
  region?: string;
  objects: (AWSSecretsManagerObject | AWSParameterStoreObject)[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for Azure Workload Identity ServiceAccount.
 * Enables secure authentication to Azure services without storing credentials.
 *
 * @see https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview
 */
export interface AzureWorkloadIdentityServiceAccountSpec {
  /** Name of the ServiceAccount */
  name: string;
  /** Azure application client ID for workload identity */
  clientId: string;
  /** Azure tenant ID where the application is registered */
  tenantId: string;
  /** Service account token expiration in seconds (3600-86400) */
  tokenExpiration?: number;
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * Azure Key Vault object configuration for SecretProviderClass.
 */
export interface AzureKeyVaultObject {
  /** Name of the object in Azure Key Vault */
  objectName: string;
  /** Type of object to retrieve */
  objectType: 'secret' | 'key' | 'cert';
  /** Optional alias for the object when mounted */
  objectAlias?: string;
  /** Optional version of the object */
  objectVersion?: string;
}

/**
 * Configuration interface for Azure Key Vault SecretProviderClass.
 * Enables mounting secrets from Azure Key Vault using CSI driver.
 *
 * @see https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver
 */
export interface AzureKeyVaultSecretProviderClassSpec {
  /** Name of the SecretProviderClass */
  name: string;
  /** Name of the Azure Key Vault */
  keyVaultName: string;
  /** Azure tenant ID */
  tenantId: string;
  /** Objects to retrieve from Key Vault */
  objects: AzureKeyVaultObject[];
  /** User-assigned managed identity client ID for authentication */
  userAssignedIdentityID?: string;
  /** Azure cloud environment */
  cloudName?: 'AzurePublicCloud' | 'AzureUSGovernmentCloud' | 'AzureChinaCloud';
  /** Labels to apply to the SecretProviderClass */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the SecretProviderClass */
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for Azure Files StorageClass.
 * Defines parameters for creating Azure Files StorageClass in AKS.
 *
 * @see https://learn.microsoft.com/en-us/azure/aks/azure-csi-files-storage-provision
 */
export interface AzureFilesStorageClassSpec {
  /** Name of the StorageClass */
  name: string;
  /** Azure Files SKU */
  skuName?:
    | 'Standard_LRS'
    | 'Standard_GRS'
    | 'Standard_RAGRS'
    | 'Standard_ZRS'
    | 'Premium_LRS'
    | 'Premium_ZRS';
  /** File share protocol */
  protocol?: 'smb' | 'nfs';
  /** Allow shared access across multiple pods */
  allowSharedAccess?: boolean;
  /** Resource group for storage account */
  resourceGroup?: string;
  /** Storage account name */
  storageAccount?: string;
  /** Location for storage account */
  location?: string;
  /** Network endpoints for storage account */
  networkEndpointType?: 'publicEndpoint' | 'privateEndpoint';
  /** Mount permissions for NFS (e.g., '0777') */
  mountPermissions?: string;
  /** Root squash type for NFS */
  rootSquashType?: 'NoRootSquash' | 'RootSquash' | 'AllSquash';
  /** Volume reclaim policy */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** Allow volume expansion */
  allowVolumeExpansion?: boolean;
  /** Volume binding mode */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** Mount options for the storage class */
  mountOptions?: string[];
  /** Labels to apply to the StorageClass */
  labels?: Record<string, string>;
  /** Annotations to apply to the StorageClass */
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for Azure Files PersistentVolume.
 * Defines parameters for static Azure Files volume provisioning.
 */
export interface AzureFilesPersistentVolumeSpec {
  /** Name of the PersistentVolume */
  name: string;
  /** Storage capacity */
  capacity: string;
  /** Access modes */
  accessModes?: AccessMode[];
  /** Storage account name */
  storageAccount: string;
  /** File share name */
  shareName: string;
  /** Resource group name */
  resourceGroup?: string;
  /** File share protocol */
  protocol?: 'smb' | 'nfs';
  /** Secret name containing storage account key (SMB only) */
  secretName?: string;
  /** Secret namespace (SMB only) */
  secretNamespace?: string;
  /** Server address override */
  server?: string;
  /** Folder name within share */
  folderName?: string;
  /** Mount permissions for NFS */
  mountPermissions?: string;
  /** Volume reclaim policy */
  reclaimPolicy?: ReclaimPolicy;
  /** Storage class name */
  storageClassName?: string;
  /** Mount options */
  mountOptions?: string[];
  /** Labels to apply to the PersistentVolume */
  labels?: Record<string, string>;
  /** Annotations to apply to the PersistentVolume */
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for Azure Files PersistentVolumeClaim.
 * Simplifies creation of PVCs for Azure Files.
 */
export interface AzureFilesPersistentVolumeClaimSpec {
  /** Name of the PersistentVolumeClaim */
  name: string;
  /** Storage class name */
  storageClassName: string;
  /** Storage size request */
  size: string;
  /** Access modes */
  accessModes?: AccessMode[];
  /** Labels to apply to the PersistentVolumeClaim */
  labels?: Record<string, string>;
  /** Annotations to apply to the PersistentVolumeClaim */
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for AWS ECR ServiceAccount.
 * Simplifies ECR integration with EKS using IRSA.
 *
 * @interface AWSECRServiceAccountSpec
 * @since 2.3.0
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html
 */
export interface AWSECRServiceAccountSpec {
  /** Name of the ServiceAccount */
  name: string;
  /** IAM role ARN with ECR permissions */
  roleArn: string;
  /** AWS region for ECR registry */
  region?: string;
  /** ECR registry IDs to access (defaults to current account) */
  registryIds?: string[];
  /** IRSA audience for token validation */
  audience?: string;
  /** AWS STS endpoint type */
  stsEndpointType?: 'regional' | 'legacy';
  /** Token expiration time in seconds (900-43200) */
  tokenExpiration?: number;
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of additional image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * Configuration interface for Azure Container Registry ServiceAccount.
 * Simplifies ACR integration with AKS using managed identity.
 */
export interface AzureACRServiceAccountSpec {
  /** Name of the ServiceAccount */
  name: string;
  /** Azure Container Registry name */
  acrName: string;
  /** Resource group containing the ACR */
  resourceGroup: string;
  /** Client ID for Workload Identity (optional) */
  clientId?: string;
  /** Tenant ID for Workload Identity (optional) */
  tenantId?: string;
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of additional image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * Configuration interface for GCP Artifact Registry ServiceAccount.
 * Simplifies Artifact Registry integration with GKE using Workload Identity.
 *
 * @interface GCPArtifactRegistryServiceAccountSpec
 * @since 2.3.0
 * @see https://cloud.google.com/artifact-registry/docs/docker/authentication
 */
export interface GCPArtifactRegistryServiceAccountSpec {
  /** Name of the ServiceAccount */
  name: string;
  /** Google Cloud service account email for workload identity */
  gcpServiceAccountEmail: string;
  /** Artifact Registry locations to access */
  locations?: string[];
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of additional image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * Cloud resource tags with basic validation
 *
 * @interface CloudResourceTags
 * @since 1.0.0
 */
export interface CloudResourceTags {
  /** Resource tags as key-value pairs */
  tags?: Record<string, string>;
}

/**
 * Azure Disk StorageClass specification
 *
 * @interface AzureDiskStorageClassSpec
 * @extends CloudResourceTags
 * @since 1.0.0
 */
export interface AzureDiskStorageClassSpec extends CloudResourceTags {
  /** Name of the StorageClass */
  name: string;
  /** Azure disk SKU to use */
  skuName?:
    | 'Standard_LRS'
    | 'Premium_LRS'
    | 'StandardSSD_LRS'
    | 'PremiumV2_LRS'
    | 'UltraSSD_LRS'
    | 'Premium_ZRS'
    | 'StandardSSD_ZRS';
  /** File system type to use */
  fsType?: 'ext4' | 'ext3' | 'ext2' | 'xfs' | 'btrfs' | 'ntfs';
  /** Host caching mode */
  cachingMode?: 'None' | 'ReadOnly' | 'ReadWrite';
  /** Resource group where disks will be created */
  resourceGroup?: string;
  /** IOPS for the disk (UltraSSD_LRS only) */
  diskIOPSReadWrite?: number;
  /** Throughput in MB/s (UltraSSD_LRS only) */
  diskMBpsReadWrite?: number;
  /** Logical sector size in bytes */
  logicalSectorSize?: 512 | 4096;
  /** ID of the disk encryption set */
  diskEncryptionSetID?: string;
  /** Type of disk encryption */
  diskEncryptionType?:
    | 'EncryptionAtRestWithCustomerKey'
    | 'EncryptionAtRestWithPlatformAndCustomerKeys';
  /** Enable write accelerator */
  writeAcceleratorEnabled?: boolean;
  /** Network access policy for the disk */
  networkAccessPolicy?: 'AllowAll' | 'DenyAll' | 'AllowPrivate';
  /** ID of the disk access resource */
  diskAccessID?: string;
  /** Enable bursting (Premium SSD only) */
  enableBursting?: boolean;
  /** Maximum number of hosts that can attach to the disk simultaneously */
  maxShares?: number;
  /** Volume reclaim policy */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** Allow volume expansion */
  allowVolumeExpansion?: boolean;
  /** Volume binding mode */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** Labels to apply to the StorageClass */
  labels?: Record<string, string>;
  /** Annotations to apply to the StorageClass */
  annotations?: Record<string, string>;
}

/**
 * AWS Application Load Balancer Ingress specification
 *
 * @interface AWSALBIngressSpec
 * @extends CloudResourceTags
 * @since 1.0.0
 */
export interface AWSALBIngressSpec extends CloudResourceTags {
  /** Ingress name */
  name: string;
  /** Ingress rules */
  rules: IngressRule[];
  /** TLS configuration */
  tls?: IngressTLS[];
  /** Load balancer scheme */
  scheme?: 'internet-facing' | 'internal';
  /** Target type */
  targetType?: 'instance' | 'ip';
  /** IP address type */
  ipAddressType?: 'ipv4' | 'dualstack';
  /** ALB group name */
  groupName?: string;
  /** ALB group order */
  groupOrder?: number;
  /** Subnet IDs */
  subnets?: string[];
  /** Security group IDs */
  securityGroups?: string[];
  /** SSL certificate ARN */
  certificateArn?: string;
  /** Enable SSL redirect */
  sslRedirect?: boolean;
  /** Health check path */
  healthCheckPath?: string;
  /** Health check interval */
  healthCheckIntervalSeconds?: number;
  /** Health check timeout */
  healthCheckTimeoutSeconds?: number;
  /** Healthy threshold count */
  healthyThresholdCount?: number;
  /** Unhealthy threshold count */
  unhealthyThresholdCount?: number;
  /** Ingress labels */
  labels?: Record<string, string>;
  /** Ingress annotations */
  annotations?: Record<string, string>;
}

/**
 * Azure Application Gateway Ingress Controller specification
 *
 * @interface AzureAGICIngressSpec
 * @since 1.0.0
 */
export interface AzureAGICIngressSpec {
  /** Name of the Ingress resource */
  name: string;
  /** Ingress rules defining routing configuration */
  rules: IngressRule[];
  /** TLS configuration for HTTPS termination */
  tls?: IngressTLS[];
  /** Backend path prefix to rewrite request paths */
  backendPathPrefix?: string;
  /** Backend hostname for Application Gateway to use when communicating with pods */
  backendHostname?: string;
  /** Backend protocol (http or https) */
  backendProtocol?: 'http' | 'https';
  /** Enable SSL redirect from HTTP to HTTPS */
  sslRedirect?: boolean;
  /** Use private IP address of Application Gateway */
  usePrivateIp?: boolean;
  /** Override frontend port (default: 80 for HTTP, 443 for HTTPS) */
  overrideFrontendPort?: number;
  /** Enable cookie-based session affinity */
  cookieBasedAffinity?: boolean;
  /** Request timeout in seconds */
  requestTimeout?: number;
  /** Enable connection draining */
  connectionDraining?: boolean;
  /** Connection draining timeout in seconds */
  connectionDrainingTimeout?: number;
  /** Custom health probe hostname */
  healthProbeHostname?: string;
  /** Custom health probe port */
  healthProbePort?: number;
  /** Custom health probe path */
  healthProbePath?: string;
  /** Accepted HTTP status codes for health probe */
  healthProbeStatusCodes?: string;
  /** Health probe interval in seconds */
  healthProbeInterval?: number;
  /** Health probe timeout in seconds */
  healthProbeTimeout?: number;
  /** Health probe unhealthy threshold */
  healthProbeUnhealthyThreshold?: number;
  /**
   * Additional hostnames for multisite listener
   * @security Validate hostname format to prevent injection attacks
   */
  hostnameExtension?: string[];
  /**
   * WAF policy resource ID for path-based protection
   * @security Validate resource ID format to prevent path traversal attacks
   */
  wafPolicyForPath?: string;
  /**
   * Application Gateway SSL certificate name
   * @security Ensure certificate exists and is properly configured
   */
  appgwSslCertificate?: string;
  /** Application Gateway SSL profile name */
  appgwSslProfile?: string;
  /** Trusted root certificate names for end-to-end SSL */
  appgwTrustedRootCertificate?: string[];
  /** Rewrite rule set name */
  rewriteRuleSet?: string;
  /** Rule priority for request routing */
  rulePriority?: number;
  /** Labels to apply to the Ingress */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the Ingress */
  annotations?: Record<string, string>;
}

export interface VerticalPodAutoscalerSpec {
  name: string;
  targetRef: {
    apiVersion: string;
    kind: 'Deployment' | 'StatefulSet' | 'ReplicaSet' | 'DaemonSet' | 'Job' | 'CronJob';
    name: string;
  };
  updatePolicy?: VerticalPodAutoscalerUpdatePolicy;
  resourcePolicy?: {
    containerPolicies?: VerticalPodAutoscalerResourcePolicy[];
  };
  recommenders?: Array<{ name: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * NetworkPolicy peer specification
 *
 * @interface NetworkPolicyPeer
 * @since 1.0.0
 */
export interface NetworkPolicyPeer {
  podSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  namespaceSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  ipBlock?: {
    cidr: string;
    except?: string[];
  };
}

/**
 * NetworkPolicy port specification
 *
 * @interface NetworkPolicyPort
 * @since 1.0.0
 */
export interface NetworkPolicyPort {
  protocol?: 'TCP' | 'UDP' | 'SCTP';
  port?: number | string;
  endPort?: number;
}

/**
 * NetworkPolicy ingress rule specification
 *
 * @interface NetworkPolicyIngressRule
 * @since 1.0.0
 */
export interface NetworkPolicyIngressRule {
  from?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

/**
 * NetworkPolicy egress rule specification
 *
 * @interface NetworkPolicyEgressRule
 * @since 1.0.0
 */
export interface NetworkPolicyEgressRule {
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

/**
 * NetworkPolicy specification
 *
 * @interface NetworkPolicySpec
 * @since 1.0.0
 */
export interface NetworkPolicySpec {
  name: string;
  podSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  policyTypes?: Array<'Ingress' | 'Egress'>;
  ingress?: NetworkPolicyIngressRule[];
  egress?: NetworkPolicyEgressRule[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Karpenter NodePool requirement for node selection
 *
 * @interface KarpenterNodeRequirement
 * @since 1.0.0
 */
/**
 * Karpenter node requirement specification
 *
 * @interface KarpenterNodeRequirement
 * @since 2.3.0
 */
export interface KarpenterNodeRequirement {
  /** Label key to match against */
  key: string;
  /** Operator for matching */
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
  /** Values to match */
  values?: string[];
}

/**
 * Karpenter NodePool disruption configuration
 *
 * @interface KarpenterNodeDisruption
 * @since 1.0.0
 */
/**
 * Karpenter node disruption configuration
 *
 * @interface KarpenterNodeDisruption
 * @since 2.3.0
 */
export interface KarpenterNodeDisruption {
  /** Policy for node consolidation */
  consolidationPolicy?: 'WhenEmpty' | 'WhenUnderutilized';
  /** Time to wait before consolidating empty nodes */
  consolidateAfter?: string;
  /** Maximum node lifetime before replacement */
  expireAfter?: string;
}

/**
 * Karpenter NodePool specification
 *
 * @interface KarpenterNodePoolSpec
 * @since 1.0.0
 */
/**
 * Karpenter NodePool specification
 *
 * @interface KarpenterNodePoolSpec
 * @since 2.3.0
 */
export interface KarpenterNodePoolSpec {
  /** Name of the NodePool */
  name: string;
  /** Node requirements for instance selection */
  requirements?: KarpenterNodeRequirement[];
  /** Resource limits for the NodePool */
  limits?: {
    cpu?: string;
    memory?: string;
  };
  /** Node disruption configuration */
  disruption?: KarpenterNodeDisruption;
  /** Reference to NodeClass for AWS-specific configuration */
  nodeClassRef: {
    /** API group (default: eks.amazonaws.com) */
    group?: string;
    /** Resource kind (default: NodeClass) */
    kind?: string;
    /** NodeClass name */
    name: string;
  };
  /** Taints to apply to provisioned nodes */
  taints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  /** Labels to apply to the NodePool */
  labels?: Record<string, string>;
  /** Annotations to apply to the NodePool */
  annotations?: Record<string, string>;
}

/**
 * Karpenter block device mapping for EC2 instances
 *
 * @interface KarpenterBlockDeviceMapping
 * @since 1.0.0
 */
/**
 * Karpenter block device mapping specification
 *
 * @interface KarpenterBlockDeviceMapping
 * @since 2.3.0
 */
export interface KarpenterBlockDeviceMapping {
  /** Device name (e.g., /dev/xvda) */
  deviceName: string;
  /** EBS configuration */
  ebs?: {
    /** Volume size in GB */
    volumeSize?: string;
    /** Volume type */
    volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
    /** Enable encryption */
    encrypted?: boolean;
    /** Delete on termination */
    deleteOnTermination?: boolean;
    /** IOPS for io1/io2 volumes */
    iops?: number;
    /** Throughput for gp3 volumes */
    throughput?: number;
  };
}

/**
 * Karpenter subnet selector term
 *
 * @interface KarpenterSubnetSelectorTerm
 * @since 1.0.0
 */
/**
 * Karpenter subnet selector term specification
 *
 * @interface KarpenterSubnetSelectorTerm
 * @since 2.3.0
 */
export interface KarpenterSubnetSelectorTerm {
  /** Subnet tags for selection */
  tags?: Record<string, string>;
  /** Specific subnet ID */
  id?: string;
}

/**
 * Karpenter security group selector term
 *
 * @interface KarpenterSecurityGroupSelectorTerm
 * @since 1.0.0
 */
/**
 * Karpenter security group selector term specification
 *
 * @interface KarpenterSecurityGroupSelectorTerm
 * @since 2.3.0
 */
export interface KarpenterSecurityGroupSelectorTerm {
  /** Security group tags for selection */
  tags?: Record<string, string>;
  /** Specific security group ID */
  id?: string;
}

/**
 * Karpenter EC2 NodeClass specification
 *
 * @interface KarpenterEC2NodeClassSpec
 * @since 1.0.0
 */
/**
 * Karpenter EC2 NodeClass specification
 *
 * @interface KarpenterEC2NodeClassSpec
 * @since 2.3.0
 */
export interface KarpenterEC2NodeClassSpec {
  /** Name of the EC2 NodeClass */
  name: string;
  /** AMI family for node instances */
  amiFamily?:
    | 'AL2'
    | 'AL2023'
    | 'Bottlerocket'
    | 'Ubuntu'
    | 'Windows2019'
    | 'Windows2022'
    | 'Custom';
  /** Instance store policy */
  instanceStorePolicy?: 'NVME' | 'RAID0';
  /** User data script for instance initialization */
  userData?: string;
  /** Subnet selection terms */
  subnetSelectorTerms?: KarpenterSubnetSelectorTerm[];
  /** Security group selection terms */
  securityGroupSelectorTerms?: KarpenterSecurityGroupSelectorTerm[];
  /** IAM role for instances */
  role?: string;
  /** Instance profile name */
  instanceProfile?: string;
  /** EC2 metadata options */
  metadataOptions?: {
    /** HTTP endpoint state */
    httpEndpoint?: 'enabled' | 'disabled';
    /** IPv6 endpoint state */
    httpProtocolIPv6?: 'enabled' | 'disabled';
    /** Hop limit for metadata requests */
    httpPutResponseHopLimit?: number;
    /** Token requirement */
    httpTokens?: 'required' | 'optional';
  };
  /** Block device mappings */
  blockDeviceMappings?: KarpenterBlockDeviceMapping[];
  /** Resource tags */
  tags?: Record<string, string>;
  /** Labels to apply to the NodeClass */
  labels?: Record<string, string>;
  /** Annotations to apply to the NodeClass */
  annotations?: Record<string, string>;
}

/**
 * Karpenter disruption budget for controlling disruption rate.
 */
/**
 * Karpenter disruption budget specification
 *
 * @interface KarpenterDisruptionBudget
 * @since 2.3.0
 */
export interface KarpenterDisruptionBudget {
  /** Schedule in cron format for when budget applies */
  schedule?: string;
  /** Duration the budget is active */
  duration?: string;
  /** Number or percentage of nodes that can be disrupted */
  nodes?: string | number;
  /** Reasons this budget applies to */
  reasons?: Array<'Underutilized' | 'Empty' | 'Drifted' | 'Expired'>;
}

/**
 * GKE Workload Identity ServiceAccount specification
 * Enables secure authentication to Google Cloud APIs without service account keys
 *
 * @interface GKEWorkloadIdentityServiceAccountSpec
 * @since 2.3.0
 * @see https://cloud.google.com/kubernetes-engine/docs/concepts/workload-identity
 */
export interface GKEWorkloadIdentityServiceAccountSpec {
  /** ServiceAccount name */
  name: string;
  /** Google Cloud service account email for workload identity */
  gcpServiceAccountEmail: string;
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * GCE Load Balancer Ingress specification
 * Creates an Ingress resource that provisions a Google Cloud Load Balancer
 *
 * @interface GCELoadBalancerIngressSpec
 * @since 2.3.0
 * @see https://cloud.google.com/kubernetes-engine/docs/tutorials/http-balancer
 */
export interface GCELoadBalancerIngressSpec {
  /** Ingress name */
  name: string;
  /** Ingress rules for routing */
  rules: Array<{
    /** Host name for the rule */
    host?: string;
    /** Path rules */
    paths: Array<{
      /** URL path */
      path: string;
      /** Path matching type */
      pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
      /** Backend service */
      backend: {
        service: { name: string; port: { number?: number; name?: string } };
      };
    }>;
  }>;
  /** TLS configuration */
  tls?: Array<{
    /** TLS hosts */
    hosts?: string[];
    /** Secret name containing TLS certificate */
    secretName?: string;
  }>;
  /** Static IP address name (reserved in GCP) */
  staticIpName?: string;
  /** Enable Google-managed SSL certificates */
  managedCertificates?: string[];
  /** Custom health check path */
  healthCheckPath?: string;
  /** Ingress class name */
  ingressClassName?: string;
  /** Ingress labels */
  labels?: Record<string, string>;
  /** Additional annotations */
  annotations?: Record<string, string>;
}

/**
 * GKE Persistent Disk StorageClass specification
 * Creates a StorageClass for Google Cloud Persistent Disks using CSI driver
 *
 * @interface GKEPersistentDiskStorageClassSpec
 * @since 2.3.0
 * @see https://cloud.google.com/kubernetes-engine/docs/how-to/persistent-volumes/gce-pd-csi-driver
 */
export interface GKEPersistentDiskStorageClassSpec {
  /** StorageClass name */
  name: string;
  /** Persistent disk type */
  diskType?: 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'pd-extreme';
  /** Filesystem type */
  fsType?: 'ext4' | 'xfs' | 'NTFS';
  /** Volume reclaim policy */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** Allow volume expansion */
  allowVolumeExpansion?: boolean;
  /** Volume binding mode */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** Provisioned IOPS for pd-extreme disks */
  provisionedIops?: number;
  /** StorageClass labels */
  labels?: Record<string, string>;
  /** Additional annotations */
  annotations?: Record<string, string>;
}

/**
 * Advanced disruption configuration for Karpenter NodePools.
 */
/**
 * Karpenter advanced disruption configuration
 *
 * @interface KarpenterAdvancedDisruption
 * @since 2.3.0
 */
export interface KarpenterAdvancedDisruption {
  /** Consolidation policy */
  consolidationPolicy?: 'WhenEmpty' | 'WhenEmptyOrUnderutilized';
  /** Time to wait before consolidating */
  consolidateAfter?: string;
  /** Node expiration time */
  expireAfter?: string;
  /** Disruption budgets for rate limiting */
  budgets?: KarpenterDisruptionBudget[];
}

/**
 * Configuration interface for Karpenter NodeClaim.
 * Represents an individual node request that Karpenter will fulfill.
 *
 * @see https://karpenter.sh/docs/concepts/nodeclaims/
 */
/**
 * Karpenter NodeClaim specification
 *
 * @interface KarpenterNodeClaimSpec
 * @since 2.3.0
 */
export interface KarpenterNodeClaimSpec {
  /** Name of the NodeClaim */
  name: string;
  /** Node requirements for instance selection */
  requirements?: KarpenterNodeRequirement[];
  /** Reference to NodeClass for AWS-specific configuration */
  nodeClassRef: {
    /** API group (default: eks.amazonaws.com) */
    group?: string;
    /** Resource kind (default: NodeClass) */
    kind?: string;
    /** NodeClass name */
    name: string;
  };
  /** Taints to apply to the node */
  taints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  /** Startup taints that will be removed after node initialization */
  startupTaints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  /** Node expiration time */
  expireAfter?: string;
  /** Termination grace period */
  terminationGracePeriod?: string;
  /** Labels to apply to the NodeClaim */
  labels?: Record<string, string>;
  /** Annotations to apply to the NodeClaim */
  annotations?: Record<string, string>;
}

/**
 * Topology spread constraint for advanced scheduling.
 */
/**
 * Karpenter topology spread constraint specification
 *
 * @interface KarpenterTopologySpreadConstraint
 * @since 2.3.0
 */
export interface KarpenterTopologySpreadConstraint {
  /** Maximum skew between zones/domains */
  maxSkew: number;
  /** Topology key (e.g., topology.kubernetes.io/zone) */
  topologyKey: string;
  /** What to do when constraint cannot be satisfied */
  whenUnsatisfiable: 'DoNotSchedule' | 'ScheduleAnyway';
  /** Label selector for pods to consider */
  labelSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  /** Minimum domains required */
  minDomains?: number;
}

/**
 * Node affinity for advanced scheduling constraints.
 */
/**
 * Karpenter node affinity specification
 *
 * @interface KarpenterNodeAffinity
 * @since 2.3.0
 */
export interface KarpenterNodeAffinity {
  /** Required node affinity */
  requiredDuringSchedulingIgnoredDuringExecution?: {
    nodeSelectorTerms: Array<{
      matchExpressions?: Array<{
        key: string;
        operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
        values?: string[];
      }>;
      matchFields?: Array<{
        key: string;
        operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
        values?: string[];
      }>;
    }>;
  };
  /** Preferred node affinity */
  preferredDuringSchedulingIgnoredDuringExecution?: Array<{
    weight: number;
    preference: {
      matchExpressions?: Array<{
        key: string;
        operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
        values?: string[];
      }>;
      matchFields?: Array<{
        key: string;
        operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
        values?: string[];
      }>;
    };
  }>;
}

/**
 * Configuration interface for advanced Karpenter scheduling.
 * Provides fine-grained control over pod placement and node selection.
 */
/**
 * Karpenter scheduling specification
 *
 * @interface KarpenterSchedulingSpec
 * @since 2.3.0
 */
export interface KarpenterSchedulingSpec {
  /** Name of the scheduling configuration */
  name: string;
  /** Node selector for basic node selection */
  nodeSelector?: Record<string, string>;
  /** Node affinity for advanced node selection */
  nodeAffinity?: KarpenterNodeAffinity;
  /** Topology spread constraints */
  topologySpreadConstraints?: KarpenterTopologySpreadConstraint[];
  /** Tolerations for taints */
  tolerations?: Array<{
    key?: string;
    operator?: 'Exists' | 'Equal';
    value?: string;
    effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    tolerationSeconds?: number;
  }>;
  /** Priority class for pod scheduling */
  priorityClassName?: string;
  /** Scheduler name */
  schedulerName?: string;
  /** Labels to apply to the scheduling configuration */
  labels?: Record<string, string>;
  /** Annotations to apply to the scheduling configuration */
  annotations?: Record<string, string>;
}

/**
 * Configuration properties for Rutter
 *
 * @interface RutterProps
 * @since 1.0.0
 */
export interface RutterProps {
  /** Helm chart metadata */
  meta: HelmChartMeta;
  /** Default values for values.yaml */
  defaultValues?: Record<string, unknown>;
  /** Environment-specific values */
  envValues?: Record<string, Record<string, unknown>>;
  /** Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
  /** NOTES.txt content */
  notesTpl?: string;
  /** JSON schema for values validation */
  valuesSchema?: Record<string, unknown>;
  /** Custom name for generated manifest file */
  manifestName?: string;
  /** Combine all resources into single manifest file */
  singleManifestFile?: boolean;
}

/**
 * Rutter - Main class for building Kubernetes manifests and Helm charts
 *
 * Rutter (maritime pilot) guides the generation of Kubernetes resources
 * using cdk8s and outputs complete Helm charts with proper templating.
 *
 * @class Rutter
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const rutter = new Rutter({
 *   meta: { name: 'my-app', version: '1.0.0' },
 *   defaultValues: { replicas: 3 }
 * });
 *
 * rutter.addDeployment({
 *   name: 'web',
 *   image: 'nginx:1.21',
 *   replicas: 3
 * });
 *
 * rutter.write('./charts/my-app');
 * ```
 */
export class Rutter {
  private readonly props: RutterProps;
  private readonly app: App;
  private readonly chart: Chart;
  private readonly assets: SynthAsset[] = [];
  private valueOverrides: Record<string, string> = {};

  /**
   * Creates a new Rutter instance
   *
   * @param {RutterProps} props - Configuration properties
   * @since 1.0.0
   */
  constructor(props: RutterProps) {
    this.props = props;
    this.app = new App();
    this.chart = new Chart(this.app, props.manifestName ?? props.meta.name);
  }

  /**
   * Sets dynamic value overrides for Helm values
   *
   * Used by CLI --set flags to override default values at runtime.
   *
   * @param {Record<string, string>} overrides - Key-value pairs to override
   *
   * @example
   * ```typescript
   * rutter.setValues({
   *   'image.tag': 'v2.0.0',
   *   'replicas': '5'
   * });
   * ```
   *
   * @since 1.0.0
   */
  setValues(overrides: Record<string, string>) {
    this.valueOverrides = { ...this.valueOverrides, ...overrides };
  }

  /**
   * Apply value overrides to nested object using dot notation
   */
  private applyOverrides(values: Record<string, unknown>): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(values)); // Deep clone

    for (const [key, value] of Object.entries(this.valueOverrides)) {
      this.setNestedValue(result, key, this.parseValue(value));
    }

    return result;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
    /* eslint-disable security/detect-object-injection */
    const keys = path.split('.').filter(Boolean);
    if (keys.length === 0) return;

    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue;
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
    /* eslint-enable security/detect-object-injection */
  }

  private parseValue(value: string): unknown {
    // Try to parse as JSON first (for objects, arrays, booleans, numbers)
    try {
      return JSON.parse(value);
    } catch (error: unknown) {
      // Log parsing error for debugging purposes
      console.debug(`Failed to parse value as JSON: ${value}`, error);
      // If not valid JSON, treat as string
      return value;
    }
  }

  private static readonly LABEL_NAME = 'app.kubernetes.io/name';
  private static readonly LABEL_INSTANCE = 'app.kubernetes.io/instance';
  private static readonly HELPER_NAME = 'timonel.name';
  private static readonly NETWORKING_API_VERSION = 'networking.k8s.io/v1';
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';
  private static readonly AZURE_DISK_CSI_DRIVER = 'disk.csi.azure.com';
  private static readonly AZURE_DISK_PROVISIONER_ANNOTATION =
    'volume.beta.kubernetes.io/storage-provisioner';
  private static readonly AZURE_FILES_CSI_DRIVER = 'file.csi.azure.com';

  /**
   * Adds a Kubernetes Deployment to the chart
   *
   * @param {DeploymentSpec} spec - Deployment specification
   * @returns {ApiObject} The created Deployment object
   *
   * @example
   * ```typescript
   * rutter.addDeployment({
   *   name: 'web-app',
   *   image: 'nginx:1.21',
   *   replicas: 3,
   *   containerPort: 80,
   *   env: { NODE_ENV: 'production' }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addDeployment(spec: DeploymentSpec) {
    const match = spec.matchLabels ?? {
      [Rutter.LABEL_NAME]: include(Rutter.HELPER_NAME),
      [Rutter.LABEL_INSTANCE]: helm.releaseName,
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

  /**
   * Adds a Kubernetes Service to the chart
   *
   * @param {ServiceSpec} spec - Service specification
   * @returns {ApiObject} The created Service object
   *
   * @example
   * ```typescript
   * rutter.addService({
   *   name: 'web-service',
   *   ports: [{ port: 80, targetPort: 8080 }],
   *   type: 'LoadBalancer'
   * });
   * ```
   *
   * @since 1.0.0
   */
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
      [Rutter.LABEL_NAME]: include(Rutter.HELPER_NAME),
      [Rutter.LABEL_INSTANCE]: helm.releaseName,
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

  /**
   * Adds a Kubernetes Job to the chart
   *
   * @param {JobSpec} spec - Job specification
   * @returns {ApiObject} The created Job object
   *
   * @example
   * ```typescript
   * rutter.addJob({
   *   name: 'data-migration',
   *   image: 'migrate:latest',
   *   command: ['./migrate.sh'],
   *   backoffLimit: 3
   * });
   * ```
   *
   * @since 2.1.0
   */
  addJob(spec: JobSpec) {
    // Validate Job specification
    this.validateJobSpec(spec);

    const { envEntries, envFromEntries, volumeDefs, volumeMountDefs } =
      this.buildPodEnvironment(spec);
    const jobSpec = this.buildJobSpec(spec);
    const podTemplate = this.buildJobPodTemplate(
      spec,
      envEntries,
      envFromEntries,
      volumeDefs,
      volumeMountDefs,
    );

    const job = new ApiObject(this.chart, spec.name, {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        ...jobSpec,
        template: podTemplate,
      },
    });
    this.capture(job, `${spec.name}-job`);
    return job;
  }

  /**
   * Adds a Kubernetes CronJob to the chart
   *
   * @param {CronJobSpec} spec - CronJob specification
   * @returns {ApiObject} The created CronJob object
   *
   * @example
   * ```typescript
   * rutter.addCronJob({
   *   name: 'backup-job',
   *   schedule: '0 2 * * *',
   *   image: 'backup:latest',
   *   command: ['./backup.sh']
   * });
   * ```
   *
   * @since 2.1.0
   */
  addCronJob(spec: CronJobSpec) {
    // Validate CronJob specification
    this.validateCronJobSpec(spec);

    const { envEntries, envFromEntries, volumeDefs, volumeMountDefs } =
      this.buildPodEnvironment(spec);
    const cronJobSpec = this.buildCronJobSpec(spec);
    const jobTemplate = this.buildCronJobTemplate(
      spec,
      envEntries,
      envFromEntries,
      volumeDefs,
      volumeMountDefs,
    );

    const cronJob = new ApiObject(this.chart, spec.name, {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        ...cronJobSpec,
        jobTemplate,
      },
    });
    this.capture(cronJob, `${spec.name}-cronjob`);
    return cronJob;
  }

  /**
   * Adds a Kubernetes Ingress to the chart
   *
   * @param {IngressSpec} spec - Ingress specification
   * @returns {ApiObject} The created Ingress object
   *
   * @example
   * ```typescript
   * rutter.addIngress({
   *   name: 'web-ingress',
   *   rules: [{
   *     host: 'example.com',
   *     paths: [{
   *       path: '/',
   *       pathType: 'Prefix',
   *       backend: { service: { name: 'web-service', port: { number: 80 } } }
   *     }]
   *   }]
   * });
   * ```
   *
   * @since 1.0.0
   */
  addIngress(spec: IngressSpec) {
    const ing = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.NETWORKING_API_VERSION,
      kind: 'Ingress',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        ingressClassName: spec.ingressClassName,
        defaultBackend: spec.defaultBackend,
        tls: spec.tls,
        rules: spec.rules.map((rule) => ({
          host: rule.host,
          http: {
            paths: rule.paths.map((path) => ({
              path: path.path,
              pathType: path.pathType,
              backend: path.backend,
            })),
          },
        })),
      },
    });
    this.capture(ing, `${spec.name}-ingress`);
    return ing;
  }

  addPersistentVolume(spec: PersistentVolumeSpec) {
    // Apply cloud provider optimizations
    const optimizedSpec = this.optimizePVForCloud(spec);

    const pvSpec: Record<string, unknown> = {
      capacity: { storage: optimizedSpec.capacity },
      accessModes: optimizedSpec.accessModes,
      storageClassName: optimizedSpec.storageClassName,
      volumeMode: optimizedSpec.volumeMode,
      persistentVolumeReclaimPolicy: optimizedSpec.reclaimPolicy,
      mountOptions: optimizedSpec.mountOptions,
      nodeAffinity: optimizedSpec.nodeAffinity,
      claimRef: optimizedSpec.claimRef,
    };

    // Handle known volume sources with validation
    const knownSources = [
      'csi',
      'nfs',
      'awsElasticBlockStore',
      'hostPath',
      'azureDisk',
      'azureFile',
      'gcePersistentDisk',
    ] as const;

    let sourceCount = 0;
    for (const sourceType of knownSources) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: sourceType is from known const array
      const sourceValue = optimizedSpec.source[sourceType];
      if (sourceValue) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: sourceType is from known const array
        pvSpec[sourceType] = sourceValue;
        sourceCount++;
      }
    }

    // Validate single volume source
    if (sourceCount === 0) {
      throw new Error(`PersistentVolume ${spec.name}: No volume source specified`);
    }
    if (sourceCount > 1) {
      throw new Error(
        `PersistentVolume ${spec.name}: Multiple volume sources specified, only one allowed`,
      );
    }

    // Handle custom volume sources
    for (const [key, value] of Object.entries(optimizedSpec.source)) {
      if (!knownSources.includes(key as (typeof knownSources)[number]) && value !== undefined) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: controlled object construction
        pvSpec[key] = value;
      }
    }

    const pv = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        name: spec.name,
        ...(optimizedSpec.labels ? { labels: optimizedSpec.labels } : {}),
        ...(optimizedSpec.annotations ? { annotations: optimizedSpec.annotations } : {}),
      },
      spec: pvSpec,
    });
    this.capture(pv, `${spec.name}-pv`);
    return pv;
  }

  private optimizePVForCloud(spec: PersistentVolumeSpec): PersistentVolumeSpec {
    const optimized = { ...spec };
    const EBS_CSI_DRIVER = 'ebs.csi.aws.com';

    // Apply cloud-specific optimizations
    if (spec.cloudProvider === 'aws') {
      optimized.annotations = {
        ...optimized.annotations,
        'volume.beta.kubernetes.io/storage-provisioner': EBS_CSI_DRIVER,
      };
      // Default to gp3 for better performance/cost
      if (spec.source.csi?.driver === EBS_CSI_DRIVER && optimized.source.csi) {
        optimized.source.csi.volumeAttributes = {
          type: 'gp3',
          ...spec.source.csi.volumeAttributes,
        };
      }
    } else if (spec.cloudProvider === 'azure') {
      optimized.annotations = {
        ...optimized.annotations,
        [Rutter.AZURE_DISK_PROVISIONER_ANNOTATION]: Rutter.AZURE_DISK_CSI_DRIVER,
      };
      // Default to Premium_ZRS for multi-zone clusters
      if (spec.source.csi?.driver === Rutter.AZURE_DISK_CSI_DRIVER && optimized.source.csi) {
        optimized.source.csi.volumeAttributes = {
          skuName: 'Premium_ZRS',
          ...spec.source.csi.volumeAttributes,
        };
      }
    } else if (spec.cloudProvider === 'gcp') {
      optimized.annotations = {
        ...optimized.annotations,
        'volume.beta.kubernetes.io/storage-provisioner': 'pd.csi.storage.gke.io',
      };
    }

    // Set sensible defaults
    optimized.reclaimPolicy = optimized.reclaimPolicy ?? 'Delete';
    optimized.volumeMode = optimized.volumeMode ?? 'Filesystem';

    return optimized;
  }

  addPersistentVolumeClaim(spec: PersistentVolumeClaimSpec) {
    // Validate access modes compatibility
    this.validatePVCAccessModes(spec);

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
        volumeMode: spec.volumeMode ?? 'Filesystem',
        selector: spec.selector,
        volumeName: spec.volumeName,
      },
    });
    this.capture(pvc, `${spec.name}-pvc`);
    return pvc;
  }

  private validatePVCAccessModes(spec: PersistentVolumeClaimSpec) {
    const { accessModes, storageClassName } = spec;

    // Validate ReadWriteOncePod (K8s 1.22+)
    if (accessModes.includes('ReadWriteOncePod') && accessModes.length > 1) {
      throw new Error(
        `PVC ${spec.name}: ReadWriteOncePod cannot be combined with other access modes`,
      );
    }

    // Warn about common misconfigurations
    if (storageClassName?.includes('azure-disk') && accessModes.includes('ReadWriteMany')) {
      console.warn(
        SecurityUtils.sanitizeLogMessage(
          `PVC ${spec.name}: Azure Disk does not support ReadWriteMany, consider Azure Files`,
        ),
      );
    }

    if (storageClassName?.includes('ebs') && accessModes.includes('ReadWriteMany')) {
      console.warn(
        SecurityUtils.sanitizeLogMessage(
          `PVC ${spec.name}: EBS does not support ReadWriteMany, consider EFS`,
        ),
      );
    }
  }

  /**
   * Adds a Kubernetes ConfigMap to the chart
   *
   * @param {ConfigMapSpec} spec - ConfigMap specification
   * @returns {ApiObject} The created ConfigMap object
   *
   * @example
   * ```typescript
   * rutter.addConfigMap({
   *   name: 'app-config',
   *   data: {
   *     'config.yaml': 'key: value',
   *     'app.properties': 'debug=true'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
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

  /**
   * Adds a Kubernetes Secret to the chart
   *
   * @param {SecretSpec} spec - Secret specification
   * @returns {ApiObject} The created Secret object
   *
   * @example
   * ```typescript
   * rutter.addSecret({
   *   name: 'app-secrets',
   *   stringData: {
   *     'username': 'admin',
   *     'password': 'secret123'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
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

  /**
   * Adds a Kubernetes ServiceAccount to the chart
   *
   * @param {ServiceAccountSpec} spec - ServiceAccount specification
   * @returns {ApiObject} The created ServiceAccount object
   *
   * @example
   * ```typescript
   * rutter.addServiceAccount({
   *   name: 'app-sa',
   *   awsRoleArn: 'arn:aws:iam::123456789012:role/MyRole',
   *   automountServiceAccountToken: true
   * });
   * ```
   *
   * @since 1.0.0
   */
  addServiceAccount(spec: ServiceAccountSpec) {
    const annotations = this.buildServiceAccountAnnotations(spec);

    const sa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        ...(Object.keys(annotations).length ? { annotations } : {}),
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      automountServiceAccountToken: spec.automountServiceAccountToken,
      imagePullSecrets: spec.imagePullSecrets?.map((n) => ({ name: n })),
      secrets: spec.secrets?.map((n) => ({ name: n })),
    });
    this.capture(sa, `${spec.name}-serviceaccount`);
    return sa;
  }

  private buildServiceAccountAnnotations(spec: ServiceAccountSpec): Record<string, string> {
    const annotations: Record<string, string> = {
      ...(spec.annotations ?? {}),
    };

    this.addAWSIRSAAnnotations(annotations, spec);
    this.addAzureWorkloadIdentityAnnotations(annotations, spec);
    this.addGCPWorkloadIdentityAnnotations(annotations, spec);

    return annotations;
  }

  private addAWSIRSAAnnotations(
    annotations: Record<string, string>,
    spec: ServiceAccountSpec,
  ): void {
    if (spec.awsRoleArn) {
      annotations['eks.amazonaws.com/role-arn'] = spec.awsRoleArn;
    }
    if (spec.awsAudience) {
      annotations['eks.amazonaws.com/audience'] = spec.awsAudience;
    }
    if (spec.awsStsEndpointType) {
      annotations['eks.amazonaws.com/sts-regional-endpoints'] = spec.awsStsEndpointType;
    }
    if (spec.awsTokenExpiration !== undefined) {
      annotations['eks.amazonaws.com/token-expiration'] = String(spec.awsTokenExpiration);
    }
  }

  private addAzureWorkloadIdentityAnnotations(
    annotations: Record<string, string>,
    spec: ServiceAccountSpec,
  ): void {
    if (spec.azureClientId) {
      annotations['azure.workload.identity/client-id'] = spec.azureClientId;
    }
    if (spec.azureTenantId) {
      annotations['azure.workload.identity/tenant-id'] = spec.azureTenantId;
    }
    if (spec.azureServiceAccountTokenExpiration !== undefined) {
      annotations['azure.workload.identity/service-account-token-expiration'] = String(
        spec.azureServiceAccountTokenExpiration,
      );
    }
  }

  private addGCPWorkloadIdentityAnnotations(
    annotations: Record<string, string>,
    spec: ServiceAccountSpec,
  ): void {
    if (spec.gcpServiceAccountEmail) {
      annotations['iam.gke.io/gcp-service-account'] = spec.gcpServiceAccountEmail;
    }
  }

  /**
   * Adds a Kubernetes HorizontalPodAutoscaler to the chart
   *
   * @param {HorizontalPodAutoscalerSpec} spec - HPA specification
   * @returns {ApiObject} The created HPA object
   *
   * @example
   * ```typescript
   * rutter.addHorizontalPodAutoscaler({
   *   name: 'web-hpa',
   *   scaleTargetRef: {
   *     apiVersion: 'apps/v1',
   *     kind: 'Deployment',
   *     name: 'web-app'
   *   },
   *   minReplicas: 2,
   *   maxReplicas: 10
   * });
   * ```
   *
   * @since 1.0.0
   */
  addHorizontalPodAutoscaler(spec: HorizontalPodAutoscalerSpec) {
    // Default metrics if none provided (CPU utilization at 80%)
    const defaultMetrics: HorizontalPodAutoscalerMetric[] = [
      {
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: {
            type: 'Utilization',
            averageUtilization: 80,
          },
        },
      },
    ];

    const hpa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        scaleTargetRef: spec.scaleTargetRef,
        minReplicas: spec.minReplicas ?? 1,
        maxReplicas: spec.maxReplicas,
        metrics: spec.metrics ?? defaultMetrics,
        ...(spec.behavior ? { behavior: spec.behavior } : {}),
      },
    });
    this.capture(hpa, `${spec.name}-hpa`);
    return hpa;
  }

  addVerticalPodAutoscaler(spec: VerticalPodAutoscalerSpec) {
    const vpa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'autoscaling.k8s.io/v1',
      kind: 'VerticalPodAutoscaler',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        targetRef: spec.targetRef,
        updatePolicy: spec.updatePolicy ?? { updateMode: 'Auto' },
        ...(spec.resourcePolicy ? { resourcePolicy: spec.resourcePolicy } : {}),
        ...(spec.recommenders ? { recommenders: spec.recommenders } : {}),
      },
    });
    this.capture(vpa, `${spec.name}-vpa`);
    return vpa;
  }

  addPodDisruptionBudget(spec: PodDisruptionBudgetSpec) {
    const pdb = new ApiObject(this.chart, spec.name, {
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        ...(spec.minAvailable !== undefined ? { minAvailable: spec.minAvailable } : {}),
        ...(spec.maxUnavailable !== undefined ? { maxUnavailable: spec.maxUnavailable } : {}),
        selector: spec.selector,
      },
    });
    this.capture(pdb, `${spec.name}-pdb`);
    return pdb;
  }

  addAWSEBSStorageClass(spec: AWSEBSStorageClassSpec) {
    const DEFAULT_VOLUME_TYPE = 'gp3';
    const parameters: Record<string, string> = {
      type: spec.volumeType ?? DEFAULT_VOLUME_TYPE,
      fsType: spec.fsType ?? 'ext4',
      encrypted: String(spec.encrypted ?? true),
    };

    if (spec.kmsKeyId) {
      parameters['kmsKeyId'] = spec.kmsKeyId;
    }
    const IOPS_SUPPORTED_TYPES = ['gp3', 'io1', 'io2'];
    if (spec.iops && IOPS_SUPPORTED_TYPES.includes(spec.volumeType ?? DEFAULT_VOLUME_TYPE)) {
      parameters['iops'] = String(spec.iops);
    }
    if (spec.throughput && spec.volumeType === DEFAULT_VOLUME_TYPE) {
      parameters['throughput'] = String(spec.throughput);
    }

    const sc = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.STORAGE_API_VERSION,
      kind: 'StorageClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      provisioner: 'ebs.csi.aws.com',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    });
    this.capture(sc, `${spec.name}-storageclass`);
    return sc;
  }

  addAWSEBSPersistentVolumeClaim(spec: AWSEBSPersistentVolumeClaimSpec) {
    const pvc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        accessModes: spec.accessModes ?? ['ReadWriteOnce'],
        storageClassName: spec.storageClassName,
        resources: {
          requests: {
            storage: spec.size,
          },
        },
      },
    });
    this.capture(pvc, `${spec.name}-pvc`);
    return pvc;
  }

  addAWSEFSStorageClass(spec: AWSEFSStorageClassSpec) {
    const sc = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.STORAGE_API_VERSION,
      kind: 'StorageClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      provisioner: 'efs.csi.aws.com',
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
    });
    this.capture(sc, `${spec.name}-storageclass`);
    return sc;
  }

  addAWSEFSPersistentVolume(spec: AWSEFSPersistentVolumeSpec) {
    const csiSpec: Record<string, unknown> = {
      driver: 'efs.csi.aws.com',
      volumeHandle: spec.fileSystemId,
    };

    if (spec.accessPoint) {
      csiSpec['volumeHandle'] = `${spec.fileSystemId}::${spec.accessPoint}`;
    }

    const volumeAttributes: Record<string, string> = {};
    if (spec.directoryPerms) {
      volumeAttributes['directoryPerms'] = spec.directoryPerms;
    }
    if (spec.gidRangeStart !== undefined) {
      volumeAttributes['gidRangeStart'] = String(spec.gidRangeStart);
    }
    if (spec.gidRangeEnd !== undefined) {
      volumeAttributes['gidRangeEnd'] = String(spec.gidRangeEnd);
    }
    if (spec.basePath) {
      volumeAttributes['basePath'] = spec.basePath;
    }
    if (spec.subPath) {
      volumeAttributes['subPath'] = spec.subPath;
    }

    // Only add volumeAttributes if it has properties (more efficient than Object.keys().length)
    for (const key in volumeAttributes) {
      if (Object.prototype.hasOwnProperty.call(volumeAttributes, key)) {
        csiSpec['volumeAttributes'] = volumeAttributes;
        break;
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
      spec: {
        capacity: {
          storage: spec.capacity ?? '5Gi',
        },
        accessModes: spec.accessModes ?? ['ReadWriteMany'],
        persistentVolumeReclaimPolicy: 'Retain',
        storageClassName: spec.storageClassName,
        csi: csiSpec,
      },
    });
    this.capture(pv, `${spec.name}-pv`);
    return pv;
  }

  addAWSEFSPersistentVolumeClaim(spec: AWSEFSPersistentVolumeClaimSpec) {
    const pvc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        accessModes: spec.accessModes ?? ['ReadWriteMany'],
        storageClassName: spec.storageClassName,
        resources: {
          requests: {
            storage: spec.size ?? '5Gi',
          },
        },
      },
    });
    this.capture(pvc, `${spec.name}-pvc`);
    return pvc;
  }

  addAWSALBIngress(spec: AWSALBIngressSpec) {
    const annotations = this.buildALBAnnotations(spec);

    const ingress = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.NETWORKING_API_VERSION,
      kind: 'Ingress',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        annotations,
      },
      spec: {
        tls: spec.tls,
        rules: spec.rules.map((rule) => ({
          host: rule.host,
          http: {
            paths: rule.paths.map((path) => ({
              path: path.path,
              pathType: path.pathType,
              backend: path.backend,
            })),
          },
        })),
      },
    });
    this.capture(ingress, `${spec.name}-ingress`);
    return ingress;
  }

  private buildALBAnnotations(spec: AWSALBIngressSpec): Record<string, string> {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'alb',
      'alb.ingress.kubernetes.io/scheme': spec.scheme ?? 'internet-facing',
      'alb.ingress.kubernetes.io/target-type': spec.targetType ?? 'ip',
      ...(spec.annotations ?? {}),
    };

    this.addOptionalALBAnnotations(annotations, spec);
    this.addHealthCheckAnnotations(annotations, spec);
    this.addTagsAnnotation(annotations, spec);

    return annotations;
  }

  private addOptionalALBAnnotations(
    annotations: Record<string, string>,
    spec: AWSALBIngressSpec,
  ): void {
    if (spec.ipAddressType) {
      annotations['alb.ingress.kubernetes.io/ip-address-type'] = spec.ipAddressType;
    }
    if (spec.groupName) {
      annotations['alb.ingress.kubernetes.io/group.name'] = spec.groupName;
    }
    if (spec.groupOrder !== undefined) {
      annotations['alb.ingress.kubernetes.io/group.order'] = String(spec.groupOrder);
    }
    if (spec.subnets && spec.subnets.length > 0) {
      annotations['alb.ingress.kubernetes.io/subnets'] = spec.subnets.join(',');
    }
    if (spec.securityGroups && spec.securityGroups.length > 0) {
      annotations['alb.ingress.kubernetes.io/security-groups'] = spec.securityGroups.join(',');
    }
    if (spec.certificateArn) {
      annotations['alb.ingress.kubernetes.io/certificate-arn'] = spec.certificateArn;
    }
    if (spec.sslRedirect) {
      annotations['alb.ingress.kubernetes.io/ssl-redirect'] = '443';
    }
  }

  private addHealthCheckAnnotations(
    annotations: Record<string, string>,
    spec: AWSALBIngressSpec,
  ): void {
    if (spec.healthCheckPath) {
      annotations['alb.ingress.kubernetes.io/healthcheck-path'] = spec.healthCheckPath;
    }
    if (spec.healthCheckIntervalSeconds !== undefined) {
      annotations['alb.ingress.kubernetes.io/healthcheck-interval-seconds'] = String(
        spec.healthCheckIntervalSeconds,
      );
    }
    if (spec.healthCheckTimeoutSeconds !== undefined) {
      annotations['alb.ingress.kubernetes.io/healthcheck-timeout-seconds'] = String(
        spec.healthCheckTimeoutSeconds,
      );
    }
    if (spec.healthyThresholdCount !== undefined) {
      annotations['alb.ingress.kubernetes.io/healthy-threshold-count'] = String(
        spec.healthyThresholdCount,
      );
    }
    if (spec.unhealthyThresholdCount !== undefined) {
      annotations['alb.ingress.kubernetes.io/unhealthy-threshold-count'] = String(
        spec.unhealthyThresholdCount,
      );
    }
  }

  private addTagsAnnotation(annotations: Record<string, string>, spec: AWSALBIngressSpec): void {
    if (spec.tags && Object.keys(spec.tags).length > 0) {
      const tagString = this.formatCloudResourceTags(spec.tags);
      annotations['alb.ingress.kubernetes.io/tags'] = tagString;
    }
  }

  /**
   * Add Azure Application Gateway Ingress Controller (AGIC) Ingress.
   * Creates an Ingress resource with AGIC-specific annotations for AKS deployments.
   *
   * @param spec - AGIC Ingress specification
   * @returns The created Ingress ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAzureAGICIngress({
   *   name: 'app-ingress',
   *   rules: [{
   *     host: 'app.example.com',
   *     paths: [{
   *       path: '/',
   *       pathType: 'Prefix',
   *       backend: { service: { name: 'app-service', port: { number: 80 } } }
   *     }]
   *   }],
   *   sslRedirect: true,
   *   backendProtocol: 'https',
   *   healthProbePath: '/health'
   * });
   * ```
   */
  addAzureAGICIngress(spec: AzureAGICIngressSpec) {
    this.validateAGICHealthProbeParams(spec);
    this.validateAGICSecurityParams(spec);
    this.validateAGICAnnotationConsistency(spec);
    const annotations = this.buildAGICAnnotations(spec);

    const ingress = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.NETWORKING_API_VERSION,
      kind: 'Ingress',
      metadata: {
        name: spec.name,
        annotations,
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      spec: {
        tls: spec.tls,
        rules: spec.rules.map((rule) => ({
          host: rule.host,
          http: {
            paths: rule.paths.map((path) => ({
              path: path.path,
              pathType: path.pathType,
              backend: path.backend,
            })),
          },
        })),
      },
    });
    this.capture(ingress, `${spec.name}-ingress`);
    return ingress;
  }

  private buildAGICAnnotations(spec: AzureAGICIngressSpec): Record<string, string> {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'azure/application-gateway',
      ...(spec.annotations ?? {}),
    };

    this.addAGICPathAnnotations(annotations, spec);
    this.addAGICProtocolAnnotations(annotations, spec);
    this.addAGICHealthProbeAnnotations(annotations, spec);
    this.addAGICConnectionAnnotations(annotations, spec);
    this.addAGICSecurityAnnotations(annotations, spec);
    this.addAGICAdvancedAnnotations(annotations, spec);

    return annotations;
  }

  private addAGICPathAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.backendPathPrefix) {
      annotations['appgw.ingress.kubernetes.io/backend-path-prefix'] = spec.backendPathPrefix;
    }
    if (spec.backendHostname) {
      annotations['appgw.ingress.kubernetes.io/backend-hostname'] = spec.backendHostname;
    }
  }

  private addAGICProtocolAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.backendProtocol) {
      annotations['appgw.ingress.kubernetes.io/backend-protocol'] = spec.backendProtocol;
    }
    if (spec.sslRedirect) {
      annotations['appgw.ingress.kubernetes.io/ssl-redirect'] = 'true';
    }
    if (spec.usePrivateIp) {
      annotations['appgw.ingress.kubernetes.io/use-private-ip'] = 'true';
    }
    if (spec.overrideFrontendPort !== undefined) {
      annotations['appgw.ingress.kubernetes.io/override-frontend-port'] = String(
        spec.overrideFrontendPort,
      );
    }
  }

  private addAGICHealthProbeAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.healthProbeHostname) {
      annotations['appgw.ingress.kubernetes.io/health-probe-hostname'] = spec.healthProbeHostname;
    }
    if (spec.healthProbePort !== undefined) {
      annotations['appgw.ingress.kubernetes.io/health-probe-port'] = String(spec.healthProbePort);
    }
    if (spec.healthProbePath) {
      annotations['appgw.ingress.kubernetes.io/health-probe-path'] = spec.healthProbePath;
    }
    if (spec.healthProbeStatusCodes) {
      annotations['appgw.ingress.kubernetes.io/health-probe-status-codes'] =
        spec.healthProbeStatusCodes;
    }
    if (spec.healthProbeInterval !== undefined) {
      annotations['appgw.ingress.kubernetes.io/health-probe-interval'] = String(
        spec.healthProbeInterval,
      );
    }
    if (spec.healthProbeTimeout !== undefined) {
      annotations['appgw.ingress.kubernetes.io/health-probe-timeout'] = String(
        spec.healthProbeTimeout,
      );
    }
    if (spec.healthProbeUnhealthyThreshold !== undefined) {
      annotations['appgw.ingress.kubernetes.io/health-probe-unhealthy-threshold'] = String(
        spec.healthProbeUnhealthyThreshold,
      );
    }
  }

  private addAGICConnectionAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.cookieBasedAffinity) {
      annotations['appgw.ingress.kubernetes.io/cookie-based-affinity'] = 'true';
    }
    if (spec.requestTimeout !== undefined) {
      annotations['appgw.ingress.kubernetes.io/request-timeout'] = String(spec.requestTimeout);
    }
    if (spec.connectionDraining) {
      annotations['appgw.ingress.kubernetes.io/connection-draining'] = 'true';
    }
    if (spec.connectionDrainingTimeout !== undefined) {
      annotations['appgw.ingress.kubernetes.io/connection-draining-timeout'] = String(
        spec.connectionDrainingTimeout,
      );
    }
  }

  private addAGICSecurityAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.appgwSslCertificate) {
      annotations['appgw.ingress.kubernetes.io/appgw-ssl-certificate'] = spec.appgwSslCertificate;
    }
    if (spec.appgwSslProfile) {
      annotations['appgw.ingress.kubernetes.io/appgw-ssl-profile'] = spec.appgwSslProfile;
    }
    if (spec.appgwTrustedRootCertificate && spec.appgwTrustedRootCertificate.length > 0) {
      annotations['appgw.ingress.kubernetes.io/appgw-trusted-root-certificate'] =
        spec.appgwTrustedRootCertificate.join(',');
    }
    if (spec.wafPolicyForPath) {
      annotations['appgw.ingress.kubernetes.io/waf-policy-for-path'] = spec.wafPolicyForPath;
    }
  }

  private addAGICAdvancedAnnotations(
    annotations: Record<string, string>,
    spec: AzureAGICIngressSpec,
  ): void {
    if (spec.hostnameExtension && spec.hostnameExtension.length > 0) {
      annotations['appgw.ingress.kubernetes.io/hostname-extension'] =
        spec.hostnameExtension.join(', ');
    }
    if (spec.rewriteRuleSet) {
      annotations['appgw.ingress.kubernetes.io/rewrite-rule-set'] = spec.rewriteRuleSet;
    }
    if (spec.rulePriority !== undefined) {
      annotations['appgw.ingress.kubernetes.io/rule-priority'] = String(spec.rulePriority);
    }
  }

  addAWSIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec) {
    const annotations: Record<string, string> = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      ...(spec.audience ? { 'eks.amazonaws.com/audience': spec.audience } : {}),
      ...(spec.stsEndpointType
        ? { 'eks.amazonaws.com/sts-regional-endpoints': spec.stsEndpointType }
        : { 'eks.amazonaws.com/sts-regional-endpoints': 'regional' }),
      ...(spec.tokenExpiration !== undefined
        ? { 'eks.amazonaws.com/token-expiration': String(spec.tokenExpiration) }
        : {}),
      ...(spec.annotations ?? {}),
    };

    const sa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        annotations,
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      automountServiceAccountToken: spec.automountServiceAccountToken,
      imagePullSecrets: spec.imagePullSecrets?.map((n) => ({ name: n })),
      secrets: spec.secrets?.map((n) => ({ name: n })),
    });
    this.capture(sa, `${spec.name}-serviceaccount`);
    return sa;
  }

  addAWSSecretProviderClass(spec: AWSSecretProviderClassSpec) {
    const objects = spec.objects.map((obj) => {
      const baseObj: Record<string, string> = {
        objectName: obj.objectName,
        objectType: obj.objectType,
      };

      if ('objectAlias' in obj && obj.objectAlias) {
        baseObj['objectAlias'] = obj.objectAlias;
      }
      if ('jmesPath' in obj && obj.jmesPath) {
        baseObj['jmesPath'] = obj.jmesPath;
      }

      return baseObj;
    });

    const objectsYaml = YAML.stringify(objects, { indent: 2 }).trim();

    const parameters: Record<string, string> = {
      objects: `|\n  ${objectsYaml.split('\n').join('\n  ')}`,
    };

    if (spec.region) {
      parameters['region'] = spec.region;
    }

    const spc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'secrets-store.csi.x-k8s.io/v1',
      kind: 'SecretProviderClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        provider: 'aws',
        parameters,
      },
    });
    this.capture(spc, `${spec.name}-secretproviderclass`);
    return spc;
  }

  /**
   * Add Azure Workload Identity ServiceAccount.
   * Creates a ServiceAccount with Azure Workload Identity annotations for secure authentication.
   *
   * @param spec - Azure Workload Identity ServiceAccount specification
   * @returns The created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAzureWorkloadIdentityServiceAccount({
   *   name: 'workload-identity-sa',
   *   clientId: '12345678-1234-1234-1234-123456789012',
   *   tenantId: '87654321-4321-4321-4321-210987654321',
   *   tokenExpiration: 3600
   * });
   * ```
   */
  addAzureWorkloadIdentityServiceAccount(spec: AzureWorkloadIdentityServiceAccountSpec) {
    // Validate all inputs first for security
    if (
      spec.tokenExpiration !== undefined &&
      (spec.tokenExpiration < 3600 || spec.tokenExpiration > 86400)
    ) {
      throw new Error(
        `Azure Workload Identity ${spec.name}: tokenExpiration must be between 3600 and 86400 seconds`,
      );
    }

    if (!spec.clientId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error(`Azure Workload Identity ${spec.name}: Invalid client ID format`);
    }

    if (!spec.tenantId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error(`Azure Workload Identity ${spec.name}: Invalid tenant ID format`);
    }

    const annotations: Record<string, string> = {
      'azure.workload.identity/client-id': spec.clientId,
      'azure.workload.identity/tenant-id': spec.tenantId,
      ...(spec.tokenExpiration !== undefined
        ? {
            'azure.workload.identity/service-account-token-expiration': String(
              spec.tokenExpiration,
            ),
          }
        : {}),
      ...(spec.annotations ?? {}),
    };

    const sa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        annotations,
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
   * Add Azure Key Vault SecretProviderClass.
   * Creates a SecretProviderClass for mounting secrets from Azure Key Vault using CSI driver.
   *
   * @param spec - Azure Key Vault SecretProviderClass specification
   * @returns The created SecretProviderClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAzureKeyVaultSecretProviderClass({
   *   name: 'app-secrets',
   *   keyVaultName: 'my-keyvault',
   *   tenantId: '87654321-4321-4321-4321-210987654321',
   *   objects: [
   *     { objectName: 'database-password', objectType: 'secret' },
   *     { objectName: 'api-key', objectType: 'secret', objectAlias: 'API_KEY' }
   *   ],
   *   userAssignedIdentityID: '12345678-1234-1234-1234-123456789012'
   * });
   * ```
   */
  addAzureKeyVaultSecretProviderClass(spec: AzureKeyVaultSecretProviderClassSpec) {
    // Validate object names for security - prevent path traversal attacks
    spec.objects.forEach((obj) => {
      if (obj.objectName.includes('../') || obj.objectName.includes('..\\')) {
        throw new Error(
          `Azure Key Vault ${spec.name}: Object name '${obj.objectName}' contains invalid path traversal sequences`,
        );
      }
    });

    const objects = spec.objects.map((obj) => {
      const baseObj: Record<string, string> = {
        objectName: obj.objectName,
        objectType: obj.objectType,
      };

      if (obj.objectAlias) {
        baseObj['objectAlias'] = obj.objectAlias;
      }
      if (obj.objectVersion) {
        baseObj['objectVersion'] = obj.objectVersion;
      }

      return baseObj;
    });

    const objectsYaml = YAML.stringify(objects, { indent: 2 }).trim();

    const parameters: Record<string, string> = {
      keyvaultName: spec.keyVaultName,
      tenantId: spec.tenantId,
      objects: `|\n  ${objectsYaml.split('\n').join('\n  ')}`,
    };

    if (spec.userAssignedIdentityID) {
      parameters['userAssignedIdentityID'] = spec.userAssignedIdentityID;
    }
    if (spec.cloudName) {
      parameters['cloudName'] = spec.cloudName;
    }

    const spc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'secrets-store.csi.x-k8s.io/v1',
      kind: 'SecretProviderClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        provider: 'azure',
        parameters,
      },
    });
    this.capture(spc, `${spec.name}-secretproviderclass`);
    return spc;
  }

  /**
   * Add Azure Files StorageClass.
   * Creates a StorageClass for dynamic provisioning of Azure Files volumes.
   *
   * @param spec - Azure Files StorageClass specification
   * @returns The created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAzureFilesStorageClass({
   *   name: 'azure-files-premium',
   *   skuName: 'Premium_LRS',
   *   protocol: 'smb',
   *   allowSharedAccess: true
   * });
   * ```
   */
  addAzureFilesStorageClass(spec: AzureFilesStorageClassSpec) {
    // Validate Azure Files parameters for security and compliance
    this.validateAzureFilesParameters(spec);

    const parameters = this.buildAzureFilesParameters(spec);

    const sc = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.STORAGE_API_VERSION,
      kind: 'StorageClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      provisioner: Rutter.AZURE_FILES_CSI_DRIVER,
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
      ...(spec.mountOptions ? { mountOptions: spec.mountOptions } : {}),
    });
    this.capture(sc, `${spec.name}-storageclass`);
    return sc;
  }

  /**
   * Add Azure Files PersistentVolume.
   * Creates a PersistentVolume for static Azure Files volume provisioning.
   *
   * @param spec - Azure Files PersistentVolume specification
   * @returns The created PersistentVolume ApiObject
   */
  addAzureFilesPersistentVolume(spec: AzureFilesPersistentVolumeSpec) {
    const csiSpec = this.buildAzureFilesPVCSISpec(spec);

    const pv = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        capacity: { storage: spec.capacity },
        accessModes: spec.accessModes ?? ['ReadWriteMany'],
        persistentVolumeReclaimPolicy: spec.reclaimPolicy ?? 'Retain',
        storageClassName: spec.storageClassName,
        ...(spec.mountOptions ? { mountOptions: spec.mountOptions } : {}),
        csi: csiSpec,
      },
    });
    this.capture(pv, `${spec.name}-pv`);
    return pv;
  }

  /**
   * Add Azure Files PersistentVolumeClaim.
   * Creates a PersistentVolumeClaim for Azure Files storage.
   *
   * @param spec - Azure Files PersistentVolumeClaim specification
   * @returns The created PersistentVolumeClaim ApiObject
   */
  addAzureFilesPersistentVolumeClaim(spec: AzureFilesPersistentVolumeClaimSpec) {
    const pvc = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        accessModes: spec.accessModes ?? ['ReadWriteMany'],
        storageClassName: spec.storageClassName,
        resources: {
          requests: { storage: spec.size },
        },
      },
    });
    this.capture(pvc, `${spec.name}-pvc`);
    return pvc;
  }

  /**
   * Add Azure Container Registry ServiceAccount.
   * Creates a ServiceAccount configured for ACR access.
   *
   * @param spec - Azure ACR ServiceAccount specification
   * @returns The created ServiceAccount ApiObject
   */
  addAzureACRServiceAccount(spec: AzureACRServiceAccountSpec) {
    const annotations: Record<string, string> = {
      ...(spec.annotations ?? {}),
    };

    // Add Workload Identity annotations if provided
    if (spec.clientId) {
      annotations['azure.workload.identity/client-id'] = spec.clientId;
    }
    if (spec.tenantId) {
      annotations['azure.workload.identity/tenant-id'] = spec.tenantId;
    }

    const sa = new ApiObject(this.chart, spec.name, {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        ...(Object.keys(annotations).length ? { annotations } : {}),
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      automountServiceAccountToken: spec.automountServiceAccountToken,
      imagePullSecrets: spec.imagePullSecrets?.map((n) => ({ name: n })),
      secrets: spec.secrets?.map((n) => ({ name: n })),
    });
    this.capture(sa, `${spec.name}-serviceaccount`);
    return sa;
  }

  addAzureDiskStorageClass(spec: AzureDiskStorageClassSpec) {
    // Validate numeric parameters to prevent runtime errors
    this.validateAzureDiskNumericParameters(spec);

    const parameters = this.buildAzureDiskParameters(spec);

    const sc = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.STORAGE_API_VERSION,
      kind: 'StorageClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      provisioner: Rutter.AZURE_DISK_CSI_DRIVER,
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    });
    this.capture(sc, `${spec.name}-storageclass`);
    return sc;
  }

  private buildAzureDiskParameters(spec: AzureDiskStorageClassSpec): Record<string, string> {
    const parameters: Record<string, string> = {
      skuName: spec.skuName ?? 'StandardSSD_LRS',
      fsType: spec.fsType ?? 'ext4',
      // Security best practices: default to private network access and encryption
      networkAccessPolicy: spec.networkAccessPolicy ?? 'AllowPrivate',
    };

    this.addOptionalAzureDiskParameters(parameters, spec);
    this.addAzureDiskEncryptionParameters(parameters, spec);
    this.addAzureDiskPerformanceParameters(parameters, spec);

    return parameters;
  }

  private addOptionalAzureDiskParameters(
    parameters: Record<string, string>,
    spec: AzureDiskStorageClassSpec,
  ): void {
    if (spec.cachingMode) {
      parameters['cachingMode'] = spec.cachingMode;
    }
    if (spec.resourceGroup) {
      parameters['resourceGroup'] = spec.resourceGroup;
    }
    if (spec.logicalSectorSize !== undefined) {
      parameters['LogicalSectorSize'] = String(spec.logicalSectorSize);
    }
    if (spec.tags && Object.keys(spec.tags).length > 0) {
      const tagString = this.formatCloudResourceTags(spec.tags);
      parameters['tags'] = tagString;
    }
    // networkAccessPolicy is now set as default in buildAzureDiskParameters
    if (spec.networkAccessPolicy && spec.networkAccessPolicy !== 'AllowPrivate') {
      parameters['networkAccessPolicy'] = spec.networkAccessPolicy;
    }
    if (spec.diskAccessID) {
      parameters['diskAccessID'] = spec.diskAccessID;
    }
    if (spec.maxShares !== undefined) {
      parameters['maxShares'] = String(spec.maxShares);
    }
  }

  private addAzureDiskEncryptionParameters(
    parameters: Record<string, string>,
    spec: AzureDiskStorageClassSpec,
  ): void {
    if (spec.diskEncryptionSetID) {
      parameters['diskEncryptionSetID'] = spec.diskEncryptionSetID;
    }
    if (spec.diskEncryptionType) {
      parameters['diskEncryptionType'] = spec.diskEncryptionType;
    }
  }

  private addAzureDiskPerformanceParameters(
    parameters: Record<string, string>,
    spec: AzureDiskStorageClassSpec,
  ): void {
    if (spec.diskIOPSReadWrite !== undefined) {
      parameters['DiskIOPSReadWrite'] = String(spec.diskIOPSReadWrite);
    }
    if (spec.diskMBpsReadWrite !== undefined) {
      parameters['DiskMBpsReadWrite'] = String(spec.diskMBpsReadWrite);
    }
    if (spec.writeAcceleratorEnabled !== undefined) {
      parameters['writeAcceleratorEnabled'] = String(spec.writeAcceleratorEnabled);
    }
    if (spec.enableBursting !== undefined) {
      parameters['enableBursting'] = String(spec.enableBursting);
    }
  }

  private validateAzureDiskNumericParameters(spec: AzureDiskStorageClassSpec): void {
    this.validateAzureDiskIOPS(spec);
    this.validateAzureDiskThroughput(spec);
    this.validateAzureDiskShares(spec);
    this.validateAzureDiskSectorSize(spec);
  }

  private validateAzureDiskIOPS(spec: AzureDiskStorageClassSpec): void {
    if (spec.diskIOPSReadWrite === undefined) return;

    if (spec.diskIOPSReadWrite < 100) {
      throw new Error(`Azure Disk ${spec.name}: diskIOPSReadWrite must be at least 100 IOPS`);
    }
    if (spec.diskIOPSReadWrite > 400000) {
      throw new Error(`Azure Disk ${spec.name}: diskIOPSReadWrite cannot exceed 400,000 IOPS`);
    }
  }

  private validateAzureDiskThroughput(spec: AzureDiskStorageClassSpec): void {
    if (spec.diskMBpsReadWrite === undefined) return;

    if (spec.diskMBpsReadWrite < 1) {
      throw new Error(`Azure Disk ${spec.name}: diskMBpsReadWrite must be at least 1 MB/s`);
    }
    if (spec.diskMBpsReadWrite > 10000) {
      throw new Error(`Azure Disk ${spec.name}: diskMBpsReadWrite cannot exceed 10,000 MB/s`);
    }
  }

  private validateAzureDiskShares(spec: AzureDiskStorageClassSpec): void {
    if (spec.maxShares === undefined) return;

    if (spec.maxShares < 1) {
      throw new Error(`Azure Disk ${spec.name}: maxShares must be at least 1`);
    }
    if (spec.maxShares > 5) {
      throw new Error(`Azure Disk ${spec.name}: maxShares cannot exceed 5`);
    }
  }

  private validateAzureDiskSectorSize(spec: AzureDiskStorageClassSpec): void {
    if (spec.logicalSectorSize === undefined) return;

    if (spec.logicalSectorSize !== 512 && spec.logicalSectorSize !== 4096) {
      throw new Error(
        `Azure Disk ${spec.name}: logicalSectorSize must be either 512 or 4096 bytes`,
      );
    }
  }

  /**
   * Format cloud resource tags for provider-specific string format.
   * Provides basic validation and consistent formatting across cloud providers.
   */
  private formatCloudResourceTags(tags: Record<string, string>): string {
    this.validateCloudResourceTags(tags);
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  }

  /**
   * Validate cloud resource tags with basic rules.
   * Each cloud provider has specific validation, but these are common basics.
   */
  private validateCloudResourceTags(tags: Record<string, string>): void {
    for (const [key, value] of Object.entries(tags)) {
      if (!key || key.trim() === '') {
        throw new Error('Tag key cannot be empty');
      }
      if (value === undefined || value === null) {
        throw new Error(`Tag value for key '${key}' cannot be null or undefined`);
      }
    }
  }

  addNetworkPolicy(spec: NetworkPolicySpec) {
    // Validate policy types
    this.validateNetworkPolicyTypes(spec);

    // Validate CIDR blocks if present
    this.validateNetworkPolicyCIDRs(spec);

    const np = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.NETWORKING_API_VERSION,
      kind: 'NetworkPolicy',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        podSelector: spec.podSelector ?? {},
        policyTypes: spec.policyTypes,
        ...(spec.ingress ? { ingress: spec.ingress } : {}),
        ...(spec.egress ? { egress: spec.egress } : {}),
      },
    });
    this.capture(np, `${spec.name}-networkpolicy`);
    return np;
  }

  private static readonly EMPTY_POD_SELECTOR = {};

  /**
   * Create a deny-all ingress NetworkPolicy for the current namespace
   */
  addDenyAllIngressNetworkPolicy(name = 'deny-all-ingress') {
    return this.addNetworkPolicy({
      name,
      podSelector: Rutter.EMPTY_POD_SELECTOR,
      policyTypes: ['Ingress'],
    });
  }

  /**
   * Create a deny-all egress NetworkPolicy for the current namespace
   */
  addDenyAllEgressNetworkPolicy(name = 'deny-all-egress') {
    return this.addNetworkPolicy({
      name,
      podSelector: Rutter.EMPTY_POD_SELECTOR,
      policyTypes: ['Egress'],
    });
  }

  /**
   * Create a deny-all NetworkPolicy for both ingress and egress
   */
  addDenyAllNetworkPolicy(name = 'deny-all') {
    return this.addNetworkPolicy({
      name,
      podSelector: Rutter.EMPTY_POD_SELECTOR,
      policyTypes: ['Ingress', 'Egress'],
    });
  }

  /**
   * Allow traffic from specific pods to target pods on specific ports
   */
  addAllowFromPodsNetworkPolicy(spec: {
    name: string;
    targetPodSelector: Record<string, string>;
    sourcePodSelector: Record<string, string>;
    ports?: NetworkPolicyPort[];
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }) {
    return this.addNetworkPolicy({
      name: spec.name,
      podSelector: { matchLabels: spec.targetPodSelector },
      policyTypes: ['Ingress'],
      ingress: [
        {
          from: [{ podSelector: { matchLabels: spec.sourcePodSelector } }],
          ...(spec.ports ? { ports: spec.ports } : {}),
        },
      ],
      ...(spec.labels ? { labels: spec.labels } : {}),
      ...(spec.annotations ? { annotations: spec.annotations } : {}),
    });
  }

  /**
   * Allow traffic from specific namespace to target pods
   */
  addAllowFromNamespaceNetworkPolicy(spec: {
    name: string;
    targetPodSelector: Record<string, string>;
    sourceNamespaceSelector: Record<string, string>;
    ports?: NetworkPolicyPort[];
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }) {
    return this.addNetworkPolicy({
      name: spec.name,
      podSelector: { matchLabels: spec.targetPodSelector },
      policyTypes: ['Ingress'],
      ingress: [
        {
          from: [{ namespaceSelector: { matchLabels: spec.sourceNamespaceSelector } }],
          ...(spec.ports ? { ports: spec.ports } : {}),
        },
      ],
      ...(spec.labels ? { labels: spec.labels } : {}),
      ...(spec.annotations ? { annotations: spec.annotations } : {}),
    });
  }

  private validateNetworkPolicyTypes(spec: NetworkPolicySpec) {
    if (!spec.policyTypes || spec.policyTypes.length === 0) {
      throw new Error(`NetworkPolicy ${spec.name}: policyTypes must be specified`);
    }

    this.validatePolicyTypeValues(spec);
    this.validatePolicyTypeRules(spec);
  }

  private validatePolicyTypeValues(spec: NetworkPolicySpec) {
    const validTypes = ['Ingress', 'Egress'];
    for (const type of spec.policyTypes!) {
      if (!validTypes.includes(type)) {
        throw new Error(
          `NetworkPolicy ${spec.name}: invalid policyType '${type}', must be 'Ingress' or 'Egress'`,
        );
      }
    }
  }

  private validatePolicyTypeRules(spec: NetworkPolicySpec) {
    if (spec.policyTypes!.includes('Ingress') && spec.ingress === undefined) {
      console.warn(
        `NetworkPolicy ${spec.name}: policyType 'Ingress' specified but no ingress rules defined (will deny all ingress)`,
      );
    }
    if (spec.policyTypes!.includes('Egress') && spec.egress === undefined) {
      console.warn(
        `NetworkPolicy ${spec.name}: policyType 'Egress' specified but no egress rules defined (will deny all egress)`,
      );
    }
  }

  private validateNetworkPolicyCIDRs(spec: NetworkPolicySpec) {
    const validateCIDR = (cidr: string, context: string) => {
      if (!this.isValidCIDR(cidr)) {
        throw new Error(`NetworkPolicy ${spec.name}: invalid CIDR '${cidr}' in ${context}`);
      }
    };

    this.validateIngressCIDRs(spec, validateCIDR);
    this.validateEgressCIDRs(spec, validateCIDR);
  }

  private isValidCIDR(cidr: string): boolean {
    // IPv4 CIDR validation
    const ipv4Parts = cidr.split('/');
    if (ipv4Parts.length === 2) {
      const [ip, prefix] = ipv4Parts;
      if (ip && prefix && this.isValidIPv4(ip) && this.isValidPrefix(prefix, 32)) {
        return true;
      }
    }

    // IPv6 CIDR validation (basic)
    if (cidr.includes(':') && ipv4Parts.length === 2) {
      const [, prefix] = ipv4Parts;
      if (prefix) {
        return this.isValidPrefix(prefix, 128);
      }
    }

    return false;
  }

  private isValidIPv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every((part) => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part;
    });
  }

  private isValidPrefix(prefix: string, maxPrefix: number): boolean {
    const num = parseInt(prefix, 10);
    return !isNaN(num) && num >= 0 && num <= maxPrefix && String(num) === prefix;
  }

  private validateIngressCIDRs(
    spec: NetworkPolicySpec,
    validateCIDR: (cidr: string, context: string) => void,
  ) {
    if (!spec.ingress) return;

    for (const rule of spec.ingress) {
      if (rule.from) {
        for (const peer of rule.from) {
          this.validatePeerCIDRs(peer, validateCIDR, 'ingress rule');
        }
      }
    }
  }

  private validateEgressCIDRs(
    spec: NetworkPolicySpec,
    validateCIDR: (cidr: string, context: string) => void,
  ) {
    if (!spec.egress) return;

    for (const rule of spec.egress) {
      if (rule.to) {
        for (const peer of rule.to) {
          this.validatePeerCIDRs(peer, validateCIDR, 'egress rule');
        }
      }
    }
  }

  private validatePeerCIDRs(
    peer: NetworkPolicyPeer,
    validateCIDR: (cidr: string, context: string) => void,
    context: string,
  ) {
    if (peer.ipBlock?.cidr) {
      validateCIDR(peer.ipBlock.cidr, context);

      if (peer.ipBlock.except) {
        for (const except of peer.ipBlock.except) {
          validateCIDR(except, `${context} except block`);
        }
      }
    }
  }

  private validateAGICHealthProbeParams(spec: AzureAGICIngressSpec): void {
    if (
      spec.healthProbeInterval !== undefined &&
      (spec.healthProbeInterval < 1 || spec.healthProbeInterval > 86400)
    ) {
      throw new Error('Health probe interval must be between 1 and 86400 seconds');
    }
    if (
      spec.healthProbeTimeout !== undefined &&
      (spec.healthProbeTimeout < 1 || spec.healthProbeTimeout > 86400)
    ) {
      throw new Error('Health probe timeout must be between 1 and 86400 seconds');
    }
    if (
      spec.healthProbeUnhealthyThreshold !== undefined &&
      (spec.healthProbeUnhealthyThreshold < 1 || spec.healthProbeUnhealthyThreshold > 20)
    ) {
      throw new Error('Health probe unhealthy threshold must be between 1 and 20');
    }
  }

  private validateAGICSecurityParams(spec: AzureAGICIngressSpec): void {
    if (
      spec.wafPolicyForPath &&
      !/^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.Network\/applicationGatewayWebApplicationFirewallPolicies\/[^/]+$/.test(
        spec.wafPolicyForPath,
      )
    ) {
      throw new Error('Invalid WAF policy resource ID format');
    }
    if (spec.hostnameExtension?.some((hostname) => !this.isValidHostname(hostname))) {
      throw new Error('Invalid hostname format in hostnameExtension');
    }
  }

  private isValidHostname(hostname: string): boolean {
    // Basic hostname validation without complex regex to prevent ReDoS
    if (!hostname || hostname.length > 253) return false;
    if (hostname.startsWith('.') || hostname.endsWith('.')) return false;

    const labels = hostname.split('.');
    return labels.every((label) => {
      if (!label || label.length > 63) return false;
      if (label.startsWith('-') || label.endsWith('-')) return false;
      return /^[a-zA-Z0-9-]+$/.test(label);
    });
  }

  private validateAGICAnnotationConsistency(spec: AzureAGICIngressSpec): void {
    if (spec.sslRedirect && !spec.appgwSslCertificate) {
      throw new Error('SSL redirect requires an SSL certificate to be specified');
    }
    if (spec.backendProtocol === 'https' && !spec.appgwTrustedRootCertificate?.length) {
      throw new Error('HTTPS backend protocol requires trusted root certificates');
    }
    if (spec.overrideFrontendPort === 443 && !spec.appgwSslCertificate) {
      throw new Error('Port 443 requires an SSL certificate to be specified');
    }
  }

  private buildAzureFilesParameters(spec: AzureFilesStorageClassSpec): Record<string, string> {
    const parameters: Record<string, string> = {
      skuName: spec.skuName ?? 'Standard_LRS',
    };

    if (spec.protocol) {
      parameters['protocol'] = spec.protocol;
    }
    if (spec.allowSharedAccess !== undefined) {
      parameters['allowSharedAccess'] = String(spec.allowSharedAccess);
    }
    if (spec.resourceGroup) {
      parameters['resourceGroup'] = spec.resourceGroup;
    }
    if (spec.storageAccount) {
      parameters['storageAccount'] = spec.storageAccount;
    }
    if (spec.location) {
      parameters['location'] = spec.location;
    }
    if (spec.networkEndpointType) {
      parameters['networkEndpointType'] = spec.networkEndpointType;
    }

    // NFS-specific parameters
    if (spec.protocol === 'nfs' && spec.mountPermissions) {
      parameters['mountPermissions'] = spec.mountPermissions;
    }
    if (spec.protocol === 'nfs' && spec.rootSquashType) {
      parameters['rootSquashType'] = spec.rootSquashType;
    }

    return parameters;
  }

  private buildAzureFilesPVCSISpec(spec: AzureFilesPersistentVolumeSpec): Record<string, unknown> {
    // Validate protocol and secret configuration
    if (spec.protocol === 'nfs' && spec.secretName) {
      throw new Error(
        `Azure Files PV ${spec.name}: NFS protocol does not use secrets for authentication`,
      );
    }

    const volumeHandle = this.sanitizeVolumeHandle(spec.storageAccount, spec.shareName);

    const volumeAttributes: Record<string, string> = {
      storageAccount: spec.storageAccount,
      shareName: spec.shareName,
    };

    if (spec.resourceGroup) {
      volumeAttributes['resourceGroup'] = spec.resourceGroup;
    }
    if (spec.protocol) {
      volumeAttributes['protocol'] = spec.protocol;
    }
    if (spec.server) {
      volumeAttributes['server'] = spec.server;
    }
    if (spec.folderName) {
      volumeAttributes['folderName'] = spec.folderName;
    }
    if (spec.mountPermissions) {
      volumeAttributes['mountPermissions'] = spec.mountPermissions;
    }

    const csiSpec: Record<string, unknown> = {
      driver: Rutter.AZURE_FILES_CSI_DRIVER,
      volumeHandle,
      volumeAttributes,
    };

    // Add secret reference for SMB protocol
    if (spec.protocol !== 'nfs' && spec.secretName) {
      csiSpec['nodeStageSecretRef'] = {
        name: spec.secretName,
        namespace: spec.secretNamespace ?? 'default',
      };
    }

    return csiSpec;
  }

  private buildPodEnvironment(spec: JobSpec | CronJobSpec) {
    const envEntries = spec.env
      ? Object.entries(spec.env).map(([name, value]) => this.sanitizeEnvVar(name, value))
      : undefined;
    const envFromEntries = spec.envFrom
      ? spec.envFrom
          .map((s) => {
            const entry: { configMapRef?: { name: string }; secretRef?: { name: string } } = {};
            if (s.configMapRef) {
              entry.configMapRef = { name: s.configMapRef };
            }
            if (s.secretRef) {
              entry.secretRef = { name: s.secretRef };
            }
            return entry;
          })
          .filter((entry) => entry.configMapRef || entry.secretRef)
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

    return { envEntries, envFromEntries, volumeDefs, volumeMountDefs };
  }

  private buildJobSpec(spec: JobSpec): Record<string, unknown> {
    return {
      ...(spec.backoffLimit !== undefined ? { backoffLimit: spec.backoffLimit } : {}),
      ...(spec.activeDeadlineSeconds !== undefined
        ? { activeDeadlineSeconds: spec.activeDeadlineSeconds }
        : {}),
      ...(spec.ttlSecondsAfterFinished !== undefined
        ? { ttlSecondsAfterFinished: spec.ttlSecondsAfterFinished }
        : {}),
      ...(spec.completions !== undefined ? { completions: spec.completions } : {}),
      ...(spec.parallelism !== undefined ? { parallelism: spec.parallelism } : {}),
      ...(spec.completionMode !== undefined ? { completionMode: spec.completionMode } : {}),
      ...(spec.suspend !== undefined ? { suspend: spec.suspend } : {}),
    };
  }

  private buildJobPodTemplate(
    spec: JobSpec,
    envEntries: Array<{ name: string; value: string }> | undefined,
    envFromEntries:
      | Array<{ configMapRef?: { name: string }; secretRef?: { name: string } }>
      | undefined,
    volumeDefs: Array<Record<string, unknown>> | undefined,
    volumeMountDefs: Array<Record<string, unknown>> | undefined,
  ): Record<string, unknown> {
    return {
      metadata: {
        ...(spec.podLabels ? { labels: spec.podLabels } : {}),
        ...(spec.podAnnotations ? { annotations: spec.podAnnotations } : {}),
      },
      spec: {
        restartPolicy: spec.restartPolicy ?? 'Never',
        serviceAccountName: spec.serviceAccountName,
        volumes: volumeDefs,
        containers: [
          {
            name: spec.name,
            image: spec.image,
            imagePullPolicy: spec.imagePullPolicy,
            ...(spec.command ? { command: spec.command } : {}),
            ...(spec.args ? { args: spec.args } : {}),
            env: envEntries,
            envFrom: envFromEntries,
            volumeMounts: volumeMountDefs,
            resources: spec.resources ?? this.getDefaultResources(),
          },
        ],
      },
    };
  }

  private buildCronJobSpec(spec: CronJobSpec): Record<string, unknown> {
    return {
      schedule: spec.schedule,
      ...(spec.startingDeadlineSeconds !== undefined
        ? { startingDeadlineSeconds: spec.startingDeadlineSeconds }
        : {}),
      ...(spec.concurrencyPolicy !== undefined
        ? { concurrencyPolicy: spec.concurrencyPolicy }
        : {}),
      ...(spec.suspend !== undefined ? { suspend: spec.suspend } : {}),
      ...(spec.successfulJobsHistoryLimit !== undefined
        ? { successfulJobsHistoryLimit: spec.successfulJobsHistoryLimit }
        : {}),
      ...(spec.failedJobsHistoryLimit !== undefined
        ? { failedJobsHistoryLimit: spec.failedJobsHistoryLimit }
        : {}),
      ...(spec.timeZone !== undefined ? { timeZone: spec.timeZone } : {}),
    };
  }

  private buildCronJobTemplate(
    spec: CronJobSpec,
    envEntries: Array<{ name: string; value: string }> | undefined,
    envFromEntries:
      | Array<{ configMapRef?: { name: string }; secretRef?: { name: string } }>
      | undefined,
    volumeDefs: Array<Record<string, unknown>> | undefined,
    volumeMountDefs: Array<Record<string, unknown>> | undefined,
  ): Record<string, unknown> {
    return {
      spec: {
        ...(spec.backoffLimit !== undefined ? { backoffLimit: spec.backoffLimit } : {}),
        ...(spec.activeDeadlineSeconds !== undefined
          ? { activeDeadlineSeconds: spec.activeDeadlineSeconds }
          : {}),
        ...(spec.ttlSecondsAfterFinished !== undefined
          ? { ttlSecondsAfterFinished: spec.ttlSecondsAfterFinished }
          : {}),
        ...(spec.completions !== undefined ? { completions: spec.completions } : {}),
        ...(spec.parallelism !== undefined ? { parallelism: spec.parallelism } : {}),
        ...(spec.completionMode !== undefined ? { completionMode: spec.completionMode } : {}),
        template: {
          metadata: {
            ...(spec.podLabels ? { labels: spec.podLabels } : {}),
            ...(spec.podAnnotations ? { annotations: spec.podAnnotations } : {}),
          },
          spec: {
            restartPolicy: spec.restartPolicy ?? 'Never',
            serviceAccountName: spec.serviceAccountName,
            volumes: volumeDefs,
            containers: [
              {
                name: spec.name,
                image: spec.image,
                imagePullPolicy: spec.imagePullPolicy,
                ...(spec.command ? { command: spec.command } : {}),
                ...(spec.args ? { args: spec.args } : {}),
                env: envEntries,
                envFrom: envFromEntries,
                volumeMounts: volumeMountDefs,
                resources: spec.resources ?? this.getDefaultResources(),
              },
            ],
          },
        },
      },
    };
  }

  /**
   * Validate Job specification for security and best practices
   */
  private validateJobSpec(spec: JobSpec): void {
    if (spec.activeDeadlineSeconds !== undefined && spec.activeDeadlineSeconds <= 0) {
      throw new Error('activeDeadlineSeconds must be a positive integer');
    }
    if (spec.ttlSecondsAfterFinished !== undefined && spec.ttlSecondsAfterFinished < 0) {
      throw new Error('ttlSecondsAfterFinished must be a non-negative integer');
    }
  }

  /**
   * Validate CronJob specification for security and best practices
   */
  private validateCronJobSpec(spec: CronJobSpec): void {
    this.validateCronSchedule(spec.schedule);

    if (spec.suspend && spec.startingDeadlineSeconds !== undefined) {
      throw new Error('startingDeadlineSeconds should not be set when job is suspended');
    }
    if (spec.successfulJobsHistoryLimit !== undefined && spec.successfulJobsHistoryLimit < 0) {
      throw new Error('successfulJobsHistoryLimit must be non-negative');
    }
    if (spec.failedJobsHistoryLimit !== undefined && spec.failedJobsHistoryLimit < 0) {
      throw new Error('failedJobsHistoryLimit must be non-negative');
    }
    if (spec.activeDeadlineSeconds !== undefined && spec.activeDeadlineSeconds <= 0) {
      throw new Error('activeDeadlineSeconds must be a positive integer');
    }
    if (spec.ttlSecondsAfterFinished !== undefined && spec.ttlSecondsAfterFinished < 0) {
      throw new Error('ttlSecondsAfterFinished must be a non-negative integer');
    }
  }

  /**
   * Validate cron schedule expression
   */
  private validateCronSchedule(schedule: string): void {
    const cronRegex =
      /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    if (!cronRegex.test(schedule)) {
      throw new Error('Invalid cron schedule expression');
    }
  }

  /**
   * Sanitize environment variable names and values
   */
  private sanitizeEnvVar(name: string, value: string): { name: string; value: string } {
    const nameRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!nameRegex.test(name)) {
      throw new Error(`Invalid environment variable name: ${name}`);
    }
    // Remove control characters from value (ASCII 0-31 and 127)
    const sanitizedValue = value.replace(/[\cA-\c_\x7F]/g, '');
    return { name, value: sanitizedValue };
  }

  /**
   * Get default resource limits for Jobs and CronJobs
   */
  private getDefaultResources(): ResourceRequirements {
    return {
      limits: {
        cpu: '1',
        memory: '512Mi',
      },
      requests: {
        cpu: '100m',
        memory: '128Mi',
      },
    };
  }

  /**
   * Validate Azure Files parameters for security and compliance
   */
  private validateAzureFilesParameters(spec: AzureFilesStorageClassSpec): void {
    const validSkuNames = [
      'Standard_LRS',
      'Standard_GRS',
      'Standard_RAGRS',
      'Standard_ZRS',
      'Premium_LRS',
      'Premium_ZRS',
    ];

    if (spec.skuName && !validSkuNames.includes(spec.skuName)) {
      throw new Error(
        `Invalid skuName: ${spec.skuName}. Must be one of: ${validSkuNames.join(', ')}`,
      );
    }

    if (spec.protocol === 'nfs' && spec.mountPermissions) {
      const permRegex = /^[0-7]{3,4}$/;
      if (!permRegex.test(spec.mountPermissions)) {
        throw new Error('mountPermissions must be a valid octal permission string (e.g., "0777")');
      }
    }
  }

  /**
   * Sanitize volume handle to ensure valid format for CSI driver
   */
  private sanitizeVolumeHandle(account: string, share: string): string {
    // Remove special characters and ensure valid format
    const sanitizedAccount = account.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const sanitizedShare = share.replace(/[^a-z0-9-]/gi, '').toLowerCase();
    return `${sanitizedAccount}#${sanitizedShare}`;
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
   * Extract a meaningful name from a Kubernetes resource object
   */
  private getResourceName(obj: unknown): string {
    if (obj && typeof obj === 'object') {
      const resource = obj as {
        kind?: string;
        metadata?: { name?: string };
      };
      if (resource.kind && resource.metadata?.name) {
        return `${resource.kind.toLowerCase()}-${resource.metadata.name}`;
      }
      if (resource.kind) {
        return resource.kind.toLowerCase();
      }
    }
    return 'resource';
  }

  /**
   * Adds a raw CRD manifest to the chart
   *
   * @param {string} yaml - YAML content of the CRD
   * @param {string} [id='crd'] - Asset identifier
   *
   * @example
   * ```typescript
   * const crdYaml = `
   * apiVersion: apiextensions.k8s.io/v1
   * kind: CustomResourceDefinition
   * metadata:
   *   name: myresources.example.com
   * `;
   * rutter.addCrd(crdYaml, 'myresource-crd');
   * ```
   *
   * @since 1.0.0
   */
  addCrd(yaml: string, id = 'crd') {
    this.assets.push({ id, yaml, target: 'crds' });
  }

  /**
   * Add Karpenter NodePool for intelligent node provisioning.
   * Creates a NodePool resource that defines compute requirements and lifecycle policies.
   *
   * @param spec - Karpenter NodePool specification
   * @returns The created NodePool ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodePool({
   *   name: 'general-purpose',
   *   requirements: [
   *     { key: 'eks.amazonaws.com/instance-category', operator: 'In', values: ['c', 'm', 'r'] },
   *     { key: 'kubernetes.io/arch', operator: 'In', values: ['amd64'] }
   *   ],
   *   limits: { cpu: '1000', memory: '1000Gi' },
   *   nodeClassRef: { name: 'default' }
   * });
   * ```
   *
   * @since 2.3.0
   */
  addKarpenterNodePool(spec: KarpenterNodePoolSpec) {
    // Validate NodePool specification
    this.validateKarpenterNodePoolSpec(spec);

    const nodePool = new ApiObject(this.chart, spec.name, {
      apiVersion: 'karpenter.sh/v1',
      kind: 'NodePool',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        template: {
          metadata: {
            ...(spec.labels ? { labels: spec.labels } : {}),
          },
          spec: {
            nodeClassRef: {
              group: spec.nodeClassRef.group ?? 'eks.amazonaws.com',
              kind: spec.nodeClassRef.kind ?? 'NodeClass',
              name: spec.nodeClassRef.name,
            },
            ...(spec.requirements ? { requirements: spec.requirements } : {}),
            ...(spec.taints ? { taints: spec.taints } : {}),
          },
        },
        ...(spec.limits ? { limits: spec.limits } : {}),
        ...(spec.disruption ? { disruption: spec.disruption } : {}),
      },
    });
    this.capture(nodePool, `${spec.name}-nodepool`);
    return nodePool;
  }

  /**
   * Add Karpenter EC2 NodeClass for AWS-specific node configuration.
   * Creates a NodeClass resource that defines EC2 instance settings and networking.
   *
   * @param spec - Karpenter EC2 NodeClass specification
   * @returns The created NodeClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterEC2NodeClass({
   *   name: 'default',
   *   amiFamily: 'AL2023',
   *   subnetSelectorTerms: [{ tags: { 'karpenter.sh/discovery': 'my-cluster' } }],
   *   securityGroupSelectorTerms: [{ tags: { 'karpenter.sh/discovery': 'my-cluster' } }],
   *   role: 'KarpenterNodeInstanceProfile'
   * });
   * ```
   *
   * @since 2.3.0
   */
  addKarpenterEC2NodeClass(spec: KarpenterEC2NodeClassSpec) {
    // Validate EC2 NodeClass specification
    this.validateKarpenterEC2NodeClassSpec(spec);

    const nodeClass = new ApiObject(this.chart, spec.name, {
      apiVersion: 'eks.amazonaws.com/v1',
      kind: 'NodeClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        ...(spec.amiFamily ? { amiFamily: spec.amiFamily } : {}),
        ...(spec.instanceStorePolicy ? { instanceStorePolicy: spec.instanceStorePolicy } : {}),
        ...(spec.userData ? { userData: spec.userData } : {}),
        ...(spec.subnetSelectorTerms ? { subnetSelectorTerms: spec.subnetSelectorTerms } : {}),
        ...(spec.securityGroupSelectorTerms
          ? { securityGroupSelectorTerms: spec.securityGroupSelectorTerms }
          : {}),
        ...(spec.role ? { role: spec.role } : {}),
        ...(spec.instanceProfile ? { instanceProfile: spec.instanceProfile } : {}),
        ...(spec.metadataOptions ? { metadataOptions: spec.metadataOptions } : {}),
        ...(spec.blockDeviceMappings ? { blockDeviceMappings: spec.blockDeviceMappings } : {}),
        ...(spec.tags ? { tags: spec.tags } : {}),
      },
    });
    this.capture(nodeClass, `${spec.name}-nodeclass`);
    return nodeClass;
  }

  /**
   * Validate Karpenter NodePool specification
   */
  private validateKarpenterNodePoolSpec(spec: KarpenterNodePoolSpec): void {
    this.validateNodeClassRef(spec);
    this.validateNodePoolRequirements(spec);
    this.validateNodePoolLimits(spec);
    this.validateNodePoolDisruption(spec);
  }

  private validateNodeClassRef(spec: KarpenterNodePoolSpec): void {
    if (!spec.nodeClassRef.name) {
      throw new Error(`Karpenter NodePool ${spec.name}: nodeClassRef.name is required`);
    }
  }

  private validateNodePoolRequirements(spec: KarpenterNodePoolSpec): void {
    if (!spec.requirements) return;

    const operatorsRequiringValues = ['In', 'NotIn', 'Gt', 'Lt'];
    for (const req of spec.requirements) {
      if (operatorsRequiringValues.includes(req.operator) && !req.values?.length) {
        throw new Error(
          `Karpenter NodePool ${spec.name}: requirement with operator '${req.operator}' must have values`,
        );
      }
    }
  }

  private validateNodePoolLimits(spec: KarpenterNodePoolSpec): void {
    if (!spec.limits) return;

    if (spec.limits.cpu && !this.isValidResourceQuantity(spec.limits.cpu)) {
      throw new Error(`Karpenter NodePool ${spec.name}: invalid CPU limit format`);
    }
    if (spec.limits.memory && !this.isValidResourceQuantity(spec.limits.memory)) {
      throw new Error(`Karpenter NodePool ${spec.name}: invalid memory limit format`);
    }
  }

  private validateNodePoolDisruption(spec: KarpenterNodePoolSpec): void {
    if (!spec.disruption) return;

    if (
      spec.disruption.consolidateAfter &&
      !this.isValidDuration(spec.disruption.consolidateAfter)
    ) {
      throw new Error(`Karpenter NodePool ${spec.name}: invalid consolidateAfter duration format`);
    }
    if (spec.disruption.expireAfter && !this.isValidDuration(spec.disruption.expireAfter)) {
      throw new Error(`Karpenter NodePool ${spec.name}: invalid expireAfter duration format`);
    }
  }

  /**
   * Validate Karpenter EC2 NodeClass specification
   */
  private validateKarpenterEC2NodeClassSpec(spec: KarpenterEC2NodeClassSpec): void {
    this.validateNodeClassSelectors(spec);
    this.validateNodeClassBlockDevices(spec);
    this.validateNodeClassMetadataOptions(spec);
  }

  private validateNodeClassSelectors(spec: KarpenterEC2NodeClassSpec): void {
    if (!spec.subnetSelectorTerms?.length && !spec.securityGroupSelectorTerms?.length) {
      console.warn(
        `Karpenter EC2 NodeClass ${spec.name}: Consider specifying subnet and security group selectors for better control`,
      );
    }
  }

  private validateNodeClassBlockDevices(spec: KarpenterEC2NodeClassSpec): void {
    if (!spec.blockDeviceMappings) return;

    for (const mapping of spec.blockDeviceMappings) {
      if (mapping.ebs?.volumeSize && !this.isValidStorageSize(mapping.ebs.volumeSize)) {
        throw new Error(
          `Karpenter EC2 NodeClass ${spec.name}: invalid volume size format in block device mapping`,
        );
      }
      if (mapping.ebs?.iops !== undefined && mapping.ebs.iops < 100) {
        throw new Error(
          `Karpenter EC2 NodeClass ${spec.name}: IOPS must be at least 100 for block device mapping`,
        );
      }
    }
  }

  private validateNodeClassMetadataOptions(spec: KarpenterEC2NodeClassSpec): void {
    if (spec.metadataOptions?.httpPutResponseHopLimit === undefined) return;

    const hopLimit = spec.metadataOptions.httpPutResponseHopLimit;
    if (hopLimit < 1 || hopLimit > 64) {
      throw new Error(
        `Karpenter EC2 NodeClass ${spec.name}: httpPutResponseHopLimit must be between 1 and 64`,
      );
    }
  }

  /**
   * Validate Kubernetes resource quantity format (e.g., "100m", "1Gi")
   */
  private isValidResourceQuantity(quantity: string): boolean {
    // Safe validation without regex to prevent ReDoS
    const validUnits = ['m', 'k', 'M', 'G', 'T', 'P', 'E', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei'];

    // Find the unit suffix
    let numberPart = quantity;
    let hasValidUnit = false;

    for (const unit of validUnits) {
      if (quantity.endsWith(unit)) {
        numberPart = quantity.slice(0, -unit.length);
        hasValidUnit = true;
        break;
      }
    }

    // If no unit found, that's also valid (plain number)
    if (!hasValidUnit && quantity.length > 0) {
      numberPart = quantity;
    }

    // Validate the number part
    const num = parseFloat(numberPart);
    return !isNaN(num) && num >= 0 && numberPart === String(num);
  }

  /**
   * Validate duration format (e.g., "30s", "5m", "1h")
   */
  private isValidDuration(duration: string): boolean {
    // Safe validation without regex to prevent ReDoS
    const validUnits = ['ns', 'us', 'µs', 'ms', 's', 'm', 'h'];

    // Find the unit suffix
    let numberPart = duration;
    let hasValidUnit = false;

    for (const unit of validUnits) {
      if (duration.endsWith(unit)) {
        numberPart = duration.slice(0, -unit.length);
        hasValidUnit = true;
        break;
      }
    }

    // Duration must have a unit
    if (!hasValidUnit) return false;

    // Validate the number part
    const num = parseFloat(numberPart);
    return !isNaN(num) && num >= 0 && numberPart === String(num);
  }

  /**
   * Validate storage size format (e.g., "20", "100Gi")
   */
  private isValidStorageSize(size: string): boolean {
    // Safe validation without regex to prevent ReDoS
    const validUnits = ['Gi', 'G', 'Ti', 'T'];

    // Find the unit suffix
    let numberPart = size;
    let hasValidUnit = false;

    for (const unit of validUnits) {
      if (size.endsWith(unit)) {
        numberPart = size.slice(0, -unit.length);
        hasValidUnit = true;
        break;
      }
    }

    // If no unit found, that's also valid (plain number)
    if (!hasValidUnit && size.length > 0) {
      numberPart = size;
    }

    // Validate the number part
    const num = parseFloat(numberPart);
    return !isNaN(num) && num >= 0 && numberPart === String(num);
  }

  /**
   * Validate GCP service account email format
   */
  private isValidGCPServiceAccountEmail(email: string): boolean {
    // Skip validation for Helm template values
    if (email.includes('{{') && email.includes('}}')) {
      return true;
    }
    // Basic validation for GCP service account email format
    // Format: service-account-name@project-id.iam.gserviceaccount.com
    const gcpEmailRegex = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
    return gcpEmailRegex.test(email);
  }

  /**
   * Add Karpenter NodeClaim for individual node provisioning.
   * Creates a NodeClaim resource that represents a request for a single node.
   *
   * @param spec - Karpenter NodeClaim specification
   * @returns The created NodeClaim ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodeClaim({
   *   name: 'high-memory-node',
   *   requirements: [
   *     { key: 'eks.amazonaws.com/instance-category', operator: 'In', values: ['r'] },
   *     { key: 'eks.amazonaws.com/instance-cpu', operator: 'In', values: ['16', '32'] }
   *   ],
   *   nodeClassRef: { name: 'memory-optimized' },
   *   expireAfter: '24h'
   * });
   * ```
   *
   * @since 2.3.0
   */
  addKarpenterNodeClaim(spec: KarpenterNodeClaimSpec) {
    // Validate NodeClaim specification
    this.validateKarpenterNodeClaimSpec(spec);

    const nodeClaim = new ApiObject(this.chart, spec.name, {
      apiVersion: 'karpenter.sh/v1',
      kind: 'NodeClaim',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: {
        nodeClassRef: {
          group: spec.nodeClassRef.group ?? 'eks.amazonaws.com',
          kind: spec.nodeClassRef.kind ?? 'NodeClass',
          name: spec.nodeClassRef.name,
        },
        ...(spec.requirements ? { requirements: spec.requirements } : {}),
        ...(spec.taints ? { taints: spec.taints } : {}),
        ...(spec.startupTaints ? { startupTaints: spec.startupTaints } : {}),
        ...(spec.expireAfter ? { expireAfter: spec.expireAfter } : {}),
        ...(spec.terminationGracePeriod
          ? { terminationGracePeriod: spec.terminationGracePeriod }
          : {}),
      },
    });
    this.capture(nodeClaim, `${spec.name}-nodeclaim`);
    return nodeClaim;
  }

  /**
   * Add advanced Karpenter scheduling configuration.
   * Creates scheduling constraints for fine-grained pod placement control.
   *
   * @param spec - Karpenter scheduling specification
   * @returns Configuration object for use in pod specs
   *
   * @example
   * ```typescript
   * const schedulingConfig = rutter.addKarpenterScheduling({
   *   name: 'zone-spread-scheduling',
   *   topologySpreadConstraints: [{
   *     maxSkew: 1,
   *     topologyKey: 'topology.kubernetes.io/zone',
   *     whenUnsatisfiable: 'DoNotSchedule',
   *     labelSelector: { matchLabels: { app: 'web' } }
   *   }],
   *   nodeAffinity: {
   *     requiredDuringSchedulingIgnoredDuringExecution: {
   *       nodeSelectorTerms: [{
   *         matchExpressions: [{
   *           key: 'eks.amazonaws.com/instance-category',
   *           operator: 'In',
   *           values: ['c', 'm']
   *         }]
   *       }]
   *     }
   *   }
   * });
   * ```
   *
   * @since 2.3.0
   */
  addKarpenterScheduling(spec: KarpenterSchedulingSpec) {
    // Validate scheduling specification
    this.validateKarpenterSchedulingSpec(spec);

    // Return scheduling configuration for use in pod specs
    return {
      ...(spec.nodeSelector ? { nodeSelector: spec.nodeSelector } : {}),
      ...(spec.nodeAffinity ? { affinity: { nodeAffinity: spec.nodeAffinity } } : {}),
      ...(spec.topologySpreadConstraints
        ? { topologySpreadConstraints: spec.topologySpreadConstraints }
        : {}),
      ...(spec.tolerations ? { tolerations: spec.tolerations } : {}),
      ...(spec.priorityClassName ? { priorityClassName: spec.priorityClassName } : {}),
      ...(spec.schedulerName ? { schedulerName: spec.schedulerName } : {}),
    };
  }

  /**
   * Create advanced disruption configuration for NodePools.
   * Provides fine-grained control over when and how nodes are disrupted.
   *
   * @param spec - Advanced disruption specification
   * @returns Disruption configuration object
   *
   * @example
   * ```typescript
   * const disruptionConfig = rutter.createKarpenterDisruption({
   *   consolidationPolicy: 'WhenEmptyOrUnderutilized',
   *   consolidateAfter: '30s',
   *   expireAfter: '2160h', // 90 days
   *   budgets: [{
   *     schedule: '0 9 * * mon-fri', // Business hours
   *     duration: '8h',
   *     nodes: '0', // No disruption during business hours
   *     reasons: ['Underutilized', 'Empty']
   *   }]
   * });
   * ```
   *
   * @since 2.3.0
   */
  createKarpenterDisruption(spec: KarpenterAdvancedDisruption) {
    // Validate disruption specification
    this.validateKarpenterDisruptionSpec(spec);

    return {
      ...(spec.consolidationPolicy ? { consolidationPolicy: spec.consolidationPolicy } : {}),
      ...(spec.consolidateAfter ? { consolidateAfter: spec.consolidateAfter } : {}),
      ...(spec.expireAfter ? { expireAfter: spec.expireAfter } : {}),
      ...(spec.budgets ? { budgets: spec.budgets } : {}),
    };
  }

  /**
   * Validate Karpenter NodeClaim specification
   */
  private validateKarpenterNodeClaimSpec(spec: KarpenterNodeClaimSpec): void {
    // Validate NodeClass reference
    if (!spec.nodeClassRef.name) {
      throw new Error(`Karpenter NodeClaim ${spec.name}: nodeClassRef.name is required`);
    }

    // Validate expiration format
    if (spec.expireAfter && !this.isValidDuration(spec.expireAfter)) {
      throw new Error(`Karpenter NodeClaim ${spec.name}: invalid expireAfter duration format`);
    }

    // Validate termination grace period
    if (spec.terminationGracePeriod && !this.isValidDuration(spec.terminationGracePeriod)) {
      throw new Error(
        `Karpenter NodeClaim ${spec.name}: invalid terminationGracePeriod duration format`,
      );
    }

    // Validate requirements
    if (spec.requirements) {
      for (const req of spec.requirements) {
        if (['In', 'NotIn', 'Gt', 'Lt'].includes(req.operator) && !req.values?.length) {
          throw new Error(
            `Karpenter NodeClaim ${spec.name}: requirement with operator '${req.operator}' must have values`,
          );
        }
      }
    }
  }

  /**
   * Validate Karpenter scheduling specification
   */
  private validateKarpenterSchedulingSpec(spec: KarpenterSchedulingSpec): void {
    this.validateTopologySpreadConstraints(spec);
    this.validateSchedulingTolerations(spec);
  }

  private validateTopologySpreadConstraints(spec: KarpenterSchedulingSpec): void {
    if (!spec.topologySpreadConstraints) return;

    for (const constraint of spec.topologySpreadConstraints) {
      if (constraint.maxSkew < 1) {
        throw new Error(
          `Karpenter Scheduling ${spec.name}: maxSkew must be at least 1 in topology spread constraint`,
        );
      }
      if (!constraint.topologyKey) {
        throw new Error(
          `Karpenter Scheduling ${spec.name}: topologyKey is required in topology spread constraint`,
        );
      }
    }
  }

  private validateSchedulingTolerations(spec: KarpenterSchedulingSpec): void {
    if (!spec.tolerations) return;

    for (const toleration of spec.tolerations) {
      if (toleration.operator === 'Equal' && !toleration.value) {
        throw new Error(
          `Karpenter Scheduling ${spec.name}: value is required when operator is 'Equal' in toleration`,
        );
      }
    }
  }

  /**
   * Validate Karpenter disruption specification
   */
  private validateKarpenterDisruptionSpec(spec: KarpenterAdvancedDisruption): void {
    this.validateDisruptionDurations(spec);
    this.validateDisruptionBudgets(spec);
  }

  private validateDisruptionDurations(spec: KarpenterAdvancedDisruption): void {
    if (spec.consolidateAfter && !this.isValidDuration(spec.consolidateAfter)) {
      throw new Error('Invalid consolidateAfter duration format');
    }
    if (spec.expireAfter && !this.isValidDuration(spec.expireAfter)) {
      throw new Error('Invalid expireAfter duration format');
    }
  }

  private validateDisruptionBudgets(spec: KarpenterAdvancedDisruption): void {
    if (!spec.budgets) return;

    for (const budget of spec.budgets) {
      if (budget.schedule && budget.duration) {
        // Basic cron validation - should have 5 parts
        const cronParts = budget.schedule.split(' ');
        if (cronParts.length !== 5) {
          throw new Error('Budget schedule must be a valid cron expression with 5 parts');
        }
      }
      if (budget.duration && !this.isValidDuration(budget.duration)) {
        throw new Error('Invalid budget duration format');
      }
    }
  }

  /**
   * Add GKE Workload Identity ServiceAccount
   * Creates a ServiceAccount with GKE Workload Identity annotations for secure authentication
   *
   * @param spec - GKE Workload Identity ServiceAccount specification
   * @returns The created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addGKEWorkloadIdentityServiceAccount({
   *   name: 'workload-identity-sa',
   *   gcpServiceAccountEmail: 'my-service@my-project.iam.gserviceaccount.com',
   *   automountServiceAccountToken: true
   * });
   * ```
   *
   * @since 2.3.0
   */
  addGKEWorkloadIdentityServiceAccount(spec: GKEWorkloadIdentityServiceAccountSpec) {
    if (!this.isValidGCPServiceAccountEmail(spec.gcpServiceAccountEmail)) {
      throw new Error(
        `GKE Workload Identity ${spec.name}: Invalid GCP service account email format`,
      );
    }

    const annotations: Record<string, string> = {
      'iam.gke.io/gcp-service-account': spec.gcpServiceAccountEmail,
      ...(spec.annotations ?? {}),
    };

    return this.addServiceAccount({
      name: spec.name,
      annotations,
      ...(spec.labels ? { labels: spec.labels } : {}),
      ...(spec.automountServiceAccountToken !== undefined
        ? { automountServiceAccountToken: spec.automountServiceAccountToken }
        : {}),
      ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
      ...(spec.secrets ? { secrets: spec.secrets } : {}),
    });
  }

  /**
   * Add GCE Load Balancer Ingress
   * Creates an Ingress resource that provisions a Google Cloud Load Balancer
   *
   * @param spec - GCE Load Balancer Ingress specification
   * @returns The created Ingress ApiObject
   *
   * @example
   * ```typescript
   * rutter.addGCELoadBalancerIngress({
   *   name: 'web-ingress',
   *   rules: [{
   *     paths: [{
   *       path: '/*',
   *       pathType: 'ImplementationSpecific',
   *       backend: { service: { name: 'web-service', port: { number: 80 } } }
   *     }]
   *   }],
   *   staticIpName: 'web-static-ip'
   * });
   * ```
   *
   * @since 2.3.0
   */
  addGCELoadBalancerIngress(spec: GCELoadBalancerIngressSpec) {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'gce',
      ...(spec.annotations ?? {}),
    };

    if (spec.staticIpName) {
      annotations['kubernetes.io/ingress.global-static-ip-name'] = spec.staticIpName;
    }
    if (spec.managedCertificates && spec.managedCertificates.length > 0) {
      annotations['networking.gke.io/managed-certificates'] = spec.managedCertificates.join(',');
    }
    if (spec.healthCheckPath) {
      annotations['ingress.gcp.kubernetes.io/backend-config'] =
        `{"default": "${spec.name}-backend-config"}`;
    }

    return this.addIngress({
      name: spec.name,
      rules: spec.rules,
      ...(spec.tls ? { tls: spec.tls } : {}),
      ...(spec.ingressClassName ? { ingressClassName: spec.ingressClassName } : {}),
      ...(spec.labels ? { labels: spec.labels } : {}),
      annotations,
    });
  }

  /**
   * Add AWS ECR ServiceAccount
   * Creates a ServiceAccount with IRSA for secure ECR access without credentials
   *
   * @param spec - AWS ECR ServiceAccount specification
   * @returns The created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSECRServiceAccount({
   *   name: 'ecr-access',
   *   roleArn: 'arn:aws:iam::123456789012:role/ECRAccessRole',
   *   region: 'us-west-2',
   *   registryIds: ['123456789012'],
   *   stsEndpointType: 'regional'
   * });
   * ```
   *
   * @since 2.3.0
   */
  addAWSECRServiceAccount(spec: AWSECRServiceAccountSpec) {
    // Validate token expiration range
    if (
      spec.tokenExpiration !== undefined &&
      (spec.tokenExpiration < 900 || spec.tokenExpiration > 43200)
    ) {
      throw new Error(
        `AWS ECR ServiceAccount ${spec.name}: tokenExpiration must be between 900 and 43200 seconds`,
      );
    }

    // Validate IAM role ARN format
    if (!spec.roleArn.match(/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/)) {
      throw new Error(`AWS ECR ServiceAccount ${spec.name}: Invalid IAM role ARN format`);
    }

    const annotations: Record<string, string> = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      'eks.amazonaws.com/sts-regional-endpoints': spec.stsEndpointType ?? 'regional',
      ...(spec.audience ? { 'eks.amazonaws.com/audience': spec.audience } : {}),
      ...(spec.tokenExpiration !== undefined
        ? { 'eks.amazonaws.com/token-expiration': String(spec.tokenExpiration) }
        : {}),
      ...(spec.annotations ?? {}),
    };

    // Add ECR-specific annotations for registry access
    if (spec.region) {
      annotations['ecr.amazonaws.com/region'] = spec.region;
    }
    if (spec.registryIds && spec.registryIds.length > 0) {
      annotations['ecr.amazonaws.com/registry-ids'] = spec.registryIds.join(',');
    }

    return this.addServiceAccount({
      name: spec.name,
      annotations,
      ...(spec.labels ? { labels: spec.labels } : {}),
      ...(spec.automountServiceAccountToken !== undefined
        ? { automountServiceAccountToken: spec.automountServiceAccountToken }
        : {}),
      ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
      ...(spec.secrets ? { secrets: spec.secrets } : {}),
    });
  }

  /**
   * Add GCP Artifact Registry ServiceAccount
   * Creates a ServiceAccount with Workload Identity for secure Artifact Registry access
   *
   * @param spec - GCP Artifact Registry ServiceAccount specification
   * @returns The created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addGCPArtifactRegistryServiceAccount({
   *   name: 'artifact-registry-access',
   *   gcpServiceAccountEmail: 'artifact-registry@my-project.iam.gserviceaccount.com',
   *   locations: ['us-central1', 'us-west1']
   * });
   * ```
   *
   * @since 2.3.0
   */
  addGCPArtifactRegistryServiceAccount(spec: GCPArtifactRegistryServiceAccountSpec) {
    if (!this.isValidGCPServiceAccountEmail(spec.gcpServiceAccountEmail)) {
      throw new Error(
        `GCP Artifact Registry ServiceAccount ${spec.name}: Invalid GCP service account email format`,
      );
    }

    const annotations: Record<string, string> = {
      'iam.gke.io/gcp-service-account': spec.gcpServiceAccountEmail,
      ...(spec.annotations ?? {}),
    };

    // Add Artifact Registry-specific annotations for location access
    if (spec.locations && spec.locations.length > 0) {
      annotations['artifact-registry.gcp.io/locations'] = spec.locations.join(',');
    }

    return this.addServiceAccount({
      name: spec.name,
      annotations,
      ...(spec.labels ? { labels: spec.labels } : {}),
      ...(spec.automountServiceAccountToken !== undefined
        ? { automountServiceAccountToken: spec.automountServiceAccountToken }
        : {}),
      ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
      ...(spec.secrets ? { secrets: spec.secrets } : {}),
    });
  }

  /**
   * Add GKE Persistent Disk StorageClass
   * Creates a StorageClass for Google Cloud Persistent Disks using CSI driver
   *
   * @param spec - GKE Persistent Disk StorageClass specification
   * @returns The created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addGKEPersistentDiskStorageClass({
   *   name: 'fast-ssd',
   *   diskType: 'pd-ssd',
   *   allowVolumeExpansion: true,
   *   volumeBindingMode: 'WaitForFirstConsumer'
   * });
   * ```
   *
   * @since 2.3.0
   */
  addGKEPersistentDiskStorageClass(spec: GKEPersistentDiskStorageClassSpec) {
    if (spec.diskType === 'pd-extreme' && !spec.provisionedIops) {
      throw new Error(
        `GKE StorageClass ${spec.name}: pd-extreme disk type requires provisionedIops parameter`,
      );
    }

    const parameters: Record<string, string> = {
      type: spec.diskType ?? 'pd-balanced',
    };

    if (spec.fsType) {
      parameters['csi.storage.k8s.io/fstype'] = spec.fsType;
    }
    if (spec.provisionedIops) {
      parameters['provisioned-iops-on-create'] = String(spec.provisionedIops);
    }

    const sc = new ApiObject(this.chart, spec.name, {
      apiVersion: Rutter.STORAGE_API_VERSION,
      kind: 'StorageClass',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      provisioner: 'pd.csi.storage.gke.io',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    });
    this.capture(sc, `${spec.name}-storageclass`);
    return sc;
  }

  /**
   * Synthesizes the cdk8s app and writes a complete Helm chart
   *
   * Generates all Kubernetes manifests, applies Helm templating,
   * and writes the complete chart structure to the output directory.
   *
   * @param {string} outDir - Output directory for the Helm chart
   * @throws {Error} If synthesis or writing fails
   *
   * @example
   * ```typescript
   * rutter.write('./charts/my-app');
   * // Creates: ./charts/my-app/Chart.yaml, values.yaml, templates/, etc.
   * ```
   *
   * @since 1.0.0
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
          'app.kubernetes.io/name': include(Rutter.HELPER_NAME),
          'app.kubernetes.io/instance': helm.releaseName,
          'app.kubernetes.io/version': helm.chartVersion,
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'app.kubernetes.io/part-of': helm.chartName,
        };
        for (const [k, v] of Object.entries(defaults)) {
          if (!(k in labels)) {
            // eslint-disable-next-line security/detect-object-injection -- Safe: controlled label assignment
            labels[k] = v;
          }
        }
      }
      return obj as Record<string, unknown>;
    });

    if (this.props.singleManifestFile) {
      // Combine all resources into a single manifest file
      const combinedYaml = enriched
        .map((obj) => YAML.stringify(obj).trim())
        .filter(Boolean)
        .join('\n---\n');
      this.assets.length = 0;
      const manifestId = this.props.manifestName ?? 'manifests';
      this.assets.push({ id: manifestId, yaml: combinedYaml, singleFile: true });
    } else {
      // Create separate files for each resource (default behavior)
      this.assets.length = 0;
      enriched.forEach((obj, _index) => {
        const yaml = YAML.stringify(obj).trim();
        if (yaml) {
          const resourceName = this.getResourceName(obj);
          const manifestId = this.props.manifestName
            ? `${this.props.manifestName}-${resourceName}`
            : resourceName;
          this.assets.push({ id: manifestId, yaml });
        }
      });
    }

    const options: HelmChartWriteOptions = {
      outDir,
      meta: this.props.meta,
      defaultValues: this.props.defaultValues
        ? this.applyOverrides(this.props.defaultValues)
        : undefined,
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
