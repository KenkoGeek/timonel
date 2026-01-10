/**
 * Type definitions for the Policy Engine input validation
 */

/**
 * Configuration for a policy
 */
export interface PolicyConfig {
  /** Unique identifier for the policy */
  id: string;
  /** Human-readable name for the policy */
  name: string;
  /** Array of policy rules */
  rules: PolicyRule[];
  /** Optional description of the policy */
  description?: string;
  /** Version of the policy */
  version?: string;
  /** Whether the policy is enabled */
  enabled?: boolean;
}

/**
 * A single policy rule
 */
export interface PolicyRule {
  /** Unique identifier for the rule */
  id: string;
  /** Type of the rule (e.g., 'security', 'compliance') */
  type: string;
  /** Condition object that defines when the rule applies */
  condition: Record<string, unknown>;
  /** Optional action to take when rule is violated */
  action?: string;
  /** Priority of the rule (higher numbers = higher priority) */
  priority?: number;
  /** Whether the rule is enabled */
  enabled?: boolean;
}

/**
 * Context data for policy execution
 */
export interface PolicyContext {
  /** Environment (e.g., 'production', 'staging') */
  environment?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Any other context data */
  [key: string]: unknown;
}

/**
 * Configuration for a plugin
 */
export interface PluginConfig {
  /** Name of the plugin */
  name: string;
  /** Version of the plugin */
  version?: string;
  /** Plugin-specific configuration */
  config?: Record<string, unknown>;
  /** Whether the plugin is enabled */
  enabled?: boolean;
}
