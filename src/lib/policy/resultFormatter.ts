/**
 * Result Formatters
 *
 * This module provides formatters for policy validation results, including
 * default formatters and support for custom formatting.
 *
 * @since 3.0.0
 */

import type { PolicyResult, PolicyViolation, PolicyWarning, ResultFormatter } from './types.js';
import { sortViolationsBySeverity } from './resultAggregator.js';

/**
 * Default result formatter that provides human-readable output
 */
export class DefaultResultFormatter implements ResultFormatter {
  /**
   * Formats validation results for output
   * @param result - Validation result to format
   * @returns Formatted string representation
   */
  format(result: PolicyResult): string {
    const lines: string[] = [];

    // Header
    lines.push('='.repeat(60));
    lines.push('Policy Validation Results');
    lines.push('='.repeat(60));

    // Overall status
    const status = result.valid ? '✅ PASSED' : '❌ FAILED';
    lines.push(`Status: ${status}`);
    lines.push('');

    // Summary statistics
    if (result.summary) {
      lines.push('Summary:');
      lines.push(`  Errors:   ${result.summary.violationsBySeverity.error}`);
      lines.push(`  Warnings: ${result.summary.violationsBySeverity.warning}`);
      lines.push(`  Info:     ${result.summary.violationsBySeverity.info}`);
      lines.push('');
    }

    // Execution metadata
    lines.push('Execution Details:');
    lines.push(`  Plugins:   ${result.metadata.pluginCount}`);
    lines.push(`  Manifests: ${result.metadata.manifestCount}`);
    lines.push(`  Duration:  ${result.metadata.executionTime}ms`);
    lines.push('');

    // Violations
    if (result.violations.length > 0) {
      lines.push('Violations:');
      lines.push('-'.repeat(40));

      const sortedViolations = sortViolationsBySeverity(result.violations);
      for (const violation of sortedViolations) {
        lines.push(this.formatViolation(violation));
        lines.push('');
      }
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('Warnings:');
      lines.push('-'.repeat(40));

      const sortedWarnings = sortViolationsBySeverity(result.warnings);
      for (const warning of sortedWarnings) {
        lines.push(this.formatViolation(warning));
        lines.push('');
      }
    }

    // No issues message
    if (result.violations.length === 0 && result.warnings.length === 0) {
      lines.push('✨ No policy violations found!');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Formats a single violation for display
   * @param violation - Violation to format
   * @returns Formatted violation string
   * @private
   */
  private formatViolation(violation: PolicyViolation | PolicyWarning): string {
    const lines: string[] = [];

    // Severity icon and plugin
    const severityIcon = this.getSeverityIcon(violation.severity);
    lines.push(`${severityIcon} [${violation.plugin}] ${violation.message}`);

    // Resource path and field
    if (violation.resourcePath) {
      lines.push(`   Resource: ${violation.resourcePath}`);
    }

    if (violation.field) {
      lines.push(`   Field: ${violation.field}`);
    }

    // Suggestion
    if (violation.suggestion) {
      lines.push(`   💡 Suggestion: ${violation.suggestion}`);
    }

    return lines.join('\n');
  }

  /**
   * Gets the appropriate icon for a severity level
   * @param severity - Severity level
   * @returns Icon string
   * @private
   */
  private getSeverityIcon(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  }
}

/**
 * JSON result formatter that outputs structured JSON
 */
export class JsonResultFormatter implements ResultFormatter {
  constructor(private indent: number = 2) {}

  /**
   * Formats validation results as JSON
   * @param result - Validation result to format
   * @returns JSON string representation
   */
  format(result: PolicyResult): string {
    return JSON.stringify(result, null, this.indent);
  }
}

/**
 * Compact result formatter for CI/CD environments
 */
export class CompactResultFormatter implements ResultFormatter {
  /**
   * Formats validation results in a compact format
   * @param result - Validation result to format
   * @returns Compact string representation
   */
  format(result: PolicyResult): string {
    const status = result.valid ? 'PASS' : 'FAIL';
    const errorCount = result.violations.filter((v) => v.severity === 'error').length;
    const warningCount = [...result.violations, ...result.warnings].filter(
      (v) => v.severity === 'warning' || v.severity === 'info',
    ).length;

    let output = `Policy validation: ${status}`;

    if (errorCount > 0 || warningCount > 0) {
      output += ` (${errorCount} errors, ${warningCount} warnings)`;
    }

    output += ` - ${result.metadata.executionTime}ms`;

    // Add first few violations for context
    if (!result.valid && result.violations.length > 0) {
      output += '\n';
      const firstViolations = result.violations.slice(0, 3);
      for (const violation of firstViolations) {
        output += `\n  • [${violation.plugin}] ${violation.message}`;
      }

      if (result.violations.length > 3) {
        output += `\n  ... and ${result.violations.length - 3} more`;
      }
    }

    return output;
  }
}

/**
 * GitHub Actions result formatter that outputs in GitHub Actions format
 */
export class GitHubActionsResultFormatter implements ResultFormatter {
  /**
   * Formats validation results for GitHub Actions
   * @param result - Validation result to format
   * @returns GitHub Actions formatted string
   */
  format(result: PolicyResult): string {
    const lines: string[] = [];

    // Output summary
    const status = result.valid ? 'success' : 'failure';
    lines.push(`::notice title=Policy Validation::Status: ${status}`);

    // Output violations as errors/warnings
    for (const violation of result.violations) {
      const level = violation.severity === 'error' ? 'error' : 'warning';
      const file = violation.resourcePath || 'unknown';
      const message = `[${violation.plugin}] ${violation.message}`;

      lines.push(`::${level} file=${file}::${message}`);
    }

    for (const warning of result.warnings) {
      const level = warning.severity === 'info' ? 'notice' : 'warning';
      const file = warning.resourcePath || 'unknown';
      const message = `[${warning.plugin}] ${warning.message}`;

      lines.push(`::${level} file=${file}::${message}`);
    }

    return lines.join('\n');
  }
}

/**
 * SARIF (Static Analysis Results Interchange Format) result formatter
 */
export class SarifResultFormatter implements ResultFormatter {
  /**
   * Formats validation results as SARIF JSON
   * @param result - Validation result to format
   * @returns SARIF JSON string
   */
  format(result: PolicyResult): string {
    const runs = [
      {
        tool: {
          driver: {
            name: 'Timonel Policy Engine',
            version: '3.0.0',
            informationUri: 'https://github.com/your-org/timonel',
          },
        },
        results: this.convertViolationsToSarifResults([...result.violations, ...result.warnings]),
      },
    ];

    const sarif = {
      version: '2.1.0',
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      runs,
    };

    return JSON.stringify(sarif, null, 2);
  }

  /**
   * Converts violations to SARIF results format
   * @param violations - Violations to convert
   * @returns SARIF results array
   * @private
   */
  private convertViolationsToSarifResults(
    violations: (PolicyViolation | PolicyWarning)[],
  ): Array<Record<string, unknown>> {
    return violations.map((violation) => ({
      ruleId: `${violation.plugin}/${this.generateRuleId(violation.message)}`,
      level: this.mapSeverityToSarifLevel(violation.severity),
      message: {
        text: violation.message,
      },
      locations: violation.resourcePath
        ? [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: violation.resourcePath,
                },
                region: violation.field
                  ? {
                      startLine: 1,
                      startColumn: 1,
                    }
                  : undefined,
              },
            },
          ]
        : [],
      properties: {
        plugin: violation.plugin,
        suggestion: violation.suggestion,
        context: violation.context,
      },
    }));
  }

  /**
   * Generates a rule ID from a violation message
   * @param message - Violation message
   * @returns Rule ID string
   * @private
   */
  private generateRuleId(message: string): string {
    return message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Maps violation severity to SARIF level
   * @param severity - Violation severity
   * @returns SARIF level string
   * @private
   */
  private mapSeverityToSarifLevel(severity: 'error' | 'warning' | 'info'): string {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'note';
      default:
        return 'note';
    }
  }
}

/**
 * Factory function to create formatters by name
 * @param name - Formatter name
 * @param options - Formatter options
 * @returns Result formatter instance
 */
export function createFormatter(name: string, options?: Record<string, unknown>): ResultFormatter {
  switch (name.toLowerCase()) {
    case 'default':
      return new DefaultResultFormatter();
    case 'json':
      return new JsonResultFormatter(options?.indent as number);
    case 'compact':
      return new CompactResultFormatter();
    case 'github':
    case 'github-actions':
      return new GitHubActionsResultFormatter();
    case 'sarif':
      return new SarifResultFormatter();
    default:
      throw new Error(`Unknown formatter: ${name}`);
  }
}

/**
 * Gets a list of available formatter names
 * @returns Array of formatter names
 */
export function getAvailableFormatters(): string[] {
  return ['default', 'json', 'compact', 'github-actions', 'sarif'];
}
