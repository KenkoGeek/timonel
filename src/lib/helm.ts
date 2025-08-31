/**
 * Helpers to embed Helm template expressions while staying type-safe in TS.
 * We treat Helm placeholders as opaque strings that will be preserved in YAML.
 */

/** Create a .Values reference like {{ .Values.key }} */
export function valuesRef(path: string): string {
  return `{{ .Values.${path} }}`;
}

/** Create a required .Values reference with default: {{ required msg .Values.key }} */
export function requiredValuesRef(path: string, message?: string): string {
  const msg = message ?? `${path} is required`;
  return `{{ required "${msg}" .Values.${path} }}`;
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
