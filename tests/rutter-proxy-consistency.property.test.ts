/**
 * Property-Based Tests for Rutter Proxy Method Consistency
 *
 * These tests validate the type safety and consistency of the toSynthArray proxy method
 * implementation in the Rutter class. The proxy method should behave differently based
 * on whether a policy engine is configured.
 *
 * **Feature: pr-249-security-fixes, Property 1: Type Safety Consistency**
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * @since 3.0.0
 */

import { describe, it, expect } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';
import { PolicyEngine } from '../src/lib/policy/policyEngine.js';
import type { ChartMetadata } from '../src/lib/rutter.js';
import type { PolicyPlugin, ValidationContext, PolicyViolation } from '../src/lib/policy/types.js';

/**
 * Property-based test configuration
 */
const PROPERTY_TEST_ITERATIONS = 100;

/**
 * Generates random chart metadata for testing
 */
function generateRandomChartMetadata(seed: number = Math.random()): ChartMetadata {
  const id = Math.floor(seed * 10000);
  return {
    name: `test-chart-${id}`,
    version: `1.${Math.floor(seed * 10)}.${Math.floor(seed * 100) % 10}`,
    description: `Test chart ${id} for proxy consistency testing`,
  };
}

/**
 * Generates a simple test policy plugin
 */
function generateTestPolicyPlugin(seed: number = Math.random()): PolicyPlugin {
  const id = Math.floor(seed * 10000);
  return {
    name: `test-plugin-${id}`,
    version: '1.0.0',
    async validate(manifests: unknown[], context: ValidationContext): Promise<PolicyViolation[]> {
      // Simple validation - no violations for testing
      return [];
    },
  };
}

describe('Rutter Proxy Method Consistency Property Tests', (): void => {
  describe('Property 1: Type Safety Consistency', (): void => {
    /**
     * **Feature: pr-249-security-fixes, Property 1: Type Safety Consistency**
     *
     * For any Rutter instance without a policy engine, calling toSynthArray should return
     * synchronous results, and for any Rutter instance with a policy engine, it should
     * return asynchronous results that require await.
     * **Validates: Requirements 1.1, 1.2, 1.3**
     */
    it('should return synchronous results when no policy engine is configured', async (): Promise<void> => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Generate random chart metadata
        const chartMeta = generateRandomChartMetadata(iteration / PROPERTY_TEST_ITERATIONS);

        // Create Rutter instance WITHOUT policy engine
        const rutter = new Rutter({
          meta: chartMeta,
          // No policyEngine configured
        });

        // Add a simple manifest to ensure we have something to synthesize
        rutter.addManifest(
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: `test-config-${iteration}`,
            },
            data: {
              key: `value-${iteration}`,
            },
          },
          `test-config-${iteration}`,
        );

        // Property: When no policy engine is configured, toSynthArray should return synchronous results
        // Access the proxy method directly to test backward compatibility
        const result = (rutter as unknown as { toSynthArray: () => unknown })['toSynthArray']();

        // Verify the result is synchronous (not a Promise)
        expect(result).not.toBeInstanceOf(Promise);
        expect(Array.isArray(result)).toBe(true);
        const resultArray = result as unknown[];
        expect(resultArray.length).toBeGreaterThan(0);

        // Verify the result contains valid SynthAsset objects
        for (const asset of resultArray) {
          expect(asset).toHaveProperty('id');
          expect(asset).toHaveProperty('yaml');
          expect(asset).toHaveProperty('target');
          expect(typeof (asset as { id: unknown }).id).toBe('string');
          expect(typeof (asset as { yaml: unknown }).yaml).toBe('string');
          expect(typeof (asset as { target: unknown }).target).toBe('string');
        }
      }
    });

    it('should return asynchronous results when policy engine is configured', async (): Promise<void> => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Generate random chart metadata and policy plugin
        const chartMeta = generateRandomChartMetadata(iteration / PROPERTY_TEST_ITERATIONS);
        const testPlugin = generateTestPolicyPlugin(iteration / PROPERTY_TEST_ITERATIONS);

        // Create policy engine and register plugin
        const policyEngine = new PolicyEngine();
        await policyEngine.use(testPlugin);

        // Create Rutter instance WITH policy engine
        const rutter = new Rutter({
          meta: chartMeta,
          policyEngine,
        });

        // Add a simple manifest to ensure we have something to synthesize
        rutter.addManifest(
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: `test-config-${iteration}`,
            },
            data: {
              key: `value-${iteration}`,
            },
          },
          `test-config-${iteration}`,
        );

        // Property: When policy engine is configured, toSynthArray should return asynchronous results
        // Access the proxy method directly to test backward compatibility
        const result = (rutter as unknown as { toSynthArray: () => unknown })['toSynthArray']();

        // Verify the result is asynchronous (a Promise)
        expect(result).toBeInstanceOf(Promise);

        // Await the result and verify it's valid
        const resolvedResult = await result;
        expect(Array.isArray(resolvedResult)).toBe(true);
        const resultArray = resolvedResult as unknown[];
        expect(resultArray.length).toBeGreaterThan(0);

        // Verify the result contains valid SynthAsset objects
        for (const asset of resultArray) {
          expect(asset).toHaveProperty('id');
          expect(asset).toHaveProperty('yaml');
          expect(asset).toHaveProperty('target');
          expect(typeof (asset as { id: unknown }).id).toBe('string');
          expect(typeof (asset as { yaml: unknown }).yaml).toBe('string');
          expect(typeof (asset as { target: unknown }).target).toBe('string');
        }
      }
    });

    it('should maintain backward compatibility for synchronous calls without policy engine', async (): Promise<void> => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        // Generate random chart metadata
        const chartMeta = generateRandomChartMetadata(iteration / PROPERTY_TEST_ITERATIONS);

        // Create Rutter instance WITHOUT policy engine
        const rutter = new Rutter({
          meta: chartMeta,
        });

        // Add multiple manifests to test with varying complexity
        const manifestCount = Math.floor((iteration / PROPERTY_TEST_ITERATIONS) * 5) + 1;
        for (let i = 0; i < manifestCount; i++) {
          rutter.addManifest(
            {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              metadata: {
                name: `test-config-${iteration}-${i}`,
              },
              data: {
                key: `value-${iteration}-${i}`,
              },
            },
            `test-config-${iteration}-${i}`,
          );
        }

        // Property: Synchronous calls should work identically to async toSynthArray() when no policy engine
        const proxyResult = await (rutter as unknown as { toSynthArray: () => unknown })[
          'toSynthArray'
        ]();
        const asyncResult = await rutter.toSynthArray();

        // Both results should be identical
        expect(proxyResult).toEqual(asyncResult);

        // Verify both contain the expected number of assets
        const proxyArray = proxyResult as unknown[];
        const asyncArray = asyncResult as unknown[];
        expect(proxyArray.length).toBe(manifestCount);
        expect(asyncArray.length).toBe(manifestCount);
      }
    });

    it('should throw appropriate error when using toSynthArraySync with policy engine', async (): Promise<void> => {
      for (let iteration = 0; iteration < Math.min(PROPERTY_TEST_ITERATIONS, 20); iteration++) {
        // Generate random chart metadata and policy plugin
        const chartMeta = generateRandomChartMetadata(iteration / PROPERTY_TEST_ITERATIONS);
        const testPlugin = generateTestPolicyPlugin(iteration / PROPERTY_TEST_ITERATIONS);

        // Create policy engine and register plugin
        const policyEngine = new PolicyEngine();
        await policyEngine.use(testPlugin);

        // Create Rutter instance WITH policy engine
        const rutter = new Rutter({
          meta: chartMeta,
          policyEngine,
        });

        // Add a simple manifest
        rutter.addManifest(
          {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: `test-config-${iteration}`,
            },
            data: {
              key: `value-${iteration}`,
            },
          },
          `test-config-${iteration}`,
        );

        // Property: toSynthArraySync should throw when policy engine is configured
        expect(() => {
          rutter.toSynthArraySync();
        }).toThrow(
          'toSynthArraySync() cannot be used with policy engine. Use toSynthArray() instead.',
        );
      }
    });

    it('should preserve type safety across different chart configurations', async (): Promise<void> => {
      for (let iteration = 0; iteration < PROPERTY_TEST_ITERATIONS; iteration++) {
        const seed = iteration / PROPERTY_TEST_ITERATIONS;

        const { chartMeta, policyEngine, rutter } = await setupRandomRutterConfiguration(
          iteration,
          seed,
        );
        addRandomManifests(rutter, seed, iteration);

        // Property: Type safety should be consistent regardless of configuration
        const result = (rutter as unknown as { toSynthArray: () => unknown })['toSynthArray']();

        await validateResultTypeConsistency(result, !!policyEngine);
      }
    });
  });
});

