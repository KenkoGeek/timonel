/**
 * @fileoverview Security utilities for input validation and sanitization
 * Focused on CLI tool security concerns: path traversal, injection prevention
 * @since 2.2.0
 */

import * as path from 'path';

import {
  SECURITY_ERROR_MESSAGES,
  SECURITY_WARNING_MESSAGES,
  DANGEROUS_IMAGE_TAGS,
  VALIDATION_PATTERNS,
  LENGTH_LIMITS,
} from './constants.js';

/**
 * Security utilities for input validation and sanitization
 * Focused on CLI tool security concerns: path traversal, injection prevention
 *
 * @since 2.2.0
 */
export class SecurityUtils {
  /**
   * Validates and sanitizes file paths to prevent path traversal attacks
   * @param inputPath - The path to validate
   * @param allowedBasePath - The base path that the input should be within
   * @returns Sanitized path if valid
   * @throws Error if path is invalid or contains traversal sequences
   *
   * @since 2.2.0
   */
  static validatePath(inputPath: string, allowedBasePath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error(SECURITY_ERROR_MESSAGES.INVALID_PATH);
    }

    // Check for path traversal sequences
    if (
      inputPath.includes('../') ||
      inputPath.includes('..\\') ||
      inputPath.includes('%2e%2e%2f') ||
      inputPath.includes('%2e%2e%5c')
    ) {
      throw new Error(SECURITY_ERROR_MESSAGES.PATH_TRAVERSAL);
    }

    // Resolve and normalize paths
    const resolvedInput = path.resolve(inputPath);
    const resolvedBase = path.resolve(allowedBasePath);

    // Ensure the resolved path is within the allowed base path
    if (!resolvedInput.startsWith(resolvedBase + path.sep) && resolvedInput !== resolvedBase) {
      throw new Error(SECURITY_ERROR_MESSAGES.PATH_OUTSIDE_BASE(resolvedBase));
    }

