import { describe, it, expect } from 'vitest';

import { SecurityUtils } from '../../dist/lib/security.js';

describe('SecurityUtils', () => {
  describe('sanitizeEnvVar', () => {
    it('should sanitize valid environment variable names and values', () => {
      const result = SecurityUtils.sanitizeEnvVar('my-var', 'my-value');
      expect(result).toEqual({
        name: 'MY_VAR',
        value: 'my-value',
      });
    });

    it('should handle uppercase names correctly', () => {
      const result = SecurityUtils.sanitizeEnvVar('DATABASE_URL', 'postgres://localhost:5432/db');
      expect(result).toEqual({
        name: 'DATABASE_URL',
        value: 'postgres://localhost:5432/db',
      });
    });

    it('should replace invalid characters in names with underscores', () => {
      const result = SecurityUtils.sanitizeEnvVar('my-app.config', 'value');
      expect(result).toEqual({
        name: 'MY_APP_CONFIG',
        value: 'value',
      });
    });

    it('should trim whitespace from values', () => {
      const result = SecurityUtils.sanitizeEnvVar('VAR', '  value  ');
      expect(result).toEqual({
        name: 'VAR',
        value: 'value',
      });
    });

    it('should throw error for empty name', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('', 'value')).toThrow(
        'Environment variable name must be a non-empty string',
      );
    });

    it('should throw error for non-string name', () => {
      expect(() => SecurityUtils.sanitizeEnvVar(null as unknown as string, 'value')).toThrow(
        'Environment variable name must be a non-empty string',
      );
    });

    it('should throw error for non-string value', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', 123 as unknown as string)).toThrow(
        'Environment variable value must be a string',
      );
    });

    it('should reject command substitution patterns', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', '$(rm -rf /)')).toThrow(
        'Environment variable value contains dangerous pattern',
      );
    });

    it('should reject backtick command execution', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', '`cat /etc/passwd`')).toThrow(
        'Environment variable value contains dangerous pattern',
      );
    });

    it('should reject variable expansion patterns', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', '${PATH}')).toThrow(
        'Environment variable value contains dangerous pattern',
      );
    });

    it('should reject control characters', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', 'value\x00')).toThrow(
        'Environment variable value contains dangerous pattern',
      );
    });

    it('should reject values exceeding maximum length', () => {
      const longValue = 'a'.repeat(32769);
      expect(() => SecurityUtils.sanitizeEnvVar('VAR', longValue)).toThrow(
        'Environment variable value exceeds maximum length (32KB)',
      );
    });

    it('should handle names starting with numbers by adding underscore', () => {
      const result = SecurityUtils.sanitizeEnvVar('123var', 'value');
      expect(result.name).toBe('_123VAR');
    });
  });

  describe('validateImageTag', () => {
    it('should validate semantic version tags', () => {
      expect(SecurityUtils.validateImageTag('1.2.3')).toBe(true);
      expect(SecurityUtils.validateImageTag('v1.2.3')).toBe(true);
      expect(SecurityUtils.validateImageTag('2.0.0-alpha.1')).toBe(true);
    });

    it('should validate hash-based tags', () => {
      expect(SecurityUtils.validateImageTag('abc1234')).toBe(true);
      expect(SecurityUtils.validateImageTag('1a2b3c4d5e6f7890abcdef')).toBe(true);
    });

    it('should validate date-based tags', () => {
      expect(SecurityUtils.validateImageTag('2023-12-01')).toBe(true);
      expect(SecurityUtils.validateImageTag('2023-12-01-hotfix')).toBe(true);
    });

    it('should reject dangerous tags', () => {
      expect(() => SecurityUtils.validateImageTag('latest')).toThrow(
        "Insecure image tag detected: 'latest'. Use specific version tags for security.",
      );
      expect(() => SecurityUtils.validateImageTag('master')).toThrow(
        "Insecure image tag detected: 'master'. Use specific version tags for security.",
      );
      expect(() => SecurityUtils.validateImageTag('dev')).toThrow(
        "Insecure image tag detected: 'dev'. Use specific version tags for security.",
      );
    });

    it('should reject empty or null tags', () => {
      expect(() => SecurityUtils.validateImageTag('')).toThrow(
        'Image tag must be a non-empty string',
      );
      expect(() => SecurityUtils.validateImageTag(null as unknown as string)).toThrow(
        'Image tag must be a non-empty string',
      );
    });

    it('should reject invalid characters', () => {
      expect(() => SecurityUtils.validateImageTag('tag with spaces')).toThrow(
        'Invalid image tag format',
      );
      expect(() => SecurityUtils.validateImageTag('tag@special')).toThrow(
        'Invalid image tag format',
      );
    });

    it('should reject tags exceeding maximum length', () => {
      const longTag = 'a'.repeat(129);
      expect(() => SecurityUtils.validateImageTag(longTag)).toThrow(
        'Image tag exceeds maximum length (128 characters)',
      );
    });

    it('should handle case-insensitive dangerous tag detection', () => {
      expect(() => SecurityUtils.validateImageTag('LATEST')).toThrow(
        "Insecure image tag detected: 'LATEST'. Use specific version tags for security.",
      );
      expect(() => SecurityUtils.validateImageTag('Latest')).toThrow(
        "Insecure image tag detected: 'Latest'. Use specific version tags for security.",
      );
    });

    it('should trim whitespace before validation', () => {
      expect(SecurityUtils.validateImageTag('  1.2.3  ')).toBe(true);
    });
  });

  describe('generateSecretName', () => {
    it('should generate valid secret names from base names', () => {
      const result = SecurityUtils.generateSecretName('my-app');
      expect(result).toBe('my-app');
    });

    it('should sanitize invalid characters', () => {
      const result = SecurityUtils.generateSecretName('My App Config!');
      expect(result).toBe('my-app-config');
    });

    it('should handle base name with suffix', () => {
      const result = SecurityUtils.generateSecretName('database', 'credentials');
      expect(result).toBe('database-credentials');
    });

    it('should remove leading and trailing hyphens', () => {
      const result = SecurityUtils.generateSecretName('--app--');
      expect(result).toBe('app');
    });

    it('should collapse multiple hyphens', () => {
      const result = SecurityUtils.generateSecretName('my---app');
      expect(result).toBe('my-app');
    });

    it('should remove leading hyphens', () => {
      const result = SecurityUtils.generateSecretName('-app');
      expect(result).toBe('app');
    });

    it('should remove trailing hyphens', () => {
      const result = SecurityUtils.generateSecretName('app-');
      expect(result).toBe('app');
    });

    it('should truncate long names while preserving suffix', () => {
      const longBase = 'a'.repeat(60);
      const result = SecurityUtils.generateSecretName(longBase, 'suffix');
      expect(result.length).toBeLessThanOrEqual(63);
      expect(result).toMatch(/-suffix$/);
    });

    it('should truncate very long names without suffix', () => {
      const longBase = 'a'.repeat(70);
      const result = SecurityUtils.generateSecretName(longBase);
      expect(result.length).toBeLessThanOrEqual(63);
    });

    it('should throw error for empty base name', () => {
      expect(() => SecurityUtils.generateSecretName('')).toThrow(
        'Base name must be a non-empty string',
      );
    });

    it('should throw error for non-string base name', () => {
      expect(() => SecurityUtils.generateSecretName(null as unknown as string)).toThrow(
        'Base name must be a non-empty string',
      );
    });

    it('should throw error for non-string suffix', () => {
      expect(() => SecurityUtils.generateSecretName('app', 123 as unknown as string)).toThrow(
        'Suffix must be a string',
      );
    });

    it('should handle base name with no valid characters', () => {
      expect(() => SecurityUtils.generateSecretName('!!!')).toThrow(
        'Base name contains no valid characters',
      );
    });

    it('should handle special characters in suffix', () => {
      const result = SecurityUtils.generateSecretName('app', 'config!@#');
      expect(result).toBe('app-config');
    });

    it('should handle numeric base names by adding prefix', () => {
      const result = SecurityUtils.generateSecretName('123');
      expect(result).toBe('s123');
    });

    it('should handle mixed case and special characters', () => {
      const result = SecurityUtils.generateSecretName('MyApp_Config.v2', 'Secret');
      expect(result).toBe('myapp-config-v2-secret');
    });
  });

  describe('integration scenarios', () => {
    it('should work together for secure Kubernetes resource creation', () => {
      // Test realistic scenario
      const envVar = SecurityUtils.sanitizeEnvVar('database.url', 'postgres://db:5432/app');
      const secretName = SecurityUtils.generateSecretName('my-app', 'db-credentials');
      const isValidTag = SecurityUtils.validateImageTag('1.2.3');

      expect(envVar.name).toBe('DATABASE_URL');
      expect(envVar.value).toBe('postgres://db:5432/app');
      expect(secretName).toBe('my-app-db-credentials');
      expect(isValidTag).toBe(true);
    });

    it('should handle edge cases in combination', () => {
      // Test with challenging inputs
      const envVar = SecurityUtils.sanitizeEnvVar('my-complex.var_name', 'safe-value');
      const secretName = SecurityUtils.generateSecretName('Complex App Name!', 'v2.0');

      expect(envVar.name).toBe('MY_COMPLEX_VAR_NAME');
      expect(secretName).toBe('complex-app-name-v2-0');
    });
  });
});
