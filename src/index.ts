/**
 * @fileoverview Main entry point for Timonel - TypeScript library for programmatic Helm chart generation
 * @since 1.0.0
 */

export * from './lib/rutter.js';
export * from './lib/helmChartWriter.js';
export * from './lib/helm.js';
export * from './lib/umbrella.js';
export * from './lib/security.js';

// Export type definitions from resource providers
export type {
  DeploymentSpec,
  DaemonSetSpec,
  StatefulSetSpec,
  RoleSpec,
  ClusterRoleSpec,
  RoleBindingSpec,
  ClusterRoleBindingSpec,
  JobSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './lib/resources/core/coreResources.js';

export type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './lib/resources/core/storageResources.js';

export type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSECRServiceAccountSpec,
  AWSALBIngressSpec,
} from './lib/resources/cloud/aws/awsResources.js';

export type {
  AzureDiskStorageClassSpec,
  AzureFileStorageClassSpec,
  AzureAGICIngressSpec,
  AzureKeyVaultSecretProviderClassSpec,
  AzureACRServiceAccountSpec,
} from './lib/resources/cloud/azure/azureResources.js';

export type {
  GCPPersistentDiskStorageClassSpec,
  GCPFilestoreStorageClassSpec,
  GCPGCEIngressSpec,
  GCPWorkloadIdentityServiceAccountSpec,
  GCPArtifactRegistryServiceAccountSpec,
} from './lib/resources/cloud/gcp/gcpResources.js';

export type {
  HorizontalPodAutoscalerSpec,
  VerticalPodAutoscalerSpec,
  CronJobSpec,
} from './lib/resources/autoscaling/autoscalingResources.js';

export type {
  NetworkPolicySpec,
  IngressSpec,
  IngressTLSConfig,
  IngressEnvironment,
} from './lib/resources/network/networkResources.js';

export type {
  KarpenterNodePoolSpec,
  KarpenterNodeClaimSpec,
  KarpenterEC2NodeClassSpec,
  KarpenterDisruption,
  KarpenterDisruptionBudget,
} from './lib/resources/cloud/aws/karpenterResources.js';

export {
  KarpenterVersionUtils,
  isValidDisruptionBudget,
  isValidKubernetesDuration,
  DEFAULT_TERMINATION_GRACE_PERIOD,
} from './lib/resources/cloud/aws/karpenterResources.js';

// Re-export specific items from new modules to avoid conflicts
export {
  generateHelpersTemplate,
  getDefaultHelpers,
  formatHelpers,
  STANDARD_HELPERS,
  AWS_HELPERS,
  AZURE_HELPERS,
  GCP_HELPERS,
  type HelperDefinition,
} from './lib/utils/helmHelpers.js';

export {
  getResourceName,
  generateManifestName,
  sanitizeKubernetesName,
  isValidKubernetesName,
  type NamingStrategy,
  type KubernetesResource,
} from './lib/utils/resourceNaming.js';

export {
  createSecurePodTemplate,
  createWorkloadPodTemplate,
  createSidecarPodTemplate,
  createHealthyPodTemplate,
  type ContainerSpec,
  type PodTemplateSpec,
  type SecurityProfile,
  type WorkloadType,
} from './lib/utils/podTemplates.js';
