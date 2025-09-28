/**
 * @fileoverview Security utilities for input validation and sanitization
 * Focused on CLI tool security concerns: path traversal, injection prevention
 * @since 2.8.0+
 */

import * as path from 'path';

/** Options controlling path validation behaviour. */
export interface PathValidationOptions {
  /**
   * When true, accepts absolute destinations even if they fall outside the allowed base.
   * @since 2.12.2 Enables secure chart writes to system-level directories.
   */
  allowAbsolute?: boolean;
}

/**
 * Security utilities for input validation and sanitization
 * Focused on CLI tool security concerns: path traversal, injection prevention
 *
 * @since 2.8.0+
 */
export class SecurityUtils {
  /**
   * Validates and sanitizes file paths to prevent path traversal attacks
   * @param inputPath - The path to validate
   * @param allowedBasePath - The base path that the input should be within
   * @returns Sanitized path if valid
   * @throws Error if path is invalid or contains traversal sequences
   *
   * @since 2.8.0+
   */
  static validatePath(
    inputPath: string,
    allowedBasePath: string,
    options?: PathValidationOptions,
  ): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    if (inputPath.includes('\0')) {
      throw new Error('Invalid path: null bytes are not permitted');
    }

    const allowAbsolute = Boolean(options?.allowAbsolute);

    const candidates = new Set<string>();
    const addCandidate = (value: string) => {
      if (typeof value === 'string' && value.length > 0) {
        candidates.add(value);
      }
    };

    addCandidate(inputPath);

    let decoded = inputPath;
    for (let iteration = 0; iteration < 2; iteration += 1) {
      try {
        decoded = decodeURIComponent(decoded);
        addCandidate(decoded);
      } catch {
        break;
      }
    }

    const containsTraversalSequence = (candidate: string): boolean => {
      const lowered = candidate.toLowerCase();
      if (lowered.includes('%2e%2f') || lowered.includes('%2e%5c') || lowered.includes('%2f%2e')) {
        return true;
      }

      const normalized = candidate.replace(/\\+/g, '/');
      const segments = normalized.split('/');
      return segments.some((segment) => segment === '..');
    };

    for (const candidate of candidates) {
      if (containsTraversalSequence(candidate)) {
        throw new Error('Invalid path: path traversal sequences detected');
      }
    }

    // Resolve and normalize paths
    const resolvedInput = path.resolve(inputPath);
    const resolvedBase = path.resolve(allowedBasePath);

