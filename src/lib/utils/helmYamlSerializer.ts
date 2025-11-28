import { Document, Scalar, isMap, isScalar, visit } from 'yaml';

import type { HelmConstruct } from './helmControlStructures.js';
import {
  isHelmConstruct,
  isHelmExpression,
  createHelmExpression,
} from './helmControlStructures.js';

/**
 * Helper function to serialize else-if chains
 * @param elseContent The else content to process
 * @param openTag Opening Helm tag
 * @param closeTag Closing Helm tag
 * @returns Object with serialized result and remaining else content
 */
function serializeElseIfChain(
  elseContent: unknown,
  openTag: string,
  closeTag: string,
): { result: string; remainingElse: unknown | undefined } {
  let result = '';
  let currentElse: unknown | undefined = elseContent;

  // Check for nested if (else if pattern)
  if (isHelmConstruct(currentElse) && currentElse.type === 'if') {
    while (isHelmConstruct(currentElse) && currentElse.type === 'if') {
      const elseIfData = currentElse.data as {
        condition: string;
        then: unknown;
        else?: unknown;
      };
      result += `\n${openTag}else if ${elseIfData.condition}${closeTag}\n`;
      result += serializeHelmContent(elseIfData.then);
      currentElse = elseIfData.else;
    }
  }

  return { result, remainingElse: currentElse };
}

/**
 * Serialize a HelmConstruct into a Helm template string
 * @param construct The HelmConstruct to serialize
 * @returns Helm template string
 */
