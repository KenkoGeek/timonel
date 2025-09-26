/**
 * @fileoverview Base types and interfaces for Helm helpers
 * @since 2.11.0
 */

/**
 * Helper definition for Helm templates
 * @interface HelperDefinition
 * @since 2.8.0+
 */
export interface HelperDefinition {
  /** Helper name (without quotes or hyphens) */
  name: string;
  /** Helper template content */
  template: string;
}

/**
 * Helper categories for organization and filtering
 * @since 2.11.0
 */
export type HelperCategory =
  | 'standard'
  | 'fileAccess'
  | 'templateFunction'
  | 'sprig'
  | 'kubernetes'
  | 'aws'
  | 'env'
  | 'gitops'
  | 'observability'
  | 'validation';

/**
 * Cloud provider types for helper selection
 * @since 2.11.0
 */
export type CloudProvider = 'aws' | 'azure' | 'gcp';

/**
 * Options for helper inclusion and configuration
 * @since 2.11.0
 */
export interface HelperOptions {
  includeFileAccess?: boolean;
  includeTemplateFunction?: boolean;
  includeSprig?: boolean;
  includeKubernetes?: boolean;
  includeEnv?: boolean;
  includeGitops?: boolean;
  includeObservability?: boolean;
  includeValidation?: boolean;
}
