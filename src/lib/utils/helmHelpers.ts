/**
 * @fileoverview Helm chart helpers and templates
 * @since 2.8.0+
 */

/**
 * Helper definition for Helm templates
 * @interface HelperDefinition
 * @since 2.8.0+
 */
export interface HelperDefinition {
  /** Helper name (without quotes or hyphens) */
  name: string;
  /** Helper template content */
  template: string;
}

/**
 * Standard Helm chart helpers following best practices
 * @since 2.8.0+
 */
export const STANDARD_HELPERS: HelperDefinition[] = [
  {
    name: 'chart.name',
    template: `{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}`,
  },
  {
    name: 'chart.fullname',
    template: `{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}`,
  },
  {
    name: 'chart.chart',
    template: `{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}`,
  },
  {
    name: 'chart.labels',
    template: `helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}`,
  },
  {
    name: 'chart.selectorLabels',
    template: `app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}`,
  },
];

/**
 * File access helpers using Helm .Files object
 * @since 2.8.4+
 */
export const FILE_ACCESS_HELPERS: HelperDefinition[] = [
  {
    name: 'files.configFromFile',
    template: `{{- $path := . -}}
{{- if $.Files.Get $path -}}
{{- $.Files.Get $path | nindent 2 -}}
{{- else -}}
{{- fail (printf "File %s not found in chart" $path) -}}
{{- end -}}`,
  },
  {
    name: 'files.configMapFromFiles',
    template: `{{- $root := . -}}
{{- $pattern := .pattern -}}
{{- $files := .files | default ($root.Files.Glob $pattern) -}}
{{- range $path, $content := $files }}
  {{ base $path }}: |
{{ $content | indent 4 }}
{{- end }}`,
  },
  {
    name: 'files.secretFromFiles',
    template: `{{- $root := . -}}
{{- $pattern := .pattern -}}
{{- $files := .files | default ($root.Files.Glob $pattern) -}}
{{- range $path, $content := $files }}
  {{ base $path }}: {{ $content | b64enc }}
{{- end }}`,
  },
  {
    name: 'files.exists',
    template: `{{- $path := . -}}
{{- if $.Files.Get $path -}}
true
{{- else -}}
false
{{- end -}}`,
  },
];

/**
 * Advanced template function helpers
 * @since 2.8.4+
 */
export const TEMPLATE_FUNCTION_HELPERS: HelperDefinition[] = [
  {
    name: 'template.render',
    template: `{{- $template := .template -}}
{{- $context := .context | default . -}}
{{- tpl $template $context -}}`,
  },
  {
    name: 'template.renderWithValues',
    template: `{{- $template := .template -}}
{{- $values := .values | default dict -}}
{{- $context := merge $values . -}}
{{- tpl $template $context -}}`,
  },
  {
    name: 'validation.required',
    template: `{{- $value := .value -}}
{{- $message := .message | default (printf "Value %s is required" .key) -}}
{{- required $message $value -}}`,
  },
  {
    name: 'validation.requireAny',
    template: `{{- $values := .values -}}
{{- $message := .message | default "At least one value is required" -}}
{{- $found := false -}}
{{- range $values -}}
{{- if . -}}
{{- $found = true -}}
{{- end -}}
{{- end -}}
{{- if not $found -}}
{{- fail $message -}}
{{- end -}}`,
  },
];

/**
 * Sprig library function helpers for common use cases
 * @since 2.8.4+
 */
export const SPRIG_HELPERS: HelperDefinition[] = [
  {
    name: 'string.camelCase',
    template: `{{- . | camelcase }}`,
  },
  {
    name: 'string.kebabCase',
    template: `{{- . | kebabcase }}`,
  },
  {
    name: 'string.snakeCase',
    template: `{{- . | snakecase }}`,
  },
  {
    name: 'string.randomAlphaNum',
    template: `{{- $length := . | default 8 -}}
{{- randAlphaNum $length }}`,
  },
  {
    name: 'env.getOrDefault',
    template: `{{- $key := .key -}}
{{- $default := .default | default "" -}}
{{- $default }}`,
  },
  {
    name: 'list.compact',
    template: `{{- $list := . -}}
{{- $result := list -}}
{{- range $list -}}
{{- if . -}}
{{- $result = append $result . -}}
{{- end -}}
{{- end -}}
{{- $result | toJson }}`,
  },
  {
    name: 'dict.merge',
    template: `{{- $base := .base | default dict -}}
{{- $override := .override | default dict -}}
{{- merge $override $base | toJson }}`,
  },
  {
    name: 'date.now',
    template: `{{- now | date "2006-01-02T15:04:05Z07:00" }}`,
  },
  {
    name: 'date.format',
    template: `{{- $format := .format | default "2006-01-02" -}}
{{- $date := .date | default now -}}
{{- $date | date $format }}`,
  },
];

