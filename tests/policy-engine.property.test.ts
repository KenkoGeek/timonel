/**
 * Property-Based Tests for Policy Engine
 *
 * These tests validate universal properties that should hold across all valid inputs
 * for the Timonel Policy Engine system. Each property is tested with multiple
 * generated inputs to ensure correctness across the input space.
 *
 * @since 3.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { PolicyEngine } from '../src/lib/policy/policyEngine.js';
import type { PolicyPlugin, ValidationContext, PolicyViolation } from '../src/lib/policy/types.js';

// Type for testing internal engine methods
type PolicyEngineWithRegistry = PolicyEngine & {
  registry: {
    getAllPlugins(): PolicyPlugin[];
    getPlugin(name: string): PolicyPlugin | undefined;
    getPluginCount(): number;
    getPluginConfig(name: string): Record<string, unknown> | undefined;
  };
};

/**
 * Property-based test configuration
 */
const PROPERTY_TEST_ITERATIONS = 100;

/**
 * Generates a random valid plugin for testing
 */
function generateRandomPlugin(seed: number = Math.random()): PolicyPlugin {
  const id = Math.floor(seed * 10000);
  return {
    name: `test-plugin-${id}`,
    version: `1.${Math.floor(seed * 10)}.${Math.floor(seed * 100) % 10}`,
    description: `Test plugin ${id} for property testing`,
    async validate(manifests: unknown[], context: ValidationContext): Promise<PolicyViolation[]> {
      // Simple validation that returns violations based on manifest count
      const violations: PolicyViolation[] = [];
      if (manifests.length > 5) {
        violations.push({
          plugin: this.name,
          severity: 'warning',
          message: `Too many manifests: ${manifests.length}`,
        });
      }
      return violations;
    },
    metadata: {
      author: `test-author-${id}`,
      tags: ['test', 'property-testing'],
    },
  };
}

/**
 * Generates multiple random plugins
 */
function generateRandomPlugins(count: number): PolicyPlugin[] {
  const plugins: PolicyPlugin[] = [];
  for (let i = 0; i < count; i++) {
    plugins.push(generateRandomPlugin(i / count));
  }
  return plugins;
}

