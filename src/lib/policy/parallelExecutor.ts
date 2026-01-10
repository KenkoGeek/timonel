/**
 * Parallel Execution Manager for Policy Plugins
 *
 * This module provides sophisticated parallel execution capabilities for policy plugins,
 * including resource management, concurrency control, and performance optimization.
 *
 * @since 3.0.0
 */

import { cpus, totalmem } from 'os';

import { createLogger, type TimonelLogger } from '../utils/logger.js';

import type { PolicyPlugin, PolicyViolation, ValidationContext } from './types.js';
import { ValidationTimeoutError } from './errors.js';

/**
 * Constants for error messages
 */
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

/**
 * Parallel execution configuration
 */
export interface ParallelExecutionOptions {
  /** Maximum number of concurrent plugin executions */
  maxConcurrency?: number;

  /** Whether to use worker threads for CPU-intensive plugins */
  useWorkerThreads?: boolean;

  /** Timeout for individual plugin execution */
  pluginTimeout?: number;

  /** Whether to fail fast on first error */
  failFast?: boolean;

  /** Resource limits for plugin execution */
  resourceLimits?: {
    /** Maximum memory usage per plugin in MB */
    maxMemoryMB?: number;
    /** Maximum CPU time per plugin in milliseconds */
    maxCpuTimeMs?: number;
  };

  /** Plugin execution priority configuration */
  priorityConfig?: {
    /** High priority plugins (executed first) */
    highPriority?: string[];
    /** Low priority plugins (executed last) */
    lowPriority?: string[];
  };
}

/**
 * Plugin execution result
 */
export interface PluginExecutionResult {
  /** Plugin that was executed */
  plugin: PolicyPlugin;

  /** Violations found by the plugin */
  violations: PolicyViolation[];

  /** Execution time in milliseconds */
  executionTime: number;

  /** Error if execution failed */
  error?: Error;

  /** Resource usage statistics */
  resourceUsage?: {
    memoryUsageMB: number;
    cpuTimeMs: number;
  };
}

/**
 * Parallel execution statistics
 */
export interface ParallelExecutionStats {
  /** Total execution time */
  totalExecutionTime: number;

  /** Average plugin execution time */
  averagePluginTime: number;

  /** Maximum plugin execution time */
  maxPluginTime: number;

  /** Number of plugins executed in parallel */
  parallelPluginCount: number;

  /** Concurrency utilization (0-1) */
  concurrencyUtilization: number;

  /** Resource usage statistics */
  resourceUsage: {
    totalMemoryMB: number;
    totalCpuTimeMs: number;
    peakConcurrentPlugins: number;
  };
}

/**
 * Default parallel execution options
 */
const DEFAULT_PARALLEL_OPTIONS: Required<
  Omit<ParallelExecutionOptions, 'priorityConfig' | 'resourceLimits'>
> = {
  maxConcurrency: Math.max(2, Math.min(8, cpus().length)),
  useWorkerThreads: false, // Disabled by default for simplicity
  pluginTimeout: 5000,
  failFast: false,
};

/**
 * Parallel execution manager for policy plugins
 */
export class ParallelExecutor {
  private readonly options: ParallelExecutionOptions;
  private readonly logger: TimonelLogger;
  private activeExecutions = 0;
  private executionQueue: Array<() => Promise<PluginExecutionResult>> = [];

  constructor(options: ParallelExecutionOptions = {}) {
    this.options = { ...DEFAULT_PARALLEL_OPTIONS, ...options };
    this.logger = createLogger('parallel-executor');

    this.logger.debug('ParallelExecutor initialized', {
      maxConcurrency: this.options.maxConcurrency,
      useWorkerThreads: this.options.useWorkerThreads,
      pluginTimeout: this.options.pluginTimeout,
      operation: 'parallel_executor_init',
    });
  }

  /**
   * Executes plugins in parallel with resource management
   * @param plugins - Array of plugins to execute
   * @param manifests - Manifests to validate
   * @param validationContext - Validation context
   * @returns Promise resolving to execution results
   */
  async executePlugins(
    plugins: PolicyPlugin[],
    manifests: unknown[],
    validationContext: ValidationContext,
  ): Promise<{
    results: PluginExecutionResult[];
    stats: ParallelExecutionStats;
  }> {
    const startTime = Date.now();

    this.logger.info('Starting parallel plugin execution', {
      pluginCount: plugins.length,
      maxConcurrency: this.options.maxConcurrency,
      manifestCount: manifests.length,
      operation: 'parallel_execution_start',
    });

    // Sort plugins by priority
    const sortedPlugins = this.sortPluginsByPriority(plugins);

    // Create execution tasks
    const executionTasks = sortedPlugins.map(
      (plugin) => () => this.executePlugin(plugin, manifests, validationContext),
    );

    // Execute with concurrency control
    const results = await this.executeConcurrently(executionTasks);

    const totalExecutionTime = Date.now() - startTime;
    const stats = this.calculateStats(results, totalExecutionTime);

    this.logger.info('Parallel plugin execution completed', {
      pluginCount: plugins.length,
      totalExecutionTime,
      averagePluginTime: stats.averagePluginTime,
      concurrencyUtilization: stats.concurrencyUtilization,
      operation: 'parallel_execution_complete',
    });

    return { results, stats };
  }

