/**
 * @fileoverview Security utilities for input validation and sanitization
 * Focused on CLI tool security concerns: path traversal, injection prevention
 * @since 2.2.0
 */

import * as path from 'path';

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
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // Check for path traversal sequences
    if (
      inputPath.includes('../') ||
      inputPath.includes('..\\') ||
      inputPath.includes('%2e%2e%2f') ||
      inputPath.includes('%2e%2e%5c')
    ) {
      throw new Error('Invalid path: path traversal sequences detected');
    }

    // Resolve and normalize paths
    const resolvedInput = path.resolve(inputPath);
    const resolvedBase = path.resolve(allowedBasePath);

    // Ensure the resolved path is within the allowed base path
    if (!resolvedInput.startsWith(resolvedBase + path.sep) && resolvedInput !== resolvedBase) {
      throw new Error(`Invalid path: path must be within ${resolvedBase}`);
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

    // Basic validation for dot notation and no special characters that could break Helm
    const helmPathRegex = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
    return helmPathRegex.test(templatePath);
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
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple character class regex is safe
    const chartNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    return chartNameRegex.test(chartName) && chartName.length <= 63;
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
   * Validates image tags to prevent ReDoS attacks
   * Supports semantic versioning and date-based tags with secure validation
   * @param tag - Image tag to validate
   * @returns True if tag is valid
   * @throws Error if tag exceeds maximum length or contains invalid characters
   *
   * @example
   * ```typescript
   * SecurityUtils.validateImageTag('v1.2.3'); // true
   * SecurityUtils.validateImageTag('2023-12-01'); // true
   * SecurityUtils.validateImageTag('1.0.0-alpha.1'); // true
   * SecurityUtils.validateImageTag('latest'); // true
   * ```
   *
   * @since 2.2.0
   */
  static validateImageTag(tag: string): boolean {
    // Input validation and length limit to prevent ReDoS
    if (!tag || typeof tag !== 'string') {
      throw new Error('Image tag must be a non-empty string');
    }

    if (tag.length > 128) {
      throw new Error('Image tag exceeds maximum length of 128 characters');
    }

    // Check for obviously invalid characters first (fast path)
    if (tag.includes('..') || tag.includes('//') || tag.includes('\\')) {
      return false;
    }

    // Use string-based validation for common patterns to avoid regex complexity
    if (this.isValidSemanticVersion(tag)) {
      return true;
    }

    if (this.isValidDateTag(tag)) {
      return true;
    }

    if (this.isValidSimpleTag(tag)) {
      return true;
    }

    return false;
  }

  /**
   * Validates semantic version tags using string parsing instead of complex regex
   * @private
   * @param tag - Tag to validate as semantic version
   * @returns True if tag is a valid semantic version
   *
   * @since 2.2.0
   */
  private static isValidSemanticVersion(tag: string): boolean {
    // Handle optional 'v' prefix
    const cleanTag = tag.startsWith('v') ? tag.slice(1) : tag;

    // Split on dots for major.minor.patch
    const parts = cleanTag.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Validate each part is numeric
    for (let i = 0; i < 3; i++) {
      const part = parts[i];
      if (!part || !/^\d+$/.test(part)) {
        return false;
      }
      // Prevent leading zeros (except for "0")
      if (part.length > 1 && part[0] === '0') {
        return false;
      }
    }

    // Handle optional pre-release suffix (after the third part)
    const lastPart = parts[2];
    const dashIndex = lastPart.indexOf('-');
    if (dashIndex !== -1) {
      const version = lastPart.substring(0, dashIndex);
      const suffix = lastPart.substring(dashIndex + 1);

      // Validate the version part
      if (!version || !/^\d+$/.test(version)) {
        return false;
      }
      if (version.length > 1 && version[0] === '0') {
        return false;
      }

      // Validate suffix using simple character validation
      if (!this.isValidVersionSuffix(suffix)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates date-based tags using string parsing
   * @private
   * @param tag - Tag to validate as date format
   * @returns True if tag is a valid date tag
   *
   * @since 2.2.0
   */
  private static isValidDateTag(tag: string): boolean {
    // Check basic format: YYYY-MM-DD
    if (tag.length < 10) {
      return false;
    }

    const datePart = tag.substring(0, 10);
    const parts = datePart.split('-');

    if (parts.length !== 3) {
      return false;
    }

    const [year, month, day] = parts;

    // Validate year (4 digits)
    if (year.length !== 4 || !/^\d{4}$/.test(year)) {
      return false;
    }

    // Validate month (2 digits, 01-12)
    if (month.length !== 2 || !/^\d{2}$/.test(month)) {
      return false;
    }
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      return false;
    }

    // Validate day (2 digits, 01-31)
    if (day.length !== 2 || !/^\d{2}$/.test(day)) {
      return false;
    }
    const dayNum = parseInt(day, 10);
    if (dayNum < 1 || dayNum > 31) {
      return false;
    }

    // Handle optional suffix after date
    if (tag.length > 10) {
      if (tag[10] !== '-') {
        return false;
      }
      const suffix = tag.substring(11);
      if (!this.isValidVersionSuffix(suffix)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates simple tags (like 'latest', 'stable', etc.)
   * @private
   * @param tag - Tag to validate as simple tag
   * @returns True if tag is a valid simple tag
   *
   * @since 2.2.0
   */
  private static isValidSimpleTag(tag: string): boolean {
    // Simple tags should only contain alphanumeric, dots, hyphens, and underscores
    // Use a simple character-by-character check to avoid regex complexity
    for (let i = 0; i < tag.length; i++) {
      const char = tag[i];
      const isValid =
        (char >= 'a' && char <= 'z') ||
        (char >= 'A' && char <= 'Z') ||
        (char >= '0' && char <= '9') ||
        char === '.' ||
        char === '-' ||
        char === '_';

      if (!isValid) {
        return false;
      }
    }

    // Must start and end with alphanumeric
    const firstChar = tag[0];
    const lastChar = tag[tag.length - 1];
    const isAlphaNum = (c: string) =>
      (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');

    return isAlphaNum(firstChar) && isAlphaNum(lastChar);
  }

  /**
   * Validates version suffixes (pre-release, build metadata) using character validation
   * @private
   * @param suffix - Suffix to validate
   * @returns True if suffix contains only valid characters
   *
   * @since 2.2.0
   */
  private static isValidVersionSuffix(suffix: string): boolean {
    if (!suffix || suffix.length === 0) {
      return false;
    }

    // Check each character individually to avoid regex complexity
    for (let i = 0; i < suffix.length; i++) {
      const char = suffix[i];
      const isValid =
        (char >= 'a' && char <= 'z') ||
        (char >= 'A' && char <= 'Z') ||
        (char >= '0' && char <= '9') ||
        char === '.' ||
        char === '-';

      if (!isValid) {
        return false;
      }
    }

    return true;
  }
}
