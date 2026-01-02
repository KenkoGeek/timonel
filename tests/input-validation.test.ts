/**
 * Input Validation Tests
 *
 * Tests for comprehensive input validation to prevent injection attacks
 * and malformed data processing in the Policy Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { InputValidator } from '../src/lib/validation/inputValidator';
import { PolicyValidationError } from '../src/lib/policy/errors';

describe('InputValidator', () => {
  let validator: InputValidator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('PolicyConfig Validation', () => {
    it('should validate a valid PolicyConfig', () => {
      const validConfig = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            id: 'rule-1',
            type: 'security',
            condition: { field: 'value' },
          },
        ],
      };

      const result = validator.validatePolicyConfig(validConfig);
      expect(result.id).toBe('test-policy');
      expect(result.name).toBe('Test Policy');
      expect(result.rules).toHaveLength(1);
    });

    it('should reject null or undefined config', () => {
      expect(() => validator.validatePolicyConfig(null)).toThrow(PolicyValidationError);
      expect(() => validator.validatePolicyConfig(undefined)).toThrow(PolicyValidationError);
    });

    it('should reject config without required fields', () => {
      expect(() => validator.validatePolicyConfig({})).toThrow(
        'PolicyConfig.id must be a non-empty string',
      );
      expect(() => validator.validatePolicyConfig({ id: 'test' })).toThrow(
        'PolicyConfig.name must be a non-empty string',
      );
      expect(() => validator.validatePolicyConfig({ id: 'test', name: 'Test' })).toThrow(
        'PolicyConfig.rules must be an array',
      );
    });

    it('should reject config with invalid field types', () => {
      expect(() => validator.validatePolicyConfig({ id: 123, name: 'Test', rules: [] })).toThrow(
        PolicyValidationError,
      );
      expect(() => validator.validatePolicyConfig({ id: 'test', name: 123, rules: [] })).toThrow(
        PolicyValidationError,
      );
      expect(() =>
        validator.validatePolicyConfig({ id: 'test', name: 'Test', rules: 'not-array' }),
      ).toThrow(PolicyValidationError);
    });

    it('should enforce string length limits', () => {
      const longString = 'a'.repeat(20000);
      expect(() =>
        validator.validatePolicyConfig({
          id: longString,
          name: 'Test',
          rules: [],
        }),
      ).toThrow('exceeds maximum length');
    });

    it('should enforce array length limits', () => {
      const manyRules = Array(2000).fill({
        id: 'rule',
        type: 'test',
        condition: {},
      });
      expect(() =>
        validator.validatePolicyConfig({
          id: 'test',
          name: 'Test',
          rules: manyRules,
        }),
      ).toThrow('exceeds maximum length');
    });

    it('should sanitize strings when enabled', () => {
      const maliciousConfig = {
        id: 'test<script>alert("xss")</script>',
        name: 'Test javascript:void(0)',
        rules: [],
      };

      const result = validator.validatePolicyConfig(maliciousConfig);
      expect(result.id).not.toContain('<script>');
      expect(result.name).not.toContain('javascript:');
    });
  });

  describe('PolicyRule Validation', () => {
    it('should validate a valid PolicyRule', () => {
      const validRule = {
        id: 'test-rule',
        type: 'security',
        condition: { field: 'value' },
      };

      const result = validator.validatePolicyRule(validRule);
      expect(result.id).toBe('test-rule');
      expect(result.type).toBe('security');
      expect(result.condition).toEqual({ field: 'value' });
    });

    it('should reject rule without required fields', () => {
      expect(() => validator.validatePolicyRule({})).toThrow(
        'PolicyRule.id must be a non-empty string',
      );
      expect(() => validator.validatePolicyRule({ id: 'test' })).toThrow(
        'PolicyRule.type must be a non-empty string',
      );
      expect(() => validator.validatePolicyRule({ id: 'test', type: 'security' })).toThrow(
        'PolicyRule.condition must be an object',
      );
    });

    it('should enforce object depth limits', () => {
      const deepCondition = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    level7: {
                      level8: {
                        level9: {
                          level10: {
                            level11: {
                              level12: 'too deep',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      expect(() =>
        validator.validatePolicyRule({
          id: 'test',
          type: 'security',
          condition: deepCondition,
        }),
      ).toThrow('exceeds maximum object depth');
    });
  });

  describe('PolicyContext Validation', () => {
    it('should validate a valid PolicyContext', () => {
      const validContext = {
        environment: 'production',
        metadata: { version: '1.0.0' },
      };

      const result = validator.validatePolicyContext(validContext);
      expect(result.environment).toBe('production');
      expect(result.metadata).toEqual({ version: '1.0.0' });
    });

    it('should reject null or non-object context', () => {
      expect(() => validator.validatePolicyContext(null)).toThrow(PolicyValidationError);
      expect(() => validator.validatePolicyContext('string')).toThrow(PolicyValidationError);
    });

    it('should sanitize context strings', () => {
      const maliciousContext = {
        environment: 'prod<script>alert("xss")</script>',
        data: { key: 'value javascript:void(0)' },
      };

      const result = validator.validatePolicyContext(maliciousContext);
      expect(result.environment).not.toContain('<script>');
      expect((result.data as Record<string, unknown>).key).not.toContain('javascript:');
    });
  });

  describe('PluginConfig Validation', () => {
    it('should validate a valid PluginConfig', () => {
      const validConfig = {
        name: 'test-plugin',
        version: '1.0.0',
        config: { setting: 'value' },
      };

      const result = validator.validatePluginConfig(validConfig);
      expect(result.name).toBe('test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.config).toEqual({ setting: 'value' });
    });

    it('should reject config without required name', () => {
      expect(() => validator.validatePluginConfig({})).toThrow(
        'PluginConfig.name must be a non-empty string',
      );
      expect(() => validator.validatePluginConfig({ name: 123 })).toThrow(
        'PluginConfig.name must be a non-empty string',
      );
    });
  });

  describe('Custom Validation Options', () => {
    it('should respect custom string length limits', () => {
      const customValidator = new InputValidator({ maxStringLength: 10 });

      expect(() =>
        customValidator.validatePolicyConfig({
          id: 'this-is-too-long',
          name: 'Test',
          rules: [],
        }),
      ).toThrow('exceeds maximum length of 10 characters');
    });

    it('should respect custom array length limits', () => {
      const customValidator = new InputValidator({ maxArrayLength: 2 });

      expect(() =>
        customValidator.validatePolicyConfig({
          id: 'test',
          name: 'Test',
          rules: [
            { id: '1', type: 'a', condition: {} },
            { id: '2', type: 'b', condition: {} },
            { id: '3', type: 'c', condition: {} },
          ],
        }),
      ).toThrow('exceeds maximum length of 2 items');
    });

    it('should respect custom object depth limits', () => {
      const customValidator = new InputValidator({ maxObjectDepth: 2 });

      expect(() =>
        customValidator.validatePolicyRule({
          id: 'test',
          type: 'security',
          condition: { level1: { level2: { level3: { level4: 'too deep' } } } },
        }),
      ).toThrow('exceeds maximum object depth of 2');
    });

    it('should allow disabling string sanitization', () => {
      const customValidator = new InputValidator({ sanitizeStrings: false });

      const result = customValidator.validatePolicyConfig({
        id: 'test<script>',
        name: 'Test',
        rules: [],
      });

      expect(result.id).toBe('test<script>');
    });
  });

  describe('Security Tests', () => {
    it('should remove script tags', () => {
      const maliciousInput = {
        id: 'test<script>alert("xss")</script>',
        name: 'Test',
        rules: [],
      };

      const result = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).not.toContain('<script>');
      expect(result.id).not.toContain('alert');
    });

    it('should remove javascript protocols', () => {
      const maliciousInput = {
        id: 'javascript:alert("xss")',
        name: 'Test',
        rules: [],
      };

      const result = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousInput = {
        id: 'test onclick="alert(1)"',
        name: 'Test',
        rules: [],
      };

      const result = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).not.toContain('onclick=');
    });

    it('should remove null bytes and control characters', () => {
      const maliciousInput = {
        id: 'test\x00\x01\x02',
        name: 'Test',
        rules: [],
      };

      const result = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).toBe('test');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', () => {
      const config = {
        id: 'test',
        name: 'Test',
        rules: [],
      };

      const result = validator.validatePolicyConfig(config);
      expect(result.rules).toHaveLength(0);
    });

    it('should handle nested arrays in objects', () => {
      const context = {
        data: {
          items: ['item1', 'item2<script>alert(1)</script>'],
        },
      };

      const result = validator.validatePolicyContext(context);
      expect((result.data as Record<string, unknown>).items[1]).not.toContain('<script>');
    });

    it('should handle circular references gracefully', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      // This should not cause infinite recursion
      expect(() => validator.validatePolicyContext(circular)).not.toThrow('Maximum call stack');
    });
  });
});