  /**
   * Executes a single plugin with resource monitoring
   * @param plugin - Plugin to execute
   * @param manifests - Manifests to validate
   * @param validationContext - Validation context
   * @returns Promise resolving to execution result
   * @private
   */
  private async executePlugin(
    plugin: PolicyPlugin,
    manifests: unknown[],
    validationContext: ValidationContext,
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    this.logger.debug('Starting plugin execution', {
      pluginName: plugin.name,
      pluginVersion: plugin.version,
      operation: 'plugin_execution_start',
    });

    try {
      // Execute plugin with timeout
      const violations = await this.executeWithTimeout(
        plugin,
        manifests,
        validationContext,
        this.options.pluginTimeout!,
      );

      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsageMB = Math.max(0, endMemory - startMemory) / (1024 * 1024);

      const result: PluginExecutionResult = {
        plugin,
        violations,
        executionTime,
        resourceUsage: {
          memoryUsageMB,
          cpuTimeMs: executionTime, // Approximation
        },
      };

      this.logger.debug('Plugin execution completed successfully', {
        pluginName: plugin.name,
        executionTime,
        violationCount: violations.length,
        memoryUsageMB: memoryUsageMB.toFixed(2),
        operation: 'plugin_execution_success',
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryUsageMB = Math.max(0, endMemory - startMemory) / (1024 * 1024);

      this.logger.warn('Plugin execution failed', {
        pluginName: plugin.name,
        executionTime,
        error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
        memoryUsageMB: memoryUsageMB.toFixed(2),
        operation: 'plugin_execution_error',
      });

      return {
        plugin,
        violations: [],
        executionTime,
        error: error instanceof Error ? error : new Error(String(error)),
        resourceUsage: {
          memoryUsageMB,
          cpuTimeMs: executionTime,
        },
      };
    }
  }

  /**
   * Executes plugin with timeout handling
   * @param plugin - Plugin to execute
   * @param manifests - Manifests to validate
   * @param validationContext - Validation context
   * @param timeout - Timeout in milliseconds
   * @returns Promise resolving to violations
   * @private
   */
  private async executeWithTimeout(
    plugin: PolicyPlugin,
    manifests: unknown[],
    validationContext: ValidationContext,
    timeout: number,
  ): Promise<PolicyViolation[]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new ValidationTimeoutError(plugin.name, timeout));
      }, timeout);
    });

    const validationPromise = plugin.validate(manifests, validationContext);

    return Promise.race([validationPromise, timeoutPromise]);
  }

  /**
   * Executes tasks with concurrency control
   * @param tasks - Array of execution tasks
   * @returns Promise resolving to results
   * @private
   */
  private async executeConcurrently(
    tasks: Array<() => Promise<PluginExecutionResult>>,
  ): Promise<PluginExecutionResult[]> {
    const results: PluginExecutionResult[] = [];
    const executing: Promise<void>[] = [];
    let taskIndex = 0;
    let peakConcurrency = 0;

    const executeNext = async (): Promise<void> => {
      if (taskIndex >= tasks.length) {
        return;
      }

      const currentTaskIndex = taskIndex++;
      // eslint-disable-next-line security/detect-object-injection
      const task = tasks[currentTaskIndex];

      if (!task) {
        return;
      }

      this.activeExecutions++;
      peakConcurrency = Math.max(peakConcurrency, this.activeExecutions);

      try {
        const result = await task();
        // eslint-disable-next-line security/detect-object-injection
        results[currentTaskIndex] = result;

        // Check for fail-fast condition
        if (this.options.failFast && result.error) {
          this.logger.debug('Fail-fast triggered, stopping execution', {
            pluginName: result.plugin.name,
            error: result.error.message,
            operation: 'parallel_execution_fail_fast',
          });
          return;
        }
      } catch (error) {
        // This shouldn't happen as executePlugin catches all errors
        this.logger.error('Unexpected error in parallel execution', {
          taskIndex: currentTaskIndex,
          error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
          operation: 'parallel_execution_unexpected_error',
        });
      } finally {
        this.activeExecutions--;
      }

      // Continue with next task if available and not in fail-fast mode
      // eslint-disable-next-line security/detect-object-injection
      if (!this.options.failFast || !results[currentTaskIndex]?.error) {
        await executeNext();
      }
    };

    // Start initial batch of concurrent executions
    const maxConcurrency = this.options.maxConcurrency!;
    for (let i = 0; i < Math.min(maxConcurrency, tasks.length); i++) {
      executing.push(executeNext());
    }

    // Wait for all executions to complete
    await Promise.all(executing);

    this.logger.debug('Concurrent execution completed', {
      totalTasks: tasks.length,
      completedTasks: results.filter((r) => r).length,
      peakConcurrency,
      operation: 'concurrent_execution_complete',
    });

    return results.filter((r) => r); // Filter out undefined results
  }

  /**
   * Sorts plugins by priority configuration
   * @param plugins - Array of plugins to sort
   * @returns Sorted array of plugins
   * @private
   */
  private sortPluginsByPriority(plugins: PolicyPlugin[]): PolicyPlugin[] {
    if (!this.options.priorityConfig) {
      return [...plugins];
    }

    const { highPriority = [], lowPriority = [] } = this.options.priorityConfig;

    const highPriorityPlugins = plugins.filter((p) => highPriority.includes(p.name));
    const normalPriorityPlugins = plugins.filter(
      (p) => !highPriority.includes(p.name) && !lowPriority.includes(p.name),
    );
    const lowPriorityPlugins = plugins.filter((p) => lowPriority.includes(p.name));

    const sortedPlugins = [...highPriorityPlugins, ...normalPriorityPlugins, ...lowPriorityPlugins];

    this.logger.debug('Plugins sorted by priority', {
      totalPlugins: plugins.length,
      highPriorityCount: highPriorityPlugins.length,
      normalPriorityCount: normalPriorityPlugins.length,
      lowPriorityCount: lowPriorityPlugins.length,
      operation: 'plugin_priority_sort',
    });

    return sortedPlugins;
  }

  /**
   * Calculates execution statistics
   * @param results - Array of execution results
   * @param totalExecutionTime - Total execution time
   * @returns Execution statistics
   * @private
   */
  private calculateStats(
    results: PluginExecutionResult[],
    totalExecutionTime: number,
  ): ParallelExecutionStats {
    const executionTimes = results.map((r) => r.executionTime);
    const averagePluginTime = executionTimes.reduce((sum, time) => sum + time, 0) / results.length;
    const maxPluginTime = Math.max(...executionTimes);

    const totalMemoryMB = results.reduce(
      (sum, r) => sum + (r.resourceUsage?.memoryUsageMB || 0),
      0,
    );
    const totalCpuTimeMs = results.reduce((sum, r) => sum + (r.resourceUsage?.cpuTimeMs || 0), 0);

    // Calculate concurrency utilization
    const theoreticalMinTime = Math.max(...executionTimes);
    const concurrencyUtilization = theoreticalMinTime / totalExecutionTime;

    return {
      totalExecutionTime,
      averagePluginTime,
      maxPluginTime,
      parallelPluginCount: results.length,
      concurrencyUtilization: Math.min(1, concurrencyUtilization),
      resourceUsage: {
        totalMemoryMB,
        totalCpuTimeMs,
        peakConcurrentPlugins: Math.min(this.options.maxConcurrency!, results.length),
      },
    };
  }
}

