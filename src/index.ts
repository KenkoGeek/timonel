/**
 * @fileoverview Main entry point for Timonel - TypeScript library for programmatic Helm chart generation
 * @since 2.8.0+
 */

export * from './lib/helm.js';
export * from './lib/helmChartWriter.js';
export * from './lib/rutter.js';
export * from './lib/security.js';
export * from './lib/umbrella.js';

// Templates
export { BasicChart } from './lib/templates/basic-chart.js';
export { FlexibleSubchart, createFlexibleSubchart } from './lib/templates/flexible-subchart.js';
export { Subchart } from './lib/templates/subchart.js';
export { UmbrellaChartTemplate as UmbrellaChart } from './lib/templates/umbrella-chart.js';

// Types
export type { ChartProps, SubchartProps } from './lib/types.js';

// AWS Resources
export type {
  AWSALBIngressSpec,
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
} from './lib/resources/cloud/aws/awsResources.js';

// Karpenter Resources
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

// Helm Helpers
export {
  AWS_HELPERS,
  createHelper,
  FILE_ACCESS_HELPERS,
  formatHelpers,
  generateHelpersTemplate,
  getDefaultHelpers,
  getHelpersByCategory,
  KUBERNETES_HELPERS,
  SPRIG_HELPERS,
  STANDARD_HELPERS,
  TEMPLATE_FUNCTION_HELPERS,
  type HelperDefinition,
} from './lib/utils/helmHelpers.js';

// Logging Utilities
export {
  createLogger,
  logger,
  LogLevel,
  TimonelLogger,
  type LogContext,
  type LoggerConfig,
} from './lib/utils/logger.js';
