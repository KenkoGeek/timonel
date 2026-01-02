/**
 * Policy Engine Implementation
 *
 * This module provides the main PolicyEngine class that orchestrates policy validation
 * through registered plugins. It implements the core policy engine interface with
 * plugin management, validation orchestration, and result aggregation.
 *
 * @since 3.0.0
 */

import { createLogger, type TimonelLogger } from '../utils/logger.js';
import type { ChartMetadata } from '../rutter.js';

import type {
  PolicyEngine as IPolicyEngine,
  PolicyPlugin,
  PolicyEngineOptions,
  PolicyResult,
  PolicyViolation,
  PolicyWarning,
  ValidationContext,
  ValidationMetadata,
  RetryConfig,
} from './types.js';
import { PluginRegistry } from './pluginRegistry.js';
import {
  PolicyEngineError,
  ValidationTimeoutError,
  PluginError,
  PluginRetryExhaustedError,
} from './errors.js';
import { generateResultSummary } from './resultAggregator.js';
import { DefaultResultFormatter } from './resultFormatter.js';
import { ErrorContextGenerator } from './errorContextGenerator.js';
import { ConfigurationLoader } from './configurationLoader.js';
import { ValidationCache, generateManifestHash, generatePluginHash } from './validationCache.js';
import {
  ParallelExecutor,
  calculateOptimalConcurrency,
  type ParallelExecutionOptions,
} from './parallelExecutor.js';

/**
 * Constants for error messages
 */
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

/**
 * Default policy engine configuration
 */
const DEFAULT_OPTIONS: Required<
  Omit<
    PolicyEngineOptions,
    | 'formatter'
    | 'pluginConfig'
    | 'retryConfig'
    | 'configurationLoader'
    | 'environment'
    | 'cacheOptions'
    | 'parallelOptions'
  >
> = {
  timeout: 5000,
  parallel: false,
  failFast: false,
  gracefulDegradation: true,
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryOnTimeout: true,
  retryOnPluginError: false,
};

/**
 * Common operation names for logging
 */
const OPERATIONS = {
  PLUGIN_REGISTRATION: 'plugin_registration',
  VALIDATION_START: 'validation_start',
  VALIDATION_COMPLETE: 'validation_complete',
  PLUGIN_EXECUTION_ERROR: 'plugin_execution_error_isolated',
  PLUGIN_EXECUTION_RETRY: 'plugin_execution_retry',
} as const;

/**
 * Main policy engine implementation
 */
export class PolicyEngine implements IPolicyEngine {
  private readonly registry: PluginRegistry;
  private options: PolicyEngineOptions;
  private readonly logger: TimonelLogger;
  private readonly errorContextGenerator: ErrorContextGenerator;

  // Lazy initialization properties
  private _configurationLoader?: ConfigurationLoader;
  private _cache?: ValidationCache;
  private _parallelExecutor?: ParallelExecutor;

  constructor(options: PolicyEngineOptions = {}) {
    this.registry = new PluginRegistry();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = createLogger('policy-engine');
    this.errorContextGenerator = new ErrorContextGenerator();

    this.logger.debug('PolicyEngine initialized with lazy loading', {
      options: this.options,
      cacheEnabled: !!options.cacheOptions,
      parallelEnabled: !!options.parallel,
      operation: 'policy_engine_init',
    });
  }

  /**
   * Lazy getter for configuration loader
   * @private
   */
  private get configurationLoader(): ConfigurationLoader {
    if (!this._configurationLoader) {
      this._configurationLoader = new ConfigurationLoader(this.options.configurationLoader);
      this.logger.debug('ConfigurationLoader initialized lazily', {
        operation: 'lazy_init_config_loader',
      });
    }
    return this._configurationLoader;
  }

  /**
   * Lazy getter for validation cache
   * @private
   */
  private get cache(): ValidationCache {
    if (!this._cache) {
      this._cache = new ValidationCache(this.options.cacheOptions);
      this.logger.debug('ValidationCache initialized lazily', {
        cacheEnabled: !!this.options.cacheOptions,
        operation: 'lazy_init_cache',
      });
    }
    return this._cache;
  }