/**
 * Helper function to set up random Rutter configuration
 */
async function setupRandomRutterConfiguration(iteration: number, seed: number) {
  // Generate random chart metadata with varying properties
  const chartMeta: ChartMetadata = {
    name: `test-chart-${iteration}`,
    version: `1.${Math.floor(seed * 10)}.${Math.floor(seed * 100) % 10}`,
    description: seed > 0.5 ? `Test chart ${iteration}` : undefined,
    keywords: seed > 0.7 ? [`test-${iteration}`, 'property-testing'] : undefined,
    maintainers: seed > 0.8 ? [{ name: `maintainer-${iteration}` }] : undefined,
  };

  // Randomly decide whether to use policy engine
  const usePolicyEngine = seed > 0.5;
  let policyEngine: PolicyEngine | undefined;

  if (usePolicyEngine) {
    policyEngine = new PolicyEngine();
    const testPlugin = generateTestPolicyPlugin(seed);
    await policyEngine.use(testPlugin);
  }

  // Create Rutter instance with random configuration
  const rutter = new Rutter({
    meta: chartMeta,
    policyEngine,
    namespace: seed > 0.6 ? `test-namespace-${iteration}` : undefined,
    singleManifestFile: seed > 0.3,
  });

  return { chartMeta, policyEngine, rutter };
}

/**
 * Helper function to add random manifests
 */
function addRandomManifests(rutter: Rutter, seed: number, iteration: number): void {
  const manifestCount = Math.floor(seed * 3) + 1;
  for (let i = 0; i < manifestCount; i++) {
    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `config-${iteration}-${i}`,
        },
        data: {
          [`key-${i}`]: `value-${iteration}-${i}`,
        },
      },
      `config-${iteration}-${i}`,
    );
  }
}

/**
 * Helper function to validate result type consistency
 */
async function validateResultTypeConsistency(
  result: unknown,
  usePolicyEngine: boolean,
): Promise<void> {
  if (usePolicyEngine) {
    // Should return Promise when policy engine is configured
    expect(result).toBeInstanceOf(Promise);
    const resolvedResult = await result;
    expect(Array.isArray(resolvedResult)).toBe(true);
    expect((resolvedResult as unknown[]).length).toBeGreaterThan(0);
  } else {
    // Should return synchronous array when no policy engine
    expect(result).not.toBeInstanceOf(Promise);
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBeGreaterThan(0);
  }
}