/**
 * Utility function to determine optimal concurrency based on system resources
 * @param pluginCount - Number of plugins to execute
 * @param systemInfo - Optional system information
 * @returns Recommended concurrency level
 */
export function calculateOptimalConcurrency(
  pluginCount: number,
  systemInfo?: {
    cpuCount?: number;
    availableMemoryMB?: number;
    isContainerized?: boolean;
  },
): number {
  const cpuCount = systemInfo?.cpuCount || cpus().length;
  const availableMemoryMB = systemInfo?.availableMemoryMB || totalmem() / (1024 * 1024);

  // Base concurrency on CPU count
  let optimalConcurrency = Math.max(2, Math.min(cpuCount, pluginCount));

  // Adjust for memory constraints (assume 100MB per concurrent plugin)
  const memoryBasedConcurrency = Math.floor(availableMemoryMB / 100);
  optimalConcurrency = Math.min(optimalConcurrency, memoryBasedConcurrency);

  // Reduce concurrency in containerized environments
  if (systemInfo?.isContainerized) {
    optimalConcurrency = Math.max(1, Math.floor(optimalConcurrency * 0.75));
  }

  // Cap at reasonable maximum
  optimalConcurrency = Math.min(optimalConcurrency, 16);

  return optimalConcurrency;
}