  /**
   * Lazy getter for parallel executor
   * @private
   */
  private get parallelExecutor(): ParallelExecutor {
    if (!this._parallelExecutor) {
      const parallelOptions: ParallelExecutionOptions = {
        maxConcurrency:
          this.options.parallelOptions?.maxConcurrency || calculateOptimalConcurrency(10), // Default estimate
        pluginTimeout: this.options.timeout || DEFAULT_OPTIONS.timeout,
        failFast: this.options.failFast || DEFAULT_OPTIONS.failFast,
        ...this.options.parallelOptions,
      };
      this._parallelExecutor = new ParallelExecutor(parallelOptions);
      this.logger.debug('ParallelExecutor initialized lazily', {
        maxConcurrency: parallelOptions.maxConcurrency,
        operation: 'lazy_init_parallel_executor',
      });
    }
    return this._parallelExecutor;
  }

  /**
   * Registers a policy plugin for validation
   * @param plugin - The policy plugin to register
   * @returns The engine instance for method chaining
   */
  async use(plugin: PolicyPlugin): Promise<PolicyEngine> {
    try {
      // Load configuration using the configuration loader
      const pluginConfiguration = await this.configurationLoader.loadPluginConfiguration(
        plugin,
        this.options.environment,
        this.options.pluginConfig?.[plugin.name] as Record<string, unknown>,
      );

      // Register plugin with loaded configuration
      this.registry.register(plugin, pluginConfiguration.config);

      this.logger.info('Plugin registered successfully', {
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        hasConfig: Object.keys(pluginConfiguration.config).length > 0,
        configValidated: pluginConfiguration.validated,
        configSources: pluginConfiguration.entries.map((e) => e.source),
        operation: OPERATIONS.PLUGIN_REGISTRATION,
      });

      // Log configuration validation warnings if any
      if (pluginConfiguration.validationErrors) {
        this.logger.warn('Plugin configuration validation warnings', {
          pluginName: plugin.name,
          errors: pluginConfiguration.validationErrors,
          operation: 'plugin_config_validation_warnings',
        });
      }

      return this;
    } catch (error) {
      this.logger.error('Plugin registration failed', {
        pluginName: plugin?.name || 'unknown',
        error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
        operation: 'plugin_registration_error',
      });
      throw error;
    }
  }

  /**
   * Validates Kubernetes manifests against registered policies
   * @param manifests - Array of Kubernetes manifest objects
   * @param chartMetadata - Chart metadata for validation context
   * @returns Promise resolving to validation results
   */
  async validate(manifests: unknown[], chartMetadata: ChartMetadata): Promise<PolicyResult> {
    const startTime = Date.now();
    const plugins = this.registry.getAllPlugins();

    this.logger.info('Starting policy validation', {
      manifestCount: manifests.length,
      pluginCount: plugins.length,
      operation: OPERATIONS.VALIDATION_START,
    });

    // Return successful result if no plugins are registered
    if (plugins.length === 0) {
      const metadata: ValidationMetadata = {
        executionTime: Date.now() - startTime,
        pluginCount: 0,
        manifestCount: manifests.length,
        startTime,
      };

      this.logger.debug('No plugins registered, validation successful', {
        metadata,
        operation: 'validation_no_plugins',
      });

      return {
        valid: true,
        violations: [],
        warnings: [],
        metadata,
        summary: {
          violationsBySeverity: { error: 0, warning: 0, info: 0 },
          violationsByPlugin: {},
          topViolationTypes: [],
        },
      };
    }

    // Generate cache keys
    const manifestHash = generateManifestHash(manifests);
    const pluginNames = plugins.map((p) => p.name);
    const pluginConfigs = Object.fromEntries(
      pluginNames.map((name) => [name, this.registry.getPluginConfig(name)]),
    );
    const pluginHash = generatePluginHash(pluginNames, pluginConfigs);

    // Check cache first
    const cachedResult = this.cache.get(manifestHash, pluginHash);
    if (cachedResult) {
      this.logger.info('Returning cached validation result', {
        manifestCount: manifests.length,
        pluginCount: plugins.length,
        cacheAge: Date.now() - (cachedResult.metadata.startTime || 0),
        operation: 'validation_cache_hit',
      });

      return cachedResult;
    }

    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    try {
      if (this.options.parallel) {
        await this.executeParallelOptimized(
          plugins,
          manifests,
          violations,
          warnings,
          chartMetadata,
        );
      } else {
        await this.executeSequential(plugins, manifests, violations, warnings, chartMetadata);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Policy validation failed', {
        error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
        executionTime,
        operation: 'validation_error',
      });
      throw new PolicyEngineError(
        `Validation failed: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`,
      );
    }

