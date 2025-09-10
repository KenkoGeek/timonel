/**
 * Helpers to embed Helm template expressions while staying type-safe in TS.
 * We treat Helm placeholders as opaque strings that will be preserved in YAML.
 */

import { SecurityUtils } from './security.js';

/** Create a .Values reference like {{ .Values.key }} */
export function valuesRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} }}`;
}

/** Create a required .Values reference with default: {{ required msg .Values.key }} */
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
 */
function isValidHelmPath(path: string): boolean {
  // Use centralized validation from SecurityUtils
  return SecurityUtils.isValidHelmTemplatePath(path);
}

/** Built-in Helm references */
export const helm = {
  releaseName: '{{ .Release.Name }}',
  chartName: '{{ .Chart.Name }}',
  chartVersion: '{{ .Chart.Version }}',
  namespace: '{{ .Release.Namespace }}',
};

/** Quote a Helm template expression for safe YAML embedding */
export function quote(expr: string): string {
  // ensure Helm templates are quoted to avoid YAML parsing issues
  if (expr.startsWith('{{') && expr.endsWith('}}')) {
    return `'${expr}'`;
  }
  return expr;
}

/** Indent helper matching Helm indent fn: {{- n indent -}} */
export function indent(n: number, expr: string): string {
  const spaces = ' '.repeat(n);
  return expr
    .split('\n')
    .map((l) => (l.trim().length ? spaces + l : l))
    .join('\n');
}

/** Insert a call to a named Helm template: {{ template "name" . }} */
export function template(name: string, context = '.'): string {
  return `{{ template "${name}" ${context} }}`;
}

/** Insert a call to a named Helm template using include: {{ include "name" . }} */
export function include(name: string, context = '.'): string {
  return `{{ include "${name}" ${context} }}`;
}

/** Numeric value from .Values with int cast (truncates decimals): {{ .Values.path | int }} */
export function numberRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | int }}`;
}

/** Boolean value from .Values with toBool cast: {{ .Values.path | toBool }} */
export function boolRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | toBool }}`;
}

/** String value from .Values with toString cast: {{ .Values.path | toString }} */
export function stringRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | toString }}`;
}

/** Float value from .Values with float64 cast: {{ .Values.path | float64 }} */
export function floatRef(path: string): string {
  if (!isValidHelmPath(path)) {
    throw new Error(`Invalid Helm template path: ${path}`);
  }
  return `{{ .Values.${path} | float64 }}`;
}