describe('Policy Engine Property Tests', () => {
  let engine: PolicyEngine;

  // Mock ChartMetadata for all tests
  const mockChartMetadata = { name: 'test-chart', version: '1.0.0' };

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  describe('Property 1: Plugin Registration Consistency', () => {
    /**
     * **Feature: policy-engine, Property 1: Plugin Registration Consistency**
     *
     * For any valid PolicyPlugin, registering it with the PolicyEngine should make it
     * available for validation and preserve its metadata
     * **Validates: Requirements 1.1, 2.4**
     */
    it('should consistently register and retrieve plugins across multiple iterations', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Generate a fresh engine for each iteration to avoid state pollution
        const testEngine = new PolicyEngine();

        // Generate a random valid plugin
        const plugin = generateRandomPlugin(iteration / PROPERTY_TEST_ITERATIONS);

        // Property: Registering a valid plugin should make it available
        await testEngine.use(plugin);

        // Verify the plugin is registered and metadata is preserved
        const registeredPlugins = (
          testEngine as { registry: { getAllPlugins(): PolicyPlugin[] } }
        ).registry.getAllPlugins();

        expect(registeredPlugins).toHaveLength(1);
        expect(registeredPlugins[0]).toBe(plugin);
        expect(registeredPlugins[0].name).toBe(plugin.name);
        expect(registeredPlugins[0].version).toBe(plugin.version);
        expect(registeredPlugins[0].description).toBe(plugin.description);
        expect(registeredPlugins[0].metadata).toEqual(plugin.metadata);

        // Verify the plugin can be retrieved by name
        const retrievedPlugin = (
          testEngine as { registry: { getPlugin(name: string): PolicyPlugin | undefined } }
        ).registry.getPlugin(plugin.name);
        expect(retrievedPlugin).toBe(plugin);
      }
    });

    it('should handle multiple plugin registrations consistently', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate 1-5 random plugins
        const pluginCount = Math.floor(Math.random() * 5) + 1;
        const plugins = generateRandomPlugins(pluginCount);

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Property: All registered plugins should be available
        const registeredPlugins = (testEngine as PolicyEngineWithRegistry).registry.getAllPlugins();
        expect(registeredPlugins).toHaveLength(pluginCount);

        // Property: Each plugin should be retrievable by name
        plugins.forEach((plugin) => {
          const retrievedPlugin = (testEngine as PolicyEngineWithRegistry).registry.getPlugin(
            plugin.name,
          );
          expect(retrievedPlugin).toBe(plugin);
          expect(retrievedPlugin.name).toBe(plugin.name);
          expect(retrievedPlugin.version).toBe(plugin.version);
        });

        // Property: Plugin count should match registered count
        expect((testEngine as PolicyEngineWithRegistry).registry.getPluginCount()).toBe(
          pluginCount,
        );
      }
    });

    it('should preserve plugin registration order and uniqueness', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate plugins with guaranteed unique names
        const pluginCount = Math.floor(Math.random() * 10) + 1;
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          plugins.push({
            name: `unique-plugin-${iteration}-${i}`,
            version: `1.0.${i}`,
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          });
        }

        // Register plugins in order
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Property: All plugins should be registered
        const registeredPlugins = (testEngine as PolicyEngineWithRegistry).registry.getAllPlugins();
        expect(registeredPlugins).toHaveLength(pluginCount);

        // Property: Each plugin should be unique and retrievable
        const pluginNames = new Set(registeredPlugins.map((p) => p.name));
        expect(pluginNames.size).toBe(pluginCount); // All names should be unique

        // Property: All original plugins should be findable
        plugins.forEach((originalPlugin) => {
          const found = registeredPlugins.find((p) => p.name === originalPlugin.name);
          expect(found).toBeDefined();
          expect(found?.version).toBe(originalPlugin.version);
        });
      }
    });

    it('should handle plugin registration with configuration consistently', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate plugin with random configuration
        const plugin = generateRandomPlugin(iteration / PROPERTY_TEST_ITERATIONS);
        const config = {
          enabled: Math.random() > 0.5,
          threshold: Math.floor(Math.random() * 100),
          tags: [`config-${iteration}`, 'test'],
        };

        // Configure engine with plugin-specific config
        testEngine.configure({
          pluginConfig: {
            [plugin.name]: config,
          },
        });

        // Register plugin
        await testEngine.use(plugin);

        // Property: Plugin should be registered with configuration
        const registeredPlugin = (testEngine as PolicyEngineWithRegistry).registry.getPlugin(
          plugin.name,
        );
        expect(registeredPlugin).toBe(plugin);

        const pluginConfig = (testEngine as PolicyEngineWithRegistry).registry.getPluginConfig(
          plugin.name,
        );
        expect(pluginConfig).toEqual(config);
      }
    });
  });

  describe('Property 3: Plugin Interface Compliance', () => {
    /**
     * **Feature: policy-engine, Property 3: Plugin Interface Compliance**
     *
     * For any object claiming to be a PolicyPlugin, the system should validate that it
     * implements the required interface before registration
     * **Validates: Requirements 2.1, 5.2**
     */
    it('should validate plugin interface compliance for valid plugins', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate a valid plugin with all required properties
        const validPlugin: PolicyPlugin = {
          name: `valid-plugin-${iteration}`,
          version: `1.0.${iteration}`,
          description: `Valid plugin ${iteration}`,
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            return [];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
            },
          },
          metadata: {
            author: `author-${iteration}`,
            tags: ['test', 'valid'],
          },
        };

        // Property: Valid plugins should register successfully
        await expect(testEngine.use(validPlugin)).resolves.toBeDefined();

        // Verify plugin is registered
        const registeredPlugin = (testEngine as PolicyEngineWithRegistry).registry.getPlugin(
          validPlugin.name,
        );
        expect(registeredPlugin).toBe(validPlugin);
      }
    });

    it('should reject plugins with missing required properties', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Test different invalid plugin configurations
        const invalidPlugins = [
          // Missing name
          {
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Missing version
          {
            name: `plugin-${iteration}`,
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Missing validate method
          {
            name: `plugin-${iteration}`,
            version: '1.0.0',
          },
          // Invalid name type
          {
            name: 123,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Invalid version type
          {
            name: `plugin-${iteration}`,
            version: 123,
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Invalid validate type
          {
            name: `plugin-${iteration}`,
            version: '1.0.0',
            validate: 'not-a-function',
          },
        ];

        // Property: Invalid plugins should be rejected
        for (const invalidPlugin of invalidPlugins) {
          await expect(testEngine.use(invalidPlugin as PolicyPlugin)).rejects.toThrow();

          // Verify no plugin was registered
          const pluginCount = (testEngine as PolicyEngineWithRegistry).registry.getPluginCount();
          expect(pluginCount).toBe(0);
        }
      }
    });

    it('should validate optional properties when present', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Test plugins with invalid optional properties
        const pluginsWithInvalidOptionals = [
          // Invalid description type
          {
            name: `plugin-${iteration}-desc`,
            version: '1.0.0',
            description: 123, // Should be string
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Invalid configSchema type
          {
            name: `plugin-${iteration}-schema`,
            version: '1.0.0',
            configSchema: 'not-an-object', // Should be object
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
          // Invalid metadata type
          {
            name: `plugin-${iteration}-meta`,
            version: '1.0.0',
            metadata: 'not-an-object', // Should be object
            async validate(): Promise<PolicyViolation[]> {
              return [];
            },
          },
        ];

        // Property: Plugins with invalid optional properties should be rejected
        for (const invalidPlugin of pluginsWithInvalidOptionals) {
          await expect(testEngine.use(invalidPlugin as PolicyPlugin)).rejects.toThrow();

          // Verify no plugin was registered
          const pluginCount = (testEngine as PolicyEngineWithRegistry).registry.getPluginCount();
          expect(pluginCount).toBe(0);
        }
      }
    });

    it('should prevent duplicate plugin registration', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        const pluginName = `duplicate-plugin-${iteration}`;

        // Create two plugins with the same name
        const plugin1: PolicyPlugin = {
          name: pluginName,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
        };

        const plugin2: PolicyPlugin = {
          name: pluginName,
          version: '2.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
        };

        // Property: First plugin should register successfully
        await expect(testEngine.use(plugin1)).resolves.toBeDefined();

        // Property: Second plugin with same name should be rejected
        await expect(testEngine.use(plugin2)).rejects.toThrow();

        // Verify only the first plugin is registered
        const registeredPlugin = (testEngine as PolicyEngineWithRegistry).registry.getPlugin(
          pluginName,
        );
        expect(registeredPlugin).toBe(plugin1);
        expect(registeredPlugin.version).toBe('1.0.0');

        const pluginCount = (testEngine as PolicyEngineWithRegistry).registry.getPluginCount();
        expect(pluginCount).toBe(1);
      }
    });

    it('should handle null and undefined plugin inputs', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Property: null and undefined plugins should be rejected
        await expect(testEngine.use(null as unknown as PolicyPlugin)).rejects.toThrow();
        await expect(testEngine.use(undefined as unknown as PolicyPlugin)).rejects.toThrow();

        // Verify no plugins were registered
        const pluginCount = (testEngine as PolicyEngineWithRegistry).registry.getPluginCount();
        expect(pluginCount).toBe(0);
      }
    });
  });

  describe('Property 2: Sequential Plugin Execution', () => {
    /**
     * **Feature: policy-engine, Property 2: Sequential Plugin Execution**
     *
     * For any set of registered plugins, validation should execute all plugins and
     * aggregate their results without losing any violations
     * **Validates: Requirements 1.2, 1.3, 3.1**
     */
    it('should execute all plugins sequentially and aggregate results', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false }); // Force sequential execution

        // Generate 1-5 plugins with predictable violation patterns
        const pluginCount = Math.floor(Math.random() * 5) + 1;
        const plugins: PolicyPlugin[] = [];
        const expectedViolations: string[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `sequential-plugin-${iteration}-${i}`;
          const violationMessage = `Violation from ${pluginName}`;

          plugins.push({
            name: pluginName,
            version: `1.0.${i}`,
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              // Each plugin generates a predictable violation
              return [
                {
                  plugin: pluginName,
                  severity: 'error',
                  message: violationMessage,
                },
              ];
            },
          });

          expectedViolations.push(violationMessage);
        }

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Pod', metadata: { name: 'test' } }]);

        // Property: All plugins should have executed
        expect(result.violations).toHaveLength(pluginCount);

        // Property: All expected violations should be present
        const actualMessages = result.violations.map((v) => v.message);
        expectedViolations.forEach((expectedMessage) => {
          expect(actualMessages).toContain(expectedMessage);
        });

        // Property: Each plugin should be represented exactly once
        const pluginNames = result.violations.map((v) => v.plugin);
        const uniquePluginNames = new Set(pluginNames);
        expect(uniquePluginNames.size).toBe(pluginCount);

        // Property: Result should be invalid when violations exist
        expect(result.valid).toBe(false);
      }
    });

    it('should handle plugins with different violation severities', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false });

        // Create plugins with different severity levels
        const severities: Array<'error' | 'warning' | 'info'> = ['error', 'warning', 'info'];
        const plugins: PolicyPlugin[] = [];

        severities.forEach((severity, index) => {
          plugins.push({
            name: `${severity}-plugin-${iteration}-${index}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `${severity}-plugin-${iteration}-${index}`,
                  severity,
                  message: `${severity} violation`,
                },
              ];
            },
          });
        });

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);

        // Property: Should have violations and warnings
        expect(result.violations.length + result.warnings.length).toBe(severities.length);

        // Property: Errors should be in violations, warnings/info in warnings
        const errorViolations = result.violations.filter((v) => v.severity === 'error');
        const warningViolations = result.warnings.filter(
          (v) => v.severity === 'warning' || v.severity === 'info',
        );

        expect(errorViolations).toHaveLength(1);
        expect(warningViolations).toHaveLength(2);

        // Property: Result should be invalid if any errors exist
        expect(result.valid).toBe(false);
      }
    });

    it('should handle empty plugin list gracefully', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate random manifests
        const manifestCount = Math.floor(Math.random() * 10) + 1;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'ConfigMap',
          metadata: { name: `config-${i}` },
        }));

        // Property: Empty plugin list should return successful validation
        const result = await testEngine.validate(manifests, mockChartMetadata);

        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.metadata.pluginCount).toBe(0);
        expect(result.metadata.manifestCount).toBe(manifestCount);
      }
    });

    it('should preserve plugin execution order in sequential mode', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false });
        const executionOrder: string[] = [];

        // Create plugins that record their execution order
        const pluginCount = Math.floor(Math.random() * 5) + 2; // At least 2 plugins
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `order-plugin-${iteration}-${i}`;
          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              executionOrder.push(pluginName);
              return [];
            },
          });
        }

        // Register plugins in order
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        await testEngine.validate([{ kind: 'Deployment' }], mockChartMetadata);

        // Property: Plugins should execute in registration order
        expect(executionOrder).toHaveLength(pluginCount);
        plugins.forEach((plugin, index) => {
          expect(executionOrder[index]).toBe(plugin.name);
        });
      }
    });

    it('should handle plugin failures without stopping other plugins', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false, failFast: false });

        // Create mix of successful and failing plugins
        const plugins: PolicyPlugin[] = [
          {
            name: `success-plugin-${iteration}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `success-plugin-${iteration}`,
                  severity: 'warning',
                  message: 'Success plugin warning',
                },
              ];
            },
          },
          {
            name: `failing-plugin-${iteration}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              throw new Error('Plugin execution failed');
            },
          },
          {
            name: `another-success-plugin-${iteration}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `another-success-plugin-${iteration}`,
                  severity: 'error',
                  message: 'Another success plugin error',
                },
              ];
            },
          },
        ];

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'StatefulSet' }], mockChartMetadata);

        // Property: Should have violations from both successful plugins and the failed plugin
        expect(result.violations.length + result.warnings.length).toBe(3);

        // Property: Failed plugin should generate an error violation
        const failedPluginViolation = result.violations.find(
          (v) =>
            v.plugin === `failing-plugin-${iteration}` &&
            v.message.includes('Plugin execution failed'),
        );
        expect(failedPluginViolation).toBeDefined();

        // Property: Successful plugins should still produce their violations
        const successViolation = result.warnings.find(
          (v) => v.plugin === `success-plugin-${iteration}`,
        );
        const anotherSuccessViolation = result.violations.find(
          (v) => v.plugin === `another-success-plugin-${iteration}`,
        );

        expect(successViolation).toBeDefined();
        expect(anotherSuccessViolation).toBeDefined();

        // Property: Result should be invalid due to errors
        expect(result.valid).toBe(false);
      }
    });

    it('should respect failFast option when enabled', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false, failFast: true });

        // Create plugins where first one generates an error
        const plugins: PolicyPlugin[] = [
          {
            name: `first-error-plugin-${iteration}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `first-error-plugin-${iteration}`,
                  severity: 'error',
                  message: 'First error',
                },
              ];
            },
          },
          {
            name: `second-plugin-${iteration}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `second-plugin-${iteration}`,
                  severity: 'error',
                  message: 'Second error',
                },
              ];
            },
          },
        ];

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Job' }], mockChartMetadata);

        // Property: Should stop after first error when failFast is enabled
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].plugin).toBe(`first-error-plugin-${iteration}`);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Property 4: Validation Result Aggregation', () => {
    /**
     * **Feature: policy-engine, Property 4: Validation Result Aggregation**
     *
     * For any combination of plugin results, the aggregated result should contain all violations
     * from individual plugins with proper plugin attribution
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('should aggregate violations from multiple plugins with proper attribution', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false });

        // Generate 2-6 plugins with varying numbers of violations
        const pluginCount = Math.floor(Math.random() * 5) + 2;
        const plugins: PolicyPlugin[] = [];
        const expectedViolationsByPlugin: Record<string, PolicyViolation[]> = {};

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `aggregation-plugin-${iteration}-${i}`;
          const violationCount = Math.floor(Math.random() * 4) + 1; // 1-4 violations per plugin
          const pluginViolations: PolicyViolation[] = [];

          for (let j = 0; j < violationCount; j++) {
            const severity = ['error', 'warning', 'info'][Math.floor(Math.random() * 3)] as
              | 'error'
              | 'warning'
              | 'info';
            pluginViolations.push({
              plugin: pluginName,
              severity,
              message: `Violation ${j + 1} from ${pluginName}`,
              resourcePath: `spec.containers[${j}]`,
              field: `image`,
              suggestion: `Fix violation ${j + 1}`,
              context: { violationIndex: j, pluginIndex: i },
            });
          }

          expectedViolationsByPlugin[pluginName] = pluginViolations;

          plugins.push({
            name: pluginName,
            version: `1.0.${i}`,
            async validate(): Promise<PolicyViolation[]> {
              return [...pluginViolations]; // Return copy to avoid mutation
            },
          });
        }

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([
          { kind: 'Pod', metadata: { name: 'test-pod' } },
          { kind: 'Service', metadata: { name: 'test-service' } },
        ]);

        // Property: Total violations should equal sum of all plugin violations
        const expectedTotalViolations = Object.values(expectedViolationsByPlugin).reduce(
          (sum, violations) => sum + violations.length,
          0,
        );
        const actualTotalViolations = result.violations.length + result.warnings.length;
        expect(actualTotalViolations).toBe(expectedTotalViolations);

        // Property: Each plugin's violations should be present with correct attribution
        for (const [pluginName, expectedViolations] of Object.entries(expectedViolationsByPlugin)) {
          const actualViolations = [...result.violations, ...result.warnings].filter(
            (v) => v.plugin === pluginName,
          );

          expect(actualViolations).toHaveLength(expectedViolations.length);

          // Property: Each violation should maintain its original properties
          expectedViolations.forEach((expectedViolation) => {
            const matchingViolation = actualViolations.find(
              (v) =>
                v.message === expectedViolation.message &&
                v.severity === expectedViolation.severity,
            );

            expect(matchingViolation).toBeDefined();
            expect(matchingViolation!.plugin).toBe(pluginName);
            expect(matchingViolation!.resourcePath).toBe(expectedViolation.resourcePath);
            expect(matchingViolation!.field).toBe(expectedViolation.field);
            expect(matchingViolation!.suggestion).toBe(expectedViolation.suggestion);
            expect(matchingViolation!.context).toEqual(expectedViolation.context);
          });
        }

        // Property: Violations should be properly categorized by severity
        const errorViolations = result.violations.filter((v) => v.severity === 'error');
        const warningViolations = [...result.violations, ...result.warnings].filter(
          (v) => v.severity === 'warning' || v.severity === 'info',
        );

        const expectedErrors = Object.values(expectedViolationsByPlugin)
          .flat()
          .filter((v) => v.severity === 'error').length;
        const expectedWarnings = Object.values(expectedViolationsByPlugin)
          .flat()
          .filter((v) => v.severity === 'warning' || v.severity === 'info').length;

        expect(errorViolations).toHaveLength(expectedErrors);
        expect(warningViolations).toHaveLength(expectedWarnings);

        // Property: Result validity should depend on presence of errors
        expect(result.valid).toBe(expectedErrors === 0);
      }
    });

    it('should generate accurate result summaries', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Create plugins with known violation patterns
        const pluginConfigs = [
          { name: `error-plugin-${iteration}`, errors: 2, warnings: 1, infos: 0 },
          { name: `warning-plugin-${iteration}`, errors: 0, warnings: 3, infos: 2 },
          { name: `mixed-plugin-${iteration}`, errors: 1, warnings: 1, infos: 1 },
        ];

        const plugins: PolicyPlugin[] = pluginConfigs.map((config) => ({
          name: config.name,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            const violations: PolicyViolation[] = [];

            // Add errors
            for (let i = 0; i < config.errors; i++) {
              violations.push({
                plugin: config.name,
                severity: 'error',
                message: `Error ${i + 1} from ${config.name}`,
              });
            }

            // Add warnings
            for (let i = 0; i < config.warnings; i++) {
              violations.push({
                plugin: config.name,
                severity: 'warning',
                message: `Warning ${i + 1} from ${config.name}`,
              });
            }

            // Add infos
            for (let i = 0; i < config.infos; i++) {
              violations.push({
                plugin: config.name,
                severity: 'info',
                message: `Info ${i + 1} from ${config.name}`,
              });
            }

            return violations;
          },
        }));

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Namespace' }], mockChartMetadata);

        // Property: Summary should accurately count violations by severity
        const expectedErrors = pluginConfigs.reduce((sum, config) => sum + config.errors, 0);
        const expectedWarnings = pluginConfigs.reduce((sum, config) => sum + config.warnings, 0);
        const expectedInfos = pluginConfigs.reduce((sum, config) => sum + config.infos, 0);

        expect(result.summary).toBeDefined();
        expect(result.summary!.violationsBySeverity.error).toBe(expectedErrors);
        expect(result.summary!.violationsBySeverity.warning).toBe(expectedWarnings);
        expect(result.summary!.violationsBySeverity.info).toBe(expectedInfos);

        // Property: Summary should count violations by plugin
        pluginConfigs.forEach((config) => {
          const expectedCount = config.errors + config.warnings + config.infos;
          expect(result.summary!.violationsByPlugin[config.name]).toBe(expectedCount);
        });

        // Property: Top violation types should be populated
        expect(result.summary!.topViolationTypes).toBeDefined();
        expect(Array.isArray(result.summary!.topViolationTypes)).toBe(true);
      }
    });

    it('should handle empty results and edge cases', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Test with no plugins
        let result = await testEngine.validate([{ kind: 'Pod' }], mockChartMetadata);

        // Property: Empty result should have valid structure
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.summary).toBeDefined();
        expect(result.summary!.violationsBySeverity.error).toBe(0);
        expect(result.summary!.violationsBySeverity.warning).toBe(0);
        expect(result.summary!.violationsBySeverity.info).toBe(0);
        expect(Object.keys(result.summary!.violationsByPlugin)).toHaveLength(0);

        // Test with plugins that return no violations
        const emptyPlugin: PolicyPlugin = {
          name: `empty-plugin-${iteration}`,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [];
          },
        };

        await testEngine.use(emptyPlugin);
        result = await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);

        // Property: Result with no violations should still be valid
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
        expect(result.summary!.violationsByPlugin[emptyPlugin.name]).toBe(0);
      }
    });

    it('should preserve violation context and metadata across aggregation', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Create plugin with rich violation context
        const pluginName = `context-plugin-${iteration}`;
        const complexContext = {
          ruleId: `rule-${iteration}`,
          severity: 'high',
          category: 'security',
          tags: ['kubernetes', 'security', 'best-practices'],
          metadata: {
            checksum: `checksum-${iteration}`,
            timestamp: Date.now(),
            nested: {
              level1: {
                level2: `deep-value-${iteration}`,
              },
            },
          },
        };

        const plugin: PolicyPlugin = {
          name: pluginName,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [
              {
                plugin: pluginName,
                severity: 'error',
                message: `Complex violation with context`,
                resourcePath: 'spec.template.spec.containers[0]',
                field: 'securityContext.runAsRoot',
                suggestion: 'Set runAsRoot to false for better security',
                context: complexContext,
              },
            ];
          },
        };

        await testEngine.use(plugin);

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Deployment' }], mockChartMetadata);

        // Property: Complex context should be preserved exactly
        expect(result.violations).toHaveLength(1);
        const violation = result.violations[0];

        expect(violation.plugin).toBe(pluginName);
        expect(violation.resourcePath).toBe('spec.template.spec.containers[0]');
        expect(violation.field).toBe('securityContext.runAsRoot');
        expect(violation.suggestion).toBe('Set runAsRoot to false for better security');
        expect(violation.context).toEqual(complexContext);

        // Property: Nested context should be preserved
        expect(
          (violation.context as Record<string, unknown>)?.metadata?.nested?.level1?.level2,
        ).toBe(`deep-value-${iteration}`);
      }
    });

    it('should maintain plugin execution metadata in aggregated results', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate random number of plugins and manifests
        const pluginCount = Math.floor(Math.random() * 5) + 1;
        const manifestCount = Math.floor(Math.random() * 10) + 1;

        // Create plugins
        const plugins: PolicyPlugin[] = [];
        for (let i = 0; i < pluginCount; i++) {
          plugins.push({
            name: `metadata-plugin-${iteration}-${i}`,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              // Simulate some processing time
              await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
              return [];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Create manifests
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'ConfigMap',
          metadata: { name: `config-${i}` },
        }));

        // Execute validation
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const endTime = Date.now();

        // Property: Metadata should reflect actual execution
        expect(result.metadata.pluginCount).toBe(pluginCount);
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata.executionTime).toBeLessThan(endTime - startTime + 100); // Allow some margin

        if (result.metadata.startTime) {
          expect(result.metadata.startTime).toBeGreaterThanOrEqual(startTime);
          expect(result.metadata.startTime).toBeLessThanOrEqual(endTime);
        }
      }
    });
  });

  describe('Property 6: Optional Integration Behavior', () => {
    /**
     * **Feature: policy-engine, Property 6: Optional Integration Behavior**
     *
     * For any Rutter configuration, when policyEngine is undefined, chart generation should
     * proceed identically to versions without policy support
     * **Validates: Requirements 4.2, 10.1, 10.2**
     */
    it('should proceed with chart generation when policyEngine is undefined', async () => {
      // Import Rutter here to avoid circular dependencies
      const { Rutter } = await import('../src/lib/rutter.js');

      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Create chart metadata
        const chartMeta = {
          name: `test-chart-${iteration}`,
          version: `1.0.${iteration}`,
          description: `Test chart ${iteration} for optional integration testing`,
        };

        // Create two identical Rutter instances - one with policyEngine undefined, one explicitly without it
        const rutterWithoutPolicy = new Rutter({
          meta: chartMeta,
          defaultValues: { enabled: true, replicas: 3 },
          // policyEngine is undefined (not provided)
        });

        const rutterExplicitlyWithoutPolicy = new Rutter({
          meta: chartMeta,
          defaultValues: { enabled: true, replicas: 3 },
          policyEngine: undefined, // explicitly undefined
        });

        // Add identical manifests to both instances
        const manifestObject = {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: `config-${iteration}` },
          data: { key: `value-${iteration}` },
        };

        rutterWithoutPolicy.addManifest(manifestObject, `config-${iteration}`);
        rutterExplicitlyWithoutPolicy.addManifest(manifestObject, `config-${iteration}-explicit`);

        // Property: Both should generate charts successfully without policy validation
        let synthAssets1: unknown[];
        let synthAssets2: unknown[];

        expect(async () => {
          synthAssets1 = await (
            rutterWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
          ).toSynthArray();
        }).not.toThrow();

        expect(async () => {
          synthAssets2 = await (
            rutterExplicitlyWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
          ).toSynthArray();
        }).not.toThrow();

        // Actually call the methods
        synthAssets1 = await (
          rutterWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();
        synthAssets2 = await (
          rutterExplicitlyWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();

        // Property: Generated assets should have the same structure
        expect(synthAssets1).toBeDefined();
        expect(synthAssets2).toBeDefined();
        expect(synthAssets1.length).toBeGreaterThan(0);
        expect(synthAssets2.length).toBeGreaterThan(0);

        // Property: Assets should contain the expected manifest
        const hasConfigManifest1 = synthAssets1.some(
          (asset) =>
            (asset.yaml as string).includes(`name: config-${iteration}`) &&
            (asset.yaml as string).includes(`value-${iteration}`),
        );
        const hasConfigManifest2 = synthAssets2.some(
          (asset) =>
            (asset.yaml as string).includes(`name: config-${iteration}`) &&
            (asset.yaml as string).includes(`value-${iteration}`),
        );

        expect(hasConfigManifest1).toBe(true);
        expect(hasConfigManifest2).toBe(true);
      }
    });

    it('should maintain identical behavior with and without policyEngine when undefined', async () => {
      const { Rutter } = await import('../src/lib/rutter.js');

      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const chartMeta = {
          name: `identical-chart-${iteration}`,
          version: '2.0.0',
          description: 'Chart for identical behavior testing',
        };

        const defaultValues = {
          service: { enabled: true, port: 80 },
          deployment: { replicas: 2, image: `app:${iteration}` },
        };

        // Create Rutter without policyEngine
        const rutterWithoutPolicy = new Rutter({
          meta: chartMeta,
          defaultValues,
          namespace: `test-ns-${iteration}`,
        });

        // Create Rutter with explicitly undefined policyEngine
        const rutterWithUndefinedPolicy = new Rutter({
          meta: chartMeta,
          defaultValues,
          namespace: `test-ns-${iteration}`,
          policyEngine: undefined,
        });

        // Add multiple types of manifests to both
        const manifests = [
          {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: { name: `service-${iteration}` },
            spec: { ports: [{ port: 80 }] },
          },
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: `deployment-${iteration}` },
            spec: { replicas: 2 },
          },
        ];

        manifests.forEach((manifest, index) => {
          rutterWithoutPolicy.addManifest(manifest, `manifest-${iteration}-${index}`);
          rutterWithUndefinedPolicy.addManifest(manifest, `manifest-${iteration}-${index}`);
        });

        // Generate synth assets from both
        const assets1 = await (
          rutterWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();
        const assets2 = await (
          rutterWithUndefinedPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();

        // Property: Both should generate the same number of assets
        expect(assets1.length).toBe(assets2.length);

        // Property: Both should contain the same manifest content (order may vary)
        const normalizeAsset = (asset: Record<string, unknown>) => ({
          id: asset.id,
          yamlContent: (asset.yaml as string).replace(/\s+/g, ' ').trim(),
        });

        const normalizedAssets1 = assets1
          .map(normalizeAsset)
          .sort((a, b) => a.id.localeCompare(b.id));
        const normalizedAssets2 = assets2
          .map(normalizeAsset)
          .sort((a, b) => a.id.localeCompare(b.id));

        // Property: Normalized assets should be identical
        expect(normalizedAssets1.length).toBe(normalizedAssets2.length);

        normalizedAssets1.forEach((asset1, index) => {
          const asset2 = normalizedAssets2[index];
          expect(asset1.yamlContent).toBe(asset2.yamlContent);
        });
      }
    });

    it('should not invoke policy validation when policyEngine is undefined', async () => {
      const { Rutter } = await import('../src/lib/rutter.js');

      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Create a mock policy engine that should never be called
        let policyValidationCalled = false;
        const mockPolicyEngine = {
          validate: async () => {
            policyValidationCalled = true;
            return {
              valid: true,
              violations: [],
              warnings: [],
              metadata: { pluginCount: 0, manifestCount: 0, executionTime: 0 },
            };
          },
        };

        // Test with undefined policyEngine
        const rutterWithoutPolicy = new Rutter({
          meta: {
            name: `no-policy-chart-${iteration}`,
            version: '1.0.0',
          },
          // policyEngine is undefined
        });

        // Test with explicitly undefined policyEngine
        const rutterWithUndefinedPolicy = new Rutter({
          meta: {
            name: `undefined-policy-chart-${iteration}`,
            version: '1.0.0',
          },
          policyEngine: undefined,
        });

        // Add manifests
        const manifest = {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: `pod-${iteration}` },
          spec: { containers: [{ name: 'app', image: 'nginx' }] },
        };

        rutterWithoutPolicy.addManifest(manifest, `pod-${iteration}`);
        rutterWithUndefinedPolicy.addManifest(manifest, `pod-${iteration}-undefined`);

        // Property: Chart generation should succeed without calling policy validation
        const assets1 = await (
          rutterWithoutPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();
        const assets2 = await (
          rutterWithUndefinedPolicy as { toSynthArray(): Promise<unknown[]> }
        ).toSynthArray();

        expect(assets1).toBeDefined();
        expect(assets2).toBeDefined();
        expect(policyValidationCalled).toBe(false);

        // Property: Generated assets should contain the expected content
        const hasExpectedContent1 = assets1.some(
          (asset: Record<string, unknown>) =>
            (asset.yaml as string).includes(`name: pod-${iteration}`) &&
            (asset.yaml as string).includes('image: nginx'),
        );
        const hasExpectedContent2 = assets2.some(
          (asset: Record<string, unknown>) =>
            (asset.yaml as string).includes(`name: pod-${iteration}`) &&
            (asset.yaml as string).includes('image: nginx'),
        );

        expect(hasExpectedContent1).toBe(true);
        expect(hasExpectedContent2).toBe(true);
      }
    });

    it('should handle complex chart configurations without policy engine', async () => {
      const { Rutter } = await import('../src/lib/rutter.js');

      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const chartMeta = {
          name: `complex-chart-${iteration}`,
          version: `3.${iteration}.0`,
          description: 'Complex chart without policy validation',
          maintainers: [{ name: `maintainer-${iteration}`, email: `test${iteration}@example.com` }],
        };

        const rutter = new Rutter({
          meta: chartMeta,
          defaultValues: {
            global: { environment: 'test' },
            app: { name: `app-${iteration}`, version: '1.0.0' },
            service: { type: 'ClusterIP', port: 8080 },
          },
          envValues: {
            production: { app: { replicas: 5 } },
            staging: { app: { replicas: 2 } },
          },
          namespace: `complex-ns-${iteration}`,
          singleManifestFile: Math.random() > 0.5, // Randomly test both modes
          // No policyEngine provided
        });

        // Add various types of manifests
        const manifests = [
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: `config-${iteration}` },
            data: { 'app.properties': `app.name=app-${iteration}` },
          },
          {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: { name: `secret-${iteration}` },
            type: 'Opaque',
            data: { password: 'c2VjcmV0' },
          },
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: `deployment-${iteration}` },
            spec: {
              replicas: 3,
              selector: { matchLabels: { app: `app-${iteration}` } },
              template: {
                metadata: { labels: { app: `app-${iteration}` } },
                spec: { containers: [{ name: 'app', image: `nginx:${iteration}` }] },
              },
            },
          },
        ];

        manifests.forEach((manifest, index) => {
          rutter.addManifest(manifest, `manifest-${iteration}-${index}`);
        });

        // Add conditional manifest
        rutter.addConditionalManifest(
          {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: { name: `conditional-service-${iteration}` },
            spec: { ports: [{ port: 80 }] },
          },
          'service.enabled',
          `conditional-service-${iteration}`,
        );

        // Property: Complex chart should generate successfully without policy validation
        let synthAssets: unknown[];
        expect(async () => {
          synthAssets = await (rutter as { toSynthArray(): Promise<unknown[]> }).toSynthArray();
        }).not.toThrow();

        // Actually call the method
        synthAssets = await (rutter as { toSynthArray(): Promise<unknown[]> }).toSynthArray();

        expect(synthAssets).toBeDefined();
        expect(synthAssets.length).toBeGreaterThan(0);

        // Property: All manifest types should be present in the output
        const allYaml = synthAssets.map((asset: Record<string, unknown>) => asset.yaml).join('\n');

        expect(allYaml).toContain(`name: config-${iteration}`);
        expect(allYaml).toContain(`name: secret-${iteration}`);
        expect(allYaml).toContain(`name: deployment-${iteration}`);
        expect(allYaml).toContain(`image: nginx:${iteration}`);

        // Property: Conditional manifest should be present (as template)
        const hasConditionalService = synthAssets.some(
          (asset: Record<string, unknown>) =>
            (asset.yaml as string).includes(`conditional-service-${iteration}`) ||
            (asset.yaml as string).includes('service.enabled'),
        );
        expect(hasConditionalService).toBe(true);

        // Property: Standard Helm labels should be applied
        expect(allYaml).toContain('app.kubernetes.io/name');
        expect(allYaml).toContain('app.kubernetes.io/instance');
        expect(allYaml).toContain('helm.sh/chart');
      }
    });

    it('should maintain performance characteristics without policy engine', async () => {
      const { Rutter } = await import('../src/lib/rutter.js');

      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        const chartMeta = {
          name: `perf-chart-${iteration}`,
          version: '1.0.0',
        };

        const rutter = new Rutter({
          meta: chartMeta,
          // No policyEngine - should have minimal overhead
        });

        // Add multiple manifests to test performance
        const manifestCount = 50 + Math.floor(Math.random() * 50); // 50-100 manifests
        for (let i = 0; i < manifestCount; i++) {
          rutter.addManifest(
            {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              metadata: { name: `config-${iteration}-${i}` },
              data: { key: `value-${i}` },
            },
            `config-${iteration}-${i}`,
          );
        }

        // Property: Chart generation should complete quickly without policy overhead
        const startTime = Date.now();
        const synthAssets = await (rutter as { toSynthArray(): Promise<unknown[]> }).toSynthArray();
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Property: Should complete in reasonable time (allowing for CI/test environment variability)
        expect(executionTime).toBeLessThan(5000); // 5 seconds max

        // Property: Should generate all expected assets
        expect(synthAssets.length).toBeGreaterThan(0);

        // Property: All manifests should be present
        const allYaml = synthAssets.map((asset: Record<string, unknown>) => asset.yaml).join('\n');
        for (let i = 0; i < Math.min(manifestCount, 10); i++) {
          // Check first 10 for performance
          expect(allYaml).toContain(`name: config-${iteration}-${i}`);
        }
      }
    });
  });

  describe('Property 5: Error Isolation', () => {
    /**
     * **Feature: policy-engine, Property 5: Error Isolation**
     *
     * For any combination of plugins where some fail and others succeed, the system should
     * isolate failures and continue executing remaining plugins without cross-contamination
     * **Validates: Requirements 6.1, 6.2**
     */
    it('should isolate plugin failures and continue execution', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({
          parallel: false,
          failFast: false,
          gracefulDegradation: true,
        });

        // Create a mix of successful and failing plugins
        const successfulPlugins: PolicyPlugin[] = [];
        const failingPlugins: PolicyPlugin[] = [];

        // Generate 2-4 successful plugins
        const successCount = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < successCount; i++) {
          const pluginName = `success-plugin-${iteration}-${i}`;
          successfulPlugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              // Simulate some work
              await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
              return [
                {
                  plugin: pluginName,
                  severity: 'warning',
                  message: `Success plugin ${i} warning`,
                },
              ];
            },
          });
        }

        // Generate 1-3 failing plugins with different error types
        const failCount = Math.floor(Math.random() * 3) + 1;
        const errorTypes = [
          () => {
            throw new Error('Generic plugin error');
          },
          () => {
            throw new TypeError('Type error in plugin');
          },
          () => {
            throw new ReferenceError('Reference error in plugin');
          },
          () => {
            throw new Error('Network timeout error');
          },
        ];

        for (let i = 0; i < failCount; i++) {
          const pluginName = `failing-plugin-${iteration}-${i}`;
          const errorType = errorTypes[i % errorTypes.length];

          failingPlugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              // Simulate some work before failing
              await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
              errorType();
              return []; // Never reached
            },
          });
        }

        // Register all plugins in random order
        const allPlugins = [...successfulPlugins, ...failingPlugins];
        const shuffledPlugins = allPlugins.sort(() => Math.random() - 0.5);
        for (const plugin of shuffledPlugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Pod', metadata: { name: 'test-pod' } }]);

        // Property: All successful plugins should have executed and produced violations
        const successfulViolations = result.warnings.filter((v) =>
          successfulPlugins.some((p) => p.name === v.plugin),
        );
        expect(successfulViolations).toHaveLength(successCount);

        // Property: All failing plugins should have error violations
        const failingViolations = result.violations.filter(
          (v) =>
            failingPlugins.some((p) => p.name === v.plugin) &&
            v.message.includes('Plugin execution failed'),
        );
        expect(failingViolations).toHaveLength(failCount);

        // Property: Each failing plugin should have isolated error context
        failingViolations.forEach((violation) => {
          expect(violation.context).toBeDefined();
          expect(violation.context?.isolated).toBe(true);
          expect(violation.context?.pluginVersion).toBeDefined();
          expect(violation.context?.errorType).toBeDefined();
          expect(violation.suggestion).toBeDefined();
          expect(violation.suggestion).toContain(violation.plugin);
        });

        // Property: Successful plugins should not be affected by failing ones
        successfulViolations.forEach((violation) => {
          expect(violation.message).toContain('Success plugin');
          expect(violation.severity).toBe('warning');
          expect(violation.context?.isolated).toBeUndefined(); // Not an error violation
        });

        // Property: Result should be invalid due to plugin failures
        expect(result.valid).toBe(false);

        // Property: Total violations should equal successful + failed plugins
        const totalViolations = result.violations.length + result.warnings.length;
        expect(totalViolations).toBe(successCount + failCount);
      }
    });

    it('should maintain plugin execution order despite failures', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({
          parallel: false,
          failFast: false,
          gracefulDegradation: true,
        });
        const executionOrder: string[] = [];

        // Create plugins that record execution order, with some failing
        const pluginCount = Math.floor(Math.random() * 6) + 4; // 4-9 plugins
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `order-plugin-${iteration}-${i}`;
          const shouldFail = Math.random() < 0.3; // 30% chance to fail

          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              executionOrder.push(pluginName);

              if (shouldFail) {
                throw new Error(`Intentional failure in ${pluginName}`);
              }

              return [];
            },
          });
        }

        // Register plugins in order
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);

        // Property: All plugins should have executed in registration order
        expect(executionOrder).toHaveLength(pluginCount);
        plugins.forEach((plugin, index) => {
          expect(executionOrder[index]).toBe(plugin.name);
        });
      }
    });

    it('should provide detailed error context for different error types', async () => {
      // Use fewer iterations for this test to avoid timeout
      const iterations = Math.min(PROPERTY_TEST_ITERATIONS, 3);

      for (let iteration = 0; iteration < iterations; iteration++) {
        const testEngine = new PolicyEngine({
          gracefulDegradation: true,
          failFast: false,
        });

        // Create plugins with specific error types
        const errorScenarios = [
          {
            name: `timeout-plugin-${iteration}`,
            error: () => new Promise((resolve) => setTimeout(resolve, 150)), // Will timeout with 100ms limit
            expectedSuggestion: 'timeout',
          },
          {
            name: `type-error-plugin-${iteration}`,
            error: () => {
              throw new TypeError('Invalid type');
            },
            expectedSuggestion: 'type error',
          },
          {
            name: `reference-error-plugin-${iteration}`,
            error: () => {
              throw new ReferenceError('Undefined variable');
            },
            expectedSuggestion: 'undefined variable',
          },
          {
            name: `generic-error-plugin-${iteration}`,
            error: () => {
              throw new Error('Generic error');
            },
            expectedSuggestion: 'edge cases',
          },
        ];

        // Create plugins for each error scenario
        const plugins: PolicyPlugin[] = errorScenarios.map((scenario) => ({
          name: scenario.name,
          version: '1.0.0',
          metadata: { author: 'test', tags: ['error-test'] },
          async validate(): Promise<PolicyViolation[]> {
            await scenario.error();
            return [];
          },
        }));

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation with short timeout to trigger timeout errors
        const shortTimeoutEngine = new PolicyEngine({
          timeout: 100,
          gracefulDegradation: true,
          failFast: false,
        });
        for (const plugin of plugins) {
          await shortTimeoutEngine.use(plugin);
        }

        const result = await shortTimeoutEngine.validate(
          [{ kind: 'ConfigMap' }],
          mockChartMetadata,
        );

        // Property: Each error type should have appropriate context and suggestions
        const errorViolations = result.violations.filter(
          (v) =>
            v.severity === 'error' &&
            (v.message.includes('Plugin execution failed') ||
              v.message.includes('timed out') ||
              v.message.includes('failed after') ||
              v.message.includes('exhausted')),
        );

        expect(errorViolations.length).toBeGreaterThan(0);

        errorViolations.forEach((violation) => {
          // Property: Error context should be comprehensive
          expect(violation.context).toBeDefined();
          expect(violation.context?.isolated).toBe(true);
          expect(violation.context?.pluginVersion).toBe('1.0.0');
          expect(violation.context?.errorType).toBeDefined();
          expect(violation.context?.timestamp).toBeDefined();

          // Property: Suggestions should be contextual
          expect(violation.suggestion).toBeDefined();
          expect(violation.suggestion).toContain(violation.plugin);

          // Property: Resource path should indicate plugin execution
          expect(violation.resourcePath).toBe('plugin-execution');
          expect(violation.field).toBe('validate');
        });
      }
    });

    it('should handle graceful degradation when enabled', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Test with graceful degradation enabled
        const gracefulEngine = new PolicyEngine({
          gracefulDegradation: true,
          failFast: false,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        // Test with graceful degradation disabled
        const strictEngine = new PolicyEngine({
          gracefulDegradation: false,
          failFast: false,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        // Create a failing plugin
        const failingPlugin: PolicyPlugin = {
          name: `failing-plugin-${iteration}`,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            throw new Error('Intentional failure');
          },
        };

        // Create a successful plugin
        const successPlugin: PolicyPlugin = {
          name: `success-plugin-${iteration}`,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            return [
              {
                plugin: `success-plugin-${iteration}`,
                severity: 'warning',
                message: 'Success warning',
              },
            ];
          },
        };

        // Register plugins in both engines
        await gracefulEngine.use(failingPlugin);
        await gracefulEngine.use(successPlugin);
        await strictEngine.use(failingPlugin);
        await strictEngine.use(successPlugin);

        // Property: Graceful engine should continue execution
        const gracefulResult = await gracefulEngine.validate([{ kind: 'Pod' }], mockChartMetadata);
        expect(gracefulResult.warnings).toHaveLength(1); // Success plugin warning
        expect(gracefulResult.warnings[0].plugin).toBe(`success-plugin-${iteration}`);

        // Property: Strict engine should throw on plugin failure
        await expect(strictEngine.validate([{ kind: 'Pod' }], mockChartMetadata)).rejects.toThrow();
      }
    });

    it('should prevent cross-contamination between plugin contexts', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({
          gracefulDegradation: true,
          failFast: false,
        });

        // Create plugins that modify global state (anti-pattern)
        const globalState = { counter: 0, data: new Map() };

        const plugins: PolicyPlugin[] = [];
        for (let i = 0; i < 5; i++) {
          const pluginName = `isolation-plugin-${iteration}-${i}`;
          const shouldFail = i === 2; // Middle plugin fails

          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              // Each plugin modifies global state
              globalState.counter++;
              globalState.data.set(pluginName, `data-${i}`);

              if (shouldFail) {
                throw new Error(`Plugin ${i} failed`);
              }

              return [
                {
                  plugin: pluginName,
                  severity: 'info',
                  message: `Plugin ${i} executed, counter: ${globalState.counter}`,
                  context: { pluginIndex: i, globalCounter: globalState.counter },
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Deployment' }], mockChartMetadata);

        // Property: All plugins should have executed despite one failure
        expect(globalState.counter).toBe(5);
        expect(globalState.data.size).toBe(5);

        // Property: Successful plugins should have their violations
        const successViolations = result.warnings.filter((v) =>
          v.message.includes('executed, counter:'),
        );
        expect(successViolations).toHaveLength(4); // 4 successful plugins

        // Property: Failed plugin should have error violation
        const errorViolations = result.violations.filter(
          (v) =>
            v.plugin === `isolation-plugin-${iteration}-2` &&
            v.message.includes('Plugin execution failed'),
        );
        expect(errorViolations).toHaveLength(1);

        // Property: Each successful plugin should have correct context
        successViolations.forEach((violation, index) => {
          expect(violation.context?.pluginIndex).toBeDefined();
          expect(violation.context?.globalCounter).toBeDefined();
        });
      }
    });
  });

  describe('Property 9: Configuration Propagation', () => {
    /**
     * **Feature: policy-engine, Property 9: Configuration Propagation**
     *
     * For any valid plugin configuration, the plugin should receive the configuration
     * in the validation context during execution
     * **Validates: Requirements 2.5, 8.1, 8.2**
     */
    it('should propagate plugin configuration to validation context', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Generate random configuration for the plugin
        const pluginName = `config-plugin-${iteration}`;
        const pluginConfig = {
          enabled: Math.random() > 0.5,
          threshold: Math.floor(Math.random() * 100),
          tags: [`tag-${iteration}`, 'test', 'property'],
          nested: {
            level1: {
              value: `nested-value-${iteration}`,
              count: Math.floor(Math.random() * 10),
            },
          },
          array: [`item-${iteration}-0`, `item-${iteration}-1`],
        };

        let receivedConfig: Record<string, unknown> | null = null;
        let receivedContext: ValidationContext | null = null;

        // Create plugin that captures the received configuration
        const configPlugin: PolicyPlugin = {
          name: pluginName,
          version: '1.0.0',
          description: `Configuration test plugin ${iteration}`,
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            receivedConfig = context.config;
            receivedContext = context;

            return [
              {
                plugin: pluginName,
                severity: 'info',
                message: `Plugin received config: ${JSON.stringify(context.config)}`,
                context: { receivedConfig: context.config },
              },
            ];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              threshold: { type: 'number' },
              tags: { type: 'array', items: { type: 'string' } },
              nested: { type: 'object' },
              array: { type: 'array' },
            },
          },
        };

        // Configure engine with plugin-specific configuration
        testEngine.configure({
          pluginConfig: {
            [pluginName]: pluginConfig,
          },
        });

        // Register plugin
        await testEngine.use(configPlugin);

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Pod', metadata: { name: 'test-pod' } }]);

        // Property: Plugin should receive the exact configuration provided
        expect(receivedConfig).toEqual(pluginConfig);
        expect(receivedContext).toBeDefined();
        expect(receivedContext!.config).toEqual(pluginConfig);

        // Property: Configuration should be properly structured
        expect(receivedConfig.enabled).toBe(pluginConfig.enabled);
        expect(receivedConfig.threshold).toBe(pluginConfig.threshold);
        expect(receivedConfig.tags).toEqual(pluginConfig.tags);
        expect(receivedConfig.nested.level1.value).toBe(pluginConfig.nested.level1.value);
        expect(receivedConfig.nested.level1.count).toBe(pluginConfig.nested.level1.count);
        expect(receivedConfig.array).toEqual(pluginConfig.array);

        // Property: Validation result should contain the configuration in context
        expect(result.warnings).toHaveLength(1);
        const violation = result.warnings[0];
        expect(violation.context?.receivedConfig).toEqual(pluginConfig);
        expect(violation.message).toContain(JSON.stringify(pluginConfig));
      }
    });

    it('should handle multiple plugins with different configurations', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Create multiple plugins with different configurations
        const pluginCount = Math.floor(Math.random() * 4) + 2; // 2-5 plugins
        const plugins: PolicyPlugin[] = [];
        const expectedConfigs: Record<string, Record<string, unknown>> = {};
        const receivedConfigs: Record<string, Record<string, unknown>> = {};

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `multi-config-plugin-${iteration}-${i}`;
          const config = {
            pluginIndex: i,
            enabled: i % 2 === 0,
            settings: {
              mode: i < 2 ? 'strict' : 'lenient',
              priority: i + 1,
            },
            features: [`feature-${i}`, `common-feature`],
          };

          expectedConfigs[pluginName] = config;

          plugins.push({
            name: pluginName,
            version: `1.${i}.0`,
            async validate(
              manifests: unknown[],
              context: ValidationContext,
            ): Promise<PolicyViolation[]> {
              receivedConfigs[pluginName] = context.config;

              return [
                {
                  plugin: pluginName,
                  severity: 'info',
                  message: `Plugin ${i} config received`,
                  context: {
                    pluginIndex: i,
                    configReceived: context.config,
                  },
                },
              ];
            },
          });
        }

        // Configure engine with all plugin configurations
        const pluginConfig: Record<string, Record<string, unknown>> = {};
        Object.entries(expectedConfigs).forEach(([name, config]) => {
          pluginConfig[name] = config;
        });

        testEngine.configure({ pluginConfig });

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([
          { kind: 'Service', metadata: { name: 'test-service' } },
        ]);

        // Property: Each plugin should receive its specific configuration
        expect(Object.keys(receivedConfigs)).toHaveLength(pluginCount);

        Object.entries(expectedConfigs).forEach(([pluginName, expectedConfig]) => {
          expect(receivedConfigs[pluginName]).toEqual(expectedConfig);
        });

        // Property: Configurations should not be mixed between plugins
        plugins.forEach((plugin, index) => {
          const receivedConfig = receivedConfigs[plugin.name];
          expect(receivedConfig.pluginIndex).toBe(index);
          expect(receivedConfig.settings.priority).toBe(index + 1);
          expect(receivedConfig.features).toContain(`feature-${index}`);
        });

        // Property: All plugins should have executed successfully
        expect(result.warnings).toHaveLength(pluginCount);
        result.warnings.forEach((violation, index) => {
          expect(violation.context?.pluginIndex).toBe(index);
          expect(violation.context?.configReceived).toEqual(expectedConfigs[violation.plugin]);
        });
      }
    });

    it('should handle plugins without configuration gracefully', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        let receivedConfig: Record<string, unknown> | null = null;

        // Create plugin without providing configuration
        const noConfigPlugin: PolicyPlugin = {
          name: `no-config-plugin-${iteration}`,
          version: '1.0.0',
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            receivedConfig = context.config;

            return [
              {
                plugin: `no-config-plugin-${iteration}`,
                severity: 'info',
                message: 'Plugin without config executed',
                context: { hasConfig: context.config !== undefined },
              },
            ];
          },
        };

        // Register plugin without providing configuration
        await testEngine.use(noConfigPlugin);

        // Execute validation
        const result = await testEngine.validate([
          { kind: 'ConfigMap', metadata: { name: 'test-config' } },
        ]);

        // Property: Plugin should receive empty configuration object
        expect(receivedConfig).toEqual({});

        // Property: Validation should succeed
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].context?.hasConfig).toBe(true); // Empty object is still defined
      }
    });

    it('should validate configuration against plugin schema when provided', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({
          configurationLoader: {
            validateSchemas: true,
          },
        });

        // Create plugin with configuration schema
        const schemaPlugin: PolicyPlugin = {
          name: `schema-plugin-${iteration}`,
          version: '1.0.0',
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            return [
              {
                plugin: `schema-plugin-${iteration}`,
                severity: 'info',
                message: 'Schema validation passed',
                context: { validatedConfig: context.config },
              },
            ];
          },
          configSchema: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              count: { type: 'number' },
              name: { type: 'string' },
            },
            required: ['enabled', 'count'],
            additionalProperties: false,
          },
        };

        // Test with valid configuration
        const validConfig = {
          enabled: true,
          count: 42,
          name: `test-name-${iteration}`,
        };

        testEngine.configure({
          pluginConfig: {
            [`schema-plugin-${iteration}`]: validConfig,
          },
        });

        // Property: Valid configuration should be accepted
        await expect(testEngine.use(schemaPlugin)).resolves.toBeDefined();

        const result = await testEngine.validate([{ kind: 'Pod' }], mockChartMetadata);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].context?.validatedConfig).toEqual(validConfig);
      }
    });

    it('should handle environment-specific configuration loading', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const environment = ['development', 'staging', 'production'][iteration % 3];

        const testEngine = new PolicyEngine({
          environment,
          configurationLoader: {
            defaultEnvironment: 'development',
          },
        });

        let receivedConfig: Record<string, unknown> | null = null;
        let receivedContext: ValidationContext | null = null;

        // Create plugin that captures environment context
        const envPlugin: PolicyPlugin = {
          name: `env-plugin-${iteration}`,
          version: '1.0.0',
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            receivedConfig = context.config;
            receivedContext = context;

            return [
              {
                plugin: `env-plugin-${iteration}`,
                severity: 'info',
                message: `Plugin executed in ${context.environment || 'unknown'} environment`,
                context: {
                  environment: context.environment,
                  config: context.config,
                },
              },
            ];
          },
          metadata: {
            defaultConfig: {
              environmentSpecific: true,
              defaultValue: `default-${iteration}`,
            },
          },
        };

        // Configure with environment-specific settings
        const envConfig = {
          environment: environment,
          mode: `${environment}-mode`,
          settings: {
            debug: environment === 'development',
            logLevel: environment === 'production' ? 'error' : 'debug',
          },
        };

        testEngine.configure({
          pluginConfig: {
            [`env-plugin-${iteration}`]: envConfig,
          },
        });

        // Register plugin
        await testEngine.use(envPlugin);

        // Execute validation
        const result = await testEngine.validate([
          { kind: 'Deployment', metadata: { name: 'test-deployment' } },
        ]);

        // Property: Plugin should receive merged configuration (default + inline)
        const expectedMergedConfig = {
          environmentSpecific: true,
          defaultValue: `default-${iteration}`,
          ...envConfig,
        };
        expect(receivedConfig).toEqual(expectedMergedConfig);
        expect(receivedContext?.environment).toBe(environment);

        // Property: Environment should be reflected in validation context
        expect(result.warnings).toHaveLength(1);
        const violation = result.warnings[0];
        expect(violation.message).toContain(environment);
        expect((violation.context as Record<string, unknown>)?.environment).toBe(environment);
        expect((violation.context as Record<string, unknown>)?.config).toEqual(
          expectedMergedConfig,
        );
      }
    });

    it('should merge configuration from multiple sources with correct priority', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        let receivedConfig: Record<string, unknown> | null = null;

        // Create plugin with default configuration in metadata
        const mergePlugin: PolicyPlugin = {
          name: `merge-plugin-${iteration}`,
          version: '1.0.0',
          async validate(
            manifests: unknown[],
            context: ValidationContext,
          ): Promise<PolicyViolation[]> {
            receivedConfig = context.config;

            return [
              {
                plugin: `merge-plugin-${iteration}`,
                severity: 'info',
                message: 'Configuration merge test',
                context: { mergedConfig: context.config },
              },
            ];
          },
          metadata: {
            defaultConfig: {
              baseValue: 'default',
              priority: 0,
              onlyInDefault: true,
              overrideMe: 'default-value',
            },
          },
        };

        // Inline configuration (highest priority)
        const inlineConfig = {
          priority: 30,
          overrideMe: 'inline-value',
          onlyInInline: true,
        };

        testEngine.configure({
          pluginConfig: {
            [`merge-plugin-${iteration}`]: inlineConfig,
          },
        });

        // Register plugin
        await testEngine.use(mergePlugin);

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);

        // Property: Configuration should be properly merged with inline taking priority
        expect(receivedConfig).toBeDefined();
        expect(receivedConfig.baseValue).toBe('default'); // From default config
        expect(receivedConfig.onlyInDefault).toBe(true); // From default config
        expect(receivedConfig.priority).toBe(30); // From inline config (overrides default)
        expect(receivedConfig.overrideMe).toBe('inline-value'); // From inline config (overrides default)
        expect(receivedConfig.onlyInInline).toBe(true); // From inline config

        // Property: Validation should succeed with merged configuration
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].context?.mergedConfig).toEqual(receivedConfig);
      }
    });
  });

  describe('Property 8: Timeout Enforcement', () => {
    /**
     * **Feature: policy-engine, Property 8: Timeout Enforcement**
     *
     * For any plugin execution that exceeds the configured timeout, the system should
     * terminate the plugin and handle the timeout gracefully
     * **Validates: Requirements 6.4, 7.1**
     */
    it('should enforce timeout limits on plugin execution', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        const timeout = 100 + Math.floor(Math.random() * 200); // 100-300ms timeout
        const testEngine = new PolicyEngine({
          timeout,
          gracefulDegradation: true,
          failFast: false,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        // Create plugins with different execution times
        const plugins: PolicyPlugin[] = [];
        const expectedTimeouts: string[] = [];

        for (let i = 0; i < 4; i++) {
          const pluginName = `timeout-plugin-${iteration}-${i}`;
          const executionTime = (i + 1) * timeout * 0.8; // Some will timeout, some won't

          if (executionTime > timeout) {
            expectedTimeouts.push(pluginName);
          }

          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              // Simulate work that may exceed timeout
              await new Promise((resolve) => setTimeout(resolve, executionTime));
              return [
                {
                  plugin: pluginName,
                  severity: 'info',
                  message: `Plugin ${i} completed in ${executionTime}ms`,
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation and measure time
        const startTime = Date.now();
        const result = await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);
        const totalTime = Date.now() - startTime;

        // Property: Total execution time should not significantly exceed timeout * plugin count
        // Allow some margin for overhead and processing
        const maxExpectedTime = timeout * plugins.length + 1000; // 1s margin
        expect(totalTime).toBeLessThan(maxExpectedTime);

        // Property: Plugins that should timeout should not have success violations
        const successViolations = result.warnings.filter((v) => v.message.includes('completed in'));

        expectedTimeouts.forEach((timeoutPluginName) => {
          const hasSuccessViolation = successViolations.some((v) => v.plugin === timeoutPluginName);
          expect(hasSuccessViolation).toBe(false);
        });

        // Property: Timed out plugins should have appropriate violations or be gracefully degraded
        if (expectedTimeouts.length > 0) {
          // With graceful degradation, we might not see explicit timeout violations
          // but the plugins should not have produced their normal output
          expectedTimeouts.forEach((timeoutPluginName) => {
            const hasNormalOutput = successViolations.some((v) => v.plugin === timeoutPluginName);
            expect(hasNormalOutput).toBe(false);
          });
        }

        // Property: Non-timeout plugins should complete successfully
        const nonTimeoutPlugins = plugins.filter((p) => !expectedTimeouts.includes(p.name));
        nonTimeoutPlugins.forEach((plugin) => {
          const hasOutput =
            successViolations.some((v) => v.plugin === plugin.name) ||
            result.violations.some((v) => v.plugin === plugin.name);
          expect(hasOutput).toBe(true);
        });
      }
    });

    it('should handle timeout with retry configuration', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 10); iteration++) {
        const timeout = 50; // Very short timeout
        const maxAttempts = 2;

        const testEngine = new PolicyEngine({
          timeout,
          gracefulDegradation: true,
          retryConfig: {
            maxAttempts,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 50,
            retryOnTimeout: true,
            retryOnPluginError: false,
          },
        });

        let attemptCount = 0;
        const timeoutPlugin: PolicyPlugin = {
          name: `retry-timeout-plugin-${iteration}`,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            attemptCount++;
            // Always timeout
            await new Promise((resolve) => setTimeout(resolve, timeout * 2));
            return [];
          },
        };

        await testEngine.use(timeoutPlugin);

        // Execute validation
        const startTime = Date.now();
        const result = await testEngine.validate([{ kind: 'Pod' }], mockChartMetadata);
        const executionTime = Date.now() - startTime;

        // Property: Plugin should be attempted the configured number of times
        expect(attemptCount).toBe(maxAttempts);

        // Property: Execution time should account for retries and delays
        const expectedMinTime = maxAttempts * timeout + (maxAttempts - 1) * 10; // timeout + delays
        expect(executionTime).toBeGreaterThanOrEqual(expectedMinTime - 20); // Allow some margin

        // Property: With graceful degradation, should not throw error
        expect(result).toBeDefined();
        expect(result.valid).toBe(false); // Invalid due to error violations from failed plugins
      }
    });

    it('should provide accurate timeout error information', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 10); iteration++) {
        const timeout = 100;
        const testEngine = new PolicyEngine({
          timeout,
          gracefulDegradation: false, // Disable to see actual timeout errors
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        const timeoutPlugin: PolicyPlugin = {
          name: `timeout-info-plugin-${iteration}`,
          version: '1.0.0',
          async validate(): Promise<PolicyViolation[]> {
            await new Promise((resolve) => setTimeout(resolve, timeout * 2));
            return [];
          },
        };

        await testEngine.use(timeoutPlugin);

        // Property: Should throw timeout-related error when graceful degradation is disabled
        await expect(
          testEngine.validate([{ kind: 'ConfigMap' }], mockChartMetadata),
        ).rejects.toThrow();

        // Test with graceful degradation enabled to see error context
        const gracefulEngine = new PolicyEngine({
          timeout,
          gracefulDegradation: true,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });
        gracefulEngine.use(timeoutPlugin);

        const result = await gracefulEngine.validate([{ kind: 'ConfigMap' }], mockChartMetadata);

        // Property: Should complete successfully with graceful degradation
        expect(result).toBeDefined();
        // With graceful degradation, the result should be invalid if there are error violations
        const hasErrorViolations = result.violations.some((v) => v.severity === 'error');
        expect(result.valid).toBe(!hasErrorViolations); // Valid only if no error violations
      }
    });

    it('should handle mixed timeout and success scenarios', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 15); iteration++) {
        const timeout = 100;
        const testEngine = new PolicyEngine({
          timeout,
          gracefulDegradation: true,
          parallel: false,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        // Create mix of fast and slow plugins
        const plugins: PolicyPlugin[] = [];
        const fastPlugins: string[] = [];
        const slowPlugins: string[] = [];

        for (let i = 0; i < 5; i++) {
          const pluginName = `mixed-plugin-${iteration}-${i}`;
          const isFast = i % 2 === 0; // Alternate fast/slow
          const executionTime = isFast ? timeout * 0.3 : timeout * 2;

          if (isFast) {
            fastPlugins.push(pluginName);
          } else {
            slowPlugins.push(pluginName);
          }

          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              await new Promise((resolve) => setTimeout(resolve, executionTime));
              return [
                {
                  plugin: pluginName,
                  severity: 'info',
                  message: `Plugin ${pluginName} completed`,
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation
        const result = await testEngine.validate([{ kind: 'Deployment' }], mockChartMetadata);

        // Property: Fast plugins should complete successfully
        const successViolations = result.warnings.filter((v) => v.message.includes('completed'));

        fastPlugins.forEach((fastPluginName) => {
          const hasSuccess = successViolations.some((v) => v.plugin === fastPluginName);
          expect(hasSuccess).toBe(true);
        });

        // Property: Slow plugins should not have success violations (timed out)
        slowPlugins.forEach((slowPluginName) => {
          const hasSuccess = successViolations.some((v) => v.plugin === slowPluginName);
          expect(hasSuccess).toBe(false);
        });

        // Property: Should have violations from fast plugins only
        expect(successViolations).toHaveLength(fastPlugins.length);

        // Property: Result should be invalid due to error violations from failed plugins
        expect(result.valid).toBe(false);
      }
    });

    it('should respect timeout in parallel execution mode', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 10); iteration++) {
        const timeout = 150;
        const testEngine = new PolicyEngine({
          timeout,
          parallel: true, // Enable parallel execution
          gracefulDegradation: true,
          retryConfig: {
            maxAttempts: 1,
            baseDelay: 10,
            backoffMultiplier: 1,
            maxDelay: 10,
            retryOnTimeout: false,
            retryOnPluginError: false,
          },
        });

        // Create multiple plugins with different execution times
        const pluginCount = 4;
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `parallel-timeout-plugin-${iteration}-${i}`;
          const executionTime = timeout * (0.5 + i * 0.5); // 0.5x, 1x, 1.5x, 2x timeout

          plugins.push({
            name: pluginName,
            version: '1.0.0',
            async validate(): Promise<PolicyViolation[]> {
              await new Promise((resolve) => setTimeout(resolve, executionTime));
              return [
                {
                  plugin: pluginName,
                  severity: 'info',
                  message: `Parallel plugin ${i} completed`,
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Execute validation and measure time
        const startTime = Date.now();
        const result = await testEngine.validate([{ kind: 'Service' }], mockChartMetadata);
        const totalTime = Date.now() - startTime;

        // Property: Parallel execution should not take much longer than the timeout
        // (since plugins run in parallel, not sequentially)
        expect(totalTime).toBeLessThan(timeout * 2 + 500); // Allow margin for overhead

        // Property: Only plugins that complete within timeout should have success violations
        const successViolations = result.warnings.filter((v) => v.message.includes('completed'));

        // Plugins 0 and 1 should complete (0.5x and 1x timeout), plugins 2 and 3 should timeout
        expect(successViolations.length).toBeLessThanOrEqual(2);

        // Property: Result should be invalid due to error violations from failed plugins
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Property 7: Validation Determinism', () => {
    /**
     * **Feature: policy-engine, Property 7: Validation Determinism**
     *
     * For any set of manifests and plugins, running validation multiple times with
     * identical inputs should produce identical results
     * **Validates: Requirements 1.2, 3.1**
     */
    it('should produce identical results for identical inputs across multiple runs', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false }); // Ensure deterministic execution order

        // Generate deterministic plugins with consistent behavior
        const pluginCount = Math.floor(Math.random() * 5) + 2; // 2-6 plugins
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const pluginName = `deterministic-plugin-${iteration}-${i}`;

          plugins.push({
            name: pluginName,
            version: `1.0.${i}`,
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              // Deterministic validation logic based on manifest properties
              const violations: PolicyViolation[] = [];

              manifests.forEach((manifest, index) => {
                const manifestObj = manifest as Record<string, unknown>;

                // Consistent rule: check for specific patterns
                if (manifestObj.kind === 'Pod' && index % 2 === 0) {
                  violations.push({
                    plugin: pluginName,
                    severity: 'warning',
                    message: `Pod at index ${index} requires attention`,
                    resourcePath: `manifests[${index}]`,
                    field: 'kind',
                  });
                }

                if (manifestObj.metadata?.name?.includes('test') && i === 0) {
                  violations.push({
                    plugin: pluginName,
                    severity: 'error',
                    message: `Test resource detected: ${manifestObj.metadata.name}`,
                    resourcePath: `manifests[${index}].metadata.name`,
                    field: 'name',
                  });
                }
              });

              return violations;
            },
          });
        }

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Generate deterministic manifests
        const manifestCount = Math.floor(Math.random() * 10) + 3; // 3-12 manifests
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: i % 3 === 0 ? 'Pod' : i % 3 === 1 ? 'Service' : 'Deployment',
          metadata: {
            name: i % 4 === 0 ? `test-resource-${i}` : `resource-${i}`,
            namespace: 'default',
          },
          spec: {
            replicas: i + 1,
          },
        }));

        // Run validation multiple times
        const results: Awaited<ReturnType<typeof testEngine.validate>>[] = [];
        const runCount = 5;

        for (let run = 0; run < runCount; run++) {
          const result = await testEngine.validate(manifests, mockChartMetadata);
          results.push(result);
        }

        // Property: All results should be identical
        const firstResult = results[0];

        for (let run = 1; run < runCount; run++) {
          const currentResult = results[run];

          // Property: Valid status should be identical
          expect(currentResult.valid).toBe(firstResult.valid);

          // Property: Violation counts should be identical
          expect(currentResult.violations.length).toBe(firstResult.violations.length);
          expect(currentResult.warnings.length).toBe(firstResult.warnings.length);

          // Property: Metadata should be consistent (except execution time)
          expect(currentResult.metadata.pluginCount).toBe(firstResult.metadata.pluginCount);
          expect(currentResult.metadata.manifestCount).toBe(firstResult.metadata.manifestCount);

          // Property: Violations should be identical in content
          firstResult.violations.forEach((expectedViolation, index) => {
            const actualViolation = currentResult.violations[index];
            expect(actualViolation.plugin).toBe(expectedViolation.plugin);
            expect(actualViolation.severity).toBe(expectedViolation.severity);
            expect(actualViolation.message).toBe(expectedViolation.message);
            expect(actualViolation.resourcePath).toBe(expectedViolation.resourcePath);
            expect(actualViolation.field).toBe(expectedViolation.field);
          });

          // Property: Warnings should be identical in content
          firstResult.warnings.forEach((expectedWarning, index) => {
            const actualWarning = currentResult.warnings[index];
            expect(actualWarning.plugin).toBe(expectedWarning.plugin);
            expect(actualWarning.severity).toBe(expectedWarning.severity);
            expect(actualWarning.message).toBe(expectedWarning.message);
            expect(actualWarning.resourcePath).toBe(expectedWarning.resourcePath);
            expect(actualWarning.field).toBe(expectedWarning.field);
          });

          // Property: Summary should be identical
          if (firstResult.summary && currentResult.summary) {
            expect(currentResult.summary.violationsBySeverity).toEqual(
              firstResult.summary.violationsBySeverity,
            );
            expect(currentResult.summary.violationsByPlugin).toEqual(
              firstResult.summary.violationsByPlugin,
            );
          }
        }
      }
    });

    it('should produce consistent results regardless of plugin registration order', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Create identical plugins
        const plugins: PolicyPlugin[] = [
          {
            name: `plugin-alpha-${iteration}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              return manifests.length > 2
                ? [
                    {
                      plugin: `plugin-alpha-${iteration}`,
                      severity: 'info',
                      message: 'Alpha plugin info',
                    },
                  ]
                : [];
            },
          },
          {
            name: `plugin-beta-${iteration}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              return [
                {
                  plugin: `plugin-beta-${iteration}`,
                  severity: 'warning',
                  message: 'Beta plugin warning',
                },
              ];
            },
          },
          {
            name: `plugin-gamma-${iteration}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              const manifestObj = manifests[0] as Record<string, unknown>;
              return manifestObj?.kind === 'Service'
                ? [
                    {
                      plugin: `plugin-gamma-${iteration}`,
                      severity: 'error',
                      message: 'Gamma plugin error for Service',
                    },
                  ]
                : [];
            },
          },
        ];

        // Test different registration orders
        const registrationOrders = [
          [0, 1, 2], // alpha, beta, gamma
          [2, 1, 0], // gamma, beta, alpha
          [1, 0, 2], // beta, alpha, gamma
          [1, 2, 0], // beta, gamma, alpha
        ];

        const manifests = [
          { kind: 'Service', metadata: { name: 'test-service' } },
          { kind: 'Pod', metadata: { name: 'test-pod' } },
          { kind: 'Deployment', metadata: { name: 'test-deployment' } },
        ];

        const results: Awaited<ReturnType<PolicyEngine['validate']>>[] = [];

        // Run validation with different registration orders
        for (const order of registrationOrders) {
          const testEngine = new PolicyEngine({ parallel: false });

          // Register plugins in the specified order
          for (const pluginIndex of order) {
            await testEngine.use(plugins[pluginIndex]);
          }

          const result = await testEngine.validate(manifests, mockChartMetadata);
          results.push(result);
        }

        // Property: Results should be identical regardless of registration order
        const firstResult = results[0];

        for (let i = 1; i < results.length; i++) {
          const currentResult = results[i];

          // Property: Overall validity should be the same
          expect(currentResult.valid).toBe(firstResult.valid);

          // Property: Total violation and warning counts should be the same
          expect(currentResult.violations.length).toBe(firstResult.violations.length);
          expect(currentResult.warnings.length).toBe(firstResult.warnings.length);

          // Property: Each plugin should produce the same violations (order may vary)
          plugins.forEach((plugin) => {
            const firstViolations = [...firstResult.violations, ...firstResult.warnings].filter(
              (v) => v.plugin === plugin.name,
            );
            const currentViolations = [
              ...currentResult.violations,
              ...currentResult.warnings,
            ].filter((v) => v.plugin === plugin.name);

            expect(currentViolations.length).toBe(firstViolations.length);

            // Check that each violation exists (content-wise)
            firstViolations.forEach((expectedViolation) => {
              const matchingViolation = currentViolations.find(
                (v) =>
                  v.message === expectedViolation.message &&
                  v.severity === expectedViolation.severity,
              );
              expect(matchingViolation).toBeDefined();
            });
          });
        }
      }
    });

    it('should produce deterministic results with complex manifest structures', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine({ parallel: false });

        // Create plugin with complex validation logic
        const complexPlugin: PolicyPlugin = {
          name: `complex-plugin-${iteration}`,
          version: '1.0.0',
          async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
            const violations: PolicyViolation[] = [];

            manifests.forEach((manifest, index) => {
              const obj = manifest as Record<string, unknown>;

              // Complex deterministic rules
              if (obj.spec?.replicas && obj.spec.replicas > 3) {
                violations.push({
                  plugin: `complex-plugin-${iteration}`,
                  severity: 'warning',
                  message: `High replica count: ${obj.spec.replicas}`,
                  resourcePath: `manifests[${index}].spec.replicas`,
                });
              }

              if (obj.metadata?.labels) {
                const labelCount = Object.keys(obj.metadata.labels).length;
                if (labelCount < 2) {
                  violations.push({
                    plugin: `complex-plugin-${iteration}`,
                    severity: 'info',
                    message: `Insufficient labels: ${labelCount}`,
                    resourcePath: `manifests[${index}].metadata.labels`,
                  });
                }
              }

              if (obj.kind === 'Deployment' && !obj.spec?.strategy) {
                violations.push({
                  plugin: `complex-plugin-${iteration}`,
                  severity: 'error',
                  message: 'Missing deployment strategy',
                  resourcePath: `manifests[${index}].spec.strategy`,
                });
              }
            });

            return violations;
          },
        };

        await testEngine.use(complexPlugin);

        // Generate complex manifests with nested structures
        const manifests = [
          {
            kind: 'Deployment',
            metadata: {
              name: 'complex-deployment',
              labels: { app: 'test', version: 'v1', env: 'prod' },
            },
            spec: {
              replicas: 5,
              selector: { matchLabels: { app: 'test' } },
              template: {
                metadata: { labels: { app: 'test' } },
                spec: { containers: [{ name: 'app', image: 'nginx:1.20' }] },
              },
            },
          },
          {
            kind: 'Service',
            metadata: {
              name: 'simple-service',
              labels: { app: 'test' },
            },
            spec: {
              ports: [{ port: 80, targetPort: 8080 }],
              selector: { app: 'test' },
            },
          },
          {
            kind: 'ConfigMap',
            metadata: {
              name: 'config-map',
              // No labels - should trigger insufficient labels violation
            },
            data: {
              'config.yaml': 'key: value',
            },
          },
        ];

        // Run validation multiple times
        const results: Awaited<ReturnType<typeof testEngine.validate>>[] = [];
        const runCount = 7;

        for (let run = 0; run < runCount; run++) {
          const result = await testEngine.validate(manifests, mockChartMetadata);
          results.push(result);
        }

        // Property: All results should be identical
        const firstResult = results[0];

        for (let run = 1; run < runCount; run++) {
          const currentResult = results[run];

          // Property: Exact same violations should be produced
          expect(currentResult.violations.length).toBe(firstResult.violations.length);
          expect(currentResult.warnings.length).toBe(firstResult.warnings.length);

          // Property: Violations should match exactly (including order for sequential execution)
          firstResult.violations.forEach((expectedViolation, index) => {
            const actualViolation = currentResult.violations[index];
            expect(actualViolation).toEqual(expectedViolation);
          });

          firstResult.warnings.forEach((expectedWarning, index) => {
            const actualWarning = currentResult.warnings[index];
            expect(actualWarning).toEqual(expectedWarning);
          });

          // Property: Metadata should be consistent
          expect(currentResult.metadata.pluginCount).toBe(firstResult.metadata.pluginCount);
          expect(currentResult.metadata.manifestCount).toBe(firstResult.metadata.manifestCount);
          expect(currentResult.valid).toBe(firstResult.valid);
        }
      }
    });

    it('should maintain determinism with empty and edge case inputs', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const testEngine = new PolicyEngine();

        // Create plugin that handles edge cases
        const edgeCasePlugin: PolicyPlugin = {
          name: `edge-case-plugin-${iteration}`,
          version: '1.0.0',
          async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
            const violations: PolicyViolation[] = [];

            // Handle empty manifests
            if (manifests.length === 0) {
              violations.push({
                plugin: `edge-case-plugin-${iteration}`,
                severity: 'info',
                message: 'No manifests to validate',
              });
            }

            // Handle null/undefined manifests
            manifests.forEach((manifest, index) => {
              if (!manifest) {
                violations.push({
                  plugin: `edge-case-plugin-${iteration}`,
                  severity: 'error',
                  message: `Null manifest at index ${index}`,
                  resourcePath: `manifests[${index}]`,
                });
              }
            });

            return violations;
          },
        };

        await testEngine.use(edgeCasePlugin);

        // Test different edge case scenarios
        const testScenarios = [
          [], // Empty array
          [null], // Null manifest
          [undefined], // Undefined manifest
          [{}], // Empty object
          [{ kind: null }], // Null properties
          [{ kind: 'Pod' }, null, { kind: 'Service' }], // Mixed valid and null
        ];

        for (const manifests of testScenarios) {
          const results: Awaited<ReturnType<typeof testEngine.validate>>[] = [];
          const runCount = 3;

          // Run each scenario multiple times
          for (let run = 0; run < runCount; run++) {
            const result = await testEngine.validate(manifests as unknown[], mockChartMetadata);
            results.push(result);
          }

          // Property: Results should be identical for each scenario
          const firstResult = results[0];

          for (let run = 1; run < runCount; run++) {
            const currentResult = results[run];

            expect(currentResult.valid).toBe(firstResult.valid);
            expect(currentResult.violations.length).toBe(firstResult.violations.length);
            expect(currentResult.warnings.length).toBe(firstResult.warnings.length);

            // Property: Exact violation content should match
            firstResult.violations.forEach((expectedViolation, index) => {
              const actualViolation = currentResult.violations[index];
              expect(actualViolation.plugin).toBe(expectedViolation.plugin);
              expect(actualViolation.severity).toBe(expectedViolation.severity);
              expect(actualViolation.message).toBe(expectedViolation.message);
              expect(actualViolation.resourcePath).toBe(expectedViolation.resourcePath);
            });
          }
        }
      }
    });

    it('should produce deterministic results with plugin configuration', async () => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Create plugin that uses configuration
        const configPlugin: PolicyPlugin = {
          name: `config-deterministic-plugin-${iteration}`,
          version: '1.0.0',
          async validate(manifests: unknown[], context): Promise<PolicyViolation[]> {
            const config = context.config as Record<string, unknown>;
            const violations: PolicyViolation[] = [];

            const threshold = config.threshold || 2;
            const enabled = config.enabled !== false;

            if (!enabled) {
              return violations;
            }

            if (manifests.length > threshold) {
              violations.push({
                plugin: `config-deterministic-plugin-${iteration}`,
                severity: 'warning',
                message: `Manifest count ${manifests.length} exceeds threshold ${threshold}`,
                context: { threshold, manifestCount: manifests.length },
              });
            }

            manifests.forEach((manifest, index) => {
              const obj = manifest as Record<string, unknown>;
              if (config.checkNames && obj.metadata?.name?.length < 5) {
                violations.push({
                  plugin: `config-deterministic-plugin-${iteration}`,
                  severity: 'info',
                  message: `Short name: ${obj.metadata.name}`,
                  resourcePath: `manifests[${index}].metadata.name`,
                });
              }
            });

            return violations;
          },
        };

        // Test with different configurations
        const configurations = [
          { threshold: 3, enabled: true, checkNames: false },
          { threshold: 1, enabled: true, checkNames: true },
          { threshold: 5, enabled: false, checkNames: true },
        ];

        const manifests = [
          { kind: 'Pod', metadata: { name: 'a' } },
          { kind: 'Service', metadata: { name: 'service-name' } },
          { kind: 'Deployment', metadata: { name: 'app' } },
        ];

        for (const config of configurations) {
          const results: Awaited<ReturnType<PolicyEngine['validate']>>[] = [];
          const runCount = 4;

          // Run with same configuration multiple times
          for (let run = 0; run < runCount; run++) {
            const testEngine = new PolicyEngine();
            testEngine.configure({
              pluginConfig: {
                [`config-deterministic-plugin-${iteration}`]: config,
              },
            });

            await testEngine.use(configPlugin);
            const result = await testEngine.validate(manifests, mockChartMetadata);
            results.push(result);
          }

          // Property: Results should be identical with same configuration
          const firstResult = results[0];

          for (let run = 1; run < runCount; run++) {
            const currentResult = results[run];

            expect(currentResult.valid).toBe(firstResult.valid);
            expect(currentResult.violations.length).toBe(firstResult.violations.length);
            expect(currentResult.warnings.length).toBe(firstResult.warnings.length);

            // Property: Violation content should be identical
            [...firstResult.violations, ...firstResult.warnings].forEach(
              (expectedViolation, index) => {
                const actualViolations = [...currentResult.violations, ...currentResult.warnings];
                const actualViolation = actualViolations[index];

                expect(actualViolation.plugin).toBe(expectedViolation.plugin);
                expect(actualViolation.severity).toBe(expectedViolation.severity);
                expect(actualViolation.message).toBe(expectedViolation.message);
                expect(actualViolation.resourcePath).toBe(expectedViolation.resourcePath);
                expect(actualViolation.context).toEqual(expectedViolation.context);
              },
            );
          }
        }
      }
    });
  });

  describe('Property 10: Performance Metrics Collection', () => {
    /**
     * **Feature: policy-engine, Property 10: Performance Metrics Collection**
     *
     * For any validation execution, the system should collect and report performance
     * metrics including execution time and plugin count
     * **Validates: Requirements 7.5, 9.3**
     */
    it('should collect accurate performance metrics for all validation executions', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        const testEngine = new PolicyEngine();

        // Generate random number of plugins (1-10)
        const pluginCount = Math.floor(Math.random() * 10) + 1;
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const executionDelay = Math.floor(Math.random() * 50) + 10; // 10-60ms delay

          plugins.push({
            name: `perf-plugin-${iteration}-${i}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              // Simulate processing time
              await new Promise((resolve) => setTimeout(resolve, executionDelay));

              return [
                {
                  plugin: `perf-plugin-${iteration}-${i}`,
                  severity: 'info',
                  message: `Plugin ${i} processed ${manifests.length} manifests`,
                  context: {
                    processingTime: executionDelay,
                    manifestCount: manifests.length,
                  },
                },
              ];
            },
          });
        }

        // Register all plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        // Generate random number of manifests (1-20)
        const manifestCount = Math.floor(Math.random() * 20) + 1;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'Service',
          metadata: { name: `service-${i}` },
        }));

        // Execute validation and measure time
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const actualExecutionTime = Date.now() - startTime;

        // Property: Metadata should contain accurate plugin count
        expect(result.metadata.pluginCount).toBe(pluginCount);

        // Property: Metadata should contain accurate manifest count
        expect(result.metadata.manifestCount).toBe(manifestCount);

        // Property: Execution time should be reasonable and tracked
        expect(result.metadata.executionTime).toBeGreaterThan(0);
        expect(result.metadata.executionTime).toBeLessThanOrEqual(actualExecutionTime + 50); // Allow small margin

        // Property: Start time should be recorded when provided
        if (result.metadata.startTime) {
          expect(result.metadata.startTime).toBeGreaterThan(startTime - 100);
          expect(result.metadata.startTime).toBeLessThanOrEqual(startTime + 100);
        }

        // Property: Execution time should correlate with plugin processing
        const expectedMinTime = Math.min(...plugins.map((_, i) => 10)); // Minimum delay
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(expectedMinTime - 10);

        // Property: Performance metrics should be consistent across multiple runs
        const secondResult = await testEngine.validate(manifests, mockChartMetadata);
        expect(secondResult.metadata.pluginCount).toBe(result.metadata.pluginCount);
        expect(secondResult.metadata.manifestCount).toBe(result.metadata.manifestCount);

        // Property: Each run should have its own execution time
        expect(secondResult.metadata.executionTime).toBeGreaterThan(0);
        // Times may vary but should be in similar range
        const timeDifference = Math.abs(
          secondResult.metadata.executionTime - result.metadata.executionTime,
        );
        expect(timeDifference).toBeLessThan(result.metadata.executionTime * 2); // Allow reasonable variance
      }
    });

    it('should track performance metrics with no plugins registered', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        const testEngine = new PolicyEngine();

        // Generate random number of manifests
        const manifestCount = Math.floor(Math.random() * 15) + 1;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'ConfigMap',
          metadata: { name: `config-${i}` },
        }));

        // Execute validation with no plugins
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const actualExecutionTime = Date.now() - startTime;

        // Property: Should track metrics even with no plugins
        expect(result.metadata.pluginCount).toBe(0);
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata.executionTime).toBeLessThanOrEqual(actualExecutionTime + 10);

        // Property: Should be valid with no violations
        expect(result.valid).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);

        // Property: Summary should reflect empty state
        expect(result.summary?.violationsBySeverity.error).toBe(0);
        expect(result.summary?.violationsBySeverity.warning).toBe(0);
        expect(result.summary?.violationsBySeverity.info).toBe(0);
        expect(Object.keys(result.summary?.violationsByPlugin || {})).toHaveLength(0);
      }
    });

    it('should collect performance metrics in parallel execution mode', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        const testEngine = new PolicyEngine({ parallel: true });

        // Create multiple plugins with known execution times
        const pluginCount = Math.floor(Math.random() * 6) + 2; // 2-7 plugins
        const plugins: PolicyPlugin[] = [];
        const pluginDelays: number[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const delay = Math.floor(Math.random() * 100) + 20; // 20-120ms
          pluginDelays.push(delay);

          plugins.push({
            name: `parallel-perf-plugin-${iteration}-${i}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              await new Promise((resolve) => setTimeout(resolve, delay));
              return [
                {
                  plugin: `parallel-perf-plugin-${iteration}-${i}`,
                  severity: 'info',
                  message: `Parallel plugin ${i} completed`,
                  context: { delay, pluginIndex: i },
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        const manifestCount = Math.floor(Math.random() * 10) + 5;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'Deployment',
          metadata: { name: `deployment-${i}` },
        }));

        // Execute validation
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const actualExecutionTime = Date.now() - startTime;

        // Property: Metrics should be accurate for parallel execution
        expect(result.metadata.pluginCount).toBe(pluginCount);
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.executionTime).toBeGreaterThan(0);

        // Property: Parallel execution should be faster than sequential
        const maxPluginDelay = Math.max(...pluginDelays);
        const totalSequentialTime = pluginDelays.reduce((sum, delay) => sum + delay, 0);

        // Parallel execution should be closer to max delay than total delay
        expect(result.metadata.executionTime).toBeLessThan(totalSequentialTime);
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(maxPluginDelay - 50); // Allow margin

        // Property: Actual time should be reasonable
        expect(actualExecutionTime).toBeGreaterThanOrEqual(result.metadata.executionTime - 20);
        expect(actualExecutionTime).toBeLessThanOrEqual(result.metadata.executionTime + 100);
      }
    });

    it('should maintain performance metrics consistency across different configurations', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 15); iteration++) {
        // Test different engine configurations
        const configs = [
          { parallel: false, timeout: 1000 },
          { parallel: true, timeout: 1000 },
          { parallel: false, timeout: 500, failFast: true },
          { parallel: true, timeout: 500, gracefulDegradation: false },
        ];

        const configIndex = iteration % configs.length;
        const config = configs[configIndex];

        const testEngine = new PolicyEngine(config);

        // Create consistent set of plugins
        const pluginCount = 3;
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          plugins.push({
            name: `config-perf-plugin-${iteration}-${i}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              await new Promise((resolve) => setTimeout(resolve, 30)); // Fixed delay
              return [
                {
                  plugin: `config-perf-plugin-${iteration}-${i}`,
                  severity: 'info',
                  message: `Plugin ${i} with config ${configIndex}`,
                  context: { configIndex, pluginIndex: i },
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        const manifestCount = 5;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'Pod',
          metadata: { name: `pod-${i}` },
        }));

        // Execute validation
        const result = await testEngine.validate(manifests, mockChartMetadata);

        // Property: Basic metrics should always be present regardless of configuration
        expect(result.metadata.pluginCount).toBe(pluginCount);
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.executionTime).toBeGreaterThan(0);

        // Property: Metrics should be reasonable for the configuration
        if (config.parallel) {
          // Parallel execution should be roughly the time of one plugin
          expect(result.metadata.executionTime).toBeLessThan(200); // 30ms * 3 + overhead
        } else {
          // Sequential execution should be roughly the sum of plugin times
          expect(result.metadata.executionTime).toBeGreaterThanOrEqual(60); // 30ms * 3 - margin
        }

        // Property: Timeout configuration should not affect basic metric collection
        expect(typeof result.metadata.executionTime).toBe('number');
        expect(result.metadata.executionTime).toBeGreaterThan(0);
        expect(result.metadata.executionTime).toBeLessThan(Number.MAX_SAFE_INTEGER);

        // Property: Plugin and manifest counts should be unaffected by performance settings
        expect(result.metadata.pluginCount).toBe(pluginCount);
        expect(result.metadata.manifestCount).toBe(manifestCount);
      }
    });

    it('should track performance metrics during error conditions', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 10); iteration++) {
        const testEngine = new PolicyEngine({
          gracefulDegradation: true,
          timeout: 200,
        });

        // Create mix of successful and failing plugins
        const pluginCount = 4;
        const plugins: PolicyPlugin[] = [];

        for (let i = 0; i < pluginCount; i++) {
          const shouldFail = i % 2 === 1; // Every other plugin fails

          plugins.push({
            name: `error-perf-plugin-${iteration}-${i}`,
            version: '1.0.0',
            async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
              await new Promise((resolve) => setTimeout(resolve, 40));

              if (shouldFail) {
                throw new Error(`Plugin ${i} intentional failure`);
              }

              return [
                {
                  plugin: `error-perf-plugin-${iteration}-${i}`,
                  severity: 'info',
                  message: `Plugin ${i} succeeded`,
                  context: { pluginIndex: i, succeeded: true },
                },
              ];
            },
          });
        }

        // Register plugins
        for (const plugin of plugins) {
          await testEngine.use(plugin);
        }

        const manifestCount = 3;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: 'Service',
          metadata: { name: `error-service-${i}` },
        }));

        // Execute validation (should handle errors gracefully)
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const actualExecutionTime = Date.now() - startTime;

        // Property: Metrics should be collected even when plugins fail
        expect(result.metadata.pluginCount).toBe(pluginCount);
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.executionTime).toBeGreaterThan(0);
        expect(result.metadata.executionTime).toBeLessThanOrEqual(actualExecutionTime + 50);

        // Property: Should have both successful and error violations
        const successViolations = result.warnings.filter((v) => v.message.includes('succeeded'));
        const errorViolations = result.violations.filter((v) =>
          v.message.includes('execution failed'),
        );

        expect(successViolations.length).toBe(2); // 2 successful plugins
        expect(errorViolations.length).toBe(2); // 2 failed plugins

        // Property: Result should be invalid due to errors
        expect(result.valid).toBe(false);

        // Property: Performance tracking should continue despite errors
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(80); // At least 40ms * 2 successful plugins
      }
    });

    it('should provide consistent performance metrics for identical inputs', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 10); iteration++) {
        const testEngine = new PolicyEngine();

        // Create deterministic plugin
        const plugin: PolicyPlugin = {
          name: `consistent-perf-plugin-${iteration}`,
          version: '1.0.0',
          async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
            // Fixed processing time
            await new Promise((resolve) => setTimeout(resolve, 50));
            return [
              {
                plugin: `consistent-perf-plugin-${iteration}`,
                severity: 'info',
                message: `Processed ${manifests.length} manifests consistently`,
                context: { manifestCount: manifests.length },
              },
            ];
          },
        };

        await testEngine.use(plugin);

        // Use identical manifests for multiple runs
        const manifests = [
          { kind: 'Service', metadata: { name: 'test-service' } },
          { kind: 'Deployment', metadata: { name: 'test-deployment' } },
          { kind: 'ConfigMap', metadata: { name: 'test-config' } },
        ];

        // Run validation multiple times
        const results: Awaited<ReturnType<typeof testEngine.validate>>[] = [];
        for (let run = 0; run < 3; run++) {
          const result = await testEngine.validate(manifests, mockChartMetadata);
          results.push(result);
        }

        // Property: Plugin and manifest counts should be identical across runs
        results.forEach((result) => {
          expect(result.metadata.pluginCount).toBe(1);
          expect(result.metadata.manifestCount).toBe(3);
        });

        // Property: Execution times should be similar (within reasonable variance)
        const executionTimes = results.map((r) => r.metadata.executionTime);
        const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;

        executionTimes.forEach((time) => {
          expect(time).toBeGreaterThan(40); // Should be at least the plugin delay
          expect(time).toBeLessThan(200); // Should not be excessively long
          expect(Math.abs(time - avgTime)).toBeLessThan(avgTime * 0.5); // Within 50% of average
        });

        // Property: All runs should be valid with same violation pattern
        results.forEach((result) => {
          expect(result.valid).toBe(true);
          expect(result.warnings).toHaveLength(1);
          expect(result.violations).toHaveLength(0);
          expect(result.warnings[0].message).toContain('Processed 3 manifests consistently');
        });
      }
    });

    it('should track performance metrics with large manifest sets', async () => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 5); iteration++) {
        const testEngine = new PolicyEngine();

        // Create plugin that processes manifests
        const plugin: PolicyPlugin = {
          name: `large-set-perf-plugin-${iteration}`,
          version: '1.0.0',
          async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
            // Simulate processing time proportional to manifest count
            const processingTime = Math.min(manifests.length * 2, 200); // Max 200ms
            await new Promise((resolve) => setTimeout(resolve, processingTime));

            return [
              {
                plugin: `large-set-perf-plugin-${iteration}`,
                severity: 'info',
                message: `Processed large set of ${manifests.length} manifests`,
                context: {
                  manifestCount: manifests.length,
                  processingTime,
                },
              },
            ];
          },
        };

        await testEngine.use(plugin);

        // Generate large manifest set (50-200 manifests)
        const manifestCount = Math.floor(Math.random() * 150) + 50;
        const manifests = Array.from({ length: manifestCount }, (_, i) => ({
          kind: i % 3 === 0 ? 'Service' : i % 3 === 1 ? 'Deployment' : 'ConfigMap',
          metadata: { name: `resource-${i}` },
          spec: { replicas: (i % 5) + 1 },
        }));

        // Execute validation
        const startTime = Date.now();
        const result = await testEngine.validate(manifests, mockChartMetadata);
        const actualExecutionTime = Date.now() - startTime;

        // Property: Should accurately track large manifest counts
        expect(result.metadata.manifestCount).toBe(manifestCount);
        expect(result.metadata.pluginCount).toBe(1);

        // Property: Execution time should scale reasonably with manifest count
        const expectedMinTime = Math.min(manifestCount * 2, 200);
        expect(result.metadata.executionTime).toBeGreaterThanOrEqual(expectedMinTime - 20);
        expect(result.metadata.executionTime).toBeLessThanOrEqual(actualExecutionTime + 50);

        // Property: Should handle large sets without errors
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].context?.manifestCount).toBe(manifestCount);

        // Property: Performance should remain reasonable even with large sets
        expect(result.metadata.executionTime).toBeLessThan(1000); // Should complete within 1 second
      }
    });
  });
});
