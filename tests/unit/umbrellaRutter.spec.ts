/**
 * @fileoverview Unit tests for UmbrellaRutter class
 * @since 0.2.0
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import YAML from 'yaml';

import { UmbrellaRutter } from '../../src/lib/umbrellaRutter.js';
import type { UmbrellaRutterProps, SubchartSpec } from '../../src/lib/umbrellaRutter.js';
import type { HelmChartMeta } from '../../src/lib/helmChartWriter.js';
import type { Rutter } from '../../src/lib/rutter.js';
import { SecurityUtils } from '../../src/lib/security.js';

// Mock filesystem operations
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock SecurityUtils
vi.mock('../../src/lib/security.js', () => ({
  SecurityUtils: {
    validatePath: vi.fn((path: string) => path),
    isValidSubchartName: vi.fn(() => true),
    sanitizeLogMessage: vi.fn((msg: string) => msg),
    sanitizeEnvironmentName: vi.fn((env: string) => env),
  },
}));

describe('UmbrellaRutter', () => {
  let mockRutter1: Rutter;
  let mockRutter2: Rutter;
  let validMeta: HelmChartMeta;
  let validSubcharts: SubchartSpec[];
  let validProps: UmbrellaRutterProps;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock Rutter instances
    mockRutter1 = {
      write: vi.fn(),
    } as unknown as Rutter;

    mockRutter2 = {
      write: vi.fn(),
    } as unknown as Rutter;

    // Valid chart metadata
    validMeta = {
      name: 'wordpress-umbrella',
      version: '1.0.0',
      description: 'WordPress with MySQL umbrella chart',
      appVersion: '6.3.0',
      keywords: ['wordpress', 'mysql', 'cms'],
      home: 'https://wordpress.org',
      sources: ['https://github.com/wordpress/wordpress'],
      maintainers: [
        {
          name: 'Test Maintainer',
          email: 'test@example.com',
        },
      ],
    };

    // Valid subcharts
    validSubcharts = [
      {
        name: 'wordpress',
        rutter: mockRutter1,
        version: '1.0.0',
        condition: 'wordpress.enabled',
        tags: ['frontend'],
      },
      {
        name: 'mysql',
        rutter: mockRutter2,
        version: '8.0.0',
        condition: 'mysql.enabled',
        tags: ['database'],
        repository: 'https://charts.bitnami.com/bitnami',
      },
    ];

    // Valid props
    validProps = {
      meta: validMeta,
      subcharts: validSubcharts,
      defaultValues: {
        global: {
          storageClass: 'gp2',
        },
        wordpress: {
          enabled: true,
          persistence: {
            enabled: true,
            size: '10Gi',
          },
        },
        mysql: {
          enabled: true,
          auth: {
            rootPassword: 'secretpassword',
            database: 'wordpress',
          },
          primary: {
            persistence: {
              enabled: true,
              size: '8Gi',
            },
          },
        },
      },
      envValues: {
        production: {
          wordpress: {
            replicaCount: 3,
            resources: {
              requests: {
                memory: '512Mi',
                cpu: '500m',
              },
            },
          },
          mysql: {
            primary: {
              persistence: {
                size: '20Gi',
              },
            },
          },
        },
        staging: {
          wordpress: {
            replicaCount: 1,
          },
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create UmbrellaRutter with valid props', () => {
      const umbrella = new UmbrellaRutter(validProps);
      expect(umbrella).toBeInstanceOf(UmbrellaRutter);
    });

    it('should throw error for invalid chart name', () => {
      const invalidProps = {
        ...validProps,
        meta: {
          ...validMeta,
          name: 'Invalid_Chart_Name',
        },
      };

      expect(() => new UmbrellaRutter(invalidProps)).toThrow(
        'Chart name must contain only lowercase letters, numbers, and dashes',
      );
    });

    it('should throw error for invalid chart version', () => {
      const invalidProps = {
        ...validProps,
        meta: {
          ...validMeta,
          version: 'invalid-version',
        },
      };

      expect(() => new UmbrellaRutter(invalidProps)).toThrow(
        'Chart version must follow semantic versioning (e.g., 1.0.0)',
      );
    });

    it('should accept valid chart name with dashes', () => {
      const validProps2 = {
        ...validProps,
        meta: {
          ...validMeta,
          name: 'my-wordpress-umbrella',
        },
      };

      expect(() => new UmbrellaRutter(validProps2)).not.toThrow();
    });

    it('should accept valid semantic version with pre-release', () => {
      const validProps2 = {
        ...validProps,
        meta: {
          ...validMeta,
          version: '1.0.0-alpha.1',
        },
      };

      expect(() => new UmbrellaRutter(validProps2)).not.toThrow();
    });
  });

  describe('write', () => {
    let umbrella: UmbrellaRutter;
    const outDir = '/test/output';

    beforeEach(() => {
      umbrella = new UmbrellaRutter(validProps);
    });

    it('should create output directory structure', () => {
      umbrella.write(outDir);

      expect(SecurityUtils.validatePath).toHaveBeenCalledWith(outDir, process.cwd());
      expect(mkdirSync).toHaveBeenCalledWith(outDir, { recursive: true });
      expect(mkdirSync).toHaveBeenCalledWith(join(outDir, 'charts'), { recursive: true });
      expect(mkdirSync).toHaveBeenCalledWith(join(outDir, 'templates'), { recursive: true });
    });

    it('should write all subcharts', () => {
      umbrella.write(outDir);

      expect(SecurityUtils.isValidSubchartName).toHaveBeenCalledWith('wordpress');
      expect(SecurityUtils.isValidSubchartName).toHaveBeenCalledWith('mysql');
      expect(mockRutter1.write).toHaveBeenCalledWith(join(outDir, 'charts', 'wordpress'));
      expect(mockRutter2.write).toHaveBeenCalledWith(join(outDir, 'charts', 'mysql'));
    });

    it('should write parent Chart.yaml with dependencies', () => {
      umbrella.write(outDir);

      expect(writeFileSync).toHaveBeenCalledWith(
        join(outDir, 'Chart.yaml'),
        expect.stringContaining('wordpress-umbrella'),
      );

      // Verify Chart.yaml content structure
      const chartYamlCall = (
        writeFileSync as unknown as { mock: { calls: [string, string][] } }
      ).mock.calls.find((call: [string, string]) => call[0].endsWith('Chart.yaml'));
      expect(chartYamlCall).toBeDefined();

      const chartContent = YAML.parse(chartYamlCall![1]);
      expect(chartContent).toMatchObject({
        apiVersion: 'v2',
        name: 'wordpress-umbrella',
        description: 'WordPress with MySQL umbrella chart',
        type: 'application',
        version: '1.0.0',
        appVersion: '6.3.0',
        dependencies: [
          {
            name: 'wordpress',
            version: '1.0.0',
            repository: 'file://./charts/wordpress',
            condition: 'wordpress.enabled',
            tags: ['frontend'],
          },
          {
            name: 'mysql',
            version: '8.0.0',
            repository: 'https://charts.bitnami.com/bitnami',
            condition: 'mysql.enabled',
            tags: ['database'],
          },
        ],
      });
    });

    it('should write parent values.yaml', () => {
      umbrella.write(outDir);

      expect(writeFileSync).toHaveBeenCalledWith(
        join(outDir, 'values.yaml'),
        expect.stringContaining('global'),
      );

      // Verify values.yaml content
      const valuesYamlCall = (
        writeFileSync as unknown as { mock: { calls: [string, string][] } }
      ).mock.calls.find((call: [string, string]) => call[0].endsWith('values.yaml'));
      expect(valuesYamlCall).toBeDefined();

      const valuesContent = YAML.parse(valuesYamlCall![1]);
      expect(valuesContent).toMatchObject({
        global: {
          storageClass: 'gp2',
        },
        wordpress: {
          enabled: true,
          persistence: {
            enabled: true,
            size: '10Gi',
          },
        },
        mysql: {
          enabled: true,
          auth: {
            rootPassword: 'secretpassword',
            database: 'wordpress',
          },
        },
      });
    });

    it('should write environment-specific values files', () => {
      umbrella.write(outDir);

      expect(SecurityUtils.sanitizeEnvironmentName).toHaveBeenCalledWith('production');
      expect(SecurityUtils.sanitizeEnvironmentName).toHaveBeenCalledWith('staging');

      expect(writeFileSync).toHaveBeenCalledWith(
        join(outDir, 'values-production.yaml'),
        expect.any(String),
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        join(outDir, 'values-staging.yaml'),
        expect.any(String),
      );

      // Verify production values merge
      const prodValuesCall = (
        writeFileSync as unknown as { mock: { calls: [string, string][] } }
      ).mock.calls.find((call: [string, string]) => call[0].endsWith('values-production.yaml'));
      const prodContent = YAML.parse(prodValuesCall![1]);
      expect(prodContent.wordpress.replicaCount).toBe(3);
      expect(prodContent.mysql.primary.persistence.size).toBe('20Gi');
    });

    it('should write NOTES.txt template', () => {
      umbrella.write(outDir);

      expect(writeFileSync).toHaveBeenCalledWith(
        join(outDir, 'templates', 'NOTES.txt'),
        expect.stringContaining('Get the application URLs'),
      );

      const notesCall = (
        writeFileSync as unknown as { mock: { calls: [string, string][] } }
      ).mock.calls.find((call: [string, string]) => call[0].endsWith('NOTES.txt'));
      expect(notesCall![1]).toContain('charts/wordpress/README.md');
      expect(notesCall![1]).toContain('charts/mysql/README.md');
    });

    it('should throw error for invalid subchart name', () => {
      (
        SecurityUtils.isValidSubchartName as unknown as {
          mockReturnValue: (value: boolean) => void;
        }
      ).mockReturnValue(false);
      (
        SecurityUtils.sanitizeLogMessage as unknown as { mockReturnValue: (value: string) => void }
      ).mockReturnValue('invalid-name');

      expect(() => umbrella.write(outDir)).toThrow('Invalid subchart name: invalid-name');
    });

    it('should handle subcharts without optional properties', () => {
      const minimalProps = {
        meta: validMeta,
        subcharts: [
          {
            name: 'simple-chart',
            rutter: mockRutter1,
          },
        ],
      };

      const minimalUmbrella = new UmbrellaRutter(minimalProps);
      minimalUmbrella.write(outDir);

      const chartYamlCall = (
        writeFileSync as unknown as { mock: { calls: [string, string][] } }
      ).mock.calls.find((call: [string, string]) => call[0].endsWith('Chart.yaml'));
      const chartContent = YAML.parse(chartYamlCall![1]);

      expect(chartContent.dependencies[0]).toMatchObject({
        name: 'simple-chart',
        version: '0.1.0',
        repository: 'file://./charts/simple-chart',
      });
      expect(chartContent.dependencies[0]).not.toHaveProperty('condition');
      expect(chartContent.dependencies[0]).not.toHaveProperty('tags');
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects correctly', () => {
      const umbrella = new UmbrellaRutter(validProps);

      // Access private method through type assertion for testing
      const deepMerge = (
        umbrella as unknown as {
          deepMerge: (
            target: Record<string, unknown>,
            source: Record<string, unknown>,
          ) => Record<string, unknown>;
        }
      ).deepMerge.bind(umbrella);

      const target = {
        a: 1,
        b: {
          c: 2,
          d: 3,
        },
      };

      const source = {
        b: {
          d: 4,
          e: 5,
        },
        f: 6,
      };

      const result = deepMerge(target, source);

      expect(result).toEqual({
        a: 1,
        b: {
          c: 2,
          d: 4,
          e: 5,
        },
        f: 6,
      });
    });

    it('should handle arrays correctly', () => {
      const umbrella = new UmbrellaRutter(validProps);
      const deepMerge = (
        umbrella as unknown as {
          deepMerge: (
            target: Record<string, unknown>,
            source: Record<string, unknown>,
          ) => Record<string, unknown>;
        }
      ).deepMerge.bind(umbrella);

      const target = {
        arr: [1, 2, 3],
      };

      const source = {
        arr: [4, 5, 6],
      };

      const result = deepMerge(target, source);

      expect(result.arr).toEqual([4, 5, 6]);
    });
  });

  describe('generateNotesTemplate', () => {
    it('should generate proper NOTES.txt content', () => {
      const umbrella = new UmbrellaRutter(validProps);
      const generateNotesTemplate = (
        umbrella as unknown as { generateNotesTemplate: () => string }
      ).generateNotesTemplate.bind(umbrella);

      const notes = generateNotesTemplate();

      expect(notes).toContain('Get the application URLs');
      expect(notes).toContain('helm list -A');
      expect(notes).toContain('charts/wordpress/README.md');
      expect(notes).toContain('charts/mysql/README.md');
    });
  });
});
