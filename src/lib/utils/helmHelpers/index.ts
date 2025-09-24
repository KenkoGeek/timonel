/**
 * @fileoverview Main index file for Helm helpers with organized exports and helper management functions
 * @since 2.11.0
 */

// Export types
export type { HelperDefinition, HelperCategory, CloudProvider, HelperOptions } from './types.js';

// Export all helper categories
export { ENV_HELPERS } from './envHelpers.js';
export { GITOPS_HELPERS } from './gitopsHelpers.js';
export { OBSERVABILITY_HELPERS } from './observabilityHelpers.js';
export { VALIDATION_HELPERS } from './validationHelpers.js';

// Import existing helpers from the main file for backward compatibility
import type { HelperDefinition, HelperCategory, HelperOptions } from './types.js';
import { ENV_HELPERS } from './envHelpers.js';
import { GITOPS_HELPERS } from './gitopsHelpers.js';
import { OBSERVABILITY_HELPERS } from './observabilityHelpers.js';
import { VALIDATION_HELPERS } from './validationHelpers.js';

/**
 * Performance-optimized helper management using Map for O(1) lookups
 * @since 2.11.0
 */
const HELPER_CATEGORIES = new Map<HelperCategory, HelperDefinition[]>([
  ['env', ENV_HELPERS],
  ['gitops', GITOPS_HELPERS],
  ['observability', OBSERVABILITY_HELPERS],
  ['validation', VALIDATION_HELPERS],
]);

/**
 * Cached helper compilation for better performance
 * @since 2.11.0
 */
const COMPILED_HELPERS_CACHE = new Map<string, string>();

/**
 * Performance-optimized helper lookup with O(1) time complexity
 * @param category - Helper category to retrieve
 * @returns Array of helper definitions for the specified category
 * @throws {Error} If category is unknown
 * @since 2.11.0
 */
export function getNewHelpersByCategory(category: HelperCategory): HelperDefinition[] {
  const helpers = HELPER_CATEGORIES.get(category);
  if (!helpers) {
    throw new Error(`Unknown helper category: ${category}`);
  }
  return [...helpers]; // Return copy to prevent mutations
}

/**
 * Get all available new helper categories
 * @returns Array of available helper categories
 * @since 2.11.0
 */
export function getAvailableHelperCategories(): HelperCategory[] {
  return Array.from(HELPER_CATEGORIES.keys());
}

/**
 * Get helpers for multiple categories
 * @param categories - Array of categories to retrieve
 * @returns Combined array of helper definitions
 * @since 2.11.0
 */
export function getHelpersByCategories(categories: HelperCategory[]): HelperDefinition[] {
  const helpers: HelperDefinition[] = [];
  for (const category of categories) {
    helpers.push(...getNewHelpersByCategory(category));
  }
  return helpers;
}

/**
 * Get helpers based on options configuration
 * @param options - Configuration options for helper inclusion
 * @returns Array of helper definitions based on options
 * @since 2.11.0
 */
export function getHelpersByOptions(options: HelperOptions): HelperDefinition[] {
  const helpers: HelperDefinition[] = [];

  if (options.includeEnv) {
    helpers.push(...ENV_HELPERS);
  }

  if (options.includeGitops) {
    helpers.push(...GITOPS_HELPERS);
  }

  if (options.includeObservability) {
    helpers.push(...OBSERVABILITY_HELPERS);
  }

  if (options.includeValidation) {
    helpers.push(...VALIDATION_HELPERS);
  }

  return helpers;
}

/**
 * Converts helper definitions to Helm template format
 * @param helpers - Array of helper definitions
 * @returns Formatted Helm template string
 * @since 2.11.0
 */
export function formatNewHelpers(helpers: HelperDefinition[]): string {
  return helpers
    .map(
      (helper) => `{{/*
${helper.name}
*/}}
{{- define "${helper.name}" -}}
${helper.template}
{{- end }}`,
    )
    .join('\n\n');
}

/**
 * Generates complete _helpers.tpl content with new helpers
 * @param options - Configuration options for helper inclusion
 * @param customHelpers - Additional custom helpers
 * @returns Complete helpers template content
 * @since 2.11.0
 */
