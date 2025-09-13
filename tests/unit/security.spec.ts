/**
 * @fileoverview Unit tests for SecurityUtils
 * @since 2.2.0
 */

import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../../src/lib/security';

describe('SecurityUtils', () => {
  describe('sanitizeEnvVar', () => {
    describe('valid inputs', () => {
      it('should allow safe alphanumeric values', () => {
        expect(SecurityUtils.sanitizeEnvVar('production')).toBe('production');
        expect(SecurityUtils.sanitizeEnvVar('app-v1.2.3')).toBe('app-v1.2.3');
        expect(SecurityUtils.sanitizeEnvVar('test123')).toBe('test123');
        expect(SecurityUtils.sanitizeEnvVar('UPPER_CASE')).toBe('UPPER_CASE');
      });

      it('should allow values with safe special characters', () => {
        expect(SecurityUtils.sanitizeEnvVar('app-name')).toBe('app-name');
        expect(SecurityUtils.sanitizeEnvVar('version_1.0')).toBe('version_1.0');
        expect(SecurityUtils.sanitizeEnvVar('path/to/file')).toBe('path/to/file');
      });
    });

    describe('invalid inputs', () => {
      it('should throw error for null or undefined values', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('')).toThrow('Environment variable value must be a non-empty string');
        expect(() => SecurityUtils.sanitizeEnvVar(null as any)).toThrow('Environment variable value must be a non-empty string');
        expect(() => SecurityUtils.sanitizeEnvVar(undefined as any)).toThrow('Environment variable value must be a non-empty string');
      });

      it('should throw error for non-string values', () => {
        expect(() => SecurityUtils.sanitizeEnvVar(123 as any)).toThrow('Environment variable value must be a non-empty string');
        expect(() => SecurityUtils.sanitizeEnvVar({} as any)).toThrow('Environment variable value must be a non-empty string');
      });
    });

    describe('command injection detection', () => {
      it('should detect command substitution patterns', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('$(whoami)')).toThrow('Command injection detected: Command substitution detected');
        expect(() => SecurityUtils.sanitizeEnvVar('$(ls -la)')).toThrow('Command injection detected: Command substitution detected');
        expect(() => SecurityUtils.sanitizeEnvVar('prefix$(command)suffix')).toThrow('Command injection detected: Command substitution detected');
      });

      it('should detect backtick execution patterns', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('`whoami`')).toThrow('Command injection detected: Backtick execution detected');
        expect(() => SecurityUtils.sanitizeEnvVar('`cat /etc/passwd`')).toThrow('Command injection detected: Backtick execution detected');
        expect(() => SecurityUtils.sanitizeEnvVar('prefix`command`suffix')).toThrow('Command injection detected: Backtick execution detected');
      });

      it('should detect variable expansion patterns', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('${HOME}')).toThrow('Command injection detected: Variable expansion detected');
        expect(() => SecurityUtils.sanitizeEnvVar('${PATH}')).toThrow('Command injection detected: Variable expansion detected');
        expect(() => SecurityUtils.sanitizeEnvVar('prefix${VAR}suffix')).toThrow('Command injection detected: Variable expansion detected');
      });

      it('should detect control characters', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('test\x00null')).toThrow('Command injection detected: Control characters detected');
        expect(() => SecurityUtils.sanitizeEnvVar('test\x1Fcontrol')).toThrow('Command injection detected: Control characters detected');
        expect(() => SecurityUtils.sanitizeEnvVar('test\x7Fdel')).toThrow('Command injection detected: Control characters detected');
      });
    });

    describe('nested injection detection', () => {
      it('should detect nested command substitution', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('$(echo $(id))')).toThrow('Nested command injection detected');
        expect(() => SecurityUtils.sanitizeEnvVar('$(cat $(which passwd))')).toThrow('Nested command injection detected');
      });

      it('should detect nested variable expansion', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('${HOME${USER}}')).toThrow('Nested command injection detected');
        expect(() => SecurityUtils.sanitizeEnvVar('${PATH${HOME}}')).toThrow('Nested command injection detected');
      });

      it('should detect nested backtick execution', () => {
        expect(() => SecurityUtils.sanitizeEnvVar('`echo `date``')).toThrow('Nested command injection detected');
        expect(() => SecurityUtils.sanitizeEnvVar('`cat `which ls``')).toThrow('Nested command injection detected');
      });
    });

    describe('edge cases', () => {
      it('should handle empty parentheses and braces safely', () => {
        expect(SecurityUtils.sanitizeEnvVar('text()')).toBe('text()');
        expect(SecurityUtils.sanitizeEnvVar('text{}')).toBe('text{}');
        expect(SecurityUtils.sanitizeEnvVar('text[]')).toBe('text[]');
      });

      it('should handle single characters safely', () => {
        expect(SecurityUtils.sanitizeEnvVar('$')).toBe('$');
        expect(SecurityUtils.sanitizeEnvVar('(')).toBe('(');
        expect(SecurityUtils.sanitizeEnvVar(')')).toBe(')');
        expect(SecurityUtils.sanitizeEnvVar('{')).toBe('{');
        expect(SecurityUtils.sanitizeEnvVar('}')).toBe('}');
      });

      it('should handle incomplete patterns safely', () => {
        expect(SecurityUtils.sanitizeEnvVar('$(')).toBe('$(');
        expect(SecurityUtils.sanitizeEnvVar('${')).toBe('${');
        expect(SecurityUtils.sanitizeEnvVar('`')).toBe('`');
      });
    });
  });

  describe('existing methods', () => {
    it('should validate chart names correctly', () => {
      expect(SecurityUtils.isValidChartName('valid-chart')).toBe(true);
      expect(SecurityUtils.isValidChartName('invalid_chart')).toBe(false);
      expect(SecurityUtils.isValidChartName('Invalid-Chart')).toBe(false);
    });

    it('should sanitize log messages correctly', () => {
      expect(SecurityUtils.sanitizeLogMessage('normal message')).toBe('normal message');
      expect(SecurityUtils.sanitizeLogMessage('message\x00with\x1Fcontrol')).toBe('messagewithcontrol');
    });
  });
});