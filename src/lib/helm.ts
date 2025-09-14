/**
 * @fileoverview Helpers to embed Helm template expressions while staying type-safe in TypeScript.
 * We treat Helm placeholders as opaque strings that will be preserved in YAML.
 * @since 0.1.0
 */

import { SecurityUtils } from './security.js';

/**
 * Creates a reference to a value in .Values of Helm
 *
 * Generates a Helm template expression that references a value
 * in the chart's values.yaml file using dot notation.
 *
 * @param {string} path - Path to the value using dot notation (e.g., 'image.tag')
 * @returns {string} Helm template expression (e.g., '{{ .Values.image.tag }}')
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const imageTag = valuesRef('image.tag');
 * // Returns: '{{ .Values.image.tag }}'
 *
 * const replicas = valuesRef('deployment.replicas');
 * // Returns: '{{ .Values.deployment.replicas }}'
 * ```
 *
 * @since 0.1.0
 */
export function valuesRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} }}`;
}

/**
 * Creates a required reference to a value in .Values of Helm
 *
 * Similar to valuesRef, but uses Helm's 'required' function to
 * ensure the value is present, failing chart rendering if not provided.
 *
 * @param {string} path - Path to the value using dot notation
 * @param {string} [message] - Custom error message if value is missing
 * @returns {string} Helm template expression with required validation
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const dbPassword = requiredValuesRef('database.password', 'Database password is required');
 * // Returns: '{{ required "Database password is required" .Values.database.password }}'
 *
 * const apiKey = requiredValuesRef('api.key');
 * // Returns: '{{ required "api.key is required" .Values.api.key }}'
 * ```
 *
 * @since 0.1.0
 */
