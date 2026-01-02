/**
 * Policy Engine Module
 * 
 * This module provides a lightweight, extensible policy validation system for Timonel.
 * It enables validation of Kubernetes manifests through external plugins following
 * industry best practices for plugin architecture and extensibility.
 * 
 * @since 3.0.0
 */

// Core engine
export { PolicyEngine } from './policyEngine.js';
export { PluginRegistry } from './pluginRegistry.js';
export { ConfigurationLoader } from './configurationLoader.js';
export { PluginLoader } from './pluginLoader.js';

// Result aggregation utilities
export {
  aggregateResults,
  generateResultSummary,
  filterViolationsBySeverity,
  groupViolationsByPlugin,
  sortViolationsBySeverity,
  createEmptyResult,
  mergeViolationContexts
} from './resultAggregator.js';

// Result formatters
export {
  DefaultResultFormatter,
  JsonResultFormatter,
  CompactResultFormatter,
  GitHubActionsResultFormatter,
  SarifResultFormatter,
  createFormatter,
  getAvailableFormatters
} from './resultFormatter.js';

// Error context generation
export {
  ErrorContextGenerator,
  type ErrorContext
} from './errorContextGenerator.js';

// Types and interfaces
export type {
  PolicyEngine as IPolicyEngine,
  PolicyPlugin,
  PolicyEngineOptions,
  PolicyResult,
  PolicyViolation,
  PolicyWarning,
  ValidationContext,
  ValidationMetadata,
  JSONSchema,
  PluginMetadata,
  ResultFormatter,
  ResultSummary,
  RetryConfig,
  ConfigurationLoaderOptions
} from './types.js';

// Error types
export {
  PolicyEngineError,
  PluginError,
  ValidationTimeoutError,
  PluginRegistrationError,
  PluginConfigurationError,
  ValidationOrchestrationError,
  PluginRetryExhaustedError,
  GracefulDegradationError
} from './errors.js';