/**
 * Error Context Generator
 * 
 * This module provides utilities for generating detailed error context
 * for policy violations, including stack traces, environment information,
 * and debugging hints.
 * 
 * @since 3.0.0
 */

import type { PolicyViolation, PolicyWarning, ValidationContext } from './types.js';

/**
 * Enhanced error context information
 */
export interface ErrorContext {
  /** Error timestamp */
  readonly timestamp: string;
  
  /** Environment information */
  readonly environment: {
    readonly nodeVersion: string;
    readonly platform: string;
    readonly arch: string;
    readonly timonelVersion?: string;
  };
  
  /** Validation context */
  readonly validationContext: {
    readonly chartName?: string;
    readonly chartVersion?: string;
    readonly kubernetesVersion?: string;
    readonly environment?: string;
  };
  
  /** Plugin information */
  readonly plugin: {
    readonly name: string;
    readonly version?: string;
    readonly executionTime?: number;
  };
  
  /** Error details */
  readonly error: {
    readonly message: string;
    readonly severity: 'error' | 'warning' | 'info';
    readonly resourcePath?: string;
    readonly field?: string;
    readonly suggestion?: string;
    readonly stackTrace?: string;
    readonly originalContext?: Record<string, unknown>;
  };
  
  /** Debugging hints */
  readonly debuggingHints: string[];
  
  /** Related violations */
  readonly relatedViolations?: Array<{
    readonly plugin: string;
    readonly message: string;
    readonly similarity: number;
  }>;
}

/**
 * Error context generator for policy violations
 */