    return resolvedInput;
  }

  /**
   * Sanitizes log messages to prevent log injection attacks
   * @param message - The message to sanitize
   * @returns Sanitized message with control characters removed
   *
   * @since 2.2.0
   */
  static sanitizeLogMessage(message: string): string {
    if (typeof message !== 'string') {
      return String(message);
    }

    // Remove control characters (ASCII 0-31 and 127) and normalize line endings
    return (
      message
        // eslint-disable-next-line no-control-regex -- Intentionally removing control characters for security
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r\n/g, ' ') // Replace CRLF with space
        .replace(/[\r\n]/g, ' ') // Replace remaining CR/LF with space
        .trim()
    );
  }

  /**
   * Sanitizes environment names to prevent path traversal (CWE-22)
   * @param env - Environment name to sanitize
   * @returns Sanitized environment name
   * @throws Error if environment name is invalid
   *
   * @since 2.2.0
   */
  static sanitizeEnvironmentName(env: string): string {
    if (!env || typeof env !== 'string') {
      throw new Error(SECURITY_ERROR_MESSAGES.ENVIRONMENT_NAME_INVALID);
    }

    // Allow only alphanumeric, hyphens, and underscores
    const sanitized = env.replace(/[^a-zA-Z0-9-_]/g, '');

    if (sanitized !== env) {
      throw new Error(
        SECURITY_ERROR_MESSAGES.ENVIRONMENT_NAME_INVALID_FORMAT(this.sanitizeLogMessage(env)),
      );
    }

    if (sanitized.length === 0 || sanitized.length > LENGTH_LIMITS.ENVIRONMENT_NAME) {
      throw new Error(SECURITY_ERROR_MESSAGES.ENVIRONMENT_NAME_INVALID_LENGTH);
    }

    return sanitized;
  }

  /**
   * Validates TypeScript file extensions for dynamic imports
   * @param filePath - The file path to validate
   * @returns True if the file has a valid TypeScript extension
   *
   * @since 2.2.0
   */
  static isValidTypeScriptFile(filePath: string): boolean {
    const allowedExtensions = ['.ts', '.tsx'];
    const ext = path.extname(filePath);
    return allowedExtensions.includes(ext);
  }

  /**
   * Validates Helm template path syntax
   * @param templatePath - The template path to validate
   * @returns True if the path is valid for Helm templates
   *
   * @since 2.2.0
   */
  static isValidHelmTemplatePath(templatePath: string): boolean {
    if (!templatePath || typeof templatePath !== 'string') {
      return false;
    }

    // Check for empty string or only whitespace
    if (templatePath.trim().length === 0) {
      return false;
    }

    // Check for template injection patterns
    if (templatePath.includes('{{') || templatePath.includes('}}')) {
      return false;
    }

    // Check for dangerous characters that could break Helm templates
    if (this.hasDangerousCharacters(templatePath)) {
      return false;
    }

    // Check for control characters
    if (this.hasControlCharacters(templatePath)) {
      return false;
    }

    // Validate dot notation path structure
    return this.validatePathSegments(templatePath);
  }

  /**
   * Checks for dangerous characters in template path
   * @param path - Path to check
   * @returns True if dangerous characters found
   * @since 2.9.0
   */
  private static hasDangerousCharacters(path: string): boolean {
    const dangerousChars = /[<>'"\\`${}()[\]|&;]/;
    return dangerousChars.test(path);
  }

  /**
   * Checks for control characters in template path
   * @param path - Path to check
   * @returns True if control characters found
   * @since 2.9.0
   */
  private static hasControlCharacters(path: string): boolean {
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      if (code < 32 || code === 127) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validates path segments in dot notation
   * @param path - Path to validate
   * @returns True if all segments are valid
   * @since 2.9.0
   */
  private static validatePathSegments(path: string): boolean {
    // Overall path length limit
    if (path.length > 253) {
      return false;
    }

    const pathSegments = path.split('.');

    // Each segment must be valid
    for (const segment of pathSegments) {
      if (!this.isValidPathSegment(segment)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates individual path segment
   * @param segment - Segment to validate
   * @returns True if segment is valid
   * @since 2.9.0
   */
  private static isValidPathSegment(segment: string): boolean {
    if (!segment || segment.length === 0) {
      return false;
    }

    // Segment can be numeric (for array indices) or start with letter/underscore
    if (!/^[a-zA-Z_0-9]/.test(segment)) {
      return false;
    }

    // Segment can only contain alphanumeric, underscore, and hyphen
    if (!/^[a-zA-Z_0-9][a-zA-Z0-9_-]*$/.test(segment)) {
      return false;
    }

    // Reasonable length limit per segment
    if (segment.length > 63) {
      return false;
    }

    return true;
  }

  /**
   * Validates chart names according to Helm conventions
   * @param chartName - Chart name to validate
   * @returns True if chart name follows Helm naming rules
   *
   * @since 2.2.0
   */
  static isValidChartName(chartName: string): boolean {
    if (!chartName || typeof chartName !== 'string') {
      return false;
    }

    // Helm chart name validation (RFC 1123 subdomain) - safe regex
    return (
      VALIDATION_PATTERNS.KUBERNETES_NAME.test(chartName) &&
      chartName.length <= LENGTH_LIMITS.KUBERNETES_NAME
    );
  }

  /**
   * Validates subchart names according to Helm conventions
   * @param subchartName - Subchart name to validate
   * @returns True if subchart name is valid
   *
   * @since 2.2.0
   */
  static isValidSubchartName(subchartName: string): boolean {
    return this.isValidChartName(subchartName);
  }

  /**
   * Sanitizes environment variable names and values for Kubernetes security
   * Prevents injection attacks and ensures compliance with Kubernetes naming rules
   * @param name - Environment variable name to sanitize
   * @param value - Environment variable value to sanitize
   * @returns Object with sanitized name and value
   * @throws Error if name or value contains dangerous patterns
   *
   * @since 2.6.0
   */
  static sanitizeEnvVar(name: string, value: string): { name: string; value: string } {
    if (!name || typeof name !== 'string') {
      throw new Error(SECURITY_ERROR_MESSAGES.INVALID_ENV_NAME);
    }

    if (typeof value !== 'string') {
      throw new Error(SECURITY_ERROR_MESSAGES.INVALID_ENV_VALUE);
    }

    // Kubernetes env var name validation (RFC 1123 compatible)
    let sanitizedName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    // Ensure name starts with letter or underscore
    if (/^[0-9]/.test(sanitizedName)) {
      sanitizedName = `_${sanitizedName}`;
    }

    if (!VALIDATION_PATTERNS.ENV_VAR_NAME.test(sanitizedName)) {
      throw new Error(
        SECURITY_ERROR_MESSAGES.ENV_NAME_INVALID_FORMAT(this.sanitizeLogMessage(name)),
      );
    }

    // Enhanced dangerous pattern detection with nested command injection prevention
    const dangerousPattern = this.detectDangerousPatterns(value);
    if (dangerousPattern) {
      throw new Error(
        SECURITY_ERROR_MESSAGES.ENV_VALUE_DANGEROUS_PATTERN(
          dangerousPattern,
          this.sanitizeLogMessage(value),
        ),
      );
    }

    // Limit value length to prevent DoS
    if (value.length > LENGTH_LIMITS.ENV_VAR_VALUE) {
      throw new Error(SECURITY_ERROR_MESSAGES.ENV_VALUE_TOO_LONG);
    }

    return {
      name: sanitizedName,
      value: value.trim(),
    };
  }

  /**
   * Enhanced dangerous pattern detection with nested command injection prevention
   * @param value - String to check for dangerous patterns
   * @returns Pattern name if dangerous pattern detected, null otherwise
   * @since 2.9.0
   */
  private static detectDangerousPatterns(value: string): string | null {
    // Check for nested command substitution patterns
    if (this.hasNestedCommandSubstitution(value)) return 'nested command substitution';
    if (this.hasNestedBacktickExecution(value)) return 'nested backtick execution';
    if (this.hasNestedVariableExpansion(value)) return 'nested variable expansion';

    // Basic patterns
    if (value.includes('$(') && value.includes(')')) return 'command substitution';
    if (value.includes('`')) return 'backtick execution';
    if (value.includes('${') && value.includes('}')) return 'variable expansion';

    // Check for control characters
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f
      ) {
        return 'control characters';
      }
    }

    // Check for shell metacharacters that could enable injection
    if (this.hasShellMetacharacters(value)) return 'shell metacharacters';

    return null;
  }

  /**
   * Detects shell metacharacters that could enable command injection
   * @param value - String to check
   * @returns True if shell metacharacters found
   * @since 2.9.0
   */
  private static hasShellMetacharacters(value: string): boolean {
    const shellMetachars = ['|', '&', ';', '(', ')', '<', '>', '?', '*', '[', ']', '{', '}'];
    return shellMetachars.some((char) => value.includes(char));
  }

  /**
   * Detects nested command substitution patterns like $(command $(nested))
   * @param value - String to check for nested patterns
   * @returns True if nested command substitution is detected
   * @since 2.9.0
   */
  private static hasNestedCommandSubstitution(value: string): boolean {
    let depth = 0;
    let inSubstitution = false;

    for (let i = 0; i < value.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      if (value[i] === '$' && value[i + 1] === '(') {
        if (inSubstitution) return true; // Nested pattern detected
        inSubstitution = true;
        depth = 1;
        i++; // Skip the '('
        // eslint-disable-next-line security/detect-object-injection
      } else if (inSubstitution && value[i] === '(') {
        depth++;
        // eslint-disable-next-line security/detect-object-injection
      } else if (inSubstitution && value[i] === ')') {
        depth--;
        if (depth === 0) inSubstitution = false;
      }
    }
    return false;
  }

  /**
   * Detects nested backtick execution patterns like `command `nested` `
   * @param value - String to check for nested patterns
   * @returns True if nested backtick execution is detected
   * @since 2.9.0
   */
  private static hasNestedBacktickExecution(value: string): boolean {
    let inBacktick = false;

    for (let i = 0; i < value.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      if (value[i] === '`') {
        if (inBacktick) {
          inBacktick = false;
        } else {
          // Check for nested pattern in remaining string
          if (this.hasNestedBacktickInSubstring(value, i)) {
            return true;
          }
          inBacktick = true;
        }
      }
    }
    return false;
  }

  /**
   * Helper method to check for nested backticks in substring
   * @param value - Full string
   * @param startIndex - Starting index to check from
   * @returns True if nested backtick found
   * @since 2.9.0
   */
  private static hasNestedBacktickInSubstring(value: string, startIndex: number): boolean {
    for (let j = startIndex + 1; j < value.length; j++) {
      // eslint-disable-next-line security/detect-object-injection
      if (value[j] === '`') {
        // Found potential nested pattern
        const inner = value.substring(startIndex + 1, j);
        return inner.includes('`');
      }
    }
    return false;
  }

  /**
   * Detects nested variable expansion patterns like ${var${nested}}
   * @param value - String to check for nested patterns
   * @returns True if nested variable expansion is detected
   * @since 2.9.0
   */
  private static hasNestedVariableExpansion(value: string): boolean {
    let depth = 0;
    let inExpansion = false;

    for (let i = 0; i < value.length - 1; i++) {
      // eslint-disable-next-line security/detect-object-injection
      if (value[i] === '$' && value[i + 1] === '{') {
        if (inExpansion) return true; // Nested pattern detected
        inExpansion = true;
        depth = 1;
        i++; // Skip the '{'
        // eslint-disable-next-line security/detect-object-injection
      } else if (inExpansion && value[i] === '{') {
        depth++;
        // eslint-disable-next-line security/detect-object-injection
      } else if (inExpansion && value[i] === '}') {
        depth--;
        if (depth === 0) inExpansion = false;
      }
    }
    return false;
  }

  /**
   * Validates container image tags for security best practices
   * Prevents use of dangerous tags and ensures proper versioning
   * @param tag - Image tag to validate
   * @returns True if tag is valid and secure
   * @throws Error if tag violates security policies
   *
   * @since 2.6.0
   */
  static validateImageTag(tag: string): boolean {
    if (!tag || typeof tag !== 'string') {
      throw new Error(SECURITY_ERROR_MESSAGES.INVALID_IMAGE_TAG);
    }

    const trimmedTag = tag.trim();

    // Check against expanded list of dangerous or non-specific tags
    if (
      DANGEROUS_IMAGE_TAGS.includes(
        trimmedTag.toLowerCase() as (typeof DANGEROUS_IMAGE_TAGS)[number],
      )
    ) {
      console.warn(SECURITY_WARNING_MESSAGES.DANGEROUS_IMAGE_TAG(trimmedTag));
    }

    // Validate tag format (Docker tag rules)
    if (!VALIDATION_PATTERNS.DOCKER_TAG.test(trimmedTag)) {
      throw new Error(
        SECURITY_ERROR_MESSAGES.IMAGE_TAG_INVALID_FORMAT(this.sanitizeLogMessage(trimmedTag)),
      );
    }

    // Check length limits
    if (trimmedTag.length > LENGTH_LIMITS.IMAGE_TAG) {
      throw new Error(SECURITY_ERROR_MESSAGES.IMAGE_TAG_TOO_LONG);
    }

    // Prefer semantic versioning patterns
    if (
      !VALIDATION_PATTERNS.SEMVER.test(trimmedTag) &&
      !VALIDATION_PATTERNS.HASH.test(trimmedTag) &&
      !VALIDATION_PATTERNS.DATE.test(trimmedTag)
    ) {
      // Warning for non-standard tags but don't fail
      console.warn(SECURITY_WARNING_MESSAGES.NON_STANDARD_IMAGE_TAG(trimmedTag));
    }

    return true;
  }

  /**
   * Generates secure names for Kubernetes secrets
   * Ensures names follow RFC 1123 and are safe for Kubernetes
   * @param baseName - Base name for the secret
   * @param suffix - Optional suffix to append
   * @returns Secure secret name
   * @throws Error if generated name is invalid
   *
   * @since 2.6.0
   */
  static generateSecretName(baseName: string, suffix?: string): string {
    if (!baseName || typeof baseName !== 'string') {
      throw new Error('Base name must be a non-empty string');
    }

    let sanitizedBase = this.sanitizeBaseName(baseName);

    if (suffix) {
      sanitizedBase = this.appendSuffix(sanitizedBase, suffix);
    }

    // Ensure name starts with letter (not number)
    if (/^[0-9]/.test(sanitizedBase)) {
      sanitizedBase = `s${sanitizedBase}`;
    }

    sanitizedBase = this.truncateIfNeeded(sanitizedBase, suffix);

    // Final validation
    if (!this.isValidChartName(sanitizedBase)) {
      throw new Error(`Generated secret name is invalid: ${sanitizedBase}`);
    }

    return sanitizedBase;
  }

  /**
   * Sanitizes the base name for secret generation using safe string methods
   * @param baseName - Base name to sanitize
   * @returns Sanitized base name
   * @throws Error if no valid characters remain
   *
   * @since 2.6.0
   */
  private static sanitizeBaseName(baseName: string): string {
    // Use character-by-character processing instead of regex
    let sanitized = '';
    for (const char of baseName.toLowerCase()) {
      if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-') {
        sanitized += char;
      } else {
        sanitized += '-';
      }
    }

    // Collapse multiple hyphens using split/filter/join
    const parts = sanitized.split('-').filter((part) => part.length > 0);
    sanitized = parts.join('-');

    if (!sanitized) {
      throw new Error('Base name contains no valid characters');
    }

    return sanitized;
  }

  /**
   * Appends suffix to sanitized base name using safe string methods
   * @param baseName - Sanitized base name
   * @param suffix - Suffix to append
   * @returns Base name with suffix
   * @throws Error if suffix is invalid
   *
   * @since 2.6.0
   */
  private static appendSuffix(baseName: string, suffix: string): string {
    if (typeof suffix !== 'string') {
      throw new Error('Suffix must be a string');
    }

    // Use character-by-character processing instead of regex
    let sanitizedSuffix = '';
    for (const char of suffix.toLowerCase()) {
      if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-') {
        sanitizedSuffix += char;
      } else {
        sanitizedSuffix += '-';
      }
    }

    // Collapse multiple hyphens using split/filter/join
    const parts = sanitizedSuffix.split('-').filter((part) => part.length > 0);
    sanitizedSuffix = parts.join('-');

    if (sanitizedSuffix) {
      return `${baseName}-${sanitizedSuffix}`;
    }

    return baseName;
  }

  /**
   * Truncates name if it exceeds length limits
   * @param name - Name to potentially truncate
   * @param suffix - Original suffix for preservation
   * @returns Truncated name if needed
   *
   * @since 2.6.0
   */
  private static truncateIfNeeded(name: string, suffix?: string): string {
    const maxLength = 63;

    if (name.length <= maxLength) {
      return name;
    }

    // Truncate but preserve suffix if possible
    if (suffix) {
      // Use safe character processing instead of regex
      let safeSuffix = '';
      for (const char of suffix.toLowerCase()) {
        if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-') {
          safeSuffix += char;
        } else {
          safeSuffix += '-';
        }
      }
      const suffixPart = `-${safeSuffix}`;
      const maxBaseLength = maxLength - suffixPart.length;

      if (maxBaseLength > 0) {
        return name.substring(0, maxBaseLength) + suffixPart;
      }
    }

    return name.substring(0, maxLength);
  }
}
