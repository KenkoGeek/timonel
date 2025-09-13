import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../../dist/lib/security.js';

describe('SecurityUtils', () => {
  describe('validateImageTag', () => {
    describe('should reject dangerous/mutable tags', () => {
      const dangerousTags = [
        // Original dangerous tags
        'latest',
        'master', 
        'main',
        'dev',
        'development',
        'test',
        'staging',
        // New dangerous tags added in enhancement
        'unstable',
        'nightly',
        'edge',
        'canary',
        'current',
        'snapshot'
      ];

      dangerousTags.forEach(tag => {
        it(`should reject "${tag}" tag`, () => {
          expect(() => SecurityUtils.validateImageTag(tag)).toThrow(
            `Dangerous image tag detected: "${tag}". Mutable tags like "${tag}" pose security risks. Use specific version tags (e.g., "1.2.3", "v1.2.3", "sha256:abc123") instead.`
          );
        });

        it(`should reject "${tag}" tag with different casing`, () => {
          const upperTag = tag.toUpperCase();
          expect(() => SecurityUtils.validateImageTag(upperTag)).toThrow(
            `Dangerous image tag detected: "${upperTag}". Mutable tags like "${tag}" pose security risks. Use specific version tags (e.g., "1.2.3", "v1.2.3", "sha256:abc123") instead.`
          );
        });

        it(`should reject "${tag}" tag with whitespace`, () => {
          const tagWithSpaces = `  ${tag}  `;
          expect(() => SecurityUtils.validateImageTag(tagWithSpaces)).toThrow(
            `Dangerous image tag detected: "${tagWithSpaces}". Mutable tags like "${tag}" pose security risks. Use specific version tags (e.g., "1.2.3", "v1.2.3", "sha256:abc123") instead.`
          );
        });
      });
    });

    describe('should accept safe/immutable tags', () => {
      const safeTags = [
        '1.0.0',
        'v1.2.3',
        '2.1.0-alpha',
        '1.0.0-beta.1',
        'v2.0.0-rc.1',
        '20231201',
        '2023-12-01',
        'sha256:abc123def456',
        'build-123',
        'release-2023.12',
        'stable-v1.0',
        'prod-v2.1.0',
        '1.0.0-SNAPSHOT-20231201', // Different from just 'snapshot'
        'v1.0.0-latest', // Different from just 'latest'
        'main-v1.0.0', // Different from just 'main'
      ];

      safeTags.forEach(tag => {
        it(`should accept "${tag}" tag`, () => {
          expect(SecurityUtils.validateImageTag(tag)).toBe(true);
        });
      });
    });

    describe('should handle invalid inputs', () => {
      it('should reject empty string', () => {
        expect(() => SecurityUtils.validateImageTag('')).toThrow(
          'Image tag must be a non-empty string'
        );
      });

      it('should reject whitespace-only string', () => {
        expect(() => SecurityUtils.validateImageTag('   ')).toThrow(
          'Image tag cannot be empty or whitespace-only'
        );
      });

      it('should reject null input', () => {
        expect(() => SecurityUtils.validateImageTag(null as any)).toThrow(
          'Image tag must be a non-empty string'
        );
      });

      it('should reject undefined input', () => {
        expect(() => SecurityUtils.validateImageTag(undefined as any)).toThrow(
          'Image tag must be a non-empty string'
        );
      });

      it('should reject non-string input', () => {
        expect(() => SecurityUtils.validateImageTag(123 as any)).toThrow(
          'Image tag must be a non-empty string'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle tags that contain dangerous words but are not exact matches', () => {
        const safeTags = [
          'latest-v1.0.0',
          'my-latest-build',
          'master-branch-v1.0',
          'development-v2.0.0',
          'test-suite-v1.0',
          'staging-env-v1.0',
          'unstable-fix-v1.0',
          'nightly-build-20231201',
          'edge-case-v1.0',
          'canary-release-v1.0',
          'current-version-1.0',
          'snapshot-backup-v1.0'
        ];

        safeTags.forEach(tag => {
          expect(SecurityUtils.validateImageTag(tag)).toBe(true);
        });
      });

      it('should handle mixed case variations correctly', () => {
        const mixedCaseDangerousTags = [
          'Latest',
          'MASTER',
          'Main',
          'DEV',
          'Development',
          'TEST',
          'Staging',
          'UNSTABLE',
          'Nightly',
          'EDGE',
          'Canary',
          'CURRENT',
          'Snapshot'
        ];

        mixedCaseDangerousTags.forEach(tag => {
          expect(() => SecurityUtils.validateImageTag(tag)).toThrow(/Dangerous image tag detected/);
        });
      });
    });
  });

  describe('existing security methods', () => {
    // Test existing methods to ensure they still work
    describe('validatePath', () => {
      it('should validate safe paths', () => {
        const result = SecurityUtils.validatePath('/safe/path', '/safe');
        expect(result).toContain('/safe/path');
      });

      it('should reject path traversal', () => {
        expect(() => SecurityUtils.validatePath('../unsafe', '/safe')).toThrow(
          'Invalid path: path traversal sequences detected'
        );
      });
    });

    describe('sanitizeLogMessage', () => {
      it('should sanitize control characters', () => {
        const result = SecurityUtils.sanitizeLogMessage('test\x00message\r\n');
        expect(result).toBe('test message');
      });
    });

    describe('sanitizeEnvironmentName', () => {
      it('should accept valid environment names', () => {
        expect(SecurityUtils.sanitizeEnvironmentName('prod')).toBe('prod');
        expect(SecurityUtils.sanitizeEnvironmentName('dev-env')).toBe('dev-env');
      });

      it('should reject invalid characters', () => {
        expect(() => SecurityUtils.sanitizeEnvironmentName('prod@env')).toThrow(
          'Invalid environment name'
        );
      });
    });

    describe('isValidChartName', () => {
      it('should validate proper chart names', () => {
        expect(SecurityUtils.isValidChartName('my-chart')).toBe(true);
        expect(SecurityUtils.isValidChartName('chart123')).toBe(true);
      });

      it('should reject invalid chart names', () => {
        expect(SecurityUtils.isValidChartName('My-Chart')).toBe(false);
        expect(SecurityUtils.isValidChartName('chart_name')).toBe(false);
      });
    });
  });
});