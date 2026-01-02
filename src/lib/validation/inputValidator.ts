/**
 * Input validation utilities for the Policy Engine
 * Provides comprehensive validation for all user inputs to prevent
 * injection attacks and malformed data processing
 */

import type { PolicyConfig, PolicyContext, PolicyRule, PluginConfig } from '../../types/index.js';
import { PolicyValidationError } from '../policy/errors.js';

/**
 * Validation configuration options
 */
export interface ValidationOptions {
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectDepth?: number;
  allowedProtocols?: string[];
  sanitizeStrings?: boolean;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
  allowedProtocols: ['http', 'https'],
  sanitizeStrings: true,
};

/**
 * Input validator class for policy engine inputs
 */
export class InputValidator {
  private options: Required<ValidationOptions>;

  constructor(options: ValidationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Validates a PolicyConfig object
   */
  validatePolicyConfig(config: unknown): PolicyConfig {
    if (!config || typeof config !== 'object') {
      throw new PolicyValidationError('PolicyConfig must be a non-null object');
    }

    const typedConfig = config as Record<string, unknown>;

    // Validate required fields
    if (!typedConfig.id || typeof typedConfig.id !== 'string') {
      throw new PolicyValidationError('PolicyConfig.id must be a non-empty string');
    }

    if (!typedConfig.name || typeof typedConfig.name !== 'string') {
      throw new PolicyValidationError('PolicyConfig.name must be a non-empty string');
    }

    if (!Array.isArray(typedConfig.rules)) {
      throw new PolicyValidationError('PolicyConfig.rules must be an array');
    }

    // Validate string lengths
    this.validateStringLength(typedConfig.id as string, 'PolicyConfig.id');
    this.validateStringLength(typedConfig.name as string, 'PolicyConfig.name');

    // Validate array length
    this.validateArrayLength(typedConfig.rules as unknown[], 'PolicyConfig.rules');

    // Validate each rule
    const validatedRules = (typedConfig.rules as unknown[]).map((rule, index) => {
      try {
        return this.validatePolicyRule(rule);
      } catch (error) {
        throw new PolicyValidationError(
          `PolicyConfig.rules[${index}]: ${(error as Error).message}`,
        );
      }
    });

    // Sanitize strings if enabled
    const sanitizedConfig: PolicyConfig = {
      id: this.sanitizeString(typedConfig.id as string),
      name: this.sanitizeString(typedConfig.name as string),
      rules: validatedRules,
      enabled: typeof typedConfig.enabled === 'boolean' ? typedConfig.enabled : true,
    };

    if (typedConfig.description) {
      sanitizedConfig.description = this.sanitizeString(typedConfig.description as string);
    }

    if (typedConfig.version) {
      sanitizedConfig.version = this.sanitizeString(typedConfig.version as string);
    }

    return sanitizedConfig;
  }

  /**
   * Validates a PolicyRule object
   */
  validatePolicyRule(rule: unknown): PolicyRule {
    if (!rule || typeof rule !== 'object') {
      throw new PolicyValidationError('PolicyRule must be a non-null object');
    }

    const typedRule = rule as Record<string, unknown>;

    // Validate required fields
    if (!typedRule.id || typeof typedRule.id !== 'string') {
      throw new PolicyValidationError('PolicyRule.id must be a non-empty string');
    }

    if (!typedRule.type || typeof typedRule.type !== 'string') {
      throw new PolicyValidationError('PolicyRule.type must be a non-empty string');
    }

    if (!typedRule.condition || typeof typedRule.condition !== 'object') {
      throw new PolicyValidationError('PolicyRule.condition must be an object');
    }

    // Validate string lengths
    this.validateStringLength(typedRule.id as string, 'PolicyRule.id');
    this.validateStringLength(typedRule.type as string, 'PolicyRule.type');

    // Validate object depth
    this.validateObjectDepth(
      typedRule.condition as Record<string, unknown>,
      'PolicyRule.condition',
    );

    const sanitizedRule: PolicyRule = {
      id: this.sanitizeString(typedRule.id as string),
      type: this.sanitizeString(typedRule.type as string),
      condition: this.sanitizeObject(typedRule.condition as Record<string, unknown>),
      priority: typeof typedRule.priority === 'number' ? typedRule.priority : 0,
      enabled: typeof typedRule.enabled === 'boolean' ? typedRule.enabled : true,
    };

    if (typedRule.action) {
      sanitizedRule.action = this.sanitizeString(typedRule.action as string);
    }

    return sanitizedRule;
  }
  /**
   * Validates a PolicyContext object
   */
  validatePolicyContext(context: unknown): PolicyContext {
    if (!context || typeof context !== 'object') {
      throw new PolicyValidationError('PolicyContext must be a non-null object');
    }

    const typedContext = context as Record<string, unknown>;

    // Validate object depth
    this.validateObjectDepth(typedContext, 'PolicyContext');

    // Sanitize the entire context object
    return this.sanitizeObject(typedContext) as PolicyContext;
  }

  /**
   * Validates a PluginConfig object
   */
  validatePluginConfig(config: unknown): PluginConfig {
    if (!config || typeof config !== 'object') {
      throw new PolicyValidationError('PluginConfig must be a non-null object');
    }

    const typedConfig = config as Record<string, unknown>;

    // Validate required fields
    if (!typedConfig.name || typeof typedConfig.name !== 'string') {
      throw new PolicyValidationError('PluginConfig.name must be a non-empty string');
    }

    // Validate string lengths
    this.validateStringLength(typedConfig.name as string, 'PluginConfig.name');

    // Validate configuration object if present
    if (typedConfig.config && typeof typedConfig.config === 'object') {
      this.validateObjectDepth(
        typedConfig.config as Record<string, unknown>,
        'PluginConfig.config',
      );
    }

    const sanitizedConfig: PluginConfig = {
      name: this.sanitizeString(typedConfig.name as string),
      enabled: typeof typedConfig.enabled === 'boolean' ? typedConfig.enabled : true,
    };

    if (typedConfig.version) {
      sanitizedConfig.version = this.sanitizeString(typedConfig.version as string);
    }

    if (typedConfig.config) {
      sanitizedConfig.config = this.sanitizeObject(typedConfig.config as Record<string, unknown>);
    }

    return sanitizedConfig;
  }

  /**
   * Validates string length against maximum allowed
   */
  private validateStringLength(value: string, fieldName: string): void {
    if (value.length > this.options.maxStringLength) {
      throw new PolicyValidationError(
        `${fieldName} exceeds maximum length of ${this.options.maxStringLength} characters`,
      );
    }
  }

  /**
   * Validates array length against maximum allowed
   */
  private validateArrayLength(value: unknown[], fieldName: string): void {
    if (value.length > this.options.maxArrayLength) {
      throw new PolicyValidationError(
        `${fieldName} exceeds maximum length of ${this.options.maxArrayLength} items`,
      );
    }
  }

  /**
   * Validates object depth to prevent deeply nested objects
   */
  private validateObjectDepth(
    obj: Record<string, unknown>,
    fieldName: string,
    currentDepth = 0,
  ): void {
    if (currentDepth > this.options.maxObjectDepth) {
      throw new PolicyValidationError(
        `${fieldName} exceeds maximum object depth of ${this.options.maxObjectDepth}`,
      );
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.validateObjectDepth(
          value as Record<string, unknown>,
          `${fieldName}.${key}`,
          currentDepth + 1,
        );
      }
    }
  }

