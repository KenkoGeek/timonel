/**
 * @fileoverview GitOps and CI/CD helpers for Helm templates
 * @since 2.11.0
 */

import type { HelperDefinition } from './types.js';

/**
 * GitOps and CI/CD helpers
 *
 * These helpers provide integration with modern GitOps workflows and CI/CD systems.
 * They support Git metadata, build information, image tagging strategies, and
 * deployment annotations for traceability and auditability.
 *
 * @since 2.11.0
 */
export const GITOPS_HELPERS: HelperDefinition[] = [
  {
    name: 'git.commitSha',
    template: `{{- .Values.git.commitSha | default "unknown" }}`,
  },
  {
    name: 'git.shortSha',
    template: `{{- $sha := include "git.commitSha" . -}}
{{- if ne $sha "unknown" -}}
{{- $sha | trunc 8 -}}
{{- else -}}
unknown
{{- end }}`,
  },
  {
    name: 'git.branch',
    template: `{{- .Values.git.branch | default "main" }}`,
  },
  {
    name: 'git.tag',
    template: `{{- .Values.git.tag | default "" }}`,
  },
  {
    name: 'git.repository',
    template: `{{- .Values.git.repository | default "unknown/repository" }}`,
  },
  {
    name: 'image.tagWithSha',
    template: `{{- $repo := .Values.image.repository -}}
{{- $sha := include "git.shortSha" . -}}
{{- printf "%s:%s" $repo $sha }}`,
  },
  {
    name: 'image.tagWithVersion',
    template: `{{- $repo := .Values.image.repository -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion | default "latest" -}}
{{- printf "%s:%s" $repo $tag }}`,
  },
  {
    name: 'image.tagWithBranch',
    template: `{{- $repo := .Values.image.repository -}}
{{- $branch := include "git.branch" . | replace "/" "-" | lower -}}
{{- printf "%s:%s" $repo $branch }}`,
  },
  {
    name: 'ci.buildId',
    template: `{{- .Values.ci.buildId | default "unknown" }}`,
  },
  {
    name: 'ci.buildUrl',
    template: `{{- .Values.ci.buildUrl | default "" }}`,
  },
  {
    name: 'ci.jobUrl',
    template: `{{- .Values.ci.jobUrl | default "" }}`,
  },
  {
    name: 'ci.runner',
    template: `{{- .Values.ci.runner | default "unknown" }}`,
  },
  {
    name: 'deploy.timestamp',
    template: `{{- now | date "2006-01-02T15:04:05Z07:00" }}`,
  },
  {
    name: 'deploy.user',
    template: `{{- .Values.deploy.user | default "automated" }}`,
  },
  {
    name: 'deploy.annotations',
    template: `deployment.kubernetes.io/revision: "{{ .Release.Revision }}"
app.kubernetes.io/version: "{{ .Chart.AppVersion }}"
app.kubernetes.io/part-of: "{{ .Values.application.name | default .Chart.Name }}"
git.commit: "{{ include "git.commitSha" . }}"
git.branch: "{{ include "git.branch" . }}"
git.repository: "{{ include "git.repository" . }}"
ci.build-id: "{{ include "ci.buildId" . }}"
ci.build-url: "{{ include "ci.buildUrl" . }}"
deploy.timestamp: "{{ include "deploy.timestamp" . }}"
deploy.user: "{{ include "deploy.user" . }}"`,
  },
  {
    name: 'deploy.labels',
    template: `app.kubernetes.io/version: "{{ .Chart.AppVersion }}"
app.kubernetes.io/component: "{{ .Values.component | default "application" }}"
app.kubernetes.io/part-of: "{{ .Values.application.name | default .Chart.Name }}"
git.branch: "{{ include "git.branch" . | replace "/" "-" | lower }}"
environment: "{{ .Values.environment | default "development" }}"`,
  },
  {
    name: 'semver.parse',
    template: `{{- $version := . -}}
{{- $parts := regexSplit "\\." $version -1 -}}
{{- if eq (len $parts) 3 -}}
{{- printf "{\\"major\\": %s, \\"minor\\": %s, \\"patch\\": %s}" (index $parts 0) (index $parts 1) (index $parts 2) -}}
{{- else -}}
{{- printf "{\\"major\\": 0, \\"minor\\": 0, \\"patch\\": 0}" -}}
{{- end }}`,
  },
  {
    name: 'semver.bump',
    template: `{{- $version := .version -}}
{{- $type := .type | default "patch" -}}
{{- $parts := regexSplit "\\." $version -1 -}}
{{- if eq (len $parts) 3 -}}
{{- $major := index $parts 0 | int -}}
{{- $minor := index $parts 1 | int -}}
{{- $patch := index $parts 2 | int -}}
{{- if eq $type "major" -}}
{{- printf "%d.0.0" (add $major 1) -}}
{{- else if eq $type "minor" -}}
{{- printf "%d.%d.0" $major (add $minor 1) -}}
{{- else -}}
{{- printf "%d.%d.%d" $major $minor (add $patch 1) -}}
{{- end -}}
{{- else -}}
{{- fail (printf "Invalid semantic version: %s" $version) -}}
{{- end }}`,
  },
  {
    name: 'rollout.canaryWeight',
    template: `{{- $weight := .Values.rollout.canary.weight | default 10 -}}
{{- $env := .Values.environment | default "development" -}}
{{- if eq $env "production" -}}
{{- min $weight 5 -}}
{{- else if eq $env "staging" -}}
{{- min $weight 50 -}}
{{- else -}}
{{- $weight -}}
{{- end }}`,
  },
];
