/**
 * @fileoverview Unit tests for SecurityUtils class
 * @since 2.2.0
 */

import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../../src/lib/security.js';

describe('SecurityUtils', () => {
  describe('validateImageTag', () => {
    describe('valid semantic version tags', () => {
      it('should accept basic semantic versions', () => {
        expect(SecurityUtils.validateImageTag('1.0.0')).toBe(true);
        expect(SecurityUtils.validateImageTag('0.1.0')).toBe(true);
        expect(SecurityUtils.validateImageTag('10.20.30')).toBe(true);
      });

      it('should accept semantic versions with v prefix', () => {
        expect(SecurityUtils.validateImageTag('v1.0.0')).toBe(true);
        expect(SecurityUtils.validateImageTag('v2.1.3')).toBe(true);
        expect(SecurityUtils.validateImageTag('v0.0.1')).toBe(true);
      });

      it('should accept semantic versions with pre-release suffixes', () => {
        expect(SecurityUtils.validateImageTag('1.0.0-alpha')).toBe(true);
        expect(SecurityUtils.validateImageTag('1.0.0-alpha.1')).toBe(true);
        expect(SecurityUtils.validateImageTag('1.0.0-beta.2')).toBe(true);
        expect(SecurityUtils.validateImageTag('2.0.0-rc.1')).toBe(true);
        expect(SecurityUtils.validateImageTag('v1.0.0-alpha.beta')).toBe(true);
      });
    });

    describe('valid date tags', () => {
      it('should accept basic date formats', () => {
        expect(SecurityUtils.validateImageTag('2023-12-01')).toBe(true);
        expect(SecurityUtils.validateImageTag('2024-01-15')).toBe(true);
        expect(SecurityUtils.validateImageTag('2022-06-30')).toBe(true);
      });

      it('should accept date formats with suffixes', () => {
        expect(SecurityUtils.validateImageTag('2023-12-01-alpha')).toBe(true);
        expect(SecurityUtils.validateImageTag('2024-01-15-beta.1')).toBe(true);
        expect(SecurityUtils.validateImageTag('2022-06-30-rc')).toBe(true);
      });

      it('should validate date ranges correctly', () => {
        expect(SecurityUtils.validateImageTag('2023-01-01')).toBe(true);
        expect(SecurityUtils.validateImageTag('2023-12-31')).toBe(true);
      });
    });

    describe('valid simple tags', () => {
      it('should accept common simple tags', () => {
        expect(SecurityUtils.validateImageTag('latest')).toBe(true);
        expect(SecurityUtils.validateImageTag('stable')).toBe(true);
        expect(SecurityUtils.validateImageTag('main')).toBe(true);
        expect(SecurityUtils.validateImageTag('develop')).toBe(true);
      });

      it('should accept tags with allowed characters', () => {
        expect(SecurityUtils.validateImageTag('feature-branch')).toBe(true);
        expect(SecurityUtils.validateImageTag('test_build')).toBe(true);
        expect(SecurityUtils.validateImageTag('v1.2.3-build.456')).toBe(true);
      });
    });

    describe('input validation and security', () => {
      it('should throw error for non-string input', () => {
        expect(() => SecurityUtils.validateImageTag(null as any)).toThrow('Image tag must be a non-empty string');
        expect(() => SecurityUtils.validateImageTag(undefined as any)).toThrow('Image tag must be a non-empty string');
        expect(() => SecurityUtils.validateImageTag(123 as any)).toThrow('Image tag must be a non-empty string');
        expect(() => SecurityUtils.validateImageTag('' as any)).toThrow('Image tag must be a non-empty string');
      });

      it('should throw error for tags exceeding maximum length', () => {
        const longTag = 'a'.repeat(129);
        expect(() => SecurityUtils.validateImageTag(longTag)).toThrow('Image tag exceeds maximum length of 128 characters');
      });

      it('should accept tags at maximum length', () => {
        const maxLengthTag = 'a'.repeat(128);
        expect(SecurityUtils.validateImageTag(maxLengthTag)).toBe(true);
      });

      it('should reject tags with path traversal sequences', () => {
        expect(SecurityUtils.validateImageTag('tag/../other')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag//other')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag\\other')).toBe(false);
      });
    });

    describe('ReDoS protection tests', () => {
      it('should handle potentially malicious inputs efficiently', () => {
        // These inputs could cause ReDoS with vulnerable regex patterns
        const maliciousInputs = [
          'a'.repeat(100) + '-' + 'b'.repeat(100),
          '1.2.3-' + 'a-'.repeat(50) + 'end',
          '2023-12-01-' + 'x.'.repeat(50) + 'y',
          'v1.0.0-' + 'alpha.'.repeat(30) + 'beta',
        ];

        maliciousInputs.forEach(input => {
          const startTime = Date.now();
          const result = SecurityUtils.validateImageTag(input);
          const endTime = Date.now();
          
          // Should complete quickly (under 100ms) even for complex inputs
          expect(endTime - startTime).toBeLessThan(100);
          // Result should be deterministic
          expect(typeof result).toBe('boolean');
        });
      });

      it('should handle nested quantifier patterns safely', () => {
        // These patterns would be problematic with nested quantifiers in regex
        const problematicInputs = [
          '1.2.3-' + 'a'.repeat(50) + '-' + 'b'.repeat(50),
          'v1.0.0-alpha-' + 'x'.repeat(100),
          '2023-12-01-' + 'test.'.repeat(25) + 'end',
        ];

        problematicInputs.forEach(input => {
          expect(() => {
            const result = SecurityUtils.validateImageTag(input);
            expect(typeof result).toBe('boolean');
          }).not.toThrow();
        });
      });
    });

    describe('invalid inputs', () => {
      it('should reject invalid semantic versions', () => {
        expect(SecurityUtils.validateImageTag('1.2')).toBe(false);
        expect(SecurityUtils.validateImageTag('1.2.3.4')).toBe(false);
        expect(SecurityUtils.validateImageTag('1.2.a')).toBe(false);
        expect(SecurityUtils.validateImageTag('01.2.3')).toBe(false); // leading zeros
        expect(SecurityUtils.validateImageTag('1.02.3')).toBe(false); // leading zeros
        expect(SecurityUtils.validateImageTag('v1.2')).toBe(false);
      });

      it('should reject invalid date formats', () => {
        expect(SecurityUtils.validateImageTag('2023-13-01')).toBe(false); // invalid month
        expect(SecurityUtils.validateImageTag('2023-12-32')).toBe(false); // invalid day
        expect(SecurityUtils.validateImageTag('2023-00-01')).toBe(false); // invalid month
        expect(SecurityUtils.validateImageTag('2023-12-00')).toBe(false); // invalid day
        expect(SecurityUtils.validateImageTag('23-12-01')).toBe(false); // invalid year format
        expect(SecurityUtils.validateImageTag('2023-1-01')).toBe(false); // single digit month
        expect(SecurityUtils.validateImageTag('2023-12-1')).toBe(false); // single digit day
      });

      it('should reject tags with invalid characters', () => {
        expect(SecurityUtils.validateImageTag('tag@version')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag#hash')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag$var')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag%encoded')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag with spaces')).toBe(false);
      });

      it('should reject tags that start or end with non-alphanumeric characters', () => {
        expect(SecurityUtils.validateImageTag('-tag')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag-')).toBe(false);
        expect(SecurityUtils.validateImageTag('.tag')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag.')).toBe(false);
        expect(SecurityUtils.validateImageTag('_tag')).toBe(false);
        expect(SecurityUtils.validateImageTag('tag_')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle boundary values correctly', () => {
        expect(SecurityUtils.validateImageTag('0.0.0')).toBe(true);
        expect(SecurityUtils.validateImageTag('999.999.999')).toBe(true);
        expect(SecurityUtils.validateImageTag('2000-01-01')).toBe(true);
        expect(SecurityUtils.validateImageTag('2099-12-31')).toBe(true);
      });

      it('should handle single character tags', () => {
        expect(SecurityUtils.validateImageTag('a')).toBe(true);
        expect(SecurityUtils.validateImageTag('1')).toBe(true);
        expect(SecurityUtils.validateImageTag('Z')).toBe(true);
      });

      it('should handle mixed case tags', () => {
        expect(SecurityUtils.validateImageTag('MyTag')).toBe(true);
        expect(SecurityUtils.validateImageTag('v1.0.0-Alpha')).toBe(true);
        expect(SecurityUtils.validateImageTag('Feature-Branch')).toBe(true);
      });
    });

    describe('performance tests', () => {
      it('should validate tags quickly', () => {
        const testTags = [
          '1.0.0',
          'v2.1.3-alpha.1',
          '2023-12-01-beta',
          'latest',
          'feature-branch-name',
          'very-long-tag-name-with-many-parts-and-numbers-123',
        ];

        testTags.forEach(tag => {
          const startTime = Date.now();
          const result = SecurityUtils.validateImageTag(tag);
          const endTime = Date.now();
          
          expect(endTime - startTime).toBeLessThan(10); // Should be very fast
          expect(typeof result).toBe('boolean');
        });
      });

      it('should handle batch validation efficiently', () => {
        const tags = Array.from({ length: 1000 }, (_, i) => `tag-${i}.0.0`);
        
        const startTime = Date.now();
        const results = tags.map(tag => SecurityUtils.validateImageTag(tag));
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
        expect(results.every(result => result === true)).toBe(true);
      });
    });
  });

  describe('existing security functions', () => {
    it('should maintain existing functionality', () => {
      expect(SecurityUtils.isValidChartName('my-chart')).toBe(true);
      expect(SecurityUtils.isValidChartName('invalid_chart')).toBe(false);
      
      expect(SecurityUtils.sanitizeLogMessage('test message\n\r')).toBe('test message');
      
      expect(SecurityUtils.sanitizeEnvironmentName('prod')).toBe('prod');
      expect(() => SecurityUtils.sanitizeEnvironmentName('prod@env')).toThrow();
    });
  });
});