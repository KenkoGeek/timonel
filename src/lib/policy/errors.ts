/**
 * Policy Engine Error Types
 *
 * This module defines custom error types for the Timonel Policy Engine system.
 * These errors provide structured error handling and debugging capabilities.
 *
 * @since 3.0.0
 */

/**
 * Base error class for all policy engine related errors
 */
export class PolicyEngineError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PolicyEngineError';

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolicyEngineError);
    }
  }
}

/**
 * Error thrown when a plugin fails during execution
 */
export class PluginError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly pluginName: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PLUGIN_ERROR', { ...context, pluginName });
    this.name = 'PluginError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginError);
    }
  }
}

/**
 * Error thrown when plugin validation times out
 */
export class ValidationTimeoutError extends PolicyEngineError {
  constructor(pluginName: string, timeout: number) {
    super(`Plugin '${pluginName}' timed out after ${timeout}ms`, 'VALIDATION_TIMEOUT', {
      pluginName,
      timeout,
    });
    this.name = 'ValidationTimeoutError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationTimeoutError);
    }
  }
}

/**
 * Error thrown when plugin registration fails
 */
export class PluginRegistrationError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly pluginName?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PLUGIN_REGISTRATION_ERROR', { ...context, pluginName });
    this.name = 'PluginRegistrationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginRegistrationError);
    }
  }
}

/**
 * Error thrown when plugin configuration is invalid
 */
export class PluginConfigurationError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly configPath?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PLUGIN_CONFIGURATION_ERROR', { ...context, pluginName, configPath });
    this.name = 'PluginConfigurationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginConfigurationError);
    }
  }
}

/**
 * Error thrown when validation orchestration fails
 */
export class ValidationOrchestrationError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly failedPlugins?: string[],
    context?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ORCHESTRATION_ERROR', { ...context, failedPlugins });
    this.name = 'ValidationOrchestrationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationOrchestrationError);
    }
  }
}

/**
 * Error thrown when plugin execution fails after all retry attempts
 */
export class PluginRetryExhaustedError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly attempts: number,
    public readonly lastError: Error,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PLUGIN_RETRY_EXHAUSTED', {
      ...context,
      pluginName,
      attempts,
      lastError: lastError.message,
    });
    this.name = 'PluginRetryExhaustedError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginRetryExhaustedError);
    }
  }
}

/**
 * Error thrown when graceful degradation is triggered
 */
export class GracefulDegradationError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly degradedPlugins: string[],
    public readonly originalErrors: Error[],
    context?: Record<string, unknown>,
  ) {
    super(message, 'GRACEFUL_DEGRADATION', {
      ...context,
      degradedPlugins,
      errorCount: originalErrors.length,
    });
    this.name = 'GracefulDegradationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GracefulDegradationError);
    }
  }
}
/**
 * Error thrown when input validation fails
 */
export class PolicyValidationError extends PolicyEngineError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'POLICY_VALIDATION_ERROR', {
      ...context,
      field,
    });
    this.name = 'PolicyValidationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PolicyValidationError);
    }
  }
}
