import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HelmChartWriter } from '../../dist/lib/helmChartWriter.js';
import type { HelmChartMeta, HelmChartWriteOptions } from '../../dist/lib/helmChartWriter.js';

// Mock filesystem
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('HelmChartWriter', () => {
  const testOutputDir = path.join(process.cwd(), 'test-chart');

  const basicMeta: HelmChartMeta = {
    name: 'test-app',
    version: '0.1.0',
    description: 'A test Helm chart',
    appVersion: '1.0.0',
    type: 'application',
  };

  const basicValues = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
  });

  describe('static write method', () => {
    it('should write complete Helm chart structure', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: basicValues,
        envValues: {
          dev: { replicas: 1 },
          prod: { replicas: 5 },
        },
        assets: [
          {
            id: 'deployment',
            yaml: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: test-app',
            target: 'deployment.yaml',
          },
        ],
      };

      HelmChartWriter.write(options);

      // Verify directory creation - HelmChartWriter creates directories as needed
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join(testOutputDir, 'templates'), {
        recursive: true,
      });

      // Verify Chart.yaml
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('apiVersion: v2'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('name: test-app'),
      );

      // Verify values.yaml
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values.yaml'),
        expect.stringContaining('image:'),
      );

      // Verify environment values
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-dev.yaml'),
        expect.stringContaining('replicas: 1'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-prod.yaml'),
        expect.stringContaining('replicas: 5'),
      );

      // Verify template assets
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', 'deployment.yaml'),
        expect.stringContaining('kind: Deployment'),
      );
    });

    it('should handle minimal configuration', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: { name: 'minimal', version: '1.0.0' },
        assets: [],
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('name: minimal'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values.yaml'),
        expect.stringContaining('{}'),
      );
    });

    it('should handle complex metadata', () => {
      const complexMeta: HelmChartMeta = {
        name: 'complex-app',
        version: '2.1.0',
        description: 'A complex application',
        appVersion: '2.1.0',
        type: 'application',
        kubeVersion: '>=1.20.0',
        keywords: ['web', 'api', 'microservice'],
        home: 'https://example.com',
        sources: ['https://github.com/example/app'],
        maintainers: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', url: 'https://jane.dev' },
        ],
        icon: 'https://example.com/icon.png',
        dependencies: [
          {
            name: 'postgresql',
            version: '11.6.12',
            repository: 'https://charts.bitnami.com/bitnami',
          },
        ],
      };

      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: complexMeta,
        assets: [],
      };

      HelmChartWriter.write(options);

      const chartYamlCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'Chart.yaml'),
      );

      expect(chartYamlCall?.[1]).toContain('name: complex-app');
      expect(chartYamlCall?.[1]).toContain('version: 2.1.0');
      expect(chartYamlCall?.[1]).toContain('kubeVersion: ">=1.20.0"');
      expect(chartYamlCall?.[1]).toContain('- web');
      expect(chartYamlCall?.[1]).toContain('- api');
      expect(chartYamlCall?.[1]).toContain('John Doe');
    });

    it('should write multiple assets', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        assets: [
          {
            id: 'deployment',
            yaml: 'deployment content',
            target: 'deployment.yaml',
          },
          {
            id: 'service',
            yaml: 'service content',
            target: 'service.yaml',
          },
          {
            id: 'ingress',
            yaml: 'ingress content',
            target: 'ingress.yaml',
          },
        ],
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', 'deployment.yaml'),
        expect.stringContaining('deployment content'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', 'service.yaml'),
        expect.stringContaining('service content'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', 'ingress.yaml'),
        expect.stringContaining('ingress content'),
      );
    });

    it('should write helpers template', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        assets: [],
        helpersTpl: '{{- define "myapp.name" -}}\n{{ .Chart.Name }}\n{{- end }}',
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', '_helpers.tpl'),
        expect.stringContaining('{{- define "myapp.name" -}}'),
      );
    });

    it('should write NOTES.txt', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        assets: [],
        notesTpl: 'Thank you for installing {{ .Chart.Name }}!',
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates', 'NOTES.txt'),
        expect.stringContaining('Thank you for installing {{ .Chart.Name }}!'),
      );
    });

    it('should write values schema', () => {
      const schema = {
        type: 'object',
        properties: {
          replicas: { type: 'integer', minimum: 1 },
          image: {
            type: 'object',
            properties: {
              repository: { type: 'string' },
              tag: { type: 'string' },
            },
          },
        },
      };

      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        assets: [],
        valuesSchema: schema,
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values.schema.json'),
        expect.stringContaining('"type": "object"'),
      );
    });

    it('should generate valid YAML format', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: basicValues,
        assets: [],
      };

      HelmChartWriter.write(options);

      const chartYamlCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'Chart.yaml'),
      );

      const valuesYamlCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      // Chart.yaml should be valid YAML
      expect(chartYamlCall?.[1]).toMatch(/^apiVersion: v2$/m);
      expect(chartYamlCall?.[1]).toMatch(/^name: test-app$/m);
      expect(chartYamlCall?.[1]).toMatch(/^version: 0\.1\.0$/m);

      // values.yaml should be valid YAML
      expect(valuesYamlCall?.[1]).toMatch(/^image:$/m);
      expect(valuesYamlCall?.[1]).toMatch(/^\s+repository: nginx$/m);
      expect(valuesYamlCall?.[1]).toMatch(/^\s+tag: "1\.27"$/m);
    });
  });

  describe('edge cases', () => {
    it('should handle values with null and undefined', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: {
          config: null,
          resources: undefined,
          emptyObject: {},
          emptyArray: [],
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall?.[1]).toContain('config: null');
      expect(valuesCall?.[1]).toContain('emptyObject: {}');
      expect(valuesCall?.[1]).toContain('emptyArray: []');
    });

    it('should handle special characters in values', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: {
          specialString: 'string with "quotes" and \\backslashes',
          multilineString: 'line1\nline2\nline3',
          unicodeString: '🚀 Unicode test 中文',
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall?.[1]).toContain('specialString:');
      expect(valuesCall?.[1]).toContain('multilineString:');
      expect(valuesCall?.[1]).toContain('unicodeString:');
    });

    it('should handle zero values correctly', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: {
          port: 0, // Edge case: port 0
          replicas: 0, // Edge case: 0 replicas
          timeout: 0,
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall?.[1]).toContain('port: 0');
      expect(valuesCall?.[1]).toContain('replicas: 0');
      expect(valuesCall?.[1]).toContain('timeout: 0');
    });

    it('should handle deeply nested objects', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'found',
                  },
                },
              },
            },
          },
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      const valuesCall = mockFs.writeFileSync.mock.calls.find(
        (call) => call[0] === path.join(testOutputDir, 'values.yaml'),
      );

      expect(valuesCall?.[1]).toContain('deepValue: found');
    });

    it('should handle empty environment values', () => {
      const options: HelmChartWriteOptions = {
        outDir: testOutputDir,
        meta: basicMeta,
        defaultValues: { replicas: 1 },
        envValues: {
          staging: {},
        },
        assets: [],
      };

      HelmChartWriter.write(options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-staging.yaml'),
        expect.stringContaining('{}'),
      );
    });
  });
});
