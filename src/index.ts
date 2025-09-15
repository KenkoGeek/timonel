/**
 * @fileoverview Main entry point for Timonel - TypeScript library for programmatic Helm chart generation
 * @since 2.8.0+
 */

export * from './lib/helm.js';
export * from './lib/helmChartWriter.js';
export * from './lib/rutter.js';
export * from './lib/security.js';
export * from './lib/umbrella.js';

export type {
  AWSALBIngressSpec,
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
} from './lib/resources/cloud/aws/awsResources.js';

export type {
  KarpenterDisruption,
  KarpenterDisruptionBudget,
  KarpenterEC2NodeClassSpec,
  KarpenterNodeClaimSpec,
  KarpenterNodePoolSpec,
} from './lib/resources/cloud/aws/karpenterResources.js';

export {
  DEFAULT_TERMINATION_GRACE_PERIOD,
  isValidDisruptionBudget,
  isValidKubernetesDuration,
  KarpenterVersionUtils,
} from './lib/resources/cloud/aws/karpenterResources.js';

// Re-export specific items from new modules to avoid conflicts
export {
  AWS_HELPERS,
  formatHelpers,
  generateHelpersTemplate,
  getDefaultHelpers,
  STANDARD_HELPERS,
  type HelperDefinition,
} from './lib/utils/helmHelpers.js';
