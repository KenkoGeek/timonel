import { App, Chart, Testing, ApiObject } from 'cdk8s';
import YAML from 'yaml';

import { include, helm } from './helm.js';
import { HelmChartWriter } from './HelmChartWriter.js';
import type {
  HelmChartMeta,
  HelmChartWriteOptions,
  SynthAsset,
  HelperDefinition,
} from './HelmChartWriter.js';

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
  controllerPublishSecretRef?: { name: string; namespace?: string };
  nodeStageSecretRef?: { name: string; namespace?: string };
  nodePublishSecretRef?: { name: string; namespace?: string };
  controllerExpandSecretRef?: { name: string; namespace?: string };
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
    cachingMode?: 'None' | 'ReadOnly' | 'ReadWrite';
    fsType?: string;
    readOnly?: boolean;
    kind?: 'Shared' | 'Dedicated' | 'Managed';
  };
  azureFile?: {
    secretName: string;
    shareName: string;
    readOnly?: boolean;
    secretNamespace?: string;
  };
  gcePersistentDisk?: {
    pdName: string;
    fsType?: string;
    partition?: number;
    readOnly?: boolean;
  };
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
  /** Cloud provider for optimized defaults */
  cloudProvider?: 'aws' | 'azure' | 'gcp';
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

export interface JobSpec {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  envFrom?: EnvFromSource[];
  volumes?: VolumeSourceSpec[];
  volumeMounts?: VolumeMountSpec[];
  resources?: ResourceRequirements;
  restartPolicy?: 'Never' | 'OnFailure';
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  completions?: number;
  parallelism?: number;
  completionMode?: 'NonIndexed' | 'Indexed';
  suspend?: boolean;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  serviceAccountName?: string;
  /** Optional extra labels on the Job metadata */
  labels?: Record<string, string>;
  /** Optional annotations on the Job metadata */
  annotations?: Record<string, string>;
  /** Optional extra labels on the pod template */
  podLabels?: Record<string, string>;
  /** Optional annotations on the pod template */
  podAnnotations?: Record<string, string>;
}

