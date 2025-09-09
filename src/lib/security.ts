import * as path from 'path';

/**
 * Security utilities for input validation and sanitization
 */
export class SecurityUtils {
  /**
   * Validates and sanitizes file paths to prevent path traversal attacks
   * @param inputPath - The path to validate
   * @param allowedBasePath - The base path that the input should be within
   * @returns Sanitized path if valid
   * @throws Error if path is invalid or contains traversal sequences
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
   * Validates TypeScript file extensions for dynamic imports
   * @param filePath - The file path to validate
   * @returns True if the file has a valid TypeScript extension
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
   */
  static isValidHelmTemplatePath(templatePath: string): boolean {
    if (!templatePath || typeof templatePath !== 'string') {
      return false;
    }

    // Basic validation for dot notation and no special characters that could break Helm
    const helmPathRegex = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
    return helmPathRegex.test(templatePath);
  }
}