export class ErrorContextGenerator {
  /**
   * Generates detailed error context for a policy violation
   * @param violation - Policy violation to generate context for
   * @param validationContext - Validation context
   * @param allViolations - All violations for finding related issues
   * @param executionTime - Plugin execution time
   * @returns Enhanced error context
   */
  generateContext(
    violation: PolicyViolation | PolicyWarning,
    validationContext?: ValidationContext,
    allViolations?: (PolicyViolation | PolicyWarning)[],
    executionTime?: number
  ): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      environment: this.getEnvironmentInfo(),
      validationContext: this.getValidationContextInfo(validationContext),
      plugin: {
        name: violation.plugin,
        ...(executionTime !== undefined && { executionTime })
      },
      error: {
        message: violation.message,
        severity: violation.severity,
        ...(violation.resourcePath && { resourcePath: violation.resourcePath }),
        ...(violation.field && { field: violation.field }),
        ...(violation.suggestion && { suggestion: violation.suggestion }),
        ...(violation.context && { originalContext: violation.context })
      },
      debuggingHints: this.generateDebuggingHints(violation, validationContext),
      relatedViolations: this.findRelatedViolations(violation, allViolations)
    };
  }
  
  /**
   * Generates a formatted error report
   * @param violation - Policy violation
   * @param validationContext - Validation context
   * @param allViolations - All violations
   * @param executionTime - Plugin execution time
   * @returns Formatted error report string
   */
  generateErrorReport(
    violation: PolicyViolation | PolicyWarning,
    validationContext?: ValidationContext,
    allViolations?: (PolicyViolation | PolicyWarning)[],
    executionTime?: number
  ): string {
    const context = this.generateContext(violation, validationContext, allViolations, executionTime);
    const lines: string[] = [];
    
    // Header
    lines.push('='.repeat(80));
    lines.push(`Policy Violation Report - ${violation.severity.toUpperCase()}`);
    lines.push('='.repeat(80));
    lines.push('');
    
    // Plugin information
    lines.push('Basic Information:');
    lines.push(`  Plugin:    ${context.plugin.name}`);
    lines.push(`  Severity:  ${context.error.severity}`);
    lines.push(`  Message:   ${context.error.message}`);
    lines.push(`  Timestamp: ${context.timestamp}`);
    if (context.plugin.executionTime !== undefined) {
      lines.push(`  Exec Time: ${context.plugin.executionTime}ms`);
    }
    lines.push('');
    
    // Resource information
    if (context.error.resourcePath || context.error.field) {
      lines.push('Resource Information:');
      if (context.error.resourcePath) {
        lines.push(`  Path:  ${context.error.resourcePath}`);
      }
      if (context.error.field) {
        lines.push(`  Field: ${context.error.field}`);
      }
      lines.push('');
    }
    
    // Suggestion
    if (context.error.suggestion) {
      lines.push('Suggested Fix:');
      lines.push(`  ${context.error.suggestion}`);
      lines.push('');
    }
    
    // Environment
    lines.push('Environment:');
    lines.push(`  Node.js:   ${context.environment.nodeVersion}`);
    lines.push(`  Platform:  ${context.environment.platform} (${context.environment.arch})`);
    if (context.environment.timonelVersion) {
      lines.push(`  Timonel:   ${context.environment.timonelVersion}`);
    }
    lines.push('');
    
    // Validation context
    const hasValidationContext = context.validationContext.chartName || 
                                context.validationContext.kubernetesVersion || 
                                context.validationContext.environment;
    if (hasValidationContext) {
      lines.push('Validation Context:');
      if (context.validationContext.chartName) {
        const version = context.validationContext.chartVersion || 'unknown';
        lines.push(`  Chart:      ${context.validationContext.chartName}@${version}`);
      }
      if (context.validationContext.kubernetesVersion) {
        lines.push(`  Kubernetes: ${context.validationContext.kubernetesVersion}`);
      }
      if (context.validationContext.environment) {
        lines.push(`  Environment: ${context.validationContext.environment}`);
      }
      lines.push('');
    }
    
    // Debugging hints
    if (context.debuggingHints.length > 0) {
      lines.push('Debugging Hints:');
      context.debuggingHints.forEach(hint => {
        lines.push(`  • ${hint}`);
      });
      lines.push('');
    }
    
    // Related violations
    if (context.relatedViolations && context.relatedViolations.length > 0) {
      lines.push('Related Violations:');
      for (const related of context.relatedViolations) {
        lines.push(`  • [${related.plugin}] ${related.message} (${Math.round(related.similarity * 100)}% similar)`);
      }
      lines.push('');
    }
    
    // Original context
    if (context.error.originalContext && Object.keys(context.error.originalContext).length > 0) {
      lines.push('Additional Context:');
      lines.push(JSON.stringify(context.error.originalContext, null, 2)
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n'));
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Gets environment information
   * @returns Environment information object
   * @private
   */
  private getEnvironmentInfo() {
    const timonelVersion = this.getTimonelVersion();
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ...(timonelVersion && { timonelVersion })
    };
  }
  
  /**
   * Gets Timonel version from package.json
   * @returns Timonel version or undefined
   * @private
   */
  private getTimonelVersion(): string | undefined {
    try {
      // Try to read package.json to get version
      // This is a simplified approach - in a real implementation,
      // you might want to read from a constants file or build-time injection
      return '3.0.0'; // Placeholder
    } catch {
      return undefined;
    }
  }
  
  /**
   * Extracts validation context information
   * @param validationContext - Validation context
   * @returns Validation context information
   * @private
   */
  private getValidationContextInfo(validationContext?: ValidationContext) {
    return {
      ...(validationContext?.chart?.name && { chartName: validationContext.chart.name }),
      ...(validationContext?.chart?.version && { chartVersion: validationContext.chart.version }),
      ...(validationContext?.kubernetesVersion && { kubernetesVersion: validationContext.kubernetesVersion }),
      ...(validationContext?.environment && { environment: validationContext.environment })
    };
  }
  
  /**
   * Generates debugging hints based on the violation
   * @param violation - Policy violation
   * @param validationContext - Validation context
   * @returns Array of debugging hints
   * @private
   */
  private generateDebuggingHints(
    violation: PolicyViolation | PolicyWarning,
    validationContext?: ValidationContext
  ): string[] {
    const hints: string[] = [];
    
    // Generic hints based on severity
    if (violation.severity === 'error') {
      hints.push('This error will prevent chart generation. Fix this violation to proceed.');
    } else if (violation.severity === 'warning') {
      hints.push('This warning indicates a potential issue but won\'t block chart generation.');
    }
    
    // Hints based on resource path
    if (violation.resourcePath) {
      if (violation.resourcePath.includes('spec.containers')) {
        hints.push('This violation is related to container specifications. Check container configuration.');
      } else if (violation.resourcePath.includes('metadata')) {
        hints.push('This violation is related to resource metadata. Verify labels, annotations, and names.');
      } else if (violation.resourcePath.includes('spec.template')) {
        hints.push('This violation is in a pod template. Check deployment or statefulset configuration.');
      }
    }
    
    // Hints based on field
    if (violation.field) {
      if (violation.field.includes('securityContext')) {
        hints.push('Security context violations often relate to privilege escalation or root access.');
      } else if (violation.field.includes('resources')) {
        hints.push('Resource violations typically involve CPU/memory limits or requests.');
      } else if (violation.field.includes('image')) {
        hints.push('Image violations may relate to image tags, registries, or security policies.');
      }
    }
    
    // Hints based on plugin name
    if (violation.plugin.includes('security')) {
      hints.push('Security violations should be addressed promptly to maintain cluster security.');
      hints.push('Consider reviewing your organization\'s security policies and best practices.');
    } else if (violation.plugin.includes('resource')) {
      hints.push('Resource violations can impact cluster performance and cost.');
    } else if (violation.plugin.includes('network')) {
      hints.push('Network violations may affect service connectivity and security.');
    }
    
    // Environment-specific hints
    if (validationContext?.environment === 'production') {
      hints.push('This is a production environment - ensure all violations are resolved before deployment.');
    } else if (validationContext?.environment === 'development') {
      hints.push('Development environment detected - some violations may be acceptable for testing.');
    }
    
    // Kubernetes version hints
    if (validationContext?.kubernetesVersion) {
      const version = validationContext.kubernetesVersion;
      if (version.startsWith('1.2')) {
        hints.push('Kubernetes 1.2x detected - ensure compatibility with newer API versions.');
      }
    }
    
    return hints;
  }
  
  /**
   * Finds violations related to the current one
   * @param violation - Current violation
   * @param allViolations - All violations to search through
   * @returns Array of related violations with similarity scores
   * @private
   */
  private findRelatedViolations(
    violation: PolicyViolation | PolicyWarning,
    allViolations?: (PolicyViolation | PolicyWarning)[]
  ): Array<{ plugin: string; message: string; similarity: number }> {
    if (!allViolations || allViolations.length <= 1) {
      return [];
    }
    
    const related: Array<{ plugin: string; message: string; similarity: number }> = [];
    
    for (const other of allViolations) {
      if (other === violation) continue;
      
      const similarity = this.calculateSimilarity(violation, other);
      if (similarity > 0.3) { // 30% similarity threshold
        related.push({
          plugin: other.plugin,
          message: other.message,
          similarity
        });
      }
    }
    
    // Sort by similarity and return top 3
    return related
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }
  
  /**
   * Calculates similarity between two violations
   * @param violation1 - First violation
   * @param violation2 - Second violation
   * @returns Similarity score between 0 and 1
   * @private
   */
  private calculateSimilarity(
    violation1: PolicyViolation | PolicyWarning,
    violation2: PolicyViolation | PolicyWarning
  ): number {
    let score = 0;
    let factors = 0;
    
    // Same plugin
    if (violation1.plugin === violation2.plugin) {
      score += 0.4;
    }
    factors += 0.4;
    
    // Same severity
    if (violation1.severity === violation2.severity) {
      score += 0.2;
    }
    factors += 0.2;
    
    // Similar resource path
    if (violation1.resourcePath && violation2.resourcePath) {
      const pathSimilarity = this.calculateStringSimilarity(
        violation1.resourcePath,
        violation2.resourcePath
      );
      score += pathSimilarity * 0.2;
    }
    factors += 0.2;
    
    // Similar field
    if (violation1.field && violation2.field) {
      const fieldSimilarity = this.calculateStringSimilarity(
        violation1.field,
        violation2.field
      );
      score += fieldSimilarity * 0.1;
    }
    factors += 0.1;
    
    // Similar message
    const messageSimilarity = this.calculateStringSimilarity(
      violation1.message,
      violation2.message
    );
    score += messageSimilarity * 0.1;
    factors += 0.1;
    
    return factors > 0 ? score / factors : 0;
  }
  
  /**
   * Calculates string similarity using a simple algorithm
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score between 0 and 1
   * @private
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.calculateLevenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calculates Levenshtein distance between two strings
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Edit distance
   * @private
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i]![0] = i;
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }
}