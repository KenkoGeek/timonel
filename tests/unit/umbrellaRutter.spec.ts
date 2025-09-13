/**
 * @fileoverview Unit tests for UmbrellaRutter class
 * @since 0.2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { UmbrellaRutter } from '../../src/lib/umbrellaRutter.js';
import { Rutter } from '../../src/lib/rutter.js';

describe('UmbrellaRutter', () => {
  const testOutputDir = join(process.cwd(), 'test-output-umbrella');

  beforeEach(() => {
    // Clean up any existing test output
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test output
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('constructor validation', () => {
    it('should accept valid chart metadata', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'valid-chart',
            version: '1.0.0',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).not.toThrow();
    });

    it('should accept semantic versions with pre-release tags', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'valid-chart',
            version: '1.0.0-alpha.1',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).not.toThrow();
    });

    it('should accept versions with v prefix', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'valid-chart',
            version: 'v2.1.3',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).not.toThrow();
    });

    it('should reject invalid chart names', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'Invalid_Chart_Name',
            version: '1.0.0',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).toThrow('Chart name must contain only lowercase letters, numbers, and dashes');
    });

    it('should reject invalid version formats', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'valid-chart',
            version: '1.2',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).toThrow('Chart version must follow semantic versioning (e.g., 1.0.0)');
    });

    it('should reject versions with leading zeros', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      expect(() => {
        new UmbrellaRutter({
          meta: {
            name: 'valid-chart',
            version: '01.2.3',
            description: 'Test umbrella chart',
          },
          subcharts: [
            { name: 'subchart1', rutter: mockRutter },
          ],
        });
      }).toThrow('Chart version must follow semantic versioning (e.g., 1.0.0)');
    });

    it('should reject malformed version strings', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      const invalidVersions = [
        '1.2.a',
        '1.2.3.4',
        'version',
        '1.2.3-',
        '1.2.3-@invalid',
      ];

      invalidVersions.forEach(version => {
        expect(() => {
          new UmbrellaRutter({
            meta: {
              name: 'valid-chart',
              version,
              description: 'Test umbrella chart',
            },
            subcharts: [
              { name: 'subchart1', rutter: mockRutter },
            ],
          });
        }).toThrow('Chart version must follow semantic versioning (e.g., 1.0.0)');
      });
    });
  });

  describe('ReDoS protection', () => {
    it('should handle potentially malicious version strings efficiently', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      // These inputs could cause ReDoS with vulnerable regex patterns
      const maliciousVersions = [
        '1.0.0-' + 'a'.repeat(100),
        '1.0.0-' + 'alpha.'.repeat(50) + 'beta',
        '2.1.3-' + 'x-'.repeat(30) + 'end',
      ];

      maliciousVersions.forEach(version => {
        const startTime = Date.now();
        
        try {
          new UmbrellaRutter({
            meta: {
              name: 'valid-chart',
              version,
              description: 'Test umbrella chart',
            },
            subcharts: [
              { name: 'subchart1', rutter: mockRutter },
            ],
          });
        } catch (error) {
          // Expected to fail validation, but should fail quickly
        }
        
        const endTime = Date.now();
        
        // Should complete quickly (under 100ms) even for complex inputs
        expect(endTime - startTime).toBeLessThan(100);
      });
    });

    it('should validate versions with complex suffixes safely', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      const complexValidVersions = [
        '1.0.0-alpha.beta.gamma',
        '2.1.3-rc.1.build.456',
        '1.0.0-pre.release.version',
      ];

      complexValidVersions.forEach(version => {
        const startTime = Date.now();
        
        expect(() => {
          new UmbrellaRutter({
            meta: {
              name: 'valid-chart',
              version,
              description: 'Test umbrella chart',
            },
            subcharts: [
              { name: 'subchart1', rutter: mockRutter },
            ],
          });
        }).not.toThrow();
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(50);
      });
    });
  });

  describe('write functionality', () => {
    it('should create umbrella chart structure', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: { image: { repository: 'nginx', tag: 'latest' } },
      });

      const umbrella = new UmbrellaRutter({
        meta: {
          name: 'test-umbrella',
          version: '1.0.0',
          description: 'Test umbrella chart',
        },
        subcharts: [
          { name: 'subchart1', rutter: mockRutter },
        ],
      });

      expect(() => {
        umbrella.write(testOutputDir);
      }).not.toThrow();

      // Verify basic structure was created
      expect(existsSync(join(testOutputDir, 'Chart.yaml'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'values.yaml'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'charts'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'templates'))).toBe(true);
    });

    it('should handle multiple subcharts', () => {
      const mockRutter1 = new Rutter({
        meta: { name: 'subchart1', version: '1.0.0' },
        defaultValues: {},
      });

      const mockRutter2 = new Rutter({
        meta: { name: 'subchart2', version: '2.0.0' },
        defaultValues: {},
      });

      const umbrella = new UmbrellaRutter({
        meta: {
          name: 'multi-umbrella',
          version: '1.0.0-beta.1',
          description: 'Multi-subchart umbrella',
        },
        subcharts: [
          { name: 'subchart1', rutter: mockRutter1 },
          { name: 'subchart2', rutter: mockRutter2 },
        ],
      });

      expect(() => {
        umbrella.write(testOutputDir);
      }).not.toThrow();

      // Verify both subcharts were created
      expect(existsSync(join(testOutputDir, 'charts', 'subchart1'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'charts', 'subchart2'))).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('should maintain existing API', () => {
      const mockRutter = new Rutter({
        meta: { name: 'test-subchart', version: '1.0.0' },
        defaultValues: {},
      });

      // Test that existing code patterns still work
      const umbrella = new UmbrellaRutter({
        meta: {
          name: 'compat-test',
          version: '1.0.0',
          description: 'Compatibility test',
          appVersion: '1.0.0',
          keywords: ['test'],
          home: 'https://example.com',
          sources: ['https://github.com/example/repo'],
          maintainers: [{ name: 'Test', email: 'test@example.com' }],
        },
        subcharts: [
          {
            name: 'subchart1',
            rutter: mockRutter,
            version: '1.0.0',
            condition: 'subchart1.enabled',
            tags: ['database'],
            repository: 'https://charts.example.com',
          },
        ],
        defaultValues: {
          global: { environment: 'test' },
          subchart1: { enabled: true },
        },
        envValues: {
          dev: { global: { environment: 'development' } },
          prod: { global: { environment: 'production' } },
        },
      });

      expect(() => {
        umbrella.write(testOutputDir);
      }).not.toThrow();
    });
  });
});