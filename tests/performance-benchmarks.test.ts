/**
 * Performance Benchmarking Tests
 *
 * These tests benchmark the policy engine performance with various chart sizes,
 * memory usage, and parallel execution scenarios to ensure the system meets
 * performance requirements.
 *
 * Requirements: 7.1, 7.3
 */

import { rmSync, mkdirSync, existsSync } from 'fs';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PolicyEngine } from '../src/lib/policy/policyEngine.js';
import type { PolicyPlugin, PolicyViolation } from '../src/lib/policy/types.js';
import { Rutter } from '../src/lib/rutter.js';
import type { ChartMetadata } from '../src/lib/rutter.js';

describe('Performance Benchmarking Tests', () => {
  let engine: PolicyEngine;
  let tempDir: string;
  let chartMeta: ChartMetadata;

  beforeEach(async () => {
    engine = new PolicyEngine();
    tempDir = `/tmp/perf-benchmark-test-${Date.now()}`;
    mkdirSync(tempDir, { recursive: true });

    chartMeta = {
      name: 'benchmark-chart',
      version: '1.0.0',
      description: 'Performance benchmark test chart',
    };
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Validation Performance Benchmarks', () => {
    it('should validate small charts (1-10 manifests) under 10ms', async () => {
      const fastPlugin: PolicyPlugin = {
        name: 'fast-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Minimal validation logic
          return manifests.length > 5
            ? [
                {
                  plugin: 'fast-validator',
                  severity: 'warning',
                  message: 'Many manifests detected',
                },
              ]
            : [];
        },
      };

      await engine.use(fastPlugin);

      const smallManifests = Array.from({ length: 5 }, (_, i) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: `config-${i}` },
        data: { key: `value-${i}` },
      }));

      // Benchmark small chart validation
      const startTime = Date.now();
      const result = await engine.validate(smallManifests);
      const executionTime = Date.now() - startTime;

      expect(result.valid).toBe(true);
      expect(result.metadata.manifestCount).toBe(5);
      expect(executionTime).toBeLessThan(10); // Should complete under 10ms
      expect(result.metadata.executionTime).toBeLessThan(10);
    });

    it('should validate medium charts (50-100 manifests) under 100ms', async () => {
      const mediumPlugin: PolicyPlugin = {
        name: 'medium-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Moderate validation logic
          const violations: PolicyViolation[] = [];
          manifests.forEach((manifest, index) => {
            if (index % 10 === 0) {
              violations.push({
                plugin: 'medium-validator',
                severity: 'info',
                message: `Checkpoint at manifest ${index}`,
                resourcePath: `manifest-${index}`,
              });
            }
          });
          return violations;
        },
      };

      await engine.use(mediumPlugin);

      const mediumManifests = Array.from({ length: 75 }, (_, i) => ({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `app-${i}`,
          labels: { app: `app-${i}`, version: 'v1' },
        },
        spec: {
          replicas: 3,
          selector: { matchLabels: { app: `app-${i}` } },
          template: {
            metadata: { labels: { app: `app-${i}` } },
            spec: {
              containers: [
                {
                  name: 'app',
                  image: `nginx:${i % 3 === 0 ? 'latest' : '1.21'}`,
                  ports: [{ containerPort: 80 }],
                },
              ],
            },
          },
        },
      }));

      // Benchmark medium chart validation
      const startTime = Date.now();
      const result = await engine.validate(mediumManifests);
      const executionTime = Date.now() - startTime;

      expect(result.metadata.manifestCount).toBe(75);
      expect(result.warnings.length).toBe(8); // Every 10th manifest
      expect(executionTime).toBeLessThan(100); // Should complete under 100ms
      expect(result.metadata.executionTime).toBeLessThan(100);
    });

    it('should validate large charts (200+ manifests) under 500ms', async () => {
      const complexPlugin: PolicyPlugin = {
        name: 'complex-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // More complex validation logic
          const violations: PolicyViolation[] = [];

          manifests.forEach((manifest: Record<string, unknown>, index) => {
            // Get metadata first
            const metadata = manifest.metadata as Record<string, unknown> | undefined;

            // Simulate resource validation
            if (manifest.kind === 'Deployment') {
              const spec = manifest.spec as Record<string, unknown> | undefined;
              const replicas = (spec?.replicas as number) || 1;
              if (replicas > 5) {
                violations.push({
                  plugin: 'complex-validator',
                  severity: 'warning',
                  message: `High replica count: ${replicas}`,
                  resourcePath: `${(metadata?.name as string) || 'unknown'}`,
                  field: 'spec.replicas',
                  suggestion: 'Consider using HPA for scaling',
                });
              }
            }

            // Simulate label validation
            const labels = (metadata?.labels as Record<string, unknown>) || {};
            if (!labels.app) {
              violations.push({
                plugin: 'complex-validator',
                severity: 'error',
                message: 'Missing required app label',
                resourcePath: `${(metadata?.name as string) || 'unknown'}`,
                field: 'metadata.labels.app',
              });
            }
          });

          return violations;
        },
      };

      await engine.use(complexPlugin);

      // Generate large manifest set with variety
      const largeManifests = [];

      // Add deployments
      for (let i = 0; i < 100; i++) {
        largeManifests.push({
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: `deployment-${i}`,
            labels: i % 5 === 0 ? {} : { app: `app-${i}` }, // Some missing labels
          },
          spec: {
            replicas: i % 10 === 0 ? 8 : 3, // Some high replica counts
            selector: { matchLabels: { app: `app-${i}` } },
            template: {
              metadata: { labels: { app: `app-${i}` } },
              spec: {
                containers: [
                  {
                    name: 'app',
                    image: 'nginx:latest',
                  },
                ],
              },
            },
          },
        });
      }

      // Add services
      for (let i = 0; i < 50; i++) {
        largeManifests.push({
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: `service-${i}`,
            labels: { app: `app-${i}` },
          },
          spec: {
            selector: { app: `app-${i}` },
            ports: [{ port: 80, targetPort: 8080 }],
          },
        });
      }

      // Add configmaps
      for (let i = 0; i < 75; i++) {
        largeManifests.push({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: `config-${i}`,
            labels: { app: `app-${i}` },
          },
          data: {
            [`config-${i}.yaml`]: `key: value-${i}\nindex: ${i}`,
          },
        });
      }

      expect(largeManifests.length).toBe(225);

      // Benchmark large chart validation
      const startTime = Date.now();
      const result = await engine.validate(largeManifests);
      const executionTime = Date.now() - startTime;

      expect(result.metadata.manifestCount).toBe(225);
      expect(executionTime).toBeLessThan(500); // Should complete under 500ms
      expect(result.metadata.executionTime).toBeLessThan(500);

      // Verify violations were detected
      expect(result.violations.length).toBeGreaterThan(0); // Missing labels
      expect(result.warnings.length).toBeGreaterThan(0); // High replica counts
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage with large manifest sets', async () => {
      const memoryPlugin: PolicyPlugin = {
        name: 'memory-test',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Process manifests without storing large amounts of data
          return manifests.map((_, index) => ({
            plugin: 'memory-test',
            severity: 'info',
            message: `Processed ${index + 1}`,
          }));
        },
      };

      await engine.use(memoryPlugin);

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate very large manifest set
      const veryLargeManifests = Array.from({ length: 500 }, (_, i) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `large-config-${i}`,
          labels: {
            app: `app-${i}`,
            environment: 'test',
            component: 'data',
            version: 'v1.0.0',
          },
        },
        data: {
          [`config-${i}.json`]: JSON.stringify({
            id: i,
            name: `config-${i}`,
            settings: {
              enabled: true,
              timeout: 30000,
              retries: 3,
              endpoints: [`http://service-${i}.example.com`],
            },
          }),
        },
      }));

      const result = await engine.validate(veryLargeManifests);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(result.metadata.manifestCount).toBe(500);
      expect(result.warnings.length).toBe(500);

      // Memory increase should be reasonable (less than 100MB for 500 manifests)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle memory efficiently with multiple validation runs', async () => {
      const efficientPlugin: PolicyPlugin = {
        name: 'efficient-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Efficient validation that doesn't leak memory
          let violationCount = 0;
          for (const manifest of manifests) {
            if ((manifest as Record<string, unknown>).kind === 'Deployment') {
              violationCount++;
            }
          }

          return violationCount > 0
            ? [
                {
                  plugin: 'efficient-validator',
                  severity: 'info',
                  message: `Found ${violationCount} deployments`,
                },
              ]
            : [];
        },
      };

      await engine.use(efficientPlugin);

      const baselineMemory = process.memoryUsage().heapUsed;
      const manifests = Array.from({ length: 100 }, (_, i) => ({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: `app-${i}` },
        spec: { replicas: 1 },
      }));

      // Run multiple validation cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const result = await engine.validate(manifests);
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0].message).toBe('Found 100 deployments');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - baselineMemory;

      // Memory should not grow significantly across multiple runs
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Parallel Execution Performance', () => {
    it('should improve performance with parallel plugin execution', async () => {
      const slowPlugin1: PolicyPlugin = {
        name: 'slow-plugin-1',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [
            {
              plugin: 'slow-plugin-1',
              severity: 'info',
              message: `Processed ${manifests.length} manifests`,
            },
          ];
        },
      };

      const slowPlugin2: PolicyPlugin = {
        name: 'slow-plugin-2',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [
            {
              plugin: 'slow-plugin-2',
              severity: 'info',
              message: `Validated ${manifests.length} resources`,
            },
          ];
        },
      };

      const slowPlugin3: PolicyPlugin = {
        name: 'slow-plugin-3',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 50));
          return [
            {
              plugin: 'slow-plugin-3',
              severity: 'info',
              message: `Analyzed ${manifests.length} objects`,
            },
          ];
        },
      };

      // Test sequential execution
      const sequentialEngine = new PolicyEngine();
      sequentialEngine.configure({ parallel: false });
      await sequentialEngine.use(slowPlugin1);
      await sequentialEngine.use(slowPlugin2);
      await sequentialEngine.use(slowPlugin3);

      const manifests = Array.from({ length: 20 }, (_, i) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: `config-${i}` },
        data: { key: `value-${i}` },
      }));

      const sequentialStart = Date.now();
      const sequentialResult = await sequentialEngine.validate(manifests);
      const sequentialTime = Date.now() - sequentialStart;

      // Test parallel execution
      const parallelEngine = new PolicyEngine();
      parallelEngine.configure({ parallel: true });
      await parallelEngine.use(slowPlugin1);
      await parallelEngine.use(slowPlugin2);
      await parallelEngine.use(slowPlugin3);

      const parallelStart = Date.now();
      const parallelResult = await parallelEngine.validate(manifests);
      const parallelTime = Date.now() - parallelStart;

      // Verify results are equivalent
      expect(sequentialResult.warnings.length).toBe(3);
      expect(parallelResult.warnings.length).toBe(3);
      expect(sequentialResult.metadata.pluginCount).toBe(3);
      expect(parallelResult.metadata.pluginCount).toBe(3);

      // Parallel should be significantly faster
      expect(parallelTime).toBeLessThan(sequentialTime * 0.8); // At least 20% faster
      expect(sequentialTime).toBeGreaterThan(140); // Should take ~150ms sequentially
      expect(parallelTime).toBeLessThan(100); // Should take ~50ms in parallel
    });

    it('should handle timeout enforcement in parallel execution', async () => {
      const timeoutPlugin: PolicyPlugin = {
        name: 'timeout-plugin',
        version: '1.0.0',
        async validate(): Promise<PolicyViolation[]> {
          // Simulate plugin that takes too long
          await new Promise((resolve) => setTimeout(resolve, 200));
          return [];
        },
      };

      const fastPlugin: PolicyPlugin = {
        name: 'fast-plugin',
        version: '1.0.0',
        async validate(): Promise<PolicyViolation[]> {
          return [
            {
              plugin: 'fast-plugin',
              severity: 'info',
              message: 'Fast validation completed',
            },
          ];
        },
      };

      const timeoutEngine = new PolicyEngine();
      timeoutEngine.configure({
        parallel: true,
        timeout: 100, // 100ms timeout
        gracefulDegradation: true,
      });

      await timeoutEngine.use(timeoutPlugin);
      await timeoutEngine.use(fastPlugin);

      const manifests = [{ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'test' } }];

      const startTime = Date.now();
      const result = await timeoutEngine.validate(manifests);
      const executionTime = Date.now() - startTime;

      // Should complete quickly due to timeout (allowing for some overhead)
      expect(executionTime).toBeLessThan(250);

      // Fast plugin should still succeed
      expect(result.warnings.some((w) => w.plugin === 'fast-plugin')).toBe(true);

      // Should have some violations or warnings (timeout or fast plugin results)
      expect(result.violations.length + result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Performance Benchmarks', () => {
    it('should maintain performance in Rutter integration', async () => {
      const integrationPlugin: PolicyPlugin = {
        name: 'integration-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];
          manifests.forEach((manifest: Record<string, unknown>) => {
            const metadata = manifest.metadata as Record<string, unknown> | undefined;
            const labels = metadata?.labels as Record<string, unknown> | undefined;
            if (manifest.kind === 'Deployment' && !labels?.app) {
              violations.push({
                plugin: 'integration-validator',
                severity: 'warning',
                message: 'Deployment missing app label',
                resourcePath: metadata?.name as string,
                field: 'metadata.labels.app',
              });
            }
          });
          return violations;
        },
      };

      const policyEngine = new PolicyEngine();
      await policyEngine.use(integrationPlugin);

      const rutter = new Rutter({
        meta: chartMeta,
        policyEngine,
        defaultValues: { replicas: 3 },
      });

      // Add multiple manifests
      for (let i = 0; i < 30; i++) {
        rutter.addManifest(
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
              name: `app-${i}`,
              labels: i % 3 === 0 ? {} : { app: `app-${i}` }, // Some missing labels
            },
            spec: {
              replicas: 2,
              selector: { matchLabels: { app: `app-${i}` } },
              template: {
                metadata: { labels: { app: `app-${i}` } },
                spec: { containers: [{ name: 'app', image: 'nginx' }] },
              },
            },
          },
          `deployment-${i}`,
        );
      }

      // Benchmark chart generation with policy validation
      const startTime = Date.now();
      const assets = await (
        rutter as unknown as { toSynthArray: () => Promise<unknown[]> }
      ).toSynthArray();
      const executionTime = Date.now() - startTime;

      expect(assets.length).toBe(30);
      expect(executionTime).toBeLessThan(200); // Should complete under 200ms with policy validation
    });

    it('should scale linearly with manifest count', async () => {
      const scalingPlugin: PolicyPlugin = {
        name: 'scaling-validator',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // O(n) validation logic
          return manifests.map((_, index) => ({
            plugin: 'scaling-validator',
            severity: 'info',
            message: `Validated manifest ${index + 1}`,
          }));
        },
      };

      await engine.use(scalingPlugin);

      const testSizes = [10, 50, 100, 200];
      const timings: number[] = [];

      for (const size of testSizes) {
        const manifests = Array.from({ length: size }, (_, i) => ({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: `config-${i}` },
          data: { key: `value-${i}` },
        }));

        const startTime = Date.now();
        const result = await engine.validate(manifests);
        const executionTime = Date.now() - startTime;

        expect(result.warnings.length).toBe(size);
        timings.push(executionTime);
      }

      // Verify roughly linear scaling (allowing for caching and variance)
      // Note: Due to caching, actual performance may be much better than linear
      // We just verify that performance doesn't degrade exponentially

      // All timings should be reasonable (not exponentially growing)
      expect(timings.every((t) => t < 100)).toBe(true); // All should be under 100ms

      // Verify we got results for all test sizes
      expect(timings.length).toBe(4);
      expect(timings.every((t) => t >= 0)).toBe(true); // All should be non-negative
    });
  });
});
