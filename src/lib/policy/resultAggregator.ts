/**
 * Result Aggregation Utilities
 *
 * This module provides utilities for aggregating and processing policy validation results.
 * It includes functions for combining results from multiple plugins, generating summaries,
 * and formatting output.
 *
 * @since 3.0.0
 */

import type {
  PolicyResult,
  PolicyViolation,
  PolicyWarning,
  ValidationMetadata,
  ResultSummary,
} from './types.js';

/**
 * Aggregates multiple policy results into a single result
 * @param results - Array of policy results to aggregate
 * @returns Aggregated policy result
 */
export function aggregateResults(results: PolicyResult[]): PolicyResult {
  if (results.length === 0) {
    return createEmptyResult();
  }

  if (results.length === 1) {
    const result = results[0];
    return result || createEmptyResult();
  }

  const violations: PolicyViolation[] = [];
  const warnings: PolicyWarning[] = [];
  let totalExecutionTime = 0;
  let totalPluginCount = 0;
  let totalManifestCount = 0;
  let earliestStartTime: number | undefined;

  for (const result of results) {
    violations.push(...result.violations);
    warnings.push(...result.warnings);
    totalExecutionTime += result.metadata.executionTime;
    totalPluginCount += result.metadata.pluginCount;
    totalManifestCount = Math.max(totalManifestCount, result.metadata.manifestCount);

    if (
      result.metadata.startTime &&
      (!earliestStartTime || result.metadata.startTime < earliestStartTime)
    ) {
      earliestStartTime = result.metadata.startTime;
    }
  }

  const metadata: ValidationMetadata = {
    executionTime: totalExecutionTime,
    pluginCount: totalPluginCount,
    manifestCount: totalManifestCount,
    ...(earliestStartTime && { startTime: earliestStartTime }),
    aggregatedResults: results.length,
  };

  const aggregatedResult: PolicyResult = {
    valid: violations.length === 0,
    violations,
    warnings,
    metadata,
    summary: generateResultSummary(violations, warnings),
  };

  return aggregatedResult;
}

/**
 * Generates a summary of validation results
 * @param violations - Array of policy violations
 * @param warnings - Array of policy warnings
 * @param allPlugins - Array of all plugins that were executed (optional)
 * @returns Result summary with statistics
 */
export function generateResultSummary(
  violations: PolicyViolation[],
  warnings: PolicyWarning[],
  allPlugins?: string[],
): ResultSummary {
  const allViolations = [...violations, ...warnings];

  // Count violations by severity
  const violationsBySeverity = {
    error: violations.filter((v) => v.severity === 'error').length,
    warning: allViolations.filter((v) => v.severity === 'warning').length,
    info: allViolations.filter((v) => v.severity === 'info').length,
  };

  // Count violations by plugin
  const violationsByPlugin: Record<string, number> = Object.create(null);

  // Initialize all plugins with 0 violations if provided
  if (allPlugins) {
    for (const pluginName of allPlugins) {
      // eslint-disable-next-line security/detect-object-injection
      violationsByPlugin[pluginName] = 0;
    }
  }

  // Count actual violations
  for (const violation of allViolations) {
    const pluginName = violation.plugin;
    // eslint-disable-next-line security/detect-object-injection
    violationsByPlugin[pluginName] = (violationsByPlugin[pluginName] || 0) + 1;
  }

  // Find top violation types (based on message patterns)
  const violationTypeCount: Record<string, number> = Object.create(null);
  for (const violation of allViolations) {
    // Extract violation type from message (first sentence or first 50 chars)
    const type = extractViolationType(violation.message);
    // eslint-disable-next-line security/detect-object-injection
    violationTypeCount[type] = (violationTypeCount[type] || 0) + 1;
  }

  const topViolationTypes = Object.entries(violationTypeCount)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 violation types

  return {
    violationsBySeverity,
    violationsByPlugin,
    topViolationTypes,
  };
}

/**
 * Filters violations by severity level
 * @param violations - Array of violations to filter
 * @param severity - Severity level to filter by
 * @returns Filtered violations
 */
export function filterViolationsBySeverity(
  violations: PolicyViolation[],
  severity: 'error' | 'warning' | 'info',
): PolicyViolation[] {
  return violations.filter((v) => v.severity === severity);
}

/**
 * Groups violations by plugin name
 * @param violations - Array of violations to group
 * @returns Violations grouped by plugin name
 */
export function groupViolationsByPlugin(
  violations: PolicyViolation[],
): Record<string, PolicyViolation[]> {
  const grouped: Record<string, PolicyViolation[]> = Object.create(null);

  for (const violation of violations) {
    const pluginName = violation.plugin;
    // eslint-disable-next-line security/detect-object-injection
    if (!grouped[pluginName]) {
      // eslint-disable-next-line security/detect-object-injection
      grouped[pluginName] = [];
    }
    // eslint-disable-next-line security/detect-object-injection
    grouped[pluginName].push(violation);
  }

  return grouped;
}

/**
 * Sorts violations by severity (error > warning > info)
 * @param violations - Array of violations to sort
 * @returns Sorted violations
 */
export function sortViolationsBySeverity(violations: PolicyViolation[]): PolicyViolation[] {
  const severityOrder = { error: 0, warning: 1, info: 2 };

  return [...violations].sort((a, b) => {
    const orderA = severityOrder[a.severity];
    const orderB = severityOrder[b.severity];

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // If same severity, sort by plugin name, then by message
    if (a.plugin !== b.plugin) {
      return a.plugin.localeCompare(b.plugin);
    }

    return a.message.localeCompare(b.message);
  });
}

/**
 * Creates an empty policy result for cases with no violations
 * @returns Empty policy result
 */
export function createEmptyResult(): PolicyResult {
  const metadata: ValidationMetadata = {
    executionTime: 0,
    pluginCount: 0,
    manifestCount: 0,
  };

  return {
    valid: true,
    violations: [],
    warnings: [],
    metadata,
    summary: {
      violationsBySeverity: { error: 0, warning: 0, info: 0 },
      violationsByPlugin: {},
      topViolationTypes: [],
    },
  };
}

/**
 * Extracts a violation type identifier from a violation message
 * @param message - Violation message
 * @returns Violation type string
 * @private
 */
function extractViolationType(message: string): string {
  // Try to extract the first sentence
  const sentences = message.split('.');
  const firstSentence = sentences.length > 0 ? sentences[0] : message;

  if (firstSentence && firstSentence.length <= 50) {
    return firstSentence.trim();
  }

  // If first sentence is too long, take first 50 characters
  return message.substring(0, 50).trim() + '...';
}

/**
 * Merges violation context objects safely
 * @param contexts - Array of context objects to merge
 * @returns Merged context object
 */
export function mergeViolationContexts(
  contexts: Array<Record<string, unknown> | undefined>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = Object.create(null);

  for (const context of contexts) {
    if (context && typeof context === 'object') {
      for (const [key, value] of Object.entries(context)) {
        // eslint-disable-next-line security/detect-object-injection
        merged[key] = value;
      }
    }
  }

  return merged;
}
