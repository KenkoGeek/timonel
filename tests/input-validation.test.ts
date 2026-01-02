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

function isValidPolicyConfig(value: unknown): value is PolicyConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.rules)
  );
}

function isValidPolicyRule(value: unknown): value is PolicyRule {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isRecord(value.condition)
  );
}

function isValidPolicyContext(value: unknown): value is PolicyContext {
  return isRecord(value);
}

function isValidPluginConfig(value: unknown): value is PluginConfig {
  return isRecord(value) && typeof value.name === 'string';
}

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
        id: 'test<script>alert("xss")</script>',
        name: 'Test javascript:void(0)',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(maliciousConfig);
      expect(result.id).not.toContain('<script>');
      expect(result.name).not.toContain('javascript:');
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
        environment: 'prod<script>alert("xss")</script>',
        data: { key: 'value javascript:void(0)' },
      };

      const result: PolicyContext = validator.validatePolicyContext(maliciousContext);
      expect(result.environment).not.toContain('<script>');

      // Type-safe access to nested data with proper validation
      if (
        isRecord(result.data) &&
        hasProperty(result.data, 'key') &&
        typeof result.data.key === 'string'
      ) {
        expect(result.data.key).not.toContain('javascript:');
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
        id: 'test<script>',
        name: 'Test',
        rules: [],
      });

      expect(result.id).toBe('test<script>');
    });
  });

  describe('Security Tests', (): void => {
    it('should remove script tags', (): void => {
      const maliciousInput = {
        id: 'test<script>alert("xss")</script>',
        name: 'Test',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).not.toContain('<script>');
      expect(result.id).not.toContain('alert');
    });

    it('should remove javascript protocols', (): void => {
      const maliciousInput = {
        id: 'javascript:alert("xss")',
        name: 'Test',
        rules: [],
      };

      const result: PolicyConfig = validator.validatePolicyConfig(maliciousInput);
      expect(result.id).not.toContain('javascript:');
    });

    // NEW COMPREHENSIVE SECURITY TESTS FOR PR-249 FIXES
    describe('PR-249 Security Vulnerability Fixes', (): void => {
      it('should remove dangerous URL schemes including data: and vbscript:', (): void => {
        const maliciousInputs = [
          { id: 'data:text/html,<script>alert(1)</script>', name: 'Test', rules: [] },
          { id: 'vbscript:alert(1)', name: 'Test', rules: [] },
          { id: 'VBSCRIPT:alert(1)', name: 'Test', rules: [] },
          { id: 'DATA:text/html,<script>alert(1)</script>', name: 'Test', rules: [] },
        ];

        maliciousInputs.forEach((input) => {
          const result: PolicyConfig = validator.validatePolicyConfig(input);
          expect(result.id).not.toContain('data:');
          expect(result.id).not.toContain('vbscript:');
          expect(result.id).not.toContain('DATA:');
          expect(result.id).not.toContain('VBSCRIPT:');
        });
      });

      it('should remove event handlers comprehensively', (): void => {
        const maliciousInputs = [
          { id: 'onclick="alert(1)"', name: 'Test', rules: [] },
          { id: 'onload="alert(1)"', name: 'Test', rules: [] },
          { id: 'onerror="alert(1)"', name: 'Test', rules: [] },
          { id: 'onmouseover="alert(1)"', name: 'Test', rules: [] },
          { id: 'ONCLICK="alert(1)"', name: 'Test', rules: [] },
        ];

        maliciousInputs.forEach((input) => {
          const result: PolicyConfig = validator.validatePolicyConfig(input);
          expect(result.id).not.toMatch(/on\w+\s*=/i);
        });
      });

      it('should remove script tags with spaces and variations', (): void => {
        const maliciousInputs = [
          { id: '<script>alert(1)</script>', name: 'Test', rules: [] },
          { id: '<script >alert(1)</script >', name: 'Test', rules: [] },
          { id: '<SCRIPT>alert(1)</SCRIPT>', name: 'Test', rules: [] },
          { id: '< script>alert(1)</ script>', name: 'Test', rules: [] },
          { id: '<script type="text/javascript">alert(1)</script>', name: 'Test', rules: [] },
        ];

        maliciousInputs.forEach((input) => {
          const result: PolicyConfig = validator.validatePolicyConfig(input);
          expect(result.id).not.toMatch(/<\s*script[^>]*>/i);
          expect(result.id).not.toMatch(/<\s*\/\s*script\s*>/i);
          expect(result.id).not.toContain('alert(1)');
        });
      });

      it('should prevent bypass attempts with multi-pass sanitization', (): void => {
        const bypassAttempts = [
          { id: '<scr<script>ipt>alert(1)</script>', name: 'Test', rules: [] },
          { id: 'jajavascript:vascript:alert(1)', name: 'Test', rules: [] },
          { id: 'on<click>="alert(1)"', name: 'Test', rules: [] },
          { id: 'da<data:>ta:text/html,<script>alert(1)</script>', name: 'Test', rules: [] },
        ];

        bypassAttempts.forEach((input) => {
          const result: PolicyConfig = validator.validatePolicyConfig(input);
          expect(result.id).not.toContain('script');
          expect(result.id).not.toContain('javascript:');
          expect(result.id).not.toContain('data:');
          expect(result.id).not.toMatch(/on\w+\s*=/i);
          expect(result.id).not.toContain('alert(1)');
        });
      });

      it('should handle complex nested injection attempts', (): void => {
        const complexInput = {
          id: 'test',
          name: 'Complex<script>alert("nested")</script>Test',
          rules: [
            {
              id: 'rule<script>alert(1)</script>',
              type: 'security',
              condition: {
                field: 'onclick="alert(2)"',
                value: 'data:text/html,<script>alert(3)</script>',
                nested: {
                  deep: 'vbscript:alert(4)',
                },
              },
            },
          ],
        };

        const result: PolicyConfig = validator.validatePolicyConfig(complexInput);

        // Check all levels are sanitized
        expect(result.name).not.toContain('<script>');
        expect(result.rules[0]?.id).not.toContain('<script>');

        if (isValidPolicyRule(result.rules[0])) {
          const condition = result.rules[0].condition;
          if (hasProperty(condition, 'field') && typeof condition.field === 'string') {
            expect(condition.field).not.toMatch(/on\w+\s*=/i);
          }
          if (hasProperty(condition, 'value') && typeof condition.value === 'string') {
            expect(condition.value).not.toContain('data:');
          }
          if (
            hasProperty(condition, 'nested') &&
            isRecord(condition.nested) &&
            hasProperty(condition.nested, 'deep') &&
            typeof condition.nested.deep === 'string'
          ) {
            expect(condition.nested.deep).not.toContain('vbscript:');
          }
        }
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
          items: ['item1', 'item2<script>alert(1)</script>'],
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
          expect(items[1]).not.toContain('<script>');
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
