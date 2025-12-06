/**
 * @fileoverview Helpers to embed Helm template expressions while staying type-safe in TypeScript.
 * We treat Helm placeholders as opaque strings that will be preserved in YAML.
 * @since 2.8.0+++
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
 */
export function template(name: string, context = '.'): string {
  if (!isValidHelmPath(name)) {
    throw new Error(`Invalid template name: ${name}`);
  }
  if (!isValidHelmPath(context)) {
    throw new Error(`Invalid template context: ${context}`);
  }
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
 * @since 2.8.0+
 */
export function include(name: string, context = '.'): string {
  return `{{ include "${name}" ${context} }}`;
}

/**
 * Branded types for better type safety in Helm template paths
 * @since 2.8.0+
 */
export type HelmPath = string & { readonly __brand: unique symbol };
export type NumberPath = HelmPath & { readonly __numberType: unique symbol };
export type BooleanPath = HelmPath & { readonly __booleanType: unique symbol };
export type StringPath = HelmPath & { readonly __stringType: unique symbol };
export type FloatPath = HelmPath & { readonly __floatType: unique symbol };

/**
 * Configuration options for typed reference creation
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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
 * Wraps a complete YAML manifest in a Helm conditional
 *
 * Generates a Helm template that conditionally renders an entire
 * Kubernetes manifest based on a values condition.
 *
 * @param {string} yamlContent - Complete YAML manifest content
 * @param {string} condition - Path to the condition value
 * @returns {string} YAML content wrapped in Helm conditional
 * @throws {Error} If the condition path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const namespaceYaml = `
 * apiVersion: v1
 * kind: Namespace
 * metadata:
 *   name: my-namespace
 * `;
 * const conditionalNamespace = conditionalManifest(namespaceYaml, 'createNamespace');
 * // Returns: '{{ if .Values.createNamespace }}\napiVersion: v1\nkind: Namespace...{{ end }}'
 * ```
 *
 * @since 2.8.0+
 */
export function conditionalManifest(yamlContent: string, condition: string): string {
  if (!isValidHelmPath(condition)) {
    throw new Error(`Invalid Helm template condition path: ${condition}`);
  }

  // Remove leading/trailing whitespace and ensure proper formatting
  const cleanYaml = yamlContent.trim();

  return `{{ if .Values.${condition} }}
${cleanYaml}
{{ end }}`;
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
 * @since 2.8.0+
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
 * @since 2.8.0+
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

/**
 * Flow Control Functions for Helm Templates
 *
 * These functions provide programmatic access to Helm's flow control structures:
 * if/else, with, and range for conditional logic and iteration.
 *
 * @since 2.8.0+
 */

/**
 * Creates a conditional if block in Helm templates
 *
 * Generates Helm template expressions for conditional logic using if/else/end.
 * Supports complex conditions with comparison operators and pipeline expressions.
 *
 * @param {string} condition - The condition to evaluate (e.g., 'eq .Values.env "production"')
 * @param {string} content - Content to include when condition is true
 * @param {string} [elseContent] - Optional content for else block
 * @returns {string} Complete Helm if/else template block
 * @throws {Error} If condition contains potentially unsafe template expressions
 *
 * @example
 * ```typescript
 * const conditionalConfig = helmIf(
 *   'eq .Values.environment "production"',
 *   'replicas: 3\nresources:\n  limits:\n    memory: "1Gi"',
 *   'replicas: 1\nresources:\n  limits:\n    memory: "512Mi"'
 * );
 * // Returns:
 * // {{- if eq .Values.environment "production" }}
 * // replicas: 3
 * // resources:
 * //   limits:
 * //     memory: "1Gi"
 * // {{- else }}
 * // replicas: 1
 * // resources:
 * //   limits:
 * //     memory: "512Mi"
 * // {{- end }}
 * ```
 *
 * @since 2.8.0
 */
export function helmIf(condition: string, content: string, elseContent?: string): string {
  // Validate condition for basic security
  if (!condition || condition.trim().length === 0) {
    throw new Error('Condition cannot be empty');
  }

  // Basic validation to prevent template injection
  if (condition.includes('{{') || condition.includes('}}')) {
    throw new Error('Condition should not contain template delimiters');
  }

  let result = `{{- if ${condition} }}\n${content}`;

  if (elseContent) {
    result += `\n{{- else }}\n${elseContent}`;
  }

  result += `\n{{- end }}`;

  return result;
}

/**
 * Creates a with block for scoped template context
 *
 * Generates Helm template expressions using 'with' to change the template context.
 * Useful for accessing nested values without repeating the full path.
 *
 * @param {string} path - Path to set as new context (e.g., '.Values.database')
 * @param {string} content - Content to render within the new context
 * @param {string} [elseContent] - Optional content when path is empty/nil
 * @returns {string} Complete Helm with/else/end template block
 * @throws {Error} If path is not valid for Helm templates
 *
 * @example
 * ```typescript
 * const dbConfig = helmWith(
 *   '.Values.database',
 *   'host: {{ .host }}\nport: {{ .port }}\nname: {{ .name }}',
 *   'host: "localhost"\nport: 5432\nname: "defaultdb"'
 * );
 * // Returns:
 * // {{- with .Values.database }}
 * // host: {{ .host }}
 * // port: {{ .port }}
 * // name: {{ .name }}
 * // {{- else }}
 * // host: "localhost"
 * // port: 5432
 * // name: "defaultdb"
 * // {{- end }}
 * ```
 *
 * @since 2.8.0
 */
export function helmWith(path: string, content: string, elseContent?: string): string {
  if (!path || path.trim().length === 0) {
    throw new Error('Path cannot be empty');
  }

  // Validate path format
  if (!path.startsWith('.')) {
    throw new Error('Path must start with "." (e.g., ".Values.config")');
  }

  let result = `{{- with ${path} }}\n${content}`;

  if (elseContent) {
    result += `\n{{- else }}\n${elseContent}`;
  }

  result += `\n{{- end }}`;

  return result;
}

/**
 * Creates a range loop for iterating over collections
 *
 * Generates Helm template expressions using 'range' to iterate over lists, maps, or other collections.
 * Supports both simple iteration and key-value iteration for maps.
 *
 * @param {string} collection - Collection to iterate over (e.g., '.Values.items')
 * @param {string} content - Content template for each iteration
 * @param {object} [options] - Configuration options for the range loop
 * @param {boolean} [options.keyValue=false] - Whether to iterate with key-value pairs
 * @param {string} [options.keyVar='$key'] - Variable name for keys in key-value iteration
 * @param {string} [options.valueVar='$value'] - Variable name for values in key-value iteration
 * @param {string} [options.indexVar='$index'] - Variable name for index in indexed iteration
 * @param {string} [options.itemVar='$item'] - Variable name for items in simple iteration
 * @returns {string} Complete Helm range/end template block
 * @throws {Error} If collection path is not valid
 *
 * @example
 * ```typescript
 * // Simple list iteration
 * const serviceList = helmRange(
 *   '.Values.services',
 *   '- name: {{ .name }}\n  port: {{ .port }}'
 * );
 *
 * // Key-value map iteration
 * const envVars = helmRange(
 *   '.Values.env',
 *   '- name: {{ $key }}\n  value: {{ $value | quote }}',
 *   { keyValue: true }
 * );
 *
 * // Indexed iteration
 * const indexedItems = helmRange(
 *   '.Values.items',
 *   '{{ $index }}: {{ $item }}',
 *   { indexVar: '$i', itemVar: '$val' }
 * );
 * ```
 *
 * @since 2.8.0
 */
export function helmRange(
  collection: string,
  content: string,
  options: {
    keyValue?: boolean;
    keyVar?: string;
    valueVar?: string;
    indexVar?: string;
    itemVar?: string;
  } = {},
): string {
  if (!collection || collection.trim().length === 0) {
    throw new Error('Collection cannot be empty');
  }

  if (!collection.startsWith('.')) {
    throw new Error('Collection path must start with "." (e.g., ".Values.items")');
  }

  // Validate collection path to prevent template injection
  if (!isValidHelmPath(collection)) {
    throw new Error(`Invalid collection path: ${collection}`);
  }

  const {
    keyValue = false,
    keyVar = '$key',
    valueVar = '$value',
    indexVar = '$index',
    itemVar = '$item',
  } = options;

  // Validate variable names to prevent injection
  const validateVarName = (varName: string, varType: string) => {
    if (!varName.startsWith('$')) {
      throw new Error(`${varType} must start with $ (e.g., $key, $value)`);
    }
    if (!/^\$[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
      throw new Error(`Invalid ${varType}: ${varName}`);
    }
  };

  // Validate all variable names that will be used
  if (keyValue) {
    validateVarName(keyVar, 'keyVar');
    validateVarName(valueVar, 'valueVar');
  }
  
  if (options.indexVar !== undefined) {
    validateVarName(indexVar, 'indexVar');
  }
  
  if (options.itemVar !== undefined) {
    validateVarName(itemVar, 'itemVar');
  }

  let rangeExpression: string;

  if (keyValue) {
    rangeExpression = `{{- range ${keyVar}, ${valueVar} := ${collection} }}`;
  } else if (options.indexVar !== undefined && options.itemVar !== undefined) {
    rangeExpression = `{{- range ${indexVar}, ${itemVar} := ${collection} }}`;
  } else {
    rangeExpression = `{{- range ${collection} }}`;
  }

  return `${rangeExpression}\n${content}\n{{- end }}`;
}

/**
 * Creates a complex conditional with multiple else-if branches
 *
 * Generates Helm template expressions for complex conditional logic with multiple branches.
 * Useful for handling multiple environment configurations or feature flags.
 *
 * @param {Array<{condition: string, content: string}>} branches - Array of condition-content pairs
 * @param {string} [defaultContent] - Default content when no conditions match
 * @returns {string} Complete Helm if/else-if/else/end template block
 * @throws {Error} If branches array is empty or contains invalid conditions
 *
 * @example
 * ```typescript
 * const envConfig = helmIfElseIf([
 *   {
 *     condition: 'eq .Values.environment "production"',
 *     content: 'replicas: 5\nresources.limits.memory: "2Gi"'
 *   },
 *   {
 *     condition: 'eq .Values.environment "staging"',
 *     content: 'replicas: 2\nresources.limits.memory: "1Gi"'
 *   }
 * ], 'replicas: 1\nresources.limits.memory: "512Mi"');
 * ```
 *
 * @since 2.8.0
 */
export function helmIfElseIf(
  branches: Array<{ condition: string; content: string }>,
  defaultContent?: string,
): string {
  if (!branches || branches.length === 0) {
    throw new Error('At least one branch is required');
  }

  let result = '';

  branches.forEach((branch, index) => {
    if (!branch.condition || branch.condition.trim().length === 0) {
      throw new Error(`Branch ${index} condition cannot be empty`);
    }

    // Basic validation to prevent template injection
    if (branch.condition.includes('{{') || branch.condition.includes('}}')) {
      throw new Error(`Branch ${index} condition should not contain template delimiters`);
    }

    const keyword = index === 0 ? 'if' : 'else if';
    result += `{{- ${keyword} ${branch.condition} }}\n${branch.content}\n`;
  });

  if (defaultContent) {
    result += `{{- else }}\n${defaultContent}\n`;
  }

  result += '{{- end }}';

  return result;
}
