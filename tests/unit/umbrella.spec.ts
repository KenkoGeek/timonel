/**
 * @fileoverview Unit tests for umbrella chart utilities
 * @since 0.2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createUmbrella } from '../../src/lib/umbrella.js';
import { UmbrellaRutter } from '../../src/lib/umbrellaRutter.js';
import type { UmbrellaRutterProps, SubchartSpec } from '../../src/lib/umbrella.js';
import type { HelmChartMeta } from '../../src/lib/helmChartWriter.js';
import type { Rutter } from '../../src/lib/rutter.js';

// Mock UmbrellaRutter
vi.mock('../../src/lib/umbrellaRutter.js', () => ({
  UmbrellaRutter: vi.fn(),
}));

describe('umbrella utilities', () => {
  let mockRutter: Rutter;
  let validMeta: HelmChartMeta;
  let validSubcharts: SubchartSpec[];
  let validProps: UmbrellaRutterProps;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Rutter instance
    mockRutter = {
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
        rutter: mockRutter,
        version: '1.0.0',
        condition: 'wordpress.enabled',
        tags: ['frontend'],
      },
      {
        name: 'mysql',
        rutter: mockRutter,
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

  describe('createUmbrella', () => {
    it('should create UmbrellaRutter instance with provided props', () => {
      const mockUmbrellaInstance = { write: vi.fn() };
      (
        UmbrellaRutter as unknown as { new (props: UmbrellaRutterProps): unknown }
      ).prototype.constructor = vi.fn().mockReturnValue(mockUmbrellaInstance);

      const result = createUmbrella(validProps);

      expect(UmbrellaRutter).toHaveBeenCalledWith(validProps);
      expect(result).toBeInstanceOf(UmbrellaRutter);
    });

    it('should pass through all props to UmbrellaRutter constructor', () => {
      createUmbrella(validProps);

      expect(UmbrellaRutter).toHaveBeenCalledWith({
        meta: validMeta,
        subcharts: validSubcharts,
        defaultValues: validProps.defaultValues,
        envValues: validProps.envValues,
      });
    });

    it('should work with minimal props', () => {
      const minimalProps: UmbrellaRutterProps = {
        meta: {
          name: 'simple-umbrella',
          version: '1.0.0',
        },
        subcharts: [
          {
            name: 'simple-chart',
            rutter: mockRutter,
          },
        ],
      };

      createUmbrella(minimalProps);

      expect(UmbrellaRutter).toHaveBeenCalledWith(minimalProps);
    });

    it('should handle empty subcharts array', () => {
      const emptyProps: UmbrellaRutterProps = {
        meta: validMeta,
        subcharts: [],
      };

      createUmbrella(emptyProps);

      expect(UmbrellaRutter).toHaveBeenCalledWith(emptyProps);
    });

    it('should preserve subchart configuration', () => {
      const complexSubcharts: SubchartSpec[] = [
        {
          name: 'frontend',
          rutter: mockRutter,
          version: '2.1.0',
          condition: 'frontend.enabled',
          tags: ['web', 'ui'],
          repository: 'https://charts.example.com/frontend',
        },
        {
          name: 'backend',
          rutter: mockRutter,
          version: '1.5.3',
          condition: 'backend.enabled',
          tags: ['api', 'service'],
          repository: 'https://charts.example.com/backend',
        },
        {
          name: 'database',
          rutter: mockRutter,
          version: '3.0.0',
          tags: ['storage'],
        },
      ];

      const complexProps: UmbrellaRutterProps = {
        meta: validMeta,
        subcharts: complexSubcharts,
      };

      createUmbrella(complexProps);

      expect(UmbrellaRutter).toHaveBeenCalledWith({
        meta: validMeta,
        subcharts: complexSubcharts,
      });
    });

    it('should preserve environment values configuration', () => {
      const envValues = {
        development: {
          global: {
            debug: true,
          },
          wordpress: {
            replicaCount: 1,
            resources: {
              requests: {
                memory: '256Mi',
                cpu: '250m',
              },
            },
          },
        },
        production: {
          global: {
            debug: false,
          },
          wordpress: {
            replicaCount: 5,
            resources: {
              requests: {
                memory: '1Gi',
                cpu: '1000m',
              },
              limits: {
                memory: '2Gi',
                cpu: '2000m',
              },
            },
          },
        },
      };

      const propsWithEnv: UmbrellaRutterProps = {
        meta: validMeta,
        subcharts: validSubcharts,
        envValues,
      };

      createUmbrella(propsWithEnv);

      expect(UmbrellaRutter).toHaveBeenCalledWith({
        meta: validMeta,
        subcharts: validSubcharts,
        envValues,
      });
    });
  });
});