    const executionTime = Date.now() - startTime;
    const metadata: ValidationMetadata = {
      executionTime,
      pluginCount: plugins.length,
      manifestCount: manifests.length,
      startTime,
    };

    const result: PolicyResult = {
      valid: violations.length === 0,
      violations,
      warnings,
      metadata,
      summary: generateResultSummary(
        violations,
        warnings,
        plugins.map((p) => p.name),
      ),
    };

    // Cache the result
    this.cache.set(manifestHash, pluginHash, result);

    this.logger.info('Policy validation completed', {
      valid: result.valid,
      violationCount: violations.length,
      warningCount: warnings.length,
      executionTime,
      cached: true,
      operation: 'validation_complete',
    });

    return result;
  }

  /**
   * Configures engine-wide settings
   * @param options - Configuration options
   */
  configure(options: PolicyEngineOptions): PolicyEngine {
    this.options = { ...this.options, ...options };

    this.logger.debug('PolicyEngine configuration updated', {
      options: this.options,
      operation: 'policy_engine_configure',
    });

    return this;
  }

  /**
   * Formats validation results using the configured formatter
   * @param result - Validation result to format
   * @returns Formatted string representation
   */
  formatResult(result: PolicyResult): string {
    const formatter = this.options.formatter || new DefaultResultFormatter();
    return formatter.format(result);
  }

  /**
   * Generates detailed error context for a violation
   * @param violation - Policy violation
   * @param validationContext - Validation context
   * @param allViolations - All violations for finding related issues
   * @param executionTime - Plugin execution time
   * @returns Detailed error context
   */
  generateErrorContext(
    violation: PolicyViolation | PolicyWarning,
    validationContext?: ValidationContext,
    allViolations?: (PolicyViolation | PolicyWarning)[],
    executionTime?: number,
  ) {
    return this.errorContextGenerator.generateContext(
      violation,
      validationContext,
      allViolations,
      executionTime,
    );
  }

  /**
   * Generates a detailed error report for a violation
   * @param violation - Policy violation
   * @param validationContext - Validation context
   * @param allViolations - All violations for finding related issues
   * @param executionTime - Plugin execution time
   * @returns Formatted error report string
   */
  generateErrorReport(
    violation: PolicyViolation | PolicyWarning,
    validationContext?: ValidationContext,
    allViolations?: (PolicyViolation | PolicyWarning)[],
    executionTime?: number,
  ): string {
    return this.errorContextGenerator.generateErrorReport(
      violation,
      validationContext,
      allViolations,
      executionTime,
    );
  }

  /**
   * Gets cache statistics for monitoring
   * @returns Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Invalidates cache entries based on criteria
   * @param criteria - Invalidation criteria
   * @returns Number of invalidated entries
   */
  invalidateCache(criteria: {
    manifestHash?: string;
    pluginHash?: string;
    olderThan?: number;
    all?: boolean;
  }): number {
    return this.cache.invalidate(criteria);
  }

  /**
   * Clears all cache statistics
   */
  clearCacheStats(): void {
    this.cache.clearStats();
  }

  /**
   * Executes plugins sequentially
   * @param plugins - Array of plugins to execute
   * @param manifests - Manifests to validate
   * @param violations - Array to collect violations
   * @param warnings - Array to collect warnings
   * @private
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async executeSequential(
    plugins: PolicyPlugin[],
    manifests: unknown[],
    violations: PolicyViolation[],
    warnings: PolicyWarning[],
    chartMetadata: ChartMetadata,
  ): Promise<void> {
    for (const plugin of plugins) {
      try {
        const pluginViolations = await this.executePlugin(plugin, manifests, chartMetadata);

        // Separate violations by severity
        for (const violation of pluginViolations) {
          if (violation.severity === 'error') {
            violations.push(violation);
          } else {
            warnings.push(violation as PolicyWarning);
          }
        }

        // Fail fast if enabled and we have errors
        if (this.options.failFast && violations.length > 0) {
          this.logger.debug('Fail fast enabled, stopping validation', {
            pluginName: plugin.name,
            violationCount: violations.length,
            operation: 'validation_fail_fast',
          });
          break;
        }
      } catch (error) {
        // Handle plugin execution errors
        if (this.options.gracefulDegradation) {
          // With graceful degradation, convert error to violation
          this.handlePluginError(plugin, error, violations);
        } else {
          // Without graceful degradation, re-throw the error
          throw error;
        }
      }
    }
  }

  /**
   * Executes plugins in parallel using the optimized parallel executor
   * @param plugins - Array of plugins to execute
   * @param manifests - Manifests to validate
   * @param violations - Array to collect violations
   * @param warnings - Array to collect warnings
   * @private
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async executeParallelOptimized(
    plugins: PolicyPlugin[],
    manifests: unknown[],
    violations: PolicyViolation[],
    warnings: PolicyWarning[],
    chartMetadata: ChartMetadata,
  ): Promise<void> {
    const validationContext: ValidationContext = {
      chart: chartMetadata, // Use actual chart metadata instead of hardcoded values
      environment: this.options.environment || 'development',
      logger: this.logger,
    };

    const { results, stats } = await this.parallelExecutor.executePlugins(
      plugins,
      manifests,
      validationContext,
    );

    this.logger.info('Parallel execution completed with statistics', {
      pluginCount: plugins.length,
      totalExecutionTime: stats.totalExecutionTime,
      averagePluginTime: stats.averagePluginTime,
      concurrencyUtilization: stats.concurrencyUtilization,
      peakConcurrentPlugins: stats.resourceUsage.peakConcurrentPlugins,
      totalMemoryMB: stats.resourceUsage.totalMemoryMB,
      operation: 'parallel_execution_stats',
    });

    // Process results
    for (const result of results) {
      if (result.error) {
        if (this.options.gracefulDegradation) {
          // With graceful degradation, convert error to violation
          this.handlePluginError(result.plugin, result.error, violations);
        } else {
          // Without graceful degradation, throw the error
          throw result.error;
        }
      } else {
        // Separate violations by severity
        for (const violation of result.violations) {
          if (violation.severity === 'error') {
            violations.push(violation);
          } else {
            warnings.push(violation as PolicyWarning);
          }
        }
      }

      // Fail fast if enabled and we have errors
      if (this.options.failFast && violations.length > 0) {
        this.logger.debug('Fail fast enabled, stopping validation', {
          pluginName: result.plugin.name,
          violationCount: violations.length,
          operation: 'validation_fail_fast',
        });
        break;
      }
    }
  }

  /**
   * Executes plugins in parallel (legacy implementation)
   * @param plugins - Array of plugins to execute
   * @param manifests - Manifests to validate
   * @param violations - Array to collect violations
   * @param warnings - Array to collect warnings
   * @private
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async executeParallel(
    plugins: PolicyPlugin[],
    manifests: unknown[],
    violations: PolicyViolation[],
    warnings: PolicyWarning[],
    chartMetadata: ChartMetadata,
  ): Promise<void> {
    const pluginPromises = plugins.map(async (plugin) => {
      try {
        const pluginViolations = await this.executePlugin(plugin, manifests, chartMetadata);
        return { plugin, violations: pluginViolations, error: null };
      } catch (error) {
        return { plugin, violations: [], error };
      }
    });

    const results = await Promise.all(pluginPromises);

    for (const result of results) {
      if (result.error) {
        if (this.options.gracefulDegradation) {
          // With graceful degradation, convert error to violation
          this.handlePluginError(result.plugin, result.error, violations);
        } else {
          // Without graceful degradation, throw the first error encountered
          throw result.error;
        }
      } else {
        // Separate violations by severity
        for (const violation of result.violations) {
          if (violation.severity === 'error') {
            violations.push(violation);
          } else {
            warnings.push(violation as PolicyWarning);
          }
        }
      }
    }
  }

  /**
   * Executes a single plugin with timeout and retry handling
   * @param plugin - Plugin to execute
   * @param manifests - Manifests to validate
   * @returns Promise resolving to plugin violations
   * @private
   */
  private async executePlugin(
    plugin: PolicyPlugin,
    manifests: unknown[],
    chartMetadata: ChartMetadata,
  ): Promise<PolicyViolation[]> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...this.options.retryConfig };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await this.executePluginAttempt(plugin, manifests, attempt, chartMetadata);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn('Plugin execution attempt failed', {
          pluginName: plugin.name,
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          error: lastError.message,
          operation: 'plugin_execution_retry',
        });

        // Check if we should retry this error type
        const shouldRetry = this.shouldRetryError(lastError, retryConfig);

        if (!shouldRetry || attempt === retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay,
        );

        this.logger.debug('Retrying plugin execution after delay', {
          pluginName: plugin.name,
          attempt: attempt + 1,
          delay,
          operation: 'plugin_execution_retry_delay',
        });

        await this.sleep(delay);
      }
    }

    // All retry attempts exhausted - always throw error
    // Let the calling method decide how to handle it based on gracefulDegradation setting
    throw new PluginRetryExhaustedError(
      `Plugin '${plugin.name}' failed after ${retryConfig.maxAttempts} attempts`,
      plugin.name,
      retryConfig.maxAttempts,
      lastError!,
    );
  }

  /**
   * Executes a single plugin attempt with timeout handling
   * @param plugin - Plugin to execute
   * @param manifests - Manifests to validate
   * @param attempt - Current attempt number
   * @returns Promise resolving to plugin violations
   * @private
   */
  private async executePluginAttempt(
    plugin: PolicyPlugin,
    manifests: unknown[],
    attempt: number,
    chartMetadata: ChartMetadata,
  ): Promise<PolicyViolation[]> {
    const timeout = this.options.timeout || DEFAULT_OPTIONS.timeout;

    this.logger.debug('Executing plugin attempt', {
      pluginName: plugin.name,
      attempt,
      timeout,
      operation: 'plugin_execution_attempt_start',
    });

    const validationContext: ValidationContext = {
      chart: chartMetadata, // Use actual chart metadata instead of hardcoded values
      config: this.registry.getPluginConfig(plugin.name) as Record<string, unknown>,
      environment: this.options.environment || 'development',
      logger: this.logger,
    };

    const timeoutPromise = this.createTimeoutPromise(timeout, plugin.name);
    const validationPromise = plugin.validate(manifests, validationContext);

    try {
      const result = await Promise.race([validationPromise, timeoutPromise]);

      this.logger.debug('Plugin execution attempt completed', {
        pluginName: plugin.name,
        attempt,
        violationCount: result.length,
        operation: 'plugin_execution_attempt_complete',
      });

      return result;
    } catch (error) {
      if (error instanceof ValidationTimeoutError) {
        this.logger.warn('Plugin execution attempt timed out', {
          pluginName: plugin.name,
          attempt,
          timeout,
          operation: 'plugin_execution_attempt_timeout',
        });
      } else {
        this.logger.warn('Plugin execution attempt failed', {
          pluginName: plugin.name,
          attempt,
          error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
          operation: 'plugin_execution_attempt_error',
        });
      }
      throw error;
    }
  }

  /**
   * Determines if an error should trigger a retry
   * @param error - Error that occurred
   * @param retryConfig - Retry configuration
   * @returns True if the error should be retried
   * @private
   */
  private shouldRetryError(error: Error, retryConfig: RetryConfig): boolean {
    if (error instanceof ValidationTimeoutError) {
      return retryConfig.retryOnTimeout;
    }

    if (error instanceof PluginError) {
      return retryConfig.retryOnPluginError;
    }

    // Retry on generic errors if plugin error retry is enabled
    return retryConfig.retryOnPluginError;
  }

  /**
   * Sleep for the specified number of milliseconds
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the delay
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  }

  /**
   * Creates a timeout promise that rejects after the specified time
   * @param timeout - Timeout in milliseconds
   * @param pluginName - Name of the plugin for error reporting
   * @returns Promise that rejects with timeout error
   * @private
   */
  private createTimeoutPromise(timeout: number, pluginName: string): Promise<never> {
    return new Promise((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new ValidationTimeoutError(pluginName, timeout));
      }, timeout);
    });
  }

  /**
   * Handles plugin execution errors with enhanced isolation and context
   * @param plugin - Plugin that failed
   * @param error - Error that occurred
   * @param violations - Array to add error violation to
   * @private
   */
  private handlePluginError(
    plugin: PolicyPlugin,
    error: unknown,
    violations: PolicyViolation[],
  ): void {
    const errorMessage = error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
    const errorStack = error instanceof Error ? error.stack : String(error);

    this.logger.warn('Plugin execution failed with error isolation', {
      pluginName: plugin.name,
      pluginVersion: plugin.version,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      operation: 'plugin_execution_error_isolated',
    });

    // Create detailed error context for debugging
    const errorContext = {
      error: errorStack,
      pluginVersion: plugin.version,
      pluginMetadata: plugin.metadata,
      timestamp: new Date().toISOString(),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      isolated: true, // Mark as isolated error
    };

    // Add plugin error as a violation with enhanced context
    const errorViolation: PolicyViolation = {
      plugin: plugin.name,
      severity: 'error',
      message: `Plugin execution failed: ${errorMessage}`,
      resourcePath: 'plugin-execution',
      field: 'validate',
      suggestion: this.generateErrorSuggestion(error, plugin),
      context: errorContext,
    };

    violations.push(errorViolation);

    // Log additional context for debugging
    this.logger.debug('Plugin error context generated', {
      pluginName: plugin.name,
      errorContext,
      operation: 'plugin_error_context',
    });
  }

  /**
   * Generates helpful suggestions based on the error type
   * @param error - Error that occurred
   * @param plugin - Plugin that failed
   * @returns Suggestion string
   * @private
   */
  private generateErrorSuggestion(error: unknown, plugin: PolicyPlugin): string {
    if (error instanceof ValidationTimeoutError) {
      return `Consider increasing the timeout value or optimizing the plugin '${plugin.name}' for better performance.`;
    }

    if (error instanceof PluginRetryExhaustedError) {
      return `Plugin '${plugin.name}' failed after multiple retry attempts. Check plugin configuration and dependencies.`;
    }

    if (error instanceof TypeError) {
      return `Plugin '${plugin.name}' encountered a type error. Verify the plugin implementation and input validation.`;
    }

    if (error instanceof ReferenceError) {
      return `Plugin '${plugin.name}' referenced an undefined variable or function. Check plugin dependencies and imports.`;
    }

    return `Review plugin '${plugin.name}' implementation and ensure it handles all edge cases properly.`;
  }
}
