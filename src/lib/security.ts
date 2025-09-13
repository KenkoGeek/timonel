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
   * Validates image tags to prevent use of dangerous/mutable tags
   * @param imageTag - Image tag to validate
   * @returns True if image tag is safe to use
   * @throws Error if image tag is dangerous or invalid
   *
   * @since 2.2.0
   */
  static validateImageTag(imageTag: string): boolean {
    if (!imageTag || typeof imageTag !== 'string') {
      throw new Error('Image tag must be a non-empty string');
    }

    // List of dangerous/mutable tags that pose security risks
    const dangerousTags = [
      'latest', 'master', 'main', 'dev', 'development', 'test', 'staging',
      'unstable', 'nightly', 'edge', 'canary', 'current', 'snapshot'
    ];

    const normalizedTag = imageTag.trim().toLowerCase();

    if (dangerousTags.includes(normalizedTag)) {
      throw new Error(
        `Dangerous image tag detected: "${imageTag}". ` +
        `Mutable tags like "${normalizedTag}" pose security risks. ` +
        'Use specific version tags (e.g., "1.2.3", "v1.2.3", "sha256:abc123") instead.'
      );
    }

    // Additional validation for empty or whitespace-only tags
    if (normalizedTag.length === 0) {
      throw new Error('Image tag cannot be empty or whitespace-only');
    }

    return true;
  }
}
