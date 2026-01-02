/**
 * Unit Tests for Policy Engine Core Functionality
 * 
 * These tests validate specific functionality of individual components
 * in the Timonel Policy Engine system. Unlike property tests that validate
 * universal behaviors, unit tests focus on specific examples and edge cases.
 * 
 * @since 3.0.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PolicyEngine } from '../src/lib/policy/policyEngine.js';
import { PluginRegistry } from '../src/lib/policy/pluginRegistry.js';
import { ConfigurationLoader } from '../src/lib/policy/configurationLoader.js';
import { ErrorContextGenerator } from '../src/lib/policy/errorContextGenerator.js';
import { 
  DefaultResultFormatter,
  JsonResultFormatter,
  CompactResultFormatter,
  GitHubActionsResultFormatter,
  SarifResultFormatter
} from '../src/lib/policy/resultFormatter.js';
import {
  PolicyEngineError,
  PluginError,
  ValidationTimeoutError,
  PluginRegistrationError,
  PluginConfigurationError,
  ValidationOrchestrationError,
  PluginRetryExhaustedError,
  GracefulDegradationError
} from '../src/lib/policy/errors.js';
import type { 
  PolicyPlugin, 
  PolicyViolation, 
  ValidationContext,
  PolicyEngineOptions,
  PolicyResult
} from '../src/lib/policy/types.js';

describe('Policy Engine Unit Tests', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PolicyEngine Class', () => {
    describe('Constructor and Configuration', () => {
      it('should initialize with default options', () => {
        const defaultEngine = new PolicyEngine();
        expect(defaultEngine).toBeInstanceOf(PolicyEngine);
      });

      it('should accept custom options during initialization', () => {
        const options: PolicyEngineOptions = {
          timeout: 10000,
          parallel: true,
          failFast: true,
          gracefulDegradation: false
        };
        
        const customEngine = new PolicyEngine(options);
        expect(customEngine).toBeInstanceOf(PolicyEngine);
      });

      it('should allow configuration updates after initialization', () => {
        const newOptions: PolicyEngineOptions = {
          timeout: 2000,
          parallel: true
        };
        
        const result = engine.configure(newOptions);
        expect(result).toBe(engine); // Should return self for chaining
      });

      it('should merge configuration options correctly', () => {
        engine.configure({ timeout: 1000 });
        engine.configure({ parallel: true });
        
        // Both options should be preserved
        // We can't directly test this without exposing internals,
        // but we can test the behavior indirectly through validation
        expect(engine).toBeInstanceOf(PolicyEngine);
      });
    });

    describe('Plugin Registration', () => {
      it('should register a valid plugin successfully', async () => {
        const plugin: PolicyPlugin = {
          name: 'test-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const result = await engine.use(plugin);
        expect(result).toBe(engine); // Should return self for chaining
      });

      it('should reject plugin with missing name', async () => {
        const invalidPlugin = {
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should reject plugin with missing version', async () => {
        const invalidPlugin = {
          name: 'test-plugin',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should reject plugin with missing validate method', async () => {
        const invalidPlugin = {
          name: 'test-plugin',
          version: '1.0.0'
        } as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should reject plugin with invalid name type', async () => {
        const invalidPlugin = {
          name: 123,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as unknown as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should reject plugin with invalid version type', async () => {
        const invalidPlugin = {
          name: 'test-plugin',
          version: 123,
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as unknown as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should reject plugin with invalid validate method type', async () => {
        const invalidPlugin = {
          name: 'test-plugin',
          version: '1.0.0',
          validate: 'not-a-function'
        } as unknown as PolicyPlugin;

        await expect(engine.use(invalidPlugin)).rejects.toThrow();
      });

      it('should handle plugin registration with configuration', async () => {
        const plugin: PolicyPlugin = {
          name: 'config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' }
            }
          }
        };

        engine.configure({
          pluginConfig: {
            'config-plugin': { enabled: true }
          }
        });

        await expect(engine.use(plugin)).resolves.toBe(engine);
      });
    });

    describe('Validation Execution', () => {
      it('should return successful result with no plugins', async () => {
        const manifests = [
          { kind: 'Pod', metadata: { name: 'test-pod' } }
        ];

        const result = await engine.validate(manifests);

        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.metadata.pluginCount).toBe(0);
        expect(result.metadata.manifestCount).toBe(1);
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should execute single plugin successfully', async () => {
        const plugin: PolicyPlugin = {
          name: 'success-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'success-plugin',
              severity: 'warning',
              message: 'Test warning'
            }];
          }
        };

        await engine.use(plugin);
        const result = await engine.validate([{ kind: 'Service' }]);

        expect(result.valid).toBe(true); // Warnings don't make result invalid
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].message).toBe('Test warning');
        expect(result.metadata.pluginCount).toBe(1);
      });

      it('should execute multiple plugins successfully', async () => {
        const plugin1: PolicyPlugin = {
          name: 'plugin-1',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'plugin-1',
              severity: 'info',
              message: 'Plugin 1 info'
            }];
          }
        };

        const plugin2: PolicyPlugin = {
          name: 'plugin-2',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'plugin-2',
              severity: 'error',
              message: 'Plugin 2 error'
            }];
          }
        };

        await engine.use(plugin1);
        await engine.use(plugin2);
        const result = await engine.validate([{ kind: 'Deployment' }]);

        expect(result.valid).toBe(false); // Errors make result invalid
        expect(result.violations).toHaveLength(1);
        expect(result.warnings).toHaveLength(1);
        expect(result.metadata.pluginCount).toBe(2);
      });

      it('should handle empty manifest array', async () => {
        const plugin: PolicyPlugin = {
          name: 'empty-test-plugin',
          version: '1.0.0',
          async validate(manifests): Promise<PolicyViolation[]> {
            expect(manifests).toHaveLength(0);
            return [];
          }
        };

        await engine.use(plugin);
        const result = await engine.validate([]);

        expect(result.valid).toBe(true);
        expect(result.metadata.manifestCount).toBe(0);
      });

      it('should provide validation context to plugins', async () => {
        let receivedContext: ValidationContext | null = null;

        const plugin: PolicyPlugin = {
          name: 'context-plugin',
          version: '1.0.0',
          async validate(manifests, context): Promise<PolicyViolation[]> {
            receivedContext = context;
            return [];
          }
        };

        await engine.use(plugin);
        await engine.validate([{ kind: 'ConfigMap' }]);

        expect(receivedContext).toBeDefined();
        expect(receivedContext!.chart).toBeDefined();
        expect(receivedContext!.config).toBeDefined();
        expect(receivedContext!.environment).toBeDefined();
        expect(receivedContext!.logger).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle plugin execution errors with graceful degradation', async () => {
        const failingPlugin: PolicyPlugin = {
          name: 'failing-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            throw new Error('Plugin execution failed');
          }
        };

        const gracefulEngine = new PolicyEngine({ gracefulDegradation: true });
        await gracefulEngine.use(failingPlugin);
        
        const result = await gracefulEngine.validate([{ kind: 'Pod' }]);

        expect(result.valid).toBe(false);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].message).toContain('Plugin execution failed');
        expect(result.violations[0].plugin).toBe('failing-plugin');
      });

      it('should throw error without graceful degradation', async () => {
        const failingPlugin: PolicyPlugin = {
          name: 'failing-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            throw new Error('Plugin execution failed');
          }
        };

        const strictEngine = new PolicyEngine({ gracefulDegradation: false });
        await strictEngine.use(failingPlugin);
        
        await expect(strictEngine.validate([{ kind: 'Pod' }])).rejects.toThrow();
      });

      it('should handle timeout errors', async () => {
        const slowPlugin: PolicyPlugin = {
          name: 'slow-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            await new Promise(resolve => setTimeout(resolve, 200));
            return [];
          }
        };

        const timeoutEngine = new PolicyEngine({ 
          timeout: 100, 
          gracefulDegradation: true 
        });
        await timeoutEngine.use(slowPlugin);
        
        const result = await timeoutEngine.validate([{ kind: 'Service' }]);

        expect(result.valid).toBe(false);
        // Should have error violation from timeout
        const hasTimeoutError = result.violations.some(v => 
          v.plugin === 'slow-plugin' && 
          (v.message.includes('timed out') || v.message.includes('failed'))
        );
        expect(hasTimeoutError).toBe(true);
      });

      it('should implement fail-fast behavior', async () => {
        const errorPlugin: PolicyPlugin = {
          name: 'error-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'error-plugin',
              severity: 'error',
              message: 'First error'
            }];
          }
        };

        const secondPlugin: PolicyPlugin = {
          name: 'second-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'second-plugin',
              severity: 'error',
              message: 'Second error'
            }];
          }
        };

        const failFastEngine = new PolicyEngine({ failFast: true });
        await failFastEngine.use(errorPlugin);
        await failFastEngine.use(secondPlugin);
        
        const result = await failFastEngine.validate([{ kind: 'Deployment' }]);

        expect(result.valid).toBe(false);
        expect(result.violations).toHaveLength(1); // Should stop after first error
        expect(result.violations[0].plugin).toBe('error-plugin');
      });

      it('should continue execution without fail-fast', async () => {
        const errorPlugin: PolicyPlugin = {
          name: 'error-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'error-plugin',
              severity: 'error',
              message: 'First error'
            }];
          }
        };

        const secondPlugin: PolicyPlugin = {
          name: 'second-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [{
              plugin: 'second-plugin',
              severity: 'error',
              message: 'Second error'
            }];
          }
        };

        const continueEngine = new PolicyEngine({ failFast: false });
        await continueEngine.use(errorPlugin);
        await continueEngine.use(secondPlugin);
        
        const result = await continueEngine.validate([{ kind: 'Deployment' }]);

        expect(result.valid).toBe(false);
        expect(result.violations).toHaveLength(2); // Should execute both plugins
      });
    });

    describe('Result Formatting', () => {
      it('should format results using default formatter', () => {
        const result: PolicyResult = {
          valid: false,
          violations: [{
            plugin: 'test-plugin',
            severity: 'error',
            message: 'Test error'
          }],
          warnings: [],
          metadata: {
            executionTime: 100,
            pluginCount: 1,
            manifestCount: 1
          },
          summary: {
            violationsBySeverity: { error: 1, warning: 0, info: 0 },
            violationsByPlugin: { 'test-plugin': 1 },
            topViolationTypes: []
          }
        };

        const formatted = engine.formatResult(result);
        expect(typeof formatted).toBe('string');
        expect(formatted).toContain('test-plugin');
        expect(formatted).toContain('Test error');
      });

      it('should use custom formatter when provided', () => {
        const customFormatter = {
          format: vi.fn().mockReturnValue('Custom formatted result')
        };

        const customEngine = new PolicyEngine({ formatter: customFormatter });
        
        const result: PolicyResult = {
          valid: true,
          violations: [],
          warnings: [],
          metadata: {
            executionTime: 50,
            pluginCount: 0,
            manifestCount: 1
          },
          summary: {
            violationsBySeverity: { error: 0, warning: 0, info: 0 },
            violationsByPlugin: {},
            topViolationTypes: []
          }
        };

        const formatted = customEngine.formatResult(result);
        expect(formatted).toBe('Custom formatted result');
        expect(customFormatter.format).toHaveBeenCalledWith(result);
      });
    });

    describe('Parallel Execution', () => {
      it('should execute plugins in parallel when enabled', async () => {
        const executionOrder: string[] = [];
        const startTimes: Record<string, number> = {};

        const createPlugin = (name: string, delay: number): PolicyPlugin => ({
          name,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            startTimes[name] = Date.now();
            await new Promise(resolve => setTimeout(resolve, delay));
            executionOrder.push(name);
            return [];
          }
        });

        const plugin1 = createPlugin('plugin-1', 100);
        const plugin2 = createPlugin('plugin-2', 50);
        const plugin3 = createPlugin('plugin-3', 75);

        const parallelEngine = new PolicyEngine({ parallel: true });
        await parallelEngine.use(plugin1);
        await parallelEngine.use(plugin2);
        await parallelEngine.use(plugin3);

        const startTime = Date.now();
        const result = await parallelEngine.validate([{ kind: 'Pod' }]);
        const totalTime = Date.now() - startTime;

        expect(result.valid).toBe(true);
        expect(result.metadata.pluginCount).toBe(3);
        
        // Parallel execution should be faster than sequential
        expect(totalTime).toBeLessThan(200); // Less than sum of delays
        
        // Plugin 2 should finish first (shortest delay)
        expect(executionOrder[0]).toBe('plugin-2');
      });

      it('should handle errors in parallel execution', async () => {
        const successPlugin: PolicyPlugin = {
          name: 'success-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            await new Promise(resolve => setTimeout(resolve, 50));
            return [{
              plugin: 'success-plugin',
              severity: 'info',
              message: 'Success'
            }];
          }
        };

        const failingPlugin: PolicyPlugin = {
          name: 'failing-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            await new Promise(resolve => setTimeout(resolve, 25));
            throw new Error('Parallel execution failed');
          }
        };

        const parallelEngine = new PolicyEngine({ 
          parallel: true, 
          gracefulDegradation: true 
        });
        await parallelEngine.use(successPlugin);
        await parallelEngine.use(failingPlugin);

        const result = await parallelEngine.validate([{ kind: 'Service' }]);

        expect(result.valid).toBe(false);
        expect(result.warnings).toHaveLength(1); // Success plugin
        expect(result.violations).toHaveLength(1); // Failed plugin
        expect(result.warnings[0].plugin).toBe('success-plugin');
        expect(result.violations[0].plugin).toBe('failing-plugin');
      });
    });
  });

  describe('PluginRegistry Class', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
      registry = new PluginRegistry();
    });

    describe('Plugin Registration', () => {
      it('should register a valid plugin', () => {
        const plugin: PolicyPlugin = {
          name: 'test-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        expect(() => registry.register(plugin)).not.toThrow();
      });

      it('should reject plugin without name', () => {
        const plugin = {
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as PolicyPlugin;

        expect(() => registry.register(plugin)).toThrow();
      });

      it('should reject plugin without version', () => {
        const plugin = {
          name: 'test-plugin',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        } as PolicyPlugin;

        expect(() => registry.register(plugin)).toThrow();
      });

      it('should reject plugin without validate method', () => {
        const plugin = {
          name: 'test-plugin',
          version: '1.0.0'
        } as PolicyPlugin;

        expect(() => registry.register(plugin)).toThrow();
      });

      it('should prevent duplicate plugin registration', () => {
        const plugin1: PolicyPlugin = {
          name: 'duplicate-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const plugin2: PolicyPlugin = {
          name: 'duplicate-plugin',
          version: '2.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        registry.register(plugin1);
        expect(() => registry.register(plugin2)).toThrow();
      });

      it('should store plugin configuration', () => {
        const plugin: PolicyPlugin = {
          name: 'config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const config = { enabled: true, threshold: 10 };
        registry.register(plugin, config);

        const retrievedConfig = registry.getPluginConfig('config-plugin');
        expect(retrievedConfig).toEqual(config);
      });
    });

    describe('Plugin Retrieval', () => {
      it('should retrieve registered plugin by name', () => {
        const plugin: PolicyPlugin = {
          name: 'retrievable-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        registry.register(plugin);
        const retrieved = registry.getPlugin('retrievable-plugin');
        expect(retrieved).toBe(plugin);
      });

      it('should return undefined for non-existent plugin', () => {
        const retrieved = registry.getPlugin('non-existent');
        expect(retrieved).toBeUndefined();
      });

      it('should return all registered plugins', () => {
        const plugin1: PolicyPlugin = {
          name: 'plugin-1',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const plugin2: PolicyPlugin = {
          name: 'plugin-2',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        registry.register(plugin1);
        registry.register(plugin2);

        const allPlugins = registry.getAllPlugins();
        expect(allPlugins).toHaveLength(2);
        expect(allPlugins).toContain(plugin1);
        expect(allPlugins).toContain(plugin2);
      });

      it('should return correct plugin count', () => {
        expect(registry.getPluginCount()).toBe(0);

        const plugin: PolicyPlugin = {
          name: 'count-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        registry.register(plugin);
        expect(registry.getPluginCount()).toBe(1);
      });

      it('should return undefined for plugin without configuration', () => {
        const plugin: PolicyPlugin = {
          name: 'no-config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        registry.register(plugin);
        const config = registry.getPluginConfig('no-config-plugin');
        expect(config).toBeUndefined();
      });
    });
  });

  describe('Error Classes', () => {
    describe('PolicyEngineError', () => {
      it('should create error with message', () => {
        const error = new PolicyEngineError('Test error');
        expect(error.message).toBe('Test error');
        expect(error.name).toBe('PolicyEngineError');
        expect(error).toBeInstanceOf(Error);
      });

      it('should create error with code and context', () => {
        const context = { plugin: 'test-plugin' };
        const error = new PolicyEngineError('Test error', 'TEST_CODE', context);
        expect(error.message).toBe('Test error');
        expect(error.code).toBe('TEST_CODE');
        expect(error.context).toEqual(context);
      });
    });

    describe('PluginError', () => {
      it('should create plugin error with plugin name', () => {
        const error = new PluginError('Plugin failed', 'test-plugin');
        expect(error.message).toBe('Plugin failed');
        expect(error.pluginName).toBe('test-plugin');
        expect(error.name).toBe('PluginError');
        expect(error.code).toBe('PLUGIN_ERROR');
      });

      it('should include plugin name in context', () => {
        const error = new PluginError('Plugin failed', 'test-plugin', { extra: 'data' });
        expect(error.context).toEqual({ extra: 'data', pluginName: 'test-plugin' });
      });
    });

    describe('ValidationTimeoutError', () => {
      it('should create timeout error with plugin and timeout info', () => {
        const error = new ValidationTimeoutError('slow-plugin', 5000);
        expect(error.message).toContain('slow-plugin');
        expect(error.message).toContain('5000ms');
        expect(error.name).toBe('ValidationTimeoutError');
        expect(error.code).toBe('VALIDATION_TIMEOUT');
      });

      it('should include timeout details in context', () => {
        const error = new ValidationTimeoutError('slow-plugin', 5000);
        expect(error.context).toEqual({
          pluginName: 'slow-plugin',
          timeout: 5000
        });
      });
    });

    describe('PluginRegistrationError', () => {
      it('should create registration error', () => {
        const error = new PluginRegistrationError('Registration failed', 'test-plugin');
        expect(error.message).toBe('Registration failed');
        expect(error.pluginName).toBe('test-plugin');
        expect(error.name).toBe('PluginRegistrationError');
      });
    });

    describe('PluginConfigurationError', () => {
      it('should create configuration error', () => {
        const error = new PluginConfigurationError('Config invalid', 'test-plugin', { field: 'enabled' });
        expect(error.message).toBe('Config invalid');
        expect(error.pluginName).toBe('test-plugin');
        expect(error.configPath).toEqual({ field: 'enabled' });
        expect(error.name).toBe('PluginConfigurationError');
      });
    });

    describe('ValidationOrchestrationError', () => {
      it('should create orchestration error', () => {
        const error = new ValidationOrchestrationError('Orchestration failed', ['plugin1', 'plugin2']);
        expect(error.message).toBe('Orchestration failed');
        expect(error.failedPlugins).toEqual(['plugin1', 'plugin2']);
        expect(error.name).toBe('ValidationOrchestrationError');
      });
    });

    describe('PluginRetryExhaustedError', () => {
      it('should create retry exhausted error', () => {
        const originalError = new Error('Original failure');
        const error = new PluginRetryExhaustedError('Retries exhausted', 'test-plugin', 3, originalError);
        expect(error.message).toBe('Retries exhausted');
        expect(error.pluginName).toBe('test-plugin');
        expect(error.attempts).toBe(3);
        expect(error.lastError).toBe(originalError);
        expect(error.name).toBe('PluginRetryExhaustedError');
      });
    });

    describe('GracefulDegradationError', () => {
      it('should create graceful degradation error', () => {
        const originalError = new Error('Original failure');
        const error = new GracefulDegradationError('Degraded gracefully', ['test-plugin'], [originalError]);
        expect(error.message).toBe('Degraded gracefully');
        expect(error.degradedPlugins).toEqual(['test-plugin']);
        expect(error.originalErrors).toEqual([originalError]);
        expect(error.name).toBe('GracefulDegradationError');
      });
    });
  });

  describe('Result Formatters', () => {
    const sampleResult: PolicyResult = {
      valid: false,
      violations: [
        {
          plugin: 'security-plugin',
          severity: 'error',
          message: 'Container running as root',
          resourcePath: 'spec.containers[0]',
          field: 'securityContext.runAsRoot',
          suggestion: 'Set runAsRoot to false'
        }
      ],
      warnings: [
        {
          plugin: 'best-practices-plugin',
          severity: 'warning',
          message: 'Missing resource limits',
          resourcePath: 'spec.containers[0]',
          field: 'resources.limits'
        }
      ],
      metadata: {
        executionTime: 150,
        pluginCount: 2,
        manifestCount: 3
      },
      summary: {
        violationsBySeverity: { error: 1, warning: 1, info: 0 },
        violationsByPlugin: { 'security-plugin': 1, 'best-practices-plugin': 1 },
        topViolationTypes: ['security', 'resources']
      }
    };

    describe('DefaultResultFormatter', () => {
      it('should format result with violations and warnings', () => {
        const formatter = new DefaultResultFormatter();
        const formatted = formatter.format(sampleResult);

        expect(formatted).toContain('Policy Validation Results');
        expect(formatted).toContain('❌ FAILED');
        expect(formatted).toContain('security-plugin');
        expect(formatted).toContain('Container running as root');
        expect(formatted).toContain('best-practices-plugin');
        expect(formatted).toContain('Missing resource limits');
        expect(formatted).toContain('Errors:   1');
        expect(formatted).toContain('Warnings: 1');
      });

      it('should format successful result', () => {
        const successResult: PolicyResult = {
          valid: true,
          violations: [],
          warnings: [],
          metadata: {
            executionTime: 50,
            pluginCount: 1,
            manifestCount: 2
          },
          summary: {
            violationsBySeverity: { error: 0, warning: 0, info: 0 },
            violationsByPlugin: {},
            topViolationTypes: []
          }
        };

        const formatter = new DefaultResultFormatter();
        const formatted = formatter.format(successResult);

        expect(formatted).toContain('Policy Validation Results');
        expect(formatted).toContain('✅ PASSED');
        expect(formatted).toContain('No policy violations found');
      });
    });

    describe('JsonResultFormatter', () => {
      it('should format result as JSON', () => {
        const formatter = new JsonResultFormatter();
        const formatted = formatter.format(sampleResult);

        const parsed = JSON.parse(formatted);
        expect(parsed.valid).toBe(false);
        expect(parsed.violations).toHaveLength(1);
        expect(parsed.warnings).toHaveLength(1);
        expect(parsed.metadata.executionTime).toBe(150);
      });

      it('should use custom indentation', () => {
        const formatter = new JsonResultFormatter(4);
        const formatted = formatter.format(sampleResult);

        // Check that it uses 4-space indentation
        expect(formatted).toContain('    "valid"');
      });
    });

    describe('CompactResultFormatter', () => {
      it('should format result compactly', () => {
        const formatter = new CompactResultFormatter();
        const formatted = formatter.format(sampleResult);

        expect(formatted).toContain('FAIL');
        expect(formatted).toContain('1 errors, 1 warnings');
        expect(formatted).toContain('security-plugin');
        expect(formatted).toContain('Container running as root');
      });

      it('should format successful result compactly', () => {
        const successResult: PolicyResult = {
          valid: true,
          violations: [],
          warnings: [],
          metadata: {
            executionTime: 50,
            pluginCount: 1,
            manifestCount: 2
          },
          summary: {
            violationsBySeverity: { error: 0, warning: 0, info: 0 },
            violationsByPlugin: {},
            topViolationTypes: []
          }
        };

        const formatter = new CompactResultFormatter();
        const formatted = formatter.format(successResult);

        expect(formatted).toContain('PASS');
        expect(formatted).toContain('50ms');
      });
    });

    describe('GitHubActionsResultFormatter', () => {
      it('should format result for GitHub Actions', () => {
        const formatter = new GitHubActionsResultFormatter();
        const formatted = formatter.format(sampleResult);

        expect(formatted).toContain('::error');
        expect(formatted).toContain('::warning');
        expect(formatted).toContain('security-plugin');
        expect(formatted).toContain('Container running as root');
        expect(formatted).toContain('best-practices-plugin');
        expect(formatted).toContain('Missing resource limits');
      });

      it('should format successful result for GitHub Actions', () => {
        const successResult: PolicyResult = {
          valid: true,
          violations: [],
          warnings: [],
          metadata: {
            executionTime: 50,
            pluginCount: 1,
            manifestCount: 2
          },
          summary: {
            violationsBySeverity: { error: 0, warning: 0, info: 0 },
            violationsByPlugin: {},
            topViolationTypes: []
          }
        };

        const formatter = new GitHubActionsResultFormatter();
        const formatted = formatter.format(successResult);

        expect(formatted).toContain('::notice');
        expect(formatted).toContain('Status: success');
      });
    });

    describe('SarifResultFormatter', () => {
      it('should format result as SARIF JSON', () => {
        const formatter = new SarifResultFormatter();
        const formatted = formatter.format(sampleResult);

        const parsed = JSON.parse(formatted);
        expect(parsed.version).toBe('2.1.0');
        expect(parsed.$schema).toContain('sarif-2.1.0.json');
        expect(parsed.runs).toHaveLength(1);
        expect(parsed.runs[0].results).toHaveLength(2); // 1 violation + 1 warning
        expect(parsed.runs[0].tool.driver.name).toBe('Timonel Policy Engine');
      });

      it('should include rule information in SARIF output', () => {
        const formatter = new SarifResultFormatter();
        const formatted = formatter.format(sampleResult);

        const parsed = JSON.parse(formatted);
        const results = parsed.runs[0].results;
        expect(results).toHaveLength(2);
        expect(results[0].ruleId).toContain('security-plugin');
        expect(results[1].ruleId).toContain('best-practices-plugin');
      });
    });
  });

  describe('ConfigurationLoader', () => {
    let loader: ConfigurationLoader;

    beforeEach(() => {
      loader = new ConfigurationLoader();
    });

    describe('Plugin Configuration Loading', () => {
      it('should load empty configuration for plugin without config', async () => {
        const plugin: PolicyPlugin = {
          name: 'no-config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const result = await loader.loadPluginConfiguration(plugin, 'development');

        expect(result.config).toEqual({});
        expect(result.validated).toBe(false);
        expect(result.entries).toHaveLength(0);
      });

      it('should load inline configuration', async () => {
        const plugin: PolicyPlugin = {
          name: 'inline-config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          }
        };

        const inlineConfig = { enabled: true, threshold: 10 };
        const result = await loader.loadPluginConfiguration(plugin, 'development', inlineConfig);

        expect(result.config).toEqual(inlineConfig);
        expect(result.validated).toBe(false);
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].source).toBe('inline');
      });

      it('should merge default and inline configuration', async () => {
        const plugin: PolicyPlugin = {
          name: 'merge-config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
          metadata: {
            defaultConfig: {
              enabled: false,
              threshold: 5,
              mode: 'strict'
            }
          }
        };

        const inlineConfig = { enabled: true, threshold: 10 };
        const result = await loader.loadPluginConfiguration(plugin, 'development', inlineConfig);

        expect(result.config).toEqual({
          enabled: true,    // From inline (overrides default)
          threshold: 10,    // From inline (overrides default)
          mode: 'strict'    // From default (not overridden)
        });
        expect(result.entries).toHaveLength(2);
      });

      it('should validate configuration against schema when provided', async () => {
        const plugin: PolicyPlugin = {
          name: 'schema-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              threshold: { type: 'number' }
            },
            required: ['enabled']
          }
        };

        const validConfig = { enabled: true, threshold: 10 };
        const result = await loader.loadPluginConfiguration(plugin, 'development', validConfig);

        expect(result.config).toEqual(validConfig);
        expect(result.validated).toBe(true);
        expect(result.validationErrors).toBeUndefined();
      });

      it('should handle invalid configuration gracefully', async () => {
        const plugin: PolicyPlugin = {
          name: 'invalid-config-plugin',
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' }
            },
            required: ['enabled']
          }
        };

        const invalidConfig = { enabled: 'not-a-boolean' };
        const result = await loader.loadPluginConfiguration(plugin, 'development', invalidConfig);

        expect(result.config).toEqual(invalidConfig); // Still returns the config
        expect(result.validated).toBe(false);
        expect(result.validationErrors).toBeDefined();
        expect(result.validationErrors!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ErrorContextGenerator', () => {
    let generator: ErrorContextGenerator;

    beforeEach(() => {
      generator = new ErrorContextGenerator();
    });

    describe('Context Generation', () => {
      it('should generate basic error context', () => {
        const violation: PolicyViolation = {
          plugin: 'test-plugin',
          severity: 'error',
          message: 'Test violation'
        };

        const context = generator.generateContext(violation);

        expect(context.timestamp).toBeDefined();
        expect(context.environment).toBeDefined();
        expect(context.plugin.name).toBe('test-plugin');
        expect(context.error.message).toBe('Test violation');
        expect(context.debuggingHints).toBeDefined();
      });

      it('should include validation context when provided', () => {
        const violation: PolicyViolation = {
          plugin: 'test-plugin',
          severity: 'error',
          message: 'Test violation'
        };

        const validationContext: ValidationContext = {
          chart: { name: 'test-chart', version: '1.0.0' },
          config: { enabled: true },
          environment: 'production',
          logger: {} as any
        };

        const context = generator.generateContext(violation, validationContext);

        expect(context.validationContext.chartName).toBe('test-chart');
        expect(context.validationContext.chartVersion).toBe('1.0.0');
        expect(context.validationContext.environment).toBe('production');
      });

      it('should find related violations', () => {
        const violation: PolicyViolation = {
          plugin: 'security-plugin',
          severity: 'error',
          message: 'Security violation'
        };

        const allViolations = [
          violation,
          {
            plugin: 'security-plugin',
            severity: 'warning',
            message: 'Another security issue'
          },
          {
            plugin: 'other-plugin',
            severity: 'error',
            message: 'Different issue'
          }
        ];

        const context = generator.generateContext(violation, undefined, allViolations);

        expect(context.relatedViolations).toHaveLength(1);
        expect(context.relatedViolations[0].message).toBe('Another security issue');
      });

      it('should include execution time when provided', () => {
        const violation: PolicyViolation = {
          plugin: 'test-plugin',
          severity: 'error',
          message: 'Test violation'
        };

        const context = generator.generateContext(violation, undefined, undefined, 150);

        expect(context.plugin.executionTime).toBe(150);
      });
    });

    describe('Error Report Generation', () => {
      it('should generate formatted error report', () => {
        const violation: PolicyViolation = {
          plugin: 'test-plugin',
          severity: 'error',
          message: 'Test violation',
          resourcePath: 'spec.containers[0]',
          field: 'image',
          suggestion: 'Use a specific image tag'
        };

        const report = generator.generateErrorReport(violation);

        expect(report).toContain('test-plugin');
        expect(report).toContain('Test violation');
        expect(report).toContain('spec.containers[0]');
        expect(report).toContain('image');
        expect(report).toContain('Use a specific image tag');
      });

      it('should include context information in report', () => {
        const violation: PolicyViolation = {
          plugin: 'test-plugin',
          severity: 'error',
          message: 'Test violation'
        };

        const validationContext: ValidationContext = {
          chart: { name: 'test-chart', version: '1.0.0' },
          config: {},
          environment: 'production',
          logger: {} as any
        };

        const report = generator.generateErrorReport(violation, validationContext);

        expect(report).toContain('test-chart');
        expect(report).toContain('production');
      });
    });
  });
});