/**
 * Kubernetes-specific helpers for common patterns
 * @since 2.8.4+
 */
export const KUBERNETES_HELPERS: HelperDefinition[] = [
  {
    name: 'k8s.imagePullPolicy',
    template: `{{- $tag := .tag | default .Values.image.tag -}}
{{- if or (eq $tag "latest") (hasSuffix "-SNAPSHOT" $tag) -}}
Always
{{- else -}}
IfNotPresent
{{- end }}`,
  },
  {
    name: 'k8s.resourceName',
    template: `{{- $root := .root | default . -}}
{{- $name := .name | default (include "chart.fullname" $root) -}}
{{- $suffix := .suffix | default "" -}}
{{- if $suffix -}}
{{- printf "%s-%s" $name $suffix | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name | trunc 63 | trimSuffix "-" -}}
{{- end }}`,
  },
  {
    name: 'k8s.annotations',
    template: `{{- $global := .Values.global.annotations | default dict -}}
{{- $local := .annotations | default dict -}}
{{- $merged := merge $local $global -}}
{{- if $merged -}}
{{- range $key, $value := $merged }}
{{ $key }}: {{ $value | quote }}
{{- end -}}
{{- end }}`,
  },
  {
    name: 'k8s.labels',
    template: `{{- $global := .Values.global.labels | default dict -}}
{{- $local := .labels | default dict -}}
{{- $standard := include "chart.labels" . | fromYaml -}}
{{- $merged := merge $local $global $standard -}}
{{- range $key, $value := $merged }}
{{ $key }}: {{ $value | quote }}
{{- end }}`,
  },
  {
    name: 'k8s.probe',
    template: `{{- $probe := . -}}
{{- if $probe.enabled | default true -}}
{{- if $probe.httpGet }}
httpGet:
  path: {{ $probe.httpGet.path | default "/" }}
  port: {{ $probe.httpGet.port | default "http" }}
  {{- if $probe.httpGet.scheme }}
  scheme: {{ $probe.httpGet.scheme }}
  {{- end }}
{{- else if $probe.tcpSocket }}
tcpSocket:
  port: {{ $probe.tcpSocket.port | default "http" }}
{{- else if $probe.exec }}
exec:
  command:
  {{- range $probe.exec.command }}
  - {{ . | quote }}
  {{- end }}
{{- end }}
initialDelaySeconds: {{ $probe.initialDelaySeconds | default 30 }}
periodSeconds: {{ $probe.periodSeconds | default 10 }}
timeoutSeconds: {{ $probe.timeoutSeconds | default 5 }}
successThreshold: {{ $probe.successThreshold | default 1 }}
failureThreshold: {{ $probe.failureThreshold | default 3 }}
{{- end }}`,
  },
];

/**
 * AWS-specific Helm helpers
 * @since 2.8.0+
 */
