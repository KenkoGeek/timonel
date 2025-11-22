import * as path from 'path';

import { describe, it, expect } from 'vitest';

import { SecurityUtils } from '../src/lib/security.js';

describe('SecurityUtils Unit Tests', () => {
  describe('validatePath', () => {
    it('should validate a safe path', () => {
      const safePath = 'safe/path';
      const base = process.cwd();
      expect(SecurityUtils.validatePath(safePath, base)).toBe(path.resolve(base, safePath));
    });

    it('should reject path traversal', () => {
      const base = process.cwd();
      expect(() => SecurityUtils.validatePath('../outside', base)).toThrow('Invalid path');
    });

    it('should reject null bytes', () => {
      expect(() => SecurityUtils.validatePath('path\0with\0null', process.cwd())).toThrow(
        'Invalid path',
      );
    });

    it('should allow absolute paths if configured', () => {
      const base = process.cwd();
      const absPath = path.resolve(base, 'absolute/path');
      expect(SecurityUtils.validatePath(absPath, base, { allowAbsolute: true })).toBe(absPath);
    });
  });

  describe('sanitizeLogMessage', () => {
    it('should remove control characters', () => {
      const msg = 'Hello\x00World';
      expect(SecurityUtils.sanitizeLogMessage(msg)).toBe('HelloWorld');
    });

    it('should normalize newlines', () => {
      const msg = 'Line1\nLine2\rLine3';
      expect(SecurityUtils.sanitizeLogMessage(msg)).toBe('Line1 Line2 Line3');
    });
  });

  describe('sanitizeEnvironmentName', () => {
    it('should sanitize valid names', () => {
      expect(SecurityUtils.sanitizeEnvironmentName('prod-env')).toBe('prod-env');
    });

    it('should reject invalid characters', () => {
      expect(() => SecurityUtils.sanitizeEnvironmentName('prod$env')).toThrow(
        'Invalid environment name',
      );
    });

    it('should reject empty or too long names', () => {
      expect(() => SecurityUtils.sanitizeEnvironmentName('')).toThrow();
      expect(() => SecurityUtils.sanitizeEnvironmentName('a'.repeat(65))).toThrow();
    });
  });

  describe('isValidTypeScriptFile', () => {
    it('should accept valid extensions', () => {
      expect(SecurityUtils.isValidTypeScriptFile('file.ts')).toBe(true);
      expect(SecurityUtils.isValidTypeScriptFile('file.tsx')).toBe(true);
    });

    it('should reject invalid extensions', () => {
      expect(SecurityUtils.isValidTypeScriptFile('file.js')).toBe(false);
      expect(SecurityUtils.isValidTypeScriptFile('file.txt')).toBe(false);
    });
  });

  describe('isValidHelmTemplatePath', () => {
    it('should accept valid paths', () => {
      expect(SecurityUtils.isValidHelmTemplatePath('templates/deployment.yaml')).toBe(true);
    });

    it('should reject paths with traversal', () => {
      expect(SecurityUtils.isValidHelmTemplatePath('../templates/deployment.yaml')).toBe(false);
    });

    it('should reject paths with reserved words', () => {
      expect(SecurityUtils.isValidHelmTemplatePath('templates/true.yaml')).toBe(false);
    });
  });

  describe('isValidChartName', () => {
    it('should accept valid chart names', () => {
      expect(SecurityUtils.isValidChartName('my-chart')).toBe(true);
    });

    it('should reject invalid chart names', () => {
      expect(SecurityUtils.isValidChartName('MyChart')).toBe(false); // Uppercase not allowed
      expect(SecurityUtils.isValidChartName('-chart')).toBe(false); // Start with hyphen
    });
  });

  describe('sanitizeEnvVar', () => {
    it('should sanitize name and value', () => {
      const result = SecurityUtils.sanitizeEnvVar('api-key', 'secret');
      expect(result.name).toBe('API_KEY');
      expect(result.value).toBe('secret');
    });

    it('should reject dangerous values', () => {
      expect(() => SecurityUtils.sanitizeEnvVar('KEY', '$(command)')).toThrow('dangerous pattern');
    });
  });

  describe('validateImageTag', () => {
    it('should accept valid tags', () => {
      expect(SecurityUtils.validateImageTag('v1.0.0')).toBe(true);
    });

    it('should reject dangerous tags', () => {
      expect(() => SecurityUtils.validateImageTag('latest')).toThrow('Insecure image tag');
    });

    it('should reject invalid format', () => {
      expect(() => SecurityUtils.validateImageTag('v1.0.0!')).toThrow('Invalid image tag format');
    });
  });

  describe('generateSecretName', () => {
    it('should generate valid secret name', () => {
      expect(SecurityUtils.generateSecretName('MySecret')).toBe('mysecret');
    });

    it('should append suffix', () => {
      expect(SecurityUtils.generateSecretName('MySecret', 'suffix')).toBe('mysecret-suffix');
    });

    it('should truncate if needed', () => {
      const longName = 'a'.repeat(100);
      const secretName = SecurityUtils.generateSecretName(longName);
      expect(secretName.length).toBeLessThan(64);
    });
  });
});