  /**
   * Sanitizes a string by removing potentially dangerous characters
   * Focuses on policy configuration validation, not HTML sanitization
   */
  private sanitizeString(value: string): string {
    if (!this.options.sanitizeStrings) {
      return value;
    }

    // Remove null bytes and control characters only
    let sanitized = value
      .replace(/\0/g, '') // Remove null bytes
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code > 31 && code !== 127; // Keep printable characters only
      })
      .join('');

    // Remove only genuinely dangerous patterns for policy configurations
    // No HTML sanitization needed - these are policy configs, not web content
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitizes an object recursively
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);

      if (typeof value === 'string') {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[sanitizedKey] = this.sanitizeObject(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[sanitizedKey] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizeString(item)
            : typeof item === 'object' && item !== null
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
        );
      } else {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Default input validator instance
 */
export const defaultValidator = new InputValidator();

/**
 * Convenience functions for common validation scenarios
 */
export const validatePolicyConfig = (config: unknown): PolicyConfig =>
  defaultValidator.validatePolicyConfig(config);

export const validatePolicyRule = (rule: unknown): PolicyRule =>
  defaultValidator.validatePolicyRule(rule);

export const validatePolicyContext = (context: unknown): PolicyContext =>
  defaultValidator.validatePolicyContext(context);

export const validatePluginConfig = (config: unknown): PluginConfig =>
  defaultValidator.validatePluginConfig(config);