export function generateNewHelpersTemplate(
  options?: HelperOptions,
  customHelpers?: HelperDefinition[],
): string {
  const helpers: HelperDefinition[] = [];

  if (options) {
    helpers.push(...getHelpersByOptions(options));
  }

  if (customHelpers) {
    helpers.push(...customHelpers);
  }

  return formatNewHelpers(helpers);
}

/**
 * Cached helper compilation for better performance
 * @param options - Configuration options for helper inclusion
 * @param customHelpers - Additional custom helpers
 * @returns Complete helpers template content from cache or newly generated
 * @since 2.11.0
 */
export function getCachedNewHelpersTemplate(
  options?: HelperOptions,
  customHelpers?: HelperDefinition[],
): string {
  const cacheKey = JSON.stringify({ options, customHelpers });

  if (COMPILED_HELPERS_CACHE.has(cacheKey)) {
    return COMPILED_HELPERS_CACHE.get(cacheKey)!;
  }

  const template = generateNewHelpersTemplate(options, customHelpers);
  COMPILED_HELPERS_CACHE.set(cacheKey, template);
  return template;
}

/**
 * Creates a custom helper definition
 * @param name - Helper name
 * @param template - Helper template content
 * @returns Helper definition object
 * @since 2.11.0
 */
export function createNewHelper(name: string, template: string): HelperDefinition {
  return { name, template };
}

/**
 * Validates helper names for Helm compatibility
 * @param helpers - Array of helper definitions to validate
 * @throws {Error} If any helper has an invalid name
 * @since 2.11.0
 */
export function validateHelperNames(helpers: HelperDefinition[]): void {
  const namePattern = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const helper of helpers) {
    if (!namePattern.test(helper.name)) {
      throw new Error(
        `Invalid helper name: "${helper.name}". Names must start with a letter and contain only letters, numbers, dots, underscores, and hyphens.`,
      );
    }

    if (seen.has(helper.name)) {
      duplicates.add(helper.name);
    } else {
      seen.add(helper.name);
    }
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate helper names found: ${Array.from(duplicates).join(', ')}`);
  }
}

/**
 * Filters helpers by name pattern
 * @param helpers - Array of helper definitions to filter
 * @param pattern - RegExp pattern to match against helper names
 * @returns Filtered array of helper definitions
 * @since 2.11.0
 */
export function filterHelpersByPattern(
  helpers: HelperDefinition[],
  pattern: RegExp,
): HelperDefinition[] {
  return helpers.filter((helper) => pattern.test(helper.name));
}

/**
 * Gets helper statistics for analysis
 * @param helpers - Array of helper definitions to analyze
 * @returns Statistics about the helpers
 * @since 2.11.0
 */
export function getHelperStatistics(helpers: HelperDefinition[]): {
  totalHelpers: number;
  categoryCounts: Record<string, number>;
  averageTemplateLength: number;
  longestHelper: string;
  shortestHelper: string;
} {
  // Use Map to avoid security issues with object injection
  const categoryMap = new Map<string, number>();
  let totalTemplateLength = 0;
  let longestHelper = '';
  let shortestHelper = '';
  let longestLength = 0;
  let shortestLength = Infinity;

  for (const helper of helpers) {
    const category = helper.name.split('.')[0] || 'unknown';
    const currentCount = categoryMap.get(category) || 0;
    categoryMap.set(category, currentCount + 1);

    const templateLength = helper.template.length;
    totalTemplateLength += templateLength;

    if (templateLength > longestLength) {
      longestLength = templateLength;
      longestHelper = helper.name;
    }

    if (templateLength < shortestLength) {
      shortestLength = templateLength;
      shortestHelper = helper.name;
    }
  }

  return {
    totalHelpers: helpers.length,
    categoryCounts: Object.fromEntries(categoryMap),
    averageTemplateLength:
      helpers.length > 0 ? Math.round(totalTemplateLength / helpers.length) : 0,
    longestHelper,
    shortestHelper,
  };
}
