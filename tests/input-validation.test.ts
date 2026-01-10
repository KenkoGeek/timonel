/**
 * Input Validation Tests
 *
 * Tests for comprehensive input validation to prevent injection attacks
 * and malformed data processing in the Policy Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { InputValidator } from '../src/lib/validation/inputValidator';
import { PolicyValidationError } from '../src/lib/policy/errors';
import type { PolicyConfig, PolicyRule, PolicyContext, PluginConfig } from '../src/types/index';

// Type guard functions for safe type checking
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string');
}

function hasProperty<T extends Record<string, unknown>, K extends string>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return key in obj;
}

// Type guard functions removed as they were unused

describe('InputValidator', (): void => {
  let validator: InputValidator;

  beforeEach((): void => {
    validator = new InputValidator();
  });

  describe('PolicyConfig Validation', (): void => {
    it('should validate a valid PolicyConfig', (): void => {
      const validConfig: PolicyConfig = {
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

      const result: PolicyConfig = validator.validatePolicyConfig(validConfig);
      expect(result.id).toBe('test-policy');
      expect(result.name).toBe('Test Policy');
      expect(result.rules).toHaveLength(1);
    });

    it('should reject null or undefined config', (): void => {
      expect((): PolicyConfig => validator.validatePolicyConfig(null)).toThrow(
        PolicyValidationError,
      );
      expect((): PolicyConfig => validator.validatePolicyConfig(undefined)).toThrow(
        PolicyValidationError,
      );
    });

    it('should reject config without required fields', (): void => {
      expect((): PolicyConfig => validator.validatePolicyConfig({})).toThrow(
        'PolicyConfig.id must be a non-empty string',
      );
      expect((): PolicyConfig => validator.validatePolicyConfig({ id: 'test' })).toThrow(
        'PolicyConfig.name must be a non-empty string',
      );
      expect(
        (): PolicyConfig => validator.validatePolicyConfig({ id: 'test', name: 'Test' }),
      ).toThrow('PolicyConfig.rules must be an array');
    });

    it('should reject config with invalid field types', (): void => {
      expect(
        (): PolicyConfig => validator.validatePolicyConfig({ id: 123, name: 'Test', rules: [] }),
      ).toThrow(PolicyValidationError);
      expect(
        (): PolicyConfig => validator.validatePolicyConfig({ id: 'test', name: 123, rules: [] }),
      ).toThrow(PolicyValidationError);
      expect(
        (): PolicyConfig =>
          validator.validatePolicyConfig({ id: 'test', name: 'Test', rules: 'not-array' }),
      ).toThrow(PolicyValidationError);
    });

    it('should enforce string length limits', (): void => {
      const longString: string = 'a'.repeat(20000);
      expect(
        (): PolicyConfig =>
          validator.validatePolicyConfig({
            id: longString,
            name: 'Test',
            rules: [],
          }),
      ).toThrow('exceeds maximum length');
    });

    it('should enforce array length limits', (): void => {
      const manyRules: PolicyRule[] = Array(2000).fill({
        id: 'rule',
        type: 'test',
        condition: {},
      });
      expect(
        (): PolicyConfig =>
          validator.validatePolicyConfig({
            id: 'test',
            name: 'Test',
            rules: manyRules,
          }),
      ).toThrow('exceeds maximum length');
    });

    it('should sanitize strings when enabled', (): void => {
      const maliciousConfig = {
        id: 'test\x00\x01control-chars',
        name: 'Test\x7Fdelete-char',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(maliciousConfig);
      expect(result.id).toBe('testcontrol-chars');
      expect(result.name).toBe('Testdelete-char');
    });
  });

  describe('PolicyRule Validation', (): void => {
    it('should validate a valid PolicyRule', (): void => {
      const validRule: PolicyRule = {
        id: 'test-rule',
        type: 'security',
        condition: { field: 'value' },
      };

      const result: PolicyRule = validator.validatePolicyRule(validRule);
      expect(result.id).toBe('test-rule');
      expect(result.type).toBe('security');
      expect(result.condition).toEqual({ field: 'value' });
    });

    it('should reject rule without required fields', (): void => {
      expect((): PolicyRule => validator.validatePolicyRule({})).toThrow(
        'PolicyRule.id must be a non-empty string',
      );
      expect((): PolicyRule => validator.validatePolicyRule({ id: 'test' })).toThrow(
        'PolicyRule.type must be a non-empty string',
      );
      expect(
        (): PolicyRule => validator.validatePolicyRule({ id: 'test', type: 'security' }),
      ).toThrow('PolicyRule.condition must be an object');
    });

    it('should enforce object depth limits', (): void => {
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

      expect(
        (): PolicyRule =>
          validator.validatePolicyRule({
            id: 'test',
            type: 'security',
            condition: deepCondition,
          }),
      ).toThrow('exceeds maximum object depth');
    });
  });

  describe('PolicyContext Validation', (): void => {
    it('should validate a valid PolicyContext', (): void => {
      const validContext: PolicyContext = {
        environment: 'production',
        metadata: { version: '1.0.0' },
      };

      const result: PolicyContext = validator.validatePolicyContext(validContext);
      expect(result.environment).toBe('production');
      expect(result.metadata).toEqual({ version: '1.0.0' });
    });

    it('should reject null or non-object context', (): void => {
      expect((): PolicyContext => validator.validatePolicyContext(null)).toThrow(
        PolicyValidationError,
      );
      expect((): PolicyContext => validator.validatePolicyContext('string')).toThrow(
        PolicyValidationError,
      );
    });

    it('should sanitize context strings', (): void => {
      const maliciousContext = {
        environment: 'prod\x00null-byte',
        data: { key: 'value\x01control-char' },
      };

      const result: PolicyContext = validator.validatePolicyContext(maliciousContext);
      expect(result.environment).toBe('prodnull-byte');

      // Type-safe access to nested data with proper validation
      if (
        isRecord(result.data) &&
        hasProperty(result.data, 'key') &&
        typeof result.data.key === 'string'
      ) {
        expect(result.data.key).toBe('valuecontrol-char');
      }
    });
  });

  describe('PluginConfig Validation', (): void => {
    it('should validate a valid PluginConfig', (): void => {
      const validConfig: PluginConfig = {
        name: 'test-plugin',
        version: '1.0.0',
        config: { setting: 'value' },
      };

      const result: PluginConfig = validator.validatePluginConfig(validConfig);
      expect(result.name).toBe('test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.config).toEqual({ setting: 'value' });
    });

    it('should reject config without required name', (): void => {
      expect((): PluginConfig => validator.validatePluginConfig({})).toThrow(
        'PluginConfig.name must be a non-empty string',
      );
      expect((): PluginConfig => validator.validatePluginConfig({ name: 123 })).toThrow(
        'PluginConfig.name must be a non-empty string',
      );
    });
  });

  describe('Custom Validation Options', (): void => {
    it('should respect custom string length limits', (): void => {
      const customValidator: InputValidator = new InputValidator({ maxStringLength: 10 });

      expect(
        (): PolicyConfig =>
          customValidator.validatePolicyConfig({
            id: 'this-is-too-long',
            name: 'Test',
            rules: [],
          }),
      ).toThrow('exceeds maximum length of 10 characters');
    });

    it('should respect custom array length limits', (): void => {
      const customValidator: InputValidator = new InputValidator({ maxArrayLength: 2 });

      const testRules: PolicyRule[] = [
        { id: '1', type: 'a', condition: {} },
        { id: '2', type: 'b', condition: {} },
        { id: '3', type: 'c', condition: {} },
      ];

      expect(
        (): PolicyConfig =>
          customValidator.validatePolicyConfig({
            id: 'test',
            name: 'Test',
            rules: testRules,
          }),
      ).toThrow('exceeds maximum length of 2 items');
    });

    it('should respect custom object depth limits', (): void => {
      const customValidator: InputValidator = new InputValidator({ maxObjectDepth: 2 });

      expect(
        (): PolicyRule =>
          customValidator.validatePolicyRule({
            id: 'test',
            type: 'security',
            condition: { level1: { level2: { level3: { level4: 'too deep' } } } },
          }),
      ).toThrow('exceeds maximum object depth of 2');
    });

    it('should allow disabling string sanitization', (): void => {
      const customValidator: InputValidator = new InputValidator({ sanitizeStrings: false });

      const result: PolicyConfig = customValidator.validatePolicyConfig({
        id: 'test\x00null-byte',
        name: 'Test',
        rules: [],
      });

      expect(result.id).toBe('test\x00null-byte'); // Null byte preserved when sanitization disabled
    });
  });

  describe('Security Tests', (): void => {
    it('should remove control characters', (): void => {
      const maliciousInput = {
        id: 'test\x00null\x01control',
        name: 'Test\x7Fdelete',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).toBe('testnullcontrol');
      expect(result.name).toBe('Testdelete');
    });

    it('should preserve valid policy configuration content', (): void => {
      const validInput = {
        id: 'policy-123',
        name: 'Security Policy <v1.0>',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(validInput);
      expect(result.id).toBe('policy-123');
      expect(result.name).toBe('Security Policy <v1.0>'); // HTML-like content is preserved for policy names
    });

    // NOTE: HTML sanitization tests removed as they are not relevant
    // This validator processes policy configurations, not HTML content
    // The previous tests were based on incorrect CodeQL findings
    describe('Policy Configuration Security', (): void => {
      it('should handle policy names with angle brackets correctly', (): void => {
        const input = {
          id: 'policy-v1.0',
          name: 'Security Policy <Production>',
          rules: [],
        };

        const result: PolicyConfig = validator.validatePolicyConfig(input);
        expect(result.id).toBe('policy-v1.0');
        expect(result.name).toBe('Security Policy <Production>');
      });

      it('should preserve valid policy rule conditions', (): void => {
        const input = {
          id: 'test-policy',
          name: 'Test Policy',
          rules: [
            {
              id: 'rule-1',
              type: 'security',
              condition: {
                field: 'metadata.labels["app.kubernetes.io/name"]',
                operator: 'equals',
                value: 'my-app',
              },
            },
          ],
        };

        const result: PolicyConfig = validator.validatePolicyConfig(input);
        expect(result.rules[0]?.condition).toEqual({
          field: 'metadata.labels["app.kubernetes.io/name"]',
          operator: 'equals',
          value: 'my-app',
        });
      });
    });
  });

  describe('Edge Cases', (): void => {
    it('should handle empty arrays', (): void => {
      const config: PolicyConfig = {
        id: 'test',
        name: 'Test',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(config);
      expect(result.rules).toHaveLength(0);
    });

    it('should handle nested arrays in objects', (): void => {
      const context = {
        data: {
          items: ['item1', 'item2\x00null-byte'],
        },
      };

      const result: PolicyContext = validator.validatePolicyContext(context);

      // Type-safe access to nested array data with proper validation
      if (
        isRecord(result.data) &&
        hasProperty(result.data, 'items') &&
        isStringArray(result.data.items)
      ) {
        const items: string[] = result.data.items;
        if (items.length > 1) {
          expect(items[1]).toBe('item2null-byte');
        }
      }
    });

    it('should handle circular references gracefully', (): void => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      // This should not cause infinite recursion
      expect((): PolicyContext => validator.validatePolicyContext(circular)).not.toThrow(
        'Maximum call stack',
      );
    });
  });
});
