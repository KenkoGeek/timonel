/**
 * Policy Engine Type Definitions
 *
 * This module defines the core types and interfaces for the Timonel Policy Engine system.
 * The policy engine provides extensible validation of Kubernetes manifests through plugins.
 *
 * @since 3.0.0
 */

import type { TimonelLogger } from '../utils/logger.js';
import type { ChartMetadata } from '../rutter.js';

import type { CacheOptions } from './validationCache.js';
import type { ParallelExecutionOptions } from './parallelExecutor.js';

/**
 * JSON Schema type for plugin configuration validation
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  [key: string]: unknown;
}

/**
 * Plugin metadata for discovery and compatibility
 */
export interface PluginMetadata {
  /** Plugin author information */
  author?: string;
  /** Plugin license */
  license?: string;
  /** Plugin homepage URL */
  homepage?: string;
  /** Plugin repository URL */
  repository?: string;
  /** Supported Kubernetes versions */
  kubernetesVersions?: string[];
  /** Plugin tags for categorization */
  tags?: string[];
  /** Default configuration for the plugin */
  defaultConfig?: Record<string, unknown>;
}

/**
 * Validation context provided to plugins during execution
 */
export interface ValidationContext {
  /** Chart metadata */
  readonly chart: ChartMetadata;

  /** Target Kubernetes version */
  readonly kubernetesVersion?: string;

  /** Deployment environment */
  readonly environment?: string;

  /** Plugin-specific configuration */
  readonly config?: Record<string, unknown>;

  /** Logger instance */
  readonly logger: TimonelLogger;
}

/**
 * Policy violation reported by plugins
 */
export interface PolicyViolation {
  /** Plugin that detected the violation */
  readonly plugin: string;

  /** Severity level of the violation */
  readonly severity: 'error' | 'warning' | 'info';

  /** Human-readable violation message */
  readonly message: string;

  /** Path to the violating resource */
  readonly resourcePath?: string;

  /** Specific field that caused the violation */
  readonly field?: string;

  /** Suggested remediation steps */
  readonly suggestion?: string;

  /** Additional context data */
  readonly context?: Record<string, unknown>;
}

/**
 * Policy warning (non-blocking violation)
 */
export interface PolicyWarning extends Omit<PolicyViolation, 'severity'> {
  readonly severity: 'warning' | 'info';
}

/**
 * Validation execution metadata
 */
export interface ValidationMetadata {
  /** Total execution time in milliseconds */
  readonly executionTime: number;

  /** Number of plugins executed */
  readonly pluginCount: number;

  /** Number of manifests validated */
  readonly manifestCount: number;

  /** Timestamp when validation started */
  readonly startTime?: number;

  /** Additional metadata */
  readonly [key: string]: unknown;
}

/**
 * Complete validation result
 */
export interface PolicyResult {
  /** Overall validation success status */
  readonly valid: boolean;

  /** Array of policy violations found */
  readonly violations: PolicyViolation[];

  /** Non-blocking warnings */
  readonly warnings: PolicyWarning[];

  /** Execution metadata */
  readonly metadata: ValidationMetadata;

  /** Summary statistics for quick overview */
  readonly summary?: ResultSummary;
}

/**
 * Summary statistics for validation results
 */
export interface ResultSummary {
  /** Total number of violations by severity */
  readonly violationsBySeverity: {
    readonly error: number;
    readonly warning: number;
    readonly info: number;
  };

  /** Violations grouped by plugin */
  readonly violationsByPlugin: Record<string, number>;

  /** Most common violation types */
  readonly topViolationTypes: Array<{
    readonly type: string;
    readonly count: number;
  }>;
}

/**
 * Policy plugin interface that all plugins must implement
 */
export interface PolicyPlugin {
  /** Unique plugin identifier */
  readonly name: string;

  /** Semantic version of the plugin */
  readonly version: string;

  /** Human-readable description */
  readonly description?: string;

  /**
   * Validates manifests and returns violations
   * @param manifests - Kubernetes manifests to validate
   * @param context - Validation context and configuration
   * @returns Promise resolving to validation results
   */
  validate(manifests: unknown[], context: ValidationContext): Promise<PolicyViolation[]>;

  /** Optional plugin configuration schema */
  readonly configSchema?: JSONSchema;

  /** Plugin metadata for discovery and compatibility */
  readonly metadata?: PluginMetadata;
}

/**
 * Result formatter interface for custom output formatting
 */
export interface ResultFormatter {
  /**
   * Formats validation results for output
   * @param result - Validation result to format
   * @returns Formatted string representation
   */
  format(result: PolicyResult): string;
}

/**
 * Retry configuration for plugin execution
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Base delay between retries in milliseconds */
  baseDelay: number;

  /** Exponential backoff multiplier */
  backoffMultiplier: number;

  /** Maximum delay between retries in milliseconds */
  maxDelay: number;

  /** Whether to retry on timeout errors */
  retryOnTimeout: boolean;

  /** Whether to retry on plugin errors */
  retryOnPluginError: boolean;
}

/**
 * Configuration loader options
 */
export interface ConfigurationLoaderOptions {
  /** Default environment if not specified */
  defaultEnvironment?: string;

  /** Whether to validate configurations against schemas */
  validateSchemas?: boolean;

  /** Whether to allow unknown properties in configurations */
  allowUnknownProperties?: boolean;

  /** Configuration file paths to load */
  configurationFiles?: string[];

  /** Environment variable prefix for configuration */
  environmentPrefix?: string;
}

/**
 * Policy engine configuration options
 */
export interface PolicyEngineOptions {
  /** Maximum time to wait for plugin execution (milliseconds) */
  timeout?: number;

  /** Whether to run plugins in parallel */
  parallel?: boolean;

  /** Fail fast on first error or collect all violations */
  failFast?: boolean;

  /** Custom result formatter */
  formatter?: ResultFormatter;

  /** Plugin-specific configuration */
  pluginConfig?: Record<string, unknown>;

  /** Retry configuration for plugin execution */
  retryConfig?: RetryConfig;

  /** Whether to enable graceful degradation on plugin failures */
  gracefulDegradation?: boolean;

  /** Configuration loader options */
  configurationLoader?: ConfigurationLoaderOptions;

  /** Target environment for configuration loading */
  environment?: string;

  /** Cache configuration options */
  cacheOptions?: CacheOptions;

  /** Parallel execution configuration options */
  parallelOptions?: ParallelExecutionOptions;
}

/**
 * Main policy engine interface
 */
export interface PolicyEngine {
  /**
   * Registers a policy plugin for validation
   * @param plugin - The policy plugin to register
   * @returns Promise resolving to the engine instance for method chaining
   */
  use(plugin: PolicyPlugin): Promise<PolicyEngine>;

  /**
   * Validates Kubernetes manifests against registered policies
   * @param manifests - Array of Kubernetes manifest objects
   * @returns Promise resolving to validation results
   */
  validate(manifests: unknown[]): Promise<PolicyResult>;

  /**
   * Configures engine-wide settings
   * @param options - Configuration options
   */
  configure(options: PolicyEngineOptions): PolicyEngine;
}