export interface CronJobSpec {
  name: string;
  schedule: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  envFrom?: EnvFromSource[];
  volumes?: VolumeSourceSpec[];
  volumeMounts?: VolumeMountSpec[];
  resources?: ResourceRequirements;
  restartPolicy?: 'Never' | 'OnFailure';
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  completions?: number;
  parallelism?: number;
  completionMode?: 'NonIndexed' | 'Indexed';
  suspend?: boolean;
  startingDeadlineSeconds?: number;
  concurrencyPolicy?: 'Allow' | 'Forbid' | 'Replace';
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
  timeZone?: string;
  imagePullPolicy?: 'Always' | 'IfNotPresent' | 'Never';
  serviceAccountName?: string;
  /** Optional extra labels on the CronJob metadata */
  labels?: Record<string, string>;
  /** Optional annotations on the CronJob metadata */
  annotations?: Record<string, string>;
  /** Optional extra labels on the pod template */
  podLabels?: Record<string, string>;
  /** Optional annotations on the pod template */
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

export interface IngressRule {
  host?: string;
  paths: Array<{
    path: string;
    pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
    backend: {
      service: { name: string; port: { number?: number; name?: string } };
    };
  }>;
}

export interface IngressTLS {
  hosts?: string[];
  secretName?: string;
}

export interface IngressSpec {
  name: string;
  rules: IngressRule[];
  tls?: IngressTLS[];
  ingressClassName?: string;
  defaultBackend?: {
    service: { name: string; port: { number?: number; name?: string } };
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
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
  resources: { requests: { storage: string }; limits?: { storage: string } };
  storageClassName?: string;
  volumeMode?: VolumeMode;
  selector?: { matchLabels?: Record<string, string>; matchExpressions?: unknown[] };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  /** Reference to specific PV for static binding */
  volumeName?: string;
  /** Cloud provider for optimized defaults */
  cloudProvider?: 'aws' | 'azure' | 'gcp';
}

export interface ServiceAccountSpec {
  name: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: string[]; // names of Secrets
  secrets?: string[]; // names of Secrets to mount as tokens/files
  /**
   * EKS IRSA support: IAM role ARN for service account to assume
   * Example: arn:aws:iam::<account-id>:role/<role-name>
   * Adds annotation eks.amazonaws.com/role-arn
   */
  awsRoleArn?: string;
  /**
   * IRSA audience for token validation (default: sts.amazonaws.com)
   * Adds annotation eks.amazonaws.com/audience when provided
   */
  awsAudience?: string;
  /**
   * AWS STS endpoint type for IRSA (regional recommended for better performance)
   * Adds annotation eks.amazonaws.com/sts-regional-endpoints when provided
   * @default 'regional'
   */
  awsStsEndpointType?: 'regional' | 'legacy';
  /**
   * AWS region for regional STS endpoint (auto-detected if not provided)
   * Used with awsStsEndpointType: 'regional'
   */
  awsRegion?: string;
  /**
   * Token expiration time in seconds for IRSA tokens (3600-43200)
   * Adds annotation eks.amazonaws.com/token-expiration when provided
   * @default 3600
   */
  awsTokenExpiration?: number;
  /**
   * AKS Workload Identity: Azure application client ID
   * Adds annotation azure.workload.identity/client-id when provided
   */
  azureClientId?: string;
  /**
   * AKS Workload Identity: Azure tenant ID
   * Adds annotation azure.workload.identity/tenant-id when provided
   */
  azureTenantId?: string;
  /**
   * AKS Workload Identity: projected SA token expiration (seconds)
   * Adds annotation azure.workload.identity/service-account-token-expiration
   */
  azureServiceAccountTokenExpiration?: number;
  /**
   * GKE Workload Identity: Google service account email
   * Adds annotation iam.gke.io/gcp-service-account when provided
   */
  gcpServiceAccountEmail?: string;
}

export interface HorizontalPodAutoscalerMetric {
  type: 'Resource' | 'Pods' | 'Object' | 'External';
  resource?: {
    name: 'cpu' | 'memory';
    target: {
      type: 'Utilization' | 'AverageValue';
      averageUtilization?: number;
      averageValue?: string;
    };
  };
  pods?: {
    metric: { name: string; selector?: Record<string, unknown> };
    target: { type: 'AverageValue'; averageValue: string };
  };
  object?: {
    metric: { name: string; selector?: Record<string, unknown> };
    describedObject: { apiVersion: string; kind: string; name: string };
    target: { type: 'Value' | 'AverageValue'; value?: string; averageValue?: string };
  };
  external?: {
    metric: { name: string; selector?: Record<string, unknown> };
    target: { type: 'Value' | 'AverageValue'; value?: string; averageValue?: string };
  };
}

export interface HorizontalPodAutoscalerBehavior {
  scaleUp?: {
    stabilizationWindowSeconds?: number;
    selectPolicy?: 'Max' | 'Min' | 'Disabled';
    policies?: Array<{
      type: 'Pods' | 'Percent';
      value: number;
      periodSeconds: number;
    }>;
  };
  scaleDown?: {
    stabilizationWindowSeconds?: number;
    selectPolicy?: 'Max' | 'Min' | 'Disabled';
    policies?: Array<{
      type: 'Pods' | 'Percent';
      value: number;
      periodSeconds: number;
    }>;
  };
}

export interface HorizontalPodAutoscalerSpec {
  name: string;
  scaleTargetRef: {
    apiVersion: string;
    kind: 'Deployment' | 'StatefulSet' | 'ReplicaSet';
    name: string;
  };
  minReplicas?: number;
  maxReplicas: number;
  metrics?: HorizontalPodAutoscalerMetric[];
  behavior?: HorizontalPodAutoscalerBehavior;
  labels?: Record<string, string>;
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

export interface AWSEBSStorageClassSpec extends CloudResourceTags {
  name: string;
  volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
  fsType?: 'ext4' | 'xfs';
  encrypted?: boolean;
  kmsKeyId?: string;
  iops?: number;
  throughput?: number;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
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
 * Configuration interface for Azure Disk StorageClass.
 * Defines the parameters for creating an Azure Disk StorageClass in AKS.
 *
 * @see https://learn.microsoft.com/en-us/azure/aks/azure-csi-disk-storage-provision
 */
/**
 * Cloud resource tags with basic validation.
 * Provides a consistent interface for tagging resources across cloud providers.
 */
export interface CloudResourceTags {
  /** Resource tags as key-value pairs */
  tags?: Record<string, string>;
}

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

export interface AWSALBIngressSpec extends CloudResourceTags {
  name: string;
  rules: IngressRule[];
  tls?: IngressTLS[];
  scheme?: 'internet-facing' | 'internal';
  targetType?: 'instance' | 'ip';
  ipAddressType?: 'ipv4' | 'dualstack';
  groupName?: string;
  groupOrder?: number;
  subnets?: string[];
  securityGroups?: string[];
  certificateArn?: string;
  sslRedirect?: boolean;
  healthCheckPath?: string;
  healthCheckIntervalSeconds?: number;
  healthCheckTimeoutSeconds?: number;
  healthyThresholdCount?: number;
  unhealthyThresholdCount?: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Configuration interface for Azure Application Gateway Ingress Controller (AGIC).
 * Provides comprehensive support for AGIC annotations and features for AKS deployments.
 *
 * @see https://learn.microsoft.com/en-us/azure/application-gateway/ingress-controller-annotations
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

export interface NetworkPolicyPort {
  protocol?: 'TCP' | 'UDP' | 'SCTP';
  port?: number | string;
  endPort?: number;
}

export interface NetworkPolicyIngressRule {
  from?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyEgressRule {
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

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

export interface RutterProps {
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  /** Optional Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
  /** Optional NOTES.txt content */
  notesTpl?: string;
  /** Optional values.schema.json object */
  valuesSchema?: Record<string, unknown>;
  /** Optional custom name for the generated manifest file (without extension) */
  manifestName?: string;
  /**
   * If true, all Kubernetes resources will be combined into a single manifest file.
   * If false (default), each resource will be in its own numbered file.
   * @default false
   */
  singleManifestFile?: boolean;
}

/**
 * Rutter builds Kubernetes manifests using cdk8s and writes a Helm chart.
 */
export class Rutter {
  private readonly props: RutterProps;
  private readonly app: App;
  private readonly chart: Chart;
  private readonly assets: SynthAsset[] = [];
  private valueOverrides: Record<string, string> = {};

  constructor(props: RutterProps) {
    this.props = props;
    this.app = new App();
    this.chart = new Chart(this.app, props.manifestName ?? props.meta.name);
  }

  /**
   * Set dynamic value overrides (from --set flags)
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
    } catch {
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
        `PVC ${spec.name}: Azure Disk does not support ReadWriteMany, consider Azure Files`,
      );
    }

    if (storageClassName?.includes('ebs') && accessModes.includes('ReadWriteMany')) {
      console.warn(`PVC ${spec.name}: EBS does not support ReadWriteMany, consider EFS`);
    }
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

    if (Object.keys(volumeAttributes).length > 0) {
      csiSpec['volumeAttributes'] = volumeAttributes;
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
