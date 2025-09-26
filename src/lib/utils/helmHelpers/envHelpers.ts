/**
 * @fileoverview Environment and configuration management helpers for Helm templates
 * @since 2.11.0
 */

import type { HelperDefinition } from './types.js';

/**
 * Environment and configuration management helpers
 *
 * These helpers provide robust environment variable handling, configuration merging,
 * and environment-specific logic for Helm templates. They support common CI/CD patterns
 * and configuration management best practices.
 *
 * @since 2.11.0
 */
export const ENV_HELPERS: HelperDefinition[] = [
  {
    name: 'env.required',
    template: `{{- $key := . -}}
{{- $value := index .Values.env $key -}}
{{- required (printf "Environment variable %s is required" $key) $value }}`,
  },
  {
    name: 'env.isDev',
    template: `{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "dev") (eq $env "development") }}`,
  },
  {
    name: 'env.isProd',
    template: `{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "prod") (eq $env "production") }}`,
  },
  {
    name: 'env.isStaging',
    template: `{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "staging") (eq $env "stage") }}`,
  },
  {
    name: 'env.isTest',
    template: `{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "test") (eq $env "testing") }}`,
  },
  {
    name: 'config.merge',
    template: `{{- $base := .base | default dict -}}
{{- $env := .env | default dict -}}
{{- $override := .override | default dict -}}
{{- merge $override $env $base | toJson }}`,
  },
  {
    name: 'config.secretRef',
    template: `{{- if .fromSecret -}}
valueFrom:
  secretKeyRef:
    name: {{ .fromSecret.name }}
    key: {{ .fromSecret.key }}
    {{- if .fromSecret.optional }}
    optional: true
    {{- end }}
{{- else if .fromConfigMap -}}
valueFrom:
  configMapKeyRef:
    name: {{ .fromConfigMap.name }}
    key: {{ .fromConfigMap.key }}
    {{- if .fromConfigMap.optional }}
    optional: true
    {{- end }}
{{- else -}}
value: {{ .value | quote }}
{{- end }}`,
  },
  {
    name: 'config.envFromSource',
    template: `{{- if .configMapRef -}}
configMapRef:
  name: {{ .configMapRef.name }}
  {{- if .configMapRef.optional }}
  optional: true
  {{- end }}
{{- else if .secretRef -}}
secretRef:
  name: {{ .secretRef.name }}
  {{- if .secretRef.optional }}
  optional: true
  {{- end }}
{{- end }}`,
  },
  {
    name: 'config.featureFlag',
    template: `{{- $flag := .flag -}}
{{- $default := .default | default false -}}
{{- $envKey := printf "FEATURE_%s" ($flag | upper) -}}
{{- $envFlag := index .Values.env $envKey | default "" -}}
{{- $valueFlag := index .Values.features $flag | default "" -}}
{{- if $valueFlag }}
{{- $valueFlag }}
{{- else if $envFlag }}
{{- $envFlag }}
{{- else }}
{{- $default }}
{{- end }}`,
  },
  {
    name: 'config.debugMode',
    template: `{{- $debug := .Values.debug | default (index .Values.env "DEBUG") | default false -}}
{{- if or $debug (include "env.isDev" .) -}}
true
{{- else -}}
false
{{- end }}`,
  },
];
