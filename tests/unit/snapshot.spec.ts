import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import YAML from 'yaml';

import { HelmChartWriter } from '../../src/lib/helmChartWriter.js';
import { Rutter } from '../../src/lib/rutter.js';
import { valuesRef } from '../../src/lib/helm.js';

// Mock filesystem
vi.mock('fs');
const mockFs = vi.mocked(fs);

/**
 * Normalize YAML content for consistent snapshots
 * - Sort object keys alphabetically
 * - Remove dynamic fields like timestamps
 * - Ensure consistent formatting
 */
function normalizeYaml(yamlContent: string): string {
  try {
    const parsed = YAML.parse(yamlContent);

    // Remove dynamic fields that might change between runs
    if (parsed && typeof parsed === 'object') {
      delete parsed.generated;
      delete parsed.timestamp;
    }

    // Re-serialize with consistent options
    return YAML.stringify(parsed, {
      sortKeys: true,
      lineWidth: 0,
      minContentWidth: 0,
    });
  } catch (_error) {
    // If parsing fails, return original content
    return yamlContent;
  }
}

describe('YAML Snapshot Tests', () => {
  const _goldensDir = path.join(__dirname, '__goldens__');
  const testOutputDir = path.join(process.cwd(), 'test-snapshot');

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
  });

  describe('HelmChartWriter snapshots', () => {
    it('should generate Chart.yaml matching expected format', () => {
      const options = {
        outDir: testOutputDir,
        meta: {
          name: 'test-app',
          version: '0.1.0',
          description: 'A test Helm chart',
          appVersion: '1.0.0',
          type: 'application' as const,
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      // Find the Chart.yaml write call
      const chartYamlCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'Chart.yaml'),
      );

      expect(chartYamlCall).toBeDefined();
      const chartYamlContent = chartYamlCall![1] as string;
      const normalizedContent = normalizeYaml(chartYamlContent);

      expect(normalizedContent).toMatchSnapshot('Chart.yaml content');
    });

    it('should generate values.yaml matching expected format', () => {
      const options = {
        outDir: testOutputDir,
        meta: {
          name: 'test-app',
          version: '0.1.0',
        },
        defaultValues: {
          image: {
            repository: 'nginx',
            tag: '1.27',
            pullPolicy: 'IfNotPresent',
          },
          replicas: 2,
          service: {
            type: 'ClusterIP',
            port: 80,
          },
          resources: {
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      // Find the values.yaml write call
      const valuesYamlCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesYamlCall).toBeDefined();
      const valuesYamlContent = valuesYamlCall![1] as string;
      const normalizedContent = normalizeYaml(valuesYamlContent);

      expect(normalizedContent).toMatchSnapshot('values.yaml content');
    });
  });

  describe('Rutter snapshots', () => {
    it('should generate consistent YAML output', () => {
      const rutter = new Rutter({
        meta: {
          name: 'snapshot-test',
          version: '1.0.0',
          description: 'Snapshot test chart',
        },
        defaultValues: {
          image: { repository: 'nginx', tag: 'latest' },
          replicas: 3,
        },
        envValues: {
          dev: { replicas: 1 },
          prod: { replicas: 5 },
        },
      });

      rutter.addDeployment({
        name: 'snapshot-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: Number(valuesRef('replicas')),
        containerPort: 80,
      });

      rutter.addService({
        name: 'snapshot-service',
        port: 80,
      });

      rutter.write(testOutputDir);

      // Capture all written files
      const writtenFiles: Record<string, string> = {};
      mockFs.writeFileSync.mock.calls.forEach(([filePath, content]) => {
        const filename = path.basename(filePath as string);
        writtenFiles[filename] = content as string;
      });

      // Normalize and snapshot each YAML file
      Object.entries(writtenFiles).forEach(([filename, content]) => {
        if (filename.endsWith('.yaml')) {
          const normalizedContent = normalizeYaml(content);
          expect(normalizedContent).toMatchSnapshot(`${filename} content`);
        }
      });
    });
  });

  describe('Edge case snapshots', () => {
    it('should handle zero values consistently', () => {
      const options = {
        outDir: testOutputDir,
        meta: {
          name: 'zero-test',
          version: '1.0.0',
        },
        defaultValues: {
          port: 0,
          replicas: 0,
          timeout: 0,
          enabled: false,
          config: null,
          resources: {},
          env: [],
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall).toBeDefined();
      const valuesContent = valuesCall![1] as string;
      const normalizedContent = normalizeYaml(valuesContent);

      expect(normalizedContent).toMatchSnapshot('zero values snapshot');
    });

    it('should handle complex nested structures consistently', () => {
      const options = {
        outDir: testOutputDir,
        meta: {
          name: 'complex-test',
          version: '1.0.0',
        },
        defaultValues: {
          database: {
            primary: {
              host: 'primary.db.local',
              port: 5432,
              credentials: {
                username: 'admin',
                passwordRef: 'db-secret',
              },
            },
            replicas: [
              { host: 'replica1.db.local', port: 5432 },
              { host: 'replica2.db.local', port: 5432 },
            ],
          },
          features: {
            authentication: { enabled: true, provider: 'oauth2' },
            monitoring: { enabled: true, metrics: ['cpu', 'memory', 'requests'] },
            caching: { enabled: false },
          },
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall).toBeDefined();
      const valuesContent = valuesCall![1] as string;
      const normalizedContent = normalizeYaml(valuesContent);

      expect(normalizedContent).toMatchSnapshot('complex nested structure snapshot');
    });
  });

  describe('Environment values snapshots', () => {
    it('should generate consistent environment-specific values', () => {
      const options = {
        outDir: testOutputDir,
        meta: {
          name: 'env-test',
          version: '1.0.0',
        },
        defaultValues: {
          replicas: 3,
          resources: {
            limits: { cpu: '500m', memory: '512Mi' },
            requests: { cpu: '250m', memory: '256Mi' },
          },
        },
        envValues: {
          dev: {
            replicas: 1,
            resources: {
              limits: { cpu: '200m', memory: '256Mi' },
              requests: { cpu: '100m', memory: '128Mi' },
            },
          },
          prod: {
            replicas: 10,
            resources: {
              limits: { cpu: '2000m', memory: '2Gi' },
              requests: { cpu: '1000m', memory: '1Gi' },
            },
          },
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      // Check dev values
      const devValuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values-dev.yaml'),
      );
      expect(devValuesCall).toBeDefined();
      const devContent = normalizeYaml(devValuesCall![1] as string);
      expect(devContent).toMatchSnapshot('dev environment values');

      // Check prod values
      const prodValuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values-prod.yaml'),
      );
      expect(prodValuesCall).toBeDefined();
      const prodContent = normalizeYaml(prodValuesCall![1] as string);
      expect(prodContent).toMatchSnapshot('prod environment values');
    });
  });
});