export const AWS_HELPERS: HelperDefinition[] = [
  {
    name: 'aws.region',
    template: `{{- .Values.aws.region | default "us-east-1" }}`,
  },
  {
    name: 'aws.accountId',
    template: `{{- required "AWS Account ID is required" .Values.aws.accountId }}`,
  },
  {
    name: 'aws.irsaRoleArn',
    template: `{{- printf "arn:aws:iam::%s:role/%s" (include "aws.accountId" .) .Values.aws.irsaRoleName }}`,
  },
  {
    name: 'aws.ecrRepository',
    template: `{{- printf "%s.dkr.ecr.%s.amazonaws.com/%s" (include "aws.accountId" .) (include "aws.region" .) .Values.aws.ecrRepositoryName }}`,
  },
  {
    name: 'aws.s3Bucket',
    template: `{{- $region := include "aws.region" . -}}
{{- $accountId := include "aws.accountId" . -}}
{{- $bucketName := .bucketName | default (printf "%s-%s-%s" .Release.Name $region $accountId | lower) -}}
{{- $bucketName | trunc 63 | trimSuffix "-" }}`,
  },
  {
    name: 'aws.secretsManagerSecret',
    template: `{{- $region := include "aws.region" . -}}
{{- $secretName := .secretName | default (printf "%s/%s" .Release.Namespace .Release.Name) -}}
{{- printf "arn:aws:secretsmanager:%s:%s:secret:%s" $region (include "aws.accountId" .) $secretName }}`,
  },
];

/**
 * Converts helper definitions to Helm template format
 * @param helpers - Array of helper definitions
 * @returns Formatted Helm template string
 * @since 2.8.0+
 */
export function formatHelpers(helpers: HelperDefinition[]): string {
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
 * Gets default helpers based on cloud provider and feature flags
 * @param cloudProvider - Target cloud provider
 * @param options - Configuration options for helper inclusion
 * @returns Combined standard and cloud-specific helpers
 * @since 2.8.4+
 */
export function getDefaultHelpers(
  cloudProvider?: 'aws',
  options?: {
    includeFileAccess?: boolean;
    includeTemplateFunction?: boolean;
    includeSprig?: boolean;
    includeKubernetes?: boolean;
  },
): HelperDefinition[] {
  const helpers = [...STANDARD_HELPERS];

  // Add file access helpers by default
  if (options?.includeFileAccess !== false) {
    helpers.push(...FILE_ACCESS_HELPERS);
  }

  // Add template function helpers by default
  if (options?.includeTemplateFunction !== false) {
    helpers.push(...TEMPLATE_FUNCTION_HELPERS);
  }

  // Add Sprig helpers by default
  if (options?.includeSprig !== false) {
    helpers.push(...SPRIG_HELPERS);
  }

  // Add Kubernetes helpers by default
  if (options?.includeKubernetes !== false) {
    helpers.push(...KUBERNETES_HELPERS);
  }

  // Add cloud-specific helpers
  if (cloudProvider === 'aws') {
    helpers.push(...AWS_HELPERS);
  }

  return helpers;
}

/**
 * Generates complete _helpers.tpl content
 * @param cloudProvider - Optional cloud provider for specific helpers
 * @param customHelpers - Additional custom helpers
 * @param options - Configuration options for helper inclusion
 * @returns Complete helpers template content
 * @since 2.8.4+
 */
export function generateHelpersTemplate(
  cloudProvider?: 'aws',
  customHelpers?: HelperDefinition[],
  options?: {
    includeFileAccess?: boolean;
    includeTemplateFunction?: boolean;
    includeSprig?: boolean;
    includeKubernetes?: boolean;
  },
): string {
  const helpers = getDefaultHelpers(cloudProvider, options);

  if (customHelpers) {
    helpers.push(...customHelpers);
  }

  return formatHelpers(helpers);
}

/**
 * Gets helpers for specific categories
 * @param category - Helper category to retrieve
 * @returns Array of helper definitions for the specified category
 * @since 2.8.4+
 */
export function getHelpersByCategory(
  category: 'standard' | 'fileAccess' | 'templateFunction' | 'sprig' | 'kubernetes' | 'aws',
): HelperDefinition[] {
  switch (category) {
    case 'standard':
      return [...STANDARD_HELPERS];
    case 'fileAccess':
      return [...FILE_ACCESS_HELPERS];
    case 'templateFunction':
      return [...TEMPLATE_FUNCTION_HELPERS];
    case 'sprig':
      return [...SPRIG_HELPERS];
    case 'kubernetes':
      return [...KUBERNETES_HELPERS];
    case 'aws':
      return [...AWS_HELPERS];
    default:
      return [];
  }
}

/**
 * Creates a custom helper definition
 * @param name - Helper name
 * @param template - Helper template content
 * @returns Helper definition object
 * @since 2.8.4+
 */
export function createHelper(name: string, template: string): HelperDefinition {
  return { name, template };
}