export function requiredValuesRef(path: string, message?: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  const msg = message ?? `${path} is required`;
  // Escape quotes and backslashes in message to prevent template injection
  const escapedMsg = msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{{ required "${escapedMsg}" .Values.${path} }}`;
}

/**
 * Validates Helm template path syntax with enhanced security
 *
 * @private
 * @param {string} path - Path to validate
 * @returns {boolean} True if path is valid for Helm templates
 * @since 0.1.0
 */
function isValidHelmPath(path: string): boolean {
  // Use centralized validation from SecurityUtils
  return SecurityUtils.isValidHelmTemplatePath(path);
}

/**
 * Built-in Helm references for release and chart metadata
 *
 * Object containing the most common references to Helm's built-in
 * variables for release and chart information.
 *
 * @namespace helm
 * @since 0.1.0
 *
 * @example
 * ```typescript
 * const deploymentName = `${helm.releaseName}-deployment`;
 * // Uses: '{{ .Release.Name }}-deployment'
 *
 * const version = helm.chartVersion;
 * // Uses: '{{ .Chart.Version }}'
 * ```
 */
export const helm = {
  /** Release name: {{ .Release.Name }} */
  releaseName: '{{ .Release.Name }}',
  /** Chart name: {{ .Chart.Name }} */
  chartName: '{{ .Chart.Name }}',
  /** Chart version: {{ .Chart.Version }} */
  chartVersion: '{{ .Chart.Version }}',
  /** Release namespace: {{ .Release.Namespace }} */
  namespace: '{{ .Release.Namespace }}',
};

/**
 * Quotes a Helm template expression for safe YAML embedding
 *
 * Ensures Helm template expressions are properly quoted to avoid
 * YAML parsing issues when the expression contains special characters.
 *
 * @param {string} expr - Helm template expression to quote
 * @returns {string} Quoted expression if it's a Helm template, otherwise unchanged
 *
 * @example
 * ```typescript
 * const quoted = quote('{{ .Values.image.tag }}');
 * // Returns: "'{{ .Values.image.tag }}'"
 *
 * const normal = quote('nginx:1.21');
 * // Returns: "nginx:1.21"
 * ```
 *
 * @since 0.1.0
 */
export function quote(expr: string): string {
  // ensure Helm templates are quoted to avoid YAML parsing issues
  if (expr.startsWith('{{') && expr.endsWith('}}')) {
    return `'${expr}'`;
  }
  return expr;
}

/**
 * Indents text by specified number of spaces
 *
 * Helper function that matches Helm's indent function behavior,
 * adding the specified number of spaces to each non-empty line.
 *
 * @param {number} n - Number of spaces to indent
 * @param {string} expr - Text to indent
 * @returns {string} Indented text
 *
 * @example
 * ```typescript
 * const indented = indent(4, 'line1\nline2');
 * // Returns: "    line1\n    line2"
 * ```
 *
 * @since 0.1.0
 */
export function indent(n: number, expr: string): string {
  const spaces = ' '.repeat(n);
  return expr
    .split('\n')
    .map((l) => (l.trim().length ? spaces + l : l))
    .join('\n');
}

/**
 * Inserts a call to a named Helm template using template function
 *
 * @param {string} name - Name of the template to call
 * @param {string} [context='.'] - Context to pass to the template
 * @returns {string} Helm template expression
 *
 * @example
 * ```typescript
 * const tmpl = template('myapp.labels');
 * // Returns: '{{ template "myapp.labels" . }}'
 * ```
 *
 * @since 0.1.0
 */
export function template(name: string, context = '.'): string {
  return `{{ template "${name}" ${context} }}`;
}

/**
 * Inserts a call to a named Helm template using include function
 *
 * Preferred over template() as include allows piping and better error handling.
 *
 * @param {string} name - Name of the template to include
 * @param {string} [context='.'] - Context to pass to the template
 * @returns {string} Helm template expression
 *
 * @example
 * ```typescript
 * const tmpl = include('myapp.labels');
 * // Returns: '{{ include "myapp.labels" . }}'
 * ```
 *
 * @since 0.1.0
 */
export function include(name: string, context = '.'): string {
  return `{{ include "${name}" ${context} }}`;
}

/**
 * Branded types for better type safety in Helm template paths
 * @since 1.1.0
 */
export type HelmPath = string & { readonly __brand: unique symbol };
export type NumberPath = HelmPath & { readonly __numberType: unique symbol };
export type BooleanPath = HelmPath & { readonly __booleanType: unique symbol };
export type StringPath = HelmPath & { readonly __stringType: unique symbol };
export type FloatPath = HelmPath & { readonly __floatType: unique symbol };

/**
 * Configuration options for typed reference creation
 * @since 1.1.0
 */
interface TypedRefOptions {
  /** Whether to include default value handling */
  withDefault?: boolean;
  /** Default value to use if the path is not set */
  defaultValue?: string | number | boolean;
  /** Whether to quote string values */
  quote?: boolean;
}

/**
 * Factory function to create typed Helm value references with reduced code duplication
 * @param path - The path to the value in the Helm values
 * @param type - The expected type of the value
 * @param options - Additional options for reference creation
 * @returns A string that can be used in Helm templates
 * @throws {Error} If the path is invalid
 * @since 1.1.0
 */
export function createTypedRef(
  path: string,
  type: 'number' | 'boolean' | 'string' | 'float',
  options: TypedRefOptions = {},
): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }

  let template = `{{ .Values.${path}`;

  // Apply type casting based on type
  switch (type) {
    case 'number':
      template += ' | int';
      break;
    case 'boolean':
      template += ' | toBool';
      break;
    case 'string':
      template += ' | toString';
      break;
    case 'float':
      template += ' | float64';
      break;
  }

  // Handle default values following Helm best practices
  if (options.withDefault && options.defaultValue !== undefined) {
    const defaultVal =
      typeof options.defaultValue === 'string' && options.quote
        ? `"${options.defaultValue}"`
        : String(options.defaultValue);
    template += ` | default ${defaultVal}`;
  }

  // Handle string quoting for security
  if (type === 'string' && options.quote && !options.withDefault) {
    template += ' | quote';
  }

  template += ' }}';
  return template;
}

/**
 * Creates a numeric reference from .Values with int cast
 *
 * Generates a Helm template expression that casts the value to integer,
 * truncating any decimal places.
 *
 * @param {string} path - Path to the value using dot notation
 * @param {TypedRefOptions} [options] - Additional options for reference creation
 * @returns {string} Helm template expression with int cast
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const replicas = numberRef('deployment.replicas');
 * // Returns: '{{ .Values.deployment.replicas | int }}'
 * ```
 *
 * @since 0.1.0
 */
export function numberRef(path: string, options?: TypedRefOptions): string {
  return createTypedRef(path, 'number', options);
}

/**
 * Creates a boolean reference from .Values with toBool cast
 *
 * @param {string} path - Path to the value using dot notation
 * @param {TypedRefOptions} [options] - Additional options for reference creation
 * @returns {string} Helm template expression with toBool cast
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const enabled = boolRef('feature.enabled');
 * // Returns: '{{ .Values.feature.enabled | toBool }}'
 * ```
 *
 * @since 0.1.0
 */
export function boolRef(path: string, options?: TypedRefOptions): string {
  return createTypedRef(path, 'boolean', options);
}

/**
 * Creates a string reference from .Values with toString cast
 *
 * @param {string} path - Path to the value using dot notation
 * @param {TypedRefOptions} [options] - Additional options for reference creation
 * @returns {string} Helm template expression with toString cast
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const version = stringRef('app.version');
 * // Returns: '{{ .Values.app.version | toString }}'
 * ```
 *
 * @since 0.1.0
 */
export function stringRef(path: string, options?: TypedRefOptions): string {
  const defaultOptions = { quote: true, ...options };
  return createTypedRef(path, 'string', defaultOptions);
}

/**
 * Creates a float reference from .Values with float64 cast
 *
 * @param {string} path - Path to the value using dot notation
 * @param {TypedRefOptions} [options] - Additional options for reference creation
 * @returns {string} Helm template expression with float64 cast
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const ratio = floatRef('scaling.ratio');
 * // Returns: '{{ .Values.scaling.ratio | float64 }}'
 * ```
 *
 * @since 0.1.0
 */
export function floatRef(path: string, options?: TypedRefOptions): string {
  return createTypedRef(path, 'float', options);
}

/**
 * Creates a conditional reference to a value in .Values
 *
 * Generates a Helm template expression that conditionally renders
 * the value only if the condition is truthy.
 *
 * @param {string} path - Path to the value using dot notation
 * @param {string} condition - Path to the condition value
 * @returns {string} Helm template expression with conditional logic
 * @throws {Error} If the path or condition is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const secretName = conditionalRef('database.secretName', 'database.enabled');
 * // Returns: '{{ if .Values.database.enabled }}{{ .Values.database.secretName }}{{ end }}'
 * ```
 *
 * @since 2.6.0
 */
export function conditionalRef(path: string, condition: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  if (!isValidHelmPath(condition)) {
    throw new Error(`Invalid Helm template condition path: ${condition}`);
  }
  return `{{ if .Values.${condition} }}{{ .Values.${path} }}{{ end }}`;
}

/**
 * Creates a reference to a value in .Values with a default fallback
 *
 * Generates a Helm template expression that uses the default filter
 * to provide a fallback value when the path is not set.
 *
 * @param {string} path - Path to the value using dot notation
 * @param {string} defaultValue - Default value to use if path is not set
 * @returns {string} Helm template expression with default fallback
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const image = defaultRef('image.tag', 'latest');
 * // Returns: '{{ .Values.image.tag | default "latest" }}'
 * ```
 *
 * @since 2.6.0
 */
export function defaultRef(path: string, defaultValue: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  // Escape quotes and backslashes in defaultValue to prevent template injection
  const escapedValue = defaultValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{{ .Values.${path} | default "${escapedValue}" }}`;
}

/**
 * Creates a base64-encoded reference to a value in .Values
 *
 * Generates a Helm template expression that encodes the value
 * using base64 encoding, useful for secrets and certificates.
 *
 * @param {string} path - Path to the value using dot notation
 * @returns {string} Helm template expression with base64 encoding
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const encodedSecret = base64Ref('secrets.apiKey');
 * // Returns: '{{ .Values.secrets.apiKey | b64enc }}'
 * ```
 *
 * @since 2.6.0
 */
export function base64Ref(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | b64enc }}`;
}

/**
 * Creates a JSON-serialized reference to a value in .Values
 *
 * Generates a Helm template expression that serializes the value
 * to JSON format, useful for complex configuration objects.
 *
 * @param {string} path - Path to the value using dot notation
 * @returns {string} Helm template expression with JSON serialization
 * @throws {Error} If the path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const configJson = jsonRef('app.config');
 * // Returns: '{{ .Values.app.config | toJson }}'
 * ```
 *
 * @since 2.6.0
 */
export function jsonRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | toJson }}`;
}
