/**
 * @fileoverview Main entry point for Timonel - TypeScript library for programmatic Helm chart generation
 * @since 1.0.0
 */

export * from './lib/rutter.js';
export * from './lib/helmChartWriter.js';
export * from './lib/helm.js';
export * from './lib/umbrella.js';
export * from './lib/security.js';

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
