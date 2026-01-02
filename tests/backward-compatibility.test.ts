/**
 * Backward Compatibility Tests
 *
 * These tests ensure that the policy engine integration maintains 100% backward compatibility
 * with existing Timonel users. The policy engine should be completely opt-in with zero impact
 * when not used.
 *
 * Requirements: 10.1, 10.2, 10.5
 */

import { rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';
import type { ChartMetadata } from '../src/lib/rutter.js';
import { createLogger } from '../src/lib/utils/logger.js';

describe('Backward Compatibility Tests', () => {
  let tempDir: string;
  let chartMeta: ChartMetadata;

  beforeEach(() => {
    tempDir = `/tmp/backward-compat-test-${Date.now()}`;
    mkdirSync(tempDir, { recursive: true });

    chartMeta = {
      name: 'test-chart',
      version: '1.0.0',
      description: 'Test chart for backward compatibility',
    };
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('API Compatibility', () => {
    it('should maintain identical RutterProps interface without policyEngine', () => {
      // Test that all existing RutterProps work without policyEngine
      const rutter = new Rutter({
        meta: chartMeta,
        defaultValues: { enabled: true },
        envValues: { dev: { debug: true } },
        namespace: 'test-namespace',
        singleManifestFile: false,
        manifestPrefix: 'app',
        cloudProvider: 'aws',
        helpersTpl: 'custom helpers',
        logger: createLogger('test'),
      });

      expect(rutter).toBeDefined();
      expect(rutter.getMeta()).toEqual(chartMeta);
      expect(rutter.getDefaultValues()).toEqual({ enabled: true });
      expect(rutter.getEnvValues()).toEqual({ dev: { debug: true } });
    });

    it('should accept policyEngine as undefined without type errors', () => {
      // Test explicit undefined assignment
      const rutter = new Rutter({
        meta: chartMeta,
        policyEngine: undefined,
      });

      expect(rutter).toBeDefined();
      expect(rutter.getMeta()).toEqual(chartMeta);
    });

    it('should maintain all existing method signatures', () => {
      const rutter = new Rutter({ meta: chartMeta });

      // Test that all existing methods are available and callable
      expect(typeof rutter.addManifest).toBe('function');
      expect(typeof rutter.addConditionalManifest).toBe('function');
      expect(typeof rutter.addTemplateManifest).toBe('function');
      expect(typeof rutter.addAWSEBSStorageClass).toBe('function');
      expect(typeof rutter.addAWSEFSStorageClass).toBe('function');
      expect(typeof rutter.addAWSIRSAServiceAccount).toBe('function');
      expect(typeof rutter.addAWSALBIngress).toBe('function');
      expect(typeof rutter.addKarpenterNodePool).toBe('function');
      expect(typeof rutter.addKarpenterNodeClaim).toBe('function');
      expect(typeof rutter.addKarpenterEC2NodeClass).toBe('function');
      expect(typeof rutter.write).toBe('function');
      expect(typeof rutter.getMeta).toBe('function');
      expect(typeof rutter.getDefaultValues).toBe('function');
      expect(typeof rutter.getEnvValues).toBe('function');
      expect(typeof rutter.getAssets).toBe('function');
    });
  });

  describe('Functional Compatibility', () => {
    it('should generate identical charts with and without policyEngine undefined', async () => {
      const manifest = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'test-config' },
        data: { key: 'value' },
      };

      // Rutter without policyEngine property
      const rutterWithout = new Rutter({
        meta: chartMeta,
        defaultValues: { enabled: true },
      });
      rutterWithout.addManifest(manifest, 'config');

      // Rutter with explicit undefined policyEngine
      const rutterWithUndefined = new Rutter({
        meta: chartMeta,
        defaultValues: { enabled: true },
        policyEngine: undefined,
      });
      rutterWithUndefined.addManifest(manifest, 'config');

      // Generate synthesis assets
      const assetsWithout = await (
        rutterWithout as unknown as { toSynthArray: () => Promise<unknown[]> }
      ).toSynthArray();
      const assetsWithUndefined = await (
        rutterWithUndefined as unknown as { toSynthArray: () => Promise<unknown[]> }
      ).toSynthArray();

      // Should generate identical results
      expect(assetsWithout).toEqual(assetsWithUndefined);
      expect(assetsWithout.length).toBe(1);
      expect(assetsWithout[0].id).toBe('config');
    });

    it('should write identical chart files without policy engine', async () => {
      const manifest = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'test-app' },
        spec: {
          replicas: 3,
          selector: { matchLabels: { app: 'test' } },
          template: {
            metadata: { labels: { app: 'test' } },
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
      };

      const rutter = new Rutter({
        meta: chartMeta,
        defaultValues: { replicas: 3 },
      });
      rutter.addManifest(manifest, 'deployment');

      // Write chart
      await rutter.write(tempDir);

      // Verify standard Helm chart structure
      expect(existsSync(join(tempDir, 'Chart.yaml'))).toBe(true);
      expect(existsSync(join(tempDir, 'values.yaml'))).toBe(true);
      expect(existsSync(join(tempDir, 'templates'))).toBe(true);
      expect(existsSync(join(tempDir, 'templates', '_helpers.tpl'))).toBe(true);
      expect(existsSync(join(tempDir, 'templates', 'deployment.yaml'))).toBe(true);

      // Verify Chart.yaml content
      const chartContent = readFileSync(join(tempDir, 'Chart.yaml'), 'utf-8');
      expect(chartContent).toContain('name: test-chart');
      expect(chartContent).toContain('version: 1.0.0');

      // Verify values.yaml content
      const valuesContent = readFileSync(join(tempDir, 'values.yaml'), 'utf-8');
      expect(valuesContent).toContain('replicas: 3');
    });

    it('should handle complex chart configurations without policy engine', async () => {
      const rutter = new Rutter({
        meta: {
          name: 'complex-chart',
          version: '2.1.0',
          description: 'Complex chart without policy validation',
          maintainers: [{ name: 'Test Maintainer', email: 'test@example.com' }],
        },
        defaultValues: {
          image: { repository: 'nginx', tag: 'latest' },
          service: { type: 'ClusterIP', port: 80 },
          ingress: { enabled: false },
        },
        envValues: {
          production: { replicas: 5, resources: { limits: { memory: '512Mi' } } },
          staging: { replicas: 2, resources: { limits: { memory: '256Mi' } } },
        },
        namespace: 'app-namespace',
        singleManifestFile: false,
      });

      // Add multiple manifests
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'app-service' },
          spec: { selector: { app: 'test' }, ports: [{ port: 80 }] },
        },
        'service',
      );

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'app-config' },
          data: { 'app.conf': 'server_name localhost;' },
        },
        'configmap',
      );

      rutter.addConditionalManifest(
        {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: { name: 'app-ingress' },
          spec: { rules: [] },
        },
        'ingress.enabled',
        'ingress',
      );

      // Should generate successfully
      const assets = await (
        rutter as unknown as { toSynthArray: () => Promise<unknown[]> }
      ).toSynthArray();
      expect(assets.length).toBe(3); // service, configmap, ingress (conditional)

      // Write and verify
      await rutter.write(tempDir);
      expect(existsSync(join(tempDir, 'templates', 'service.yaml'))).toBe(true);
      expect(existsSync(join(tempDir, 'templates', 'configmap.yaml'))).toBe(true);
      expect(existsSync(join(tempDir, 'templates', 'ingress.yaml'))).toBe(true);
    });
  });

  describe('Performance Impact', () => {
    it('should have zero performance overhead without policy engine', async () => {
      const manifests = Array.from({ length: 50 }, (_, i) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: `config-${i}` },
        data: { key: `value-${i}` },
      }));

      const rutter = new Rutter({
        meta: chartMeta,
        defaultValues: { enabled: true },
      });

      // Add all manifests
      manifests.forEach((manifest, i) => {
        rutter.addManifest(manifest, `config-${i}`);
      });

      // Measure synthesis time
      const startTime = Date.now();
      const assets = await (
        rutter as unknown as { toSynthArray: () => Promise<unknown[]> }
      ).toSynthArray();
      const executionTime = Date.now() - startTime;

      // Should complete quickly without policy overhead
      expect(assets.length).toBe(50);
      expect(executionTime).toBeLessThan(100); // Should be very fast without policies
    });

    it('should maintain consistent memory usage without policy engine', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create multiple Rutter instances without policy engine
      const rutters = Array.from({ length: 10 }, (_, i) => {
        const rutter = new Rutter({
          meta: { name: `chart-${i}`, version: '1.0.0' },
        });

        // Add manifests to each
        for (let j = 0; j < 10; j++) {
          rutter.addManifest(
            {
              apiVersion: 'v1',
              kind: 'ConfigMap',
              metadata: { name: `config-${j}` },
              data: { key: `value-${j}` },
            },
            `config-${j}`,
          );
        }

        return rutter;
      });

      // Generate all charts
      const allAssets = await Promise.all(
        rutters.map((rutter) =>
          (rutter as unknown as { toSynthArray: () => Promise<unknown[]> }).toSynthArray(),
        ),
      );

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Verify results
      expect(allAssets.length).toBe(10);
      allAssets.forEach((assets) => {
        expect(assets.length).toBe(10);
      });

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should maintain existing error behavior without policy engine', async () => {
      const rutter = new Rutter({ meta: chartMeta });

      // Test invalid manifest handling (should still throw)
      expect(() => {
        rutter.addManifest(
          {
            // Missing required fields
            kind: 'ConfigMap',
          } as Record<string, unknown>,
          'invalid',
        );
      }).toThrow('Manifest must have an apiVersion');

      // Test invalid YAML handling
      expect(() => {
        rutter.addManifest('invalid: yaml: content: [', 'invalid-yaml');
      }).toThrow();
    });

    it('should handle write errors without policy engine interference', async () => {
      const rutter = new Rutter({ meta: chartMeta });
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'test' },
          data: { key: 'value' },
        },
        'config',
      );

      // Try to write to invalid directory
      await expect(rutter.write('/invalid/path/that/does/not/exist')).rejects.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should maintain TypeScript type safety without policy engine', () => {
      // This test verifies that TypeScript compilation succeeds
      // The actual type checking happens at compile time

      const rutter = new Rutter({
        meta: chartMeta,
        // All these should be type-safe
        defaultValues: { key: 'value' },
        envValues: { prod: { replicas: 3 } },
        namespace: 'test',
        singleManifestFile: true,
        manifestPrefix: 'app',
        cloudProvider: 'aws',
      });

      expect(rutter).toBeDefined();
    });

    it('should allow policyEngine to be undefined in TypeScript', () => {
      // Test that TypeScript allows undefined policyEngine
      const rutter1 = new Rutter({
        meta: chartMeta,
        policyEngine: undefined,
      });

      const rutter2 = new Rutter({
        meta: chartMeta,
        // policyEngine omitted entirely
      });

      expect(rutter1).toBeDefined();
      expect(rutter2).toBeDefined();
    });
  });
});