    const relativePath = path.relative(resolvedBase, resolvedInput);
    const isInsideBase =
      relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));

    if (!(allowAbsolute && path.isAbsolute(inputPath)) && !isInsideBase) {
      throw new Error(`Invalid path: path must be within ${resolvedBase}`);
    }

    return resolvedInput;
  }

  /**
   * Sanitizes log messages to prevent log injection attacks
   * @param message - The message to sanitize
   * @returns Sanitized message with control characters removed
   *
   * @since 2.8.0+
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
   * @since 2.8.0+
   */
  static sanitizeEnvironmentName(env: string): string {
    if (!env || typeof env !== 'string') {
      throw new Error('Environment name must be a non-empty string');
    }

    // Allow only alphanumeric, hyphens, and underscores
    const sanitized = env.replace(/[^a-zA-Z0-9-_]/g, '');

    if (sanitized !== env) {
      throw new Error(`Invalid environment name: ${this.sanitizeLogMessage(env)}`);
    }

    if (sanitized.length === 0 || sanitized.length > 63) {
      throw new Error('Environment name must be 1-63 characters long');
    }

    return sanitized;
  }

  /**
   * Validates TypeScript file extensions for dynamic imports
   * @param filePath - The file path to validate
   * @returns True if the file has a valid TypeScript extension
   *
   * @since 2.8.0+
   */
  static isValidTypeScriptFile(filePath: string): boolean {
    const allowedExtensions = ['.ts', '.tsx', '.cts', '.mts'];
    const ext = path.extname(filePath);
    return allowedExtensions.includes(ext);
  }

  /**
   * Validates if a path is safe for use in Helm templates
   * Enhanced validation with better security checks and Helm best practices
   * @param templatePath - The template path to validate
   * @returns True if the path is valid for Helm templates
   *
   * @since 2.8.0+
   */
  static isValidHelmTemplatePath(templatePath: string): boolean {
    if (!templatePath || typeof templatePath !== 'string') {
      return false;
    }

    // Check length limits (reasonable for Helm paths)
    if (templatePath.length > 253) {
      return false;
    }

    // Enhanced validation following Kubernetes naming conventions
    // Check if starts and ends with alphanumeric
    if (!/^[a-zA-Z0-9]/.test(templatePath) || !/[a-zA-Z0-9]$/.test(templatePath)) {
      return false;
    }

    // Check for valid characters only (safe regex)
    if (!/^[a-zA-Z0-9._-]+$/.test(templatePath)) {
      return false;
    }

    // Additional security checks
    // Prevent path traversal attempts
    if (templatePath.includes('..') || templatePath.includes('//')) {
      return false;
    }

    // Prevent reserved words that could cause issues
    const reservedWords = ['nil', 'null', 'undefined', 'true', 'false'];
    const pathSegments = templatePath.split('.');

    for (const segment of pathSegments) {
      if (reservedWords.includes(segment.toLowerCase())) {
        return false;
      }

      // Each segment should not be empty
      if (segment.length === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates chart names according to Helm conventions
   * @param chartName - Chart name to validate
   * @returns True if chart name follows Helm naming rules
   *
   * @since 2.8.0+
   */
  static isValidChartName(chartName: string): boolean {
    if (!chartName || typeof chartName !== 'string') {
      return false;
    }

    // Helm chart name validation (RFC 1123 subdomain) - safe regex
    // Must start with a letter, can contain letters, numbers, and hyphens
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple character class regex is safe
    const chartNameRegex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return chartNameRegex.test(chartName) && chartName.length <= 63;
  }

  /**
   * Validates subchart names according to Helm conventions
   * @param subchartName - Subchart name to validate
   * @returns True if subchart name is valid
   *
   * @since 2.8.0+
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
   * @since 2.8.0+
   */
  static sanitizeEnvVar(name: string, value: string): { name: string; value: string } {
    if (!name || typeof name !== 'string') {
      throw new Error('Environment variable name must be a non-empty string');
    }

    if (typeof value !== 'string') {
      throw new Error('Environment variable value must be a string');
    }

    // Kubernetes env var name validation (RFC 1123 compatible)
    let sanitizedName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    // Ensure name starts with letter or underscore
    if (/^[0-9]/.test(sanitizedName)) {
      sanitizedName = `_${sanitizedName}`;
    }

    const nameRegex = /^[A-Z_][A-Z0-9_]*$/;
    if (!nameRegex.test(sanitizedName)) {
      throw new Error(`Invalid environment variable name: ${this.sanitizeLogMessage(name)}`);
    }

    // Check for dangerous patterns in value using safer string methods
    const hasDangerousPattern = (val: string): string | null => {
      if (val.includes('$(') && val.includes(')')) return 'command substitution';
      if (val.includes('`')) return 'backtick execution';
      if (val.includes('${') && val.includes('}')) return 'variable expansion';
      // Check for control characters
      for (let i = 0; i < val.length; i++) {
        const code = val.charCodeAt(i);
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
      return null;
    };

    const dangerousPattern = hasDangerousPattern(value);
    if (dangerousPattern) {
      throw new Error(
        `Environment variable value contains dangerous pattern (${dangerousPattern}): ${this.sanitizeLogMessage(value)}`,
      );
    }

    // Limit value length to prevent DoS
    if (value.length > 32768) {
      throw new Error('Environment variable value exceeds maximum length (32KB)');
    }

    return {
      name: sanitizedName,
      value: value.trim(),
    };
  }

  /**
   * Validates container image tags for security best practices
   * Prevents use of dangerous tags and ensures proper versioning
   * @param tag - Image tag to validate
   * @returns True if tag is valid and secure
   * @throws Error if tag violates security policies
   *
   * @since 2.8.0+
   */
  static validateImageTag(tag: string): boolean {
    if (!tag || typeof tag !== 'string') {
      throw new Error('Image tag must be a non-empty string');
    }

    const trimmedTag = tag.trim();

    // Reject dangerous or non-specific tags
    const dangerousTags = ['latest', 'master', 'main', 'dev', 'development', 'test', 'staging'];
    if (dangerousTags.includes(trimmedTag.toLowerCase())) {
      throw new Error(
        `Insecure image tag detected: '${trimmedTag}'. Use specific version tags for security.`,
      );
    }

    // Validate tag format (Docker tag rules)
    const tagRegex = /^[a-zA-Z0-9._-]+$/;
    if (!tagRegex.test(trimmedTag)) {
      throw new Error(`Invalid image tag format: ${this.sanitizeLogMessage(trimmedTag)}`);
    }

    // Check length limits
    if (trimmedTag.length > 128) {
      throw new Error('Image tag exceeds maximum length (128 characters)');
    }

    // Prefer semantic versioning patterns
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple regex patterns are safe for validation
    const semverPattern = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    const hashPattern = /^[a-f0-9]{7,64}$/;
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple date pattern is safe for validation
    const datePattern = /^\d{4}-\d{2}-\d{2}(-[a-zA-Z0-9.-]+)?$/;

    if (
      !semverPattern.test(trimmedTag) &&
      !hashPattern.test(trimmedTag) &&
      !datePattern.test(trimmedTag)
    ) {
      // Warning for non-standard tags but don't fail
      // Note: Non-standard tag pattern detected but allowing it
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
   * @since 2.8.0+
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
   * @since 2.8.0+
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
   * @since 2.8.0+
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
   * @since 2.8.0+
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
