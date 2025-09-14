/**
 * @fileoverview Helm chart helpers and templates
 * @since 2.5.0
 */

/**
 * Helper definition for Helm templates
 * @interface HelperDefinition
 * @since 2.5.0
 */
export interface HelperDefinition {
  /** Helper name (without quotes or hyphens) */
  name: string;
  /** Helper template content */
  template: string;
}

/**
 * Standard Helm chart helpers following best practices
 * @since 2.5.0
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
 * AWS-specific Helm helpers
 * @since 2.5.0
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
];

/**
 * Converts helper definitions to Helm template format
 * @param helpers - Array of helper definitions
 * @returns Formatted Helm template string
 * @since 2.5.0
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
 * Gets default helpers based on cloud provider
 * @param cloudProvider - Target cloud provider
 * @returns Combined standard and cloud-specific helpers
 * @since 2.5.0
 */
export function getDefaultHelpers(cloudProvider?: 'aws'): HelperDefinition[] {
  const helpers = [...STANDARD_HELPERS];

  if (cloudProvider === 'aws') {
    helpers.push(...AWS_HELPERS);
  }

  return helpers;
}

/**
 * Generates complete _helpers.tpl content
 * @param cloudProvider - Optional cloud provider for specific helpers
 * @param customHelpers - Additional custom helpers
 * @returns Complete helpers template content
 * @since 2.5.0
 */
export function generateHelpersTemplate(
  cloudProvider?: 'aws',
  customHelpers?: HelperDefinition[],
): string {
  const helpers = getDefaultHelpers(cloudProvider);

  if (customHelpers) {
    helpers.push(...customHelpers);
  }

  return formatHelpers(helpers);
}