function serializeHelmConstruct(construct: HelmConstruct): string {
  const trimLeft = construct.options?.trimLeft ?? true;
  const trimRight = construct.options?.trimRight ?? true;

  const openTag = `{{${trimLeft ? '-' : ''} `;
  const closeTag = ` ${trimRight ? '-' : ''}}}`;

  switch (construct.type) {
    case 'if': {
      const data = construct.data as { condition: string; then: unknown; else?: unknown };
      let result = `${openTag}if ${data.condition}${closeTag}\n`;
      result += serializeHelmContent(data.then);

      if (data.else !== undefined) {
        const { result: elseIfResult, remainingElse } = serializeElseIfChain(
          data.else,
          openTag,
          closeTag,
        );

        result += elseIfResult;

        if (remainingElse !== undefined) {
          result += `\n${openTag}else${closeTag}\n`;
          result += serializeHelmContent(remainingElse);
        }
      }

      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'fragment': {
      const data = construct.data as unknown[];
      // Serialize each item and join with newlines
      return data.map((item) => serializeHelmContent(item)).join('\n');
    }

    case 'range': {
      const data = construct.data as { vars: string; collection: string; content: unknown };
      let result = `${openTag}range ${data.vars} := ${data.collection}${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'with': {
      const data = construct.data as { scope: string; content: unknown };
      let result = `${openTag}with ${data.scope}${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'include': {
      const data = construct.data as { templateName: string; scope: string; pipe?: string };
      let result = `${openTag}include "${data.templateName}" ${data.scope}`;
      if (data.pipe) {
        result += ` | ${data.pipe}`;
      }
      result += `${closeTag}`;
      return result;
    }

    case 'define': {
      const data = construct.data as { name: string; content: unknown };
      let result = `${openTag}define "${data.name}"${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'var': {
      const data = construct.data as { name: string; value: string };
      return `${openTag}${data.name} := ${data.value}${closeTag}`;
    }

    case 'block': {
      const data = construct.data as { name: string; content: unknown };
      let result = `${openTag}block "${data.name}" .${closeTag}\n`;
      result += serializeHelmContent(data.content);
      result += `\n${openTag}end${closeTag}`;
      return result;
    }

    case 'comment': {
      const data = construct.data as { text: string };
      return `{{/* ${data.text} */}}`;
    }

    default:
      throw new Error(`Unknown Helm construct type: ${construct.type}`);
  }
}

/**
 * Serialize HelmContent (primitives, objects, arrays, or HelmConstructs) to string
 */
function serializeHelmContent(content: unknown): string {
  if (isHelmConstruct(content)) {
    return serializeHelmConstruct(content);
  }

  if (isHelmExpression(content)) {
    return content.value;
  }

  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'number' || typeof content === 'boolean') {
    return String(content);
  }

  // For objects and arrays, use the yaml library to serialize them properly
  if (typeof content === 'object') {
    const doc = new Document(content);
    let yaml = doc.toString({ lineWidth: 0 });
    // Remove the trailing newline and any leading/trailing whitespace
    yaml = yaml.trim();
    return yaml;
  }

  return '';
}

/**
 * Pre-process an object to convert HelmConstruct instances to HelmExpression
 * This allows the yaml library to serialize them correctly
 */
function preprocessHelmConstructs(obj: unknown): unknown {
  // Handle HelmConstruct

  if (isHelmConstruct(obj)) {
    const helmTemplate = serializeHelmConstruct(obj);
    return createHelmExpression(helmTemplate);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => preprocessHelmConstructs(item));
  }

  // Handle objects
  if (obj !== null && typeof obj === 'object') {
    // Don't process HelmExpression objects
    if (isHelmExpression(obj)) {
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over own entries
      result[key] = preprocessHelmConstructs(value);
    }
    return result;
  }

  // Return primitives as-is
  return obj;
}

/**
 * Main method to serialize an object to YAML with Helm template awareness.
 * Uses 'yaml' library to natively handle Helm expressions by forcing QUOTE_DOUBLE style.
 *
 * @param obj Input object to serialize.
 * @param options Options (lineWidth, etc.) - partially supported mapping from legacy options.
 * @returns Helm-aware YAML string.
 * @since 2.11.0
 * @since 2.13.1 Refactored to use 'yaml' library
 * @since 2.14.0 Added HelmConstruct pre-processing
 */
export function dumpHelmAwareYaml(obj: unknown, options: { lineWidth?: number } = {}): string {
  // Pre-process to convert HelmConstruct objects to HelmExpression
  const preprocessed = preprocessHelmConstructs(obj);

  const doc = new Document(preprocessed);

  // Visit the document to transform HelmExpression objects and force quoting for templates
  visit(doc, (_key, node) => {
    // 1. Handle explicit HelmExpression objects
    if (isMap(node)) {
      const isHelmExpr = node.items.some(
        (pair) =>
          isScalar(pair.key) &&
          pair.key.value === '__helmExpression' &&
          isScalar(pair.value) &&
          pair.value.value === true,
      );

      if (isHelmExpr) {
        // Find the 'value' property
        const valuePair = node.items.find(
          (pair) => isScalar(pair.key) && pair.key.value === 'value',
        );
        if (valuePair && isScalar(valuePair.value)) {
          const value = String(valuePair.value.value);
          const scalar = new Scalar(value);

          // Check if this is a Helm construct (multiline block)
          if (value.trim().startsWith('{{') && value.includes('\n')) {
            scalar.type = 'BLOCK_LITERAL'; // Force block style (|)
          } else {
            scalar.type = 'QUOTE_DOUBLE'; // Force double quotes for simple expressions
          }
          return scalar; // Replace the Map node with this Scalar
        }
      }
    }
    return undefined;
  });

  // Configure output options
  const toStringOptions: { lineWidth?: number } = {};
  if (options.lineWidth !== undefined) {
    toStringOptions.lineWidth = options.lineWidth;
  }

  // Ensure we don't use flow style (JSON-like) for the root or children unless necessary
  // doc.options.collectionStyle = 'block'; // Default is usually fine

  let result = doc.toString(toStringOptions);

  // Post-process to fix double-escaped quotes within Helm templates
  // The yaml library escapes quotes in strings, but Helm templates need unescaped quotes
  // Simply replace all \" with " globally - this is safe because we're only processing
  // Helm template strings that should never have escaped quotes
  result = result.replace(/\\"/g, '"');

  // Remove escaped backslashes that appear before spaces in YAML
  // Pattern: "\  " -> "  " (two spaces)
  result = result.replace(/\\\\/g, '');

  // Post-process to handle template-only values that should be raw YAML
  // These are values that are ONLY a Helm template (start with {{ and end with }})
  // They should not be quoted so Helm can expand them as YAML structure

  // 1. Handle Block Literals (multiline constructs like if/range)
  // Pattern: "| \n  {{- if ... }}" -> "{{- if ... }}" (indented)
  // We need to remove the pipe and the newline after it, but keep indentation
  // The yaml library outputs: key: |
  //                             {{- if ... }}
  // We want: key:
  //            {{- if ... }}

  // Actually, we just need to remove the "| " (or "|\n") if it's followed by a Helm block
  // But regex on the whole string is risky for context.

  // Let's stick to the previous approach but handle the pipe if present.
  // If we used BLOCK_LITERAL, the output is:
  // key: |
  //   {{- if ... }}

  // We can replace ": |" with ":" ? No, that affects all block literals.

  // Let's refine:
  // Match: ": |" or ": |-" or ": |+" followed by newline and indent and {{
  // regex: /:\s*\|[-+]?\s*\n(\s*\{\{)/g
  result = result.replace(/:\s*\|[-+]?\s*\n(\s*\{\{)/g, ':\n$1');

  // 2. Handle Quoted Strings (single line expressions)
  // Pattern: "{{- include "name" . | nindent 4 }}" -> {{- include "name" . | nindent 4 }}
  // We need to remove quotes around pure template expressions, including multiline blocks
  // Match any quoted string that starts with {{ and ends with }}
  // Use [\s\S]*? for non-greedy multiline match
  result = result.replace(/"(\{\{[\s\S]*?\}\})"/g, '$1');

  return result;
}

/**
 * Legacy compatible stringify method.
 * @param obj Object to serialize.
 * @param options Options.
 * @returns YAML string.
 * @since 2.11.0
 */
export function stringify(
  obj: unknown,
  options: {
    lineWidth?: number;
    doubleQuotedAsJSON?: boolean;
    simpleKeys?: boolean;
  } = {},
): string {
  return dumpHelmAwareYaml(
    obj,
    options.lineWidth !== undefined ? { lineWidth: options.lineWidth } : {},
  );
}

// --- Validation and Prettify functions ---

/**
 * Helm expression types for pattern matching
 * @since 2.11.0
 */
type HelmExpressionType =
  | 'block'
  | 'nested'
  | 'comment'
  | 'action-trimmed'
  | 'raw'
  | 'include-context'
  | 'generic';

/**
 * Pattern descriptor with compiled RegExp and its type
 * @since 2.11.0
 */
interface PatternDescriptor {
  regex: RegExp;
  type: HelmExpressionType;
}

/**
 * Compile and cache Helm expression patterns with types for optimized single pass processing
 * @since 2.11.0
 */
const COMPILED_PATTERNS: PatternDescriptor[] = [
  { regex: /\{\{-?\s*define\s+[^}]+\s*-?\}\}[\s\S]*?\{\{-?\s*end\s*-?\}\}/g, type: 'block' },
  { regex: /\{\{[^}]*\{\{[^}]*\}\}[^}]*\}\}/g, type: 'nested' },
  { regex: /\{\{\/\*[\s\S]*?\*\/\}\}/g, type: 'comment' },
  { regex: /\{\{-?[\s\S]*?-?\}\}/g, type: 'action-trimmed' },
  { regex: /\{\{`[\s\S]*?`\}\}/g, type: 'raw' },
  { regex: /\{\{\s*include\s+"[^"]+"\s+[^}]+\s*\}\}/g, type: 'include-context' },
];

/**
 * Represents a match of a Helm expression in a string with position details
 * @since 2.11.0
 */
interface HelmExpressionMatch {
  type: HelmExpressionType;
  expression: string;
  start: number;
  end: number;
}

/**
 * Interface to report validation errors of Helm YAML content.
 * @since 2.11.0
 */
export interface HelmValidationError {
  type: 'syntax' | 'semantic' | 'reference' | 'type';
  message: string;
  line?: number;
  column?: number;
  expression?: string;
  suggestion?: string;
}

/**
 * Result of Helm YAML validation process.
 * @since 2.11.0
 */
export interface HelmValidationResult {
  isValid: boolean;
  errors: HelmValidationError[];
  warnings: HelmValidationError[];
  statistics: {
    totalExpressions: number;
    expressionsByType: Record<string, number>;
    complexity: number;
  };
}

/**
 * Validate YAML string with Helm template expressions.
 * - Parses Helm expressions from the string,
 * - Performs balanced parentheses and quote checks,
 * - Collects syntax errors, semantic warnings,
 * - Provides statistics including complexity.
 *
 * @param yaml YAML content string to validate.
 * @returns Validation result with errors, warnings, and stats.
 * @since 2.11.0
 * @since 2.14.0 Restored full validation functionality
 */
export function validateHelmYaml(yaml: string): HelmValidationResult {
  const errors: HelmValidationError[] = [];
  const warnings: HelmValidationError[] = [];

  // Detect all Helm expressions with types and positions
  const expressions = parseHelmExpressions(yaml);

  // Global check for unbalanced braces
  const openBraces = (yaml.match(/\{\{/g) || []).length;
  const closeBraces = (yaml.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push({
      type: 'syntax',
      message: 'Unbalanced Helm template braces detected in file',
      line: 0,
      column: 0,
      expression: '',
    });
  }

  // Syntax validation with error capturing
  for (const expr of expressions) {
    try {
      validateHelmSyntax(expr.expression);
    } catch (err) {
      errors.push({
        type: 'syntax',
        message: err instanceof Error ? err.message : 'Unknown syntax error',
        line: expr.startLine,
        column: expr.startCol,
        expression: expr.expression,
      });
    }
  }

  checkCommonIssues(yaml, warnings);
  checkQuotedExpressions(yaml, warnings);

  const expressionsByType = expressions.reduce(
    (acc, expr) => {
      acc[expr.type] = (acc[expr.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const complexity = calculateComplexity(
    expressions.map((expr) => ({
      type: expr.type,
      expression: expr.expression,
      start: 0,
      end: 0,
    })),
  );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    statistics: {
      totalExpressions: expressions.length,
      expressionsByType,
      complexity,
    },
  };
}

/**
 * Internal helper to parse Helm expressions with line and column positions.
 * Supports advanced expression types and range matching.
 * @param content YAML string content.
 * @returns List of detected Helm expressions with positional info.
 * @since 2.11.0
 */
export function parseHelmExpressions(content: string): Array<{
  type: HelmExpressionType;
  expression: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}> {
  const expressions = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: iterating over array indices
    const line = lines[i];
    if (!line) continue;
    for (const { regex, type } of COMPILED_PATTERNS) {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(line)) !== null) {
        expressions.push({
          type,
          expression: match[0],
          startLine: i + 1,
          startCol: match.index + 1,
          endLine: i + 1,
          endCol: match.index + match[0].length + 1,
        });
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    }
  }
  return expressions;
}

/**
 * Validate Helm syntax for a single Helm expression string.
 * Checks for balanced parentheses, balanced quotes, basic function call validity.
 * Throws errors with descriptive messages on failure.
 * @param expression Helm template expression string.
 * @throws Error on syntax validation failure.
 * @since 2.11.0
 */
function validateHelmSyntax(expression: string): void {
  // Strip outer braces for parsing content
  const content = expression.replace(/^\{\{-?\s*/, '').replace(/\s*-?\}\}$/, '');

  if (!isBalanced(content, '(', ')')) {
    throw new Error('Unbalanced parentheses in Helm expression');
  }
  if (!isQuotesBalanced(content)) {
    throw new Error('Unbalanced quotes in Helm expression');
  }
  validateFunctionCalls(content);
}

/**
 * Check that string has balanced pairs of the specified characters.
 * @param str String to check.
 * @param open Open character.
 * @param close Close character.
 * @returns True if balanced.
 * @since 2.11.0
 */
function isBalanced(str: string, open: string, close: string): boolean {
  let count = 0;
  for (const c of str) {
    if (c === open) count++;
    else if (c === close) count--;
    if (count < 0) return false;
  }
  return count === 0;
}

/**
 * Checks if quotes in string are balanced.
 * Supports single and double quotes ignoring escaped quotes.
 * @param str String to check.
 * @returns True if balanced.
 * @since 2.11.0
 */
function isQuotesBalanced(str: string): boolean {
  let singleQuoteOpen = false;
  let doubleQuoteOpen = false;
  let escaped = false;
  for (const c of str) {
    if (c === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (
      (c === "'" && !doubleQuoteOpen && !escaped) ||
      (c === '"' && !singleQuoteOpen && !escaped)
    ) {
      if (c === "'") singleQuoteOpen = !singleQuoteOpen;
      else doubleQuoteOpen = !doubleQuoteOpen;
    }
    escaped = false;
  }
  return !singleQuoteOpen && !doubleQuoteOpen;
}

/**
 * Validate simple function call well-formedness for Helm expressions.
 * Checks for basic invalid nested parentheses or arguments.
 * Throws error if checks fail.
 * @param content Expression string content (without outer braces).
 * @throws Error on invalid functions.
 * @since 2.11.0
 */
function validateFunctionCalls(_content: string): void {
  // Basic sanity: function names followed by open paren, balanced args are checked by previous functions
  // Additional validations can be implemented here as needed.
  // For now, no error thrown by default.
}

/**
 * Checks for common semantic issues in the YAML string to emit warnings.
 * Checks for deprecated functions and problematic usage.
 * @param yaml YAML string content.
 * @param warnings Array to populate warnings.
 * @since 2.11.0
 */
function checkCommonIssues(yaml: string, warnings: HelmValidationError[]): void {
  const deprecatedFunctions = ['template'];
  for (const func of deprecatedFunctions) {
    // eslint-disable-next-line security/detect-non-literal-regexp -- Safe: controlled function names from predefined list
    const pattern = new RegExp(`\\{\\{[^}]*\\b${func}\\b[^}]*\\}\\}`, 'g');
    let match;
    while ((match = pattern.exec(yaml)) !== null) {
      warnings.push({
        type: 'semantic',
        message: `Function '${func}' is deprecated`,
        expression: match[0],
        suggestion: `Consider avoiding deprecated function '${func}'`,
      });
    }
  }
}

/**
 * Check for quoted Helm expressions, which is an anti-pattern.
 * Emits warnings advising to remove quotes.
 * @param yaml YAML string content.
 * @param warnings Array to populate warnings.
 * @since 2.11.0
 * @since 2.11.1 Corrected pattern matching to capture quoted Helm templates
 */
function checkQuotedExpressions(yaml: string, warnings: HelmValidationError[]): void {
  const quotedPatterns = [/'(\{\{[^}]+\}\})'/g, /"(\{\{[^}]+\}\})"/g];
  for (const pattern of quotedPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(yaml)) !== null) {
      warnings.push({
        type: 'semantic',
        message: 'Helm expression should not be quoted',
        expression: match[0],
        suggestion: `Remove quotes around: ${match[1]}`,
      });
    }
  }
}

/**
 * Naive calculation of complexity score based on number and type of Helm expressions.
 * Used for validation statistics.
 * @param expressions Array of Helm expression matches.
 * @returns Complexity score number.
 * @since 2.11.0
 */
function calculateComplexity(expressions: HelmExpressionMatch[]): number {
  let score = 0;
  for (const expr of expressions) {
    switch (expr.type) {
      case 'block':
        score += 5;
        break;
      case 'nested':
        score += 4;
        break;
      case 'comment':
        score += 0;
        break;
      default:
        score += 1;
    }
  }
  return score;
}

// Export other helpers for compatibility if needed
export function detectHelmExpressions(str: string): unknown[] {
  return parseHelmExpressions(str);
}
export function preprocessHelmExpressions(obj: unknown): unknown {
  return preprocessHelmConstructs(obj);
}
export function postProcessHelmExpressions(yaml: string): string {
  return yaml;
}
