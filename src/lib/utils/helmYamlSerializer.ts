import * as jsYaml from 'js-yaml';

/**
 * Helm template expression patterns for detection and preservation
 * @since 2.9.2
 */
const HELM_EXPRESSION_PATTERNS = [
  // Template expressions: {{ .Values.something }}
  /\{\{\s*[^}]+\s*\}\}/g,
  // Template functions: {{ include "template" . }}
  /\{\{\s*include\s+[^}]+\s*\}\}/g,
  // Template conditionals: {{ if .Values.enabled }}
  /\{\{\s*if\s+[^}]+\s*\}\}/g,
  /\{\{\s*else\s*\}\}/g,
  /\{\{\s*end\s*\}\}/g,
  // Template loops: {{ range .Values.items }}
  /\{\{\s*range\s+[^}]+\s*\}\}/g,
  // Template with statements: {{ with .Values.config }}
  /\{\{\s*with\s+[^}]+\s*\}\}/g,
  // Template variables: {{ $var := .Values.something }}
  /\{\{\s*\$[^}]+\s*\}\}/g,
  // Template pipes: {{ .Values.name | quote }}
  /\{\{\s*[^}]*\|\s*[^}]+\s*\}\}/g,
];

/**
 * Marker interface for Helm template expressions to prevent quoting
 * @since 2.9.2
 */
interface HelmExpression {
  __helmExpression: true;
  value: string;
}

/**
 * Creates a marker object for Helm template expressions
 * @param value - The Helm template expression string
 * @returns Marked Helm expression object
 * @since 2.9.2
 */
function createHelmExpression(value: string): HelmExpression {
  return {
    __helmExpression: true,
    value,
  };
}

/**
 * Checks if a value is a marked Helm expression
 * @param value - Value to check
 * @returns True if value is a Helm expression marker
 * @since 2.9.2
 */
function isHelmExpression(value: unknown): value is HelmExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__helmExpression' in value &&
    (value as HelmExpression).__helmExpression === true
  );
}

/**
 * Detects if a string contains Helm template expressions
 * @param str - String to check
 * @returns True if string contains Helm expressions
 * @since 2.9.2
 */
function containsHelmExpression(str: string): boolean {
  return HELM_EXPRESSION_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Preprocesses an object to mark Helm template expressions
 * This prevents js-yaml from quoting Helm expressions
 * @param obj - Object to preprocess
 * @returns Preprocessed object with marked Helm expressions
 * @since 2.9.2
 */
function preprocessHelmExpressions(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // If the entire string is a Helm expression, mark it
    if (containsHelmExpression(obj)) {
      return createHelmExpression(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(preprocessHelmExpressions);
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    // Use Object.entries for safe iteration
    for (const [key, value] of Object.entries(obj)) {
      // Use Object.defineProperty to safely set properties
      Object.defineProperty(result, key, {
        value: preprocessHelmExpressions(value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return result;
  }

  return obj;
}

/**
 * Custom replacer function for js-yaml that handles Helm expressions
 * @param key - Object key
 * @param value - Object value
 * @returns Processed value for YAML serialization
 * @since 2.9.2
 */
function helmAwareReplacer(key: string, value: unknown): unknown {
  // Handle Helm expression markers
  if (isHelmExpression(value)) {
    // Return the raw value without quotes
    return value.value;
  }

  return value;
}

/**
 * Serializes an object to YAML with Helm template expression awareness
 * This function ensures that Helm template expressions are not quoted in the output
 * @param obj - Object to serialize to YAML
 * @param options - Additional js-yaml dump options
 * @returns YAML string with properly formatted Helm expressions
 * @since 2.9.2
 */
export function dumpHelmAwareYaml(obj: unknown, options: jsYaml.DumpOptions = {}): string {
  // Preprocess the object to mark Helm expressions
  const preprocessed = preprocessHelmExpressions(obj);

  // Configure js-yaml options for Helm compatibility
  const helmOptions: jsYaml.DumpOptions = {
    // Disable forced quotes to allow Helm expressions
    forceQuotes: false,
    // Preserve line width for readability
    lineWidth: options.lineWidth ?? 0,
    // Use block style for better readability
    flowLevel: options.flowLevel ?? -1,
    // Custom replacer for Helm expressions
    replacer: helmAwareReplacer,
    // Merge with user options
    ...options,
  };

  let yamlOutput = jsYaml.dump(preprocessed, helmOptions);

  // Post-process to clean up any remaining issues with Helm expressions
  yamlOutput = postProcessHelmExpressions(yamlOutput);

  return yamlOutput;
}

/**
 * Post-processes YAML output to ensure Helm expressions are properly formatted
 * @param yaml - YAML string to post-process
 * @returns Cleaned YAML string
 * @since 2.9.2
 */
function postProcessHelmExpressions(yaml: string): string {
  let processed = yaml;

  // Remove quotes around common Helm expressions
  // Remove single quotes around {{ }} expressions
  processed = processed.replace(/'(\{\{[^}]*\}\})'/g, '$1');
  // Remove double quotes around {{ }} expressions
  processed = processed.replace(/"(\{\{[^}]*\}\})"/g, '$1');

  // Fix any escaped Helm expressions
  processed = processed.replace(/\\(\{\{[^}]*\}\})/g, '$1');

  return processed;
}

/**
 * Legacy compatibility function that mimics the original YAML.stringify behavior
 * but with Helm template expression awareness
 * @param obj - Object to serialize
 * @param options - Serialization options (compatible with original YAML library)
 * @returns YAML string
 * @since 2.9.2
 */
export function stringify(
  obj: unknown,
  options: {
    lineWidth?: number;
    doubleQuotedAsJSON?: boolean;
    simpleKeys?: boolean;
  } = {},
): string {
  // Map original options to js-yaml options
  const jsYamlOptions: jsYaml.DumpOptions = {
    lineWidth: options.lineWidth ?? 0,
    // js-yaml doesn't have doubleQuotedAsJSON, but we can approximate
    quotingType: options.doubleQuotedAsJSON ? '"' : "'",
  };

  return dumpHelmAwareYaml(obj, jsYamlOptions);
}

/**
 * Validates that a YAML string contains properly formatted Helm expressions
 * @param yaml - YAML string to validate
 * @returns True if Helm expressions are properly formatted
 * @since 2.9.2
 */
export function validateHelmExpressions(yaml: string): boolean {
  // Check that Helm expressions are not quoted
  const quotedHelmExpressions = [/'(\{\{[^}]*\}\})'/g, /"(\{\{[^}]*\}\})"/g];

  return !quotedHelmExpressions.some((pattern) => pattern.test(yaml));
}
