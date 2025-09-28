{{/*
chart.name
*/}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
chart.fullname
*/}}
{{- define "chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
chart.chart
*/}}
{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
chart.labels
*/}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
chart.selectorLabels
*/}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
files.configFromFile
*/}}
{{- define "files.configFromFile" -}}
{{- $path := . -}}
{{- if $.Files.Get $path -}}
{{- $.Files.Get $path | nindent 2 -}}
{{- else -}}
{{- fail (printf "File %s not found in chart" $path) -}}
{{- end -}}
{{- end }}

{{/*
files.configMapFromFiles
*/}}
{{- define "files.configMapFromFiles" -}}
{{- $root := . -}}
{{- $pattern := .pattern -}}
{{- $files := .files | default ($root.Files.Glob $pattern) -}}
{{- range $path, $content := $files }}
  {{ base $path }}: |
{{ $content | indent 4 }}
{{- end }}
{{- end }}

{{/*
files.secretFromFiles
*/}}
{{- define "files.secretFromFiles" -}}
{{- $root := . -}}
{{- $pattern := .pattern -}}
{{- $files := .files | default ($root.Files.Glob $pattern) -}}
{{- range $path, $content := $files }}
  {{ base $path }}: {{ $content | b64enc }}
{{- end }}
{{- end }}

{{/*
files.exists
*/}}
{{- define "files.exists" -}}
{{- $path := . -}}
{{- if $.Files.Get $path -}}
true
{{- else -}}
false
{{- end -}}
{{- end }}

{{/*
template.render
*/}}
{{- define "template.render" -}}
{{- $template := .template -}}
{{- $context := .context | default . -}}
{{- tpl $template $context -}}
{{- end }}

{{/*
template.renderWithValues
*/}}
{{- define "template.renderWithValues" -}}
{{- $template := .template -}}
{{- $values := .values | default dict -}}
{{- $context := merge $values . -}}
{{- tpl $template $context -}}
{{- end }}

{{/*
validation.requireAny
*/}}
{{- define "validation.requireAny" -}}
{{- $values := .values -}}
{{- $message := .message | default "At least one value is required" -}}
{{- $found := false -}}
{{- range $values -}}
{{- if . -}}
{{- $found = true -}}
{{- end -}}
{{- end -}}
{{- if not $found -}}
{{- fail $message -}}
{{- end -}}
{{- end }}

{{/*
string.camelCase
*/}}
{{- define "string.camelCase" -}}
{{- . | camelcase }}
{{- end }}

{{/*
string.kebabCase
*/}}
{{- define "string.kebabCase" -}}
{{- . | kebabcase }}
{{- end }}

{{/*
string.snakeCase
*/}}
{{- define "string.snakeCase" -}}
{{- . | snakecase }}
{{- end }}

{{/*
string.randomAlphaNum
*/}}
{{- define "string.randomAlphaNum" -}}
{{- $length := . | default 8 -}}
{{- randAlphaNum $length }}
{{- end }}

{{/*
env.getOrDefault
*/}}
{{- define "env.getOrDefault" -}}
{{- $key := .key -}}
{{- $default := .default | default "" -}}
{{- $value := index .Values.env $key -}}
{{- $value | default $default }}
{{- end }}

{{/*
list.compact
*/}}
{{- define "list.compact" -}}
{{- $list := . -}}
{{- $result := list -}}
{{- range $list -}}
{{- if . -}}
{{- $result = append $result . -}}
{{- end -}}
{{- end -}}
{{- $result | toJson }}
{{- end }}

{{/*
dict.merge
*/}}
{{- define "dict.merge" -}}
{{- $base := .base | default dict -}}
{{- $override := .override | default dict -}}
{{- merge $override $base | toJson }}
{{- end }}

{{/*
date.now
*/}}
{{- define "date.now" -}}
{{- now | date "2006-01-02T15:04:05Z07:00" }}
{{- end }}

{{/*
date.format
*/}}
{{- define "date.format" -}}
{{- $format := .format | default "2006-01-02" -}}
{{- $date := .date | default now -}}
{{- $date | date $format }}
{{- end }}

{{/*
k8s.imagePullPolicy
*/}}
{{- define "k8s.imagePullPolicy" -}}
{{- $tag := .tag | default .Values.image.tag -}}
{{- if or (eq $tag "latest") (hasSuffix "-SNAPSHOT" $tag) -}}
Always
{{- else -}}
IfNotPresent
{{- end }}
{{- end }}

{{/*
k8s.resourceName
*/}}
{{- define "k8s.resourceName" -}}
{{- $root := .root | default . -}}
{{- $name := .name | default (include "chart.fullname" $root) -}}
{{- $suffix := .suffix | default "" -}}
{{- if $suffix -}}
{{- printf "%s-%s" $name $suffix | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name | trunc 63 | trimSuffix "-" -}}
{{- end }}
{{- end }}

{{/*
k8s.annotations
*/}}
{{- define "k8s.annotations" -}}
{{- $global := .Values.global.annotations | default dict -}}
{{- $local := .annotations | default dict -}}
{{- $merged := merge $local $global -}}
{{- if $merged -}}
{{- range $key, $value := $merged }}
{{ $key }}: {{ $value | quote }}
{{- end -}}
{{- end }}
{{- end }}

{{/*
k8s.labels
*/}}
{{- define "k8s.labels" -}}
{{- $global := .Values.global.labels | default dict -}}
{{- $local := .labels | default dict -}}
{{- $standard := include "chart.labels" . | fromYaml -}}
{{- $merged := merge $local $global $standard -}}
{{- range $key, $value := $merged }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}

{{/*
k8s.probe
*/}}
{{- define "k8s.probe" -}}
{{- $probe := . -}}
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
{{- end }}
{{- end }}

{{/*
env.required
*/}}
{{- define "env.required" -}}
{{- $key := . -}}
{{- $value := index .Values.env $key -}}
{{- required (printf "Environment variable %s is required" $key) $value }}
{{- end }}

{{/*
env.isDev
*/}}
{{- define "env.isDev" -}}
{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "dev") (eq $env "development") }}
{{- end }}

{{/*
env.isProd
*/}}
{{- define "env.isProd" -}}
{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "prod") (eq $env "production") }}
{{- end }}

{{/*
env.isStaging
*/}}
{{- define "env.isStaging" -}}
{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "staging") (eq $env "stage") }}
{{- end }}

{{/*
env.isTest
*/}}
{{- define "env.isTest" -}}
{{- $env := .Values.environment | default "production" -}}
{{- or (eq $env "test") (eq $env "testing") }}
{{- end }}

{{/*
config.merge
*/}}
{{- define "config.merge" -}}
{{- $base := .base | default dict -}}
{{- $env := .env | default dict -}}
{{- $override := .override | default dict -}}
{{- merge $override $env $base | toJson }}
{{- end }}

{{/*
config.secretRef
*/}}
{{- define "config.secretRef" -}}
{{- if .fromSecret -}}
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
{{- end }}
{{- end }}

{{/*
config.envFromSource
*/}}
{{- define "config.envFromSource" -}}
{{- if .configMapRef -}}
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
{{- end }}
{{- end }}

{{/*
config.featureFlag
*/}}
{{- define "config.featureFlag" -}}
{{- $flag := .flag -}}
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
{{- end }}
{{- end }}

{{/*
config.debugMode
*/}}
{{- define "config.debugMode" -}}
{{- $debug := .Values.debug | default (index .Values.env "DEBUG") | default false -}}
{{- if or $debug (include "env.isDev" .) -}}
true
{{- else -}}
false
{{- end }}
{{- end }}

{{/*
git.commitSha
*/}}
{{- define "git.commitSha" -}}
{{- .Values.git.commitSha | default "unknown" }}
{{- end }}

{{/*
git.shortSha
*/}}
{{- define "git.shortSha" -}}
{{- $sha := include "git.commitSha" . -}}
{{- if ne $sha "unknown" -}}
{{- $sha | trunc 8 -}}
{{- else -}}
unknown
{{- end }}
{{- end }}

{{/*
git.branch
*/}}
{{- define "git.branch" -}}
{{- .Values.git.branch | default "main" }}
{{- end }}

{{/*
git.tag
*/}}
{{- define "git.tag" -}}
{{- .Values.git.tag | default "" }}
{{- end }}

{{/*
git.repository
*/}}
{{- define "git.repository" -}}
{{- .Values.git.repository | default "unknown/repository" }}
{{- end }}

{{/*
image.tagWithSha
*/}}
{{- define "image.tagWithSha" -}}
{{- $repo := .Values.image.repository -}}
{{- $sha := include "git.shortSha" . -}}
{{- printf "%s:%s" $repo $sha }}
{{- end }}

{{/*
image.tagWithVersion
*/}}
{{- define "image.tagWithVersion" -}}
{{- $repo := .Values.image.repository -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion | default "latest" -}}
{{- printf "%s:%s" $repo $tag }}
{{- end }}

{{/*
image.tagWithBranch
*/}}
{{- define "image.tagWithBranch" -}}
{{- $repo := .Values.image.repository -}}
{{- $branch := include "git.branch" . | replace "/" "-" | lower -}}
{{- printf "%s:%s" $repo $branch }}
{{- end }}

{{/*
ci.buildId
*/}}
{{- define "ci.buildId" -}}
{{- .Values.ci.buildId | default "unknown" }}
{{- end }}

{{/*
ci.buildUrl
*/}}
{{- define "ci.buildUrl" -}}
{{- .Values.ci.buildUrl | default "" }}
{{- end }}

{{/*
ci.jobUrl
*/}}
{{- define "ci.jobUrl" -}}
{{- .Values.ci.jobUrl | default "" }}
{{- end }}

{{/*
ci.runner
*/}}
{{- define "ci.runner" -}}
{{- .Values.ci.runner | default "unknown" }}
{{- end }}

{{/*
deploy.timestamp
*/}}
{{- define "deploy.timestamp" -}}
{{- now | date "2006-01-02T15:04:05Z07:00" }}
{{- end }}

{{/*
deploy.user
*/}}
{{- define "deploy.user" -}}
{{- .Values.deploy.user | default "automated" }}
{{- end }}

{{/*
deploy.annotations
*/}}
{{- define "deploy.annotations" -}}
deployment.kubernetes.io/revision: "{{ .Release.Revision }}"
app.kubernetes.io/version: "{{ .Chart.AppVersion }}"
app.kubernetes.io/part-of: "{{ .Values.application.name | default .Chart.Name }}"
git.commit: "{{ include "git.commitSha" . }}"
git.branch: "{{ include "git.branch" . }}"
git.repository: "{{ include "git.repository" . }}"
ci.build-id: "{{ include "ci.buildId" . }}"
ci.build-url: "{{ include "ci.buildUrl" . }}"
deploy.timestamp: "{{ include "deploy.timestamp" . }}"
deploy.user: "{{ include "deploy.user" . }}"
{{- end }}

{{/*
deploy.labels
*/}}
{{- define "deploy.labels" -}}
app.kubernetes.io/version: "{{ .Chart.AppVersion }}"
app.kubernetes.io/component: "{{ .Values.component | default "application" }}"
app.kubernetes.io/part-of: "{{ .Values.application.name | default .Chart.Name }}"
git.branch: "{{ include "git.branch" . | replace "/" "-" | lower }}"
environment: "{{ .Values.environment | default "development" }}"
{{- end }}

{{/*
semver.parse
*/}}
{{- define "semver.parse" -}}
{{- $version := . -}}
{{- $parts := regexSplit "\\." $version -1 -}}
{{- if eq (len $parts) 3 -}}
{{- printf "{\"major\": %s, \"minor\": %s, \"patch\": %s}" (index $parts 0) (index $parts 1) (index $parts 2) -}}
{{- else -}}
{{- printf "{\"major\": 0, \"minor\": 0, \"patch\": 0}" -}}
{{- end }}
{{- end }}

{{/*
semver.bump
*/}}
{{- define "semver.bump" -}}
{{- $version := .version -}}
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
{{- end }}
{{- end }}

{{/*
rollout.canaryWeight
*/}}
{{- define "rollout.canaryWeight" -}}
{{- $weight := .Values.rollout.canary.weight | default 10 -}}
{{- $env := .Values.environment | default "development" -}}
{{- if eq $env "production" -}}
{{- min $weight 5 -}}
{{- else if eq $env "staging" -}}
{{- min $weight 50 -}}
{{- else -}}
{{- $weight -}}
{{- end }}
{{- end }}

{{/*
monitoring.serviceMonitor
*/}}
{{- define "monitoring.serviceMonitor" -}}
{{- if and .Values.serviceMonitor.enabled .Values.metrics.enabled -}}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "chart.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    {{- with .Values.serviceMonitor.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- with .Values.serviceMonitor.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
      {{- with .Values.serviceMonitor.selector }}
      {{- toYaml . | nindent 6 }}
      {{- end }}
  endpoints:
    - port: {{ .Values.metrics.port | default "metrics" }}
      path: {{ .Values.metrics.path | default "/metrics" }}
      interval: {{ .Values.serviceMonitor.interval | default "30s" }}
      scrapeTimeout: {{ .Values.serviceMonitor.scrapeTimeout | default "10s" }}
      {{- with .Values.serviceMonitor.metricRelabelings }}
      metricRelabelings:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.serviceMonitor.relabelings }}
      relabelings:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end }}
{{- end }}

{{/*
monitoring.prometheusRule
*/}}
{{- define "monitoring.prometheusRule" -}}
{{- if .Values.prometheusRule.enabled -}}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: {{ include "chart.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    {{- with .Values.prometheusRule.labels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  groups:
    - name: {{ include "chart.fullname" . }}
      rules:
        {{- with .Values.prometheusRule.rules }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
{{- end }}
{{- end }}

{{/*
tracing.jaegerConfig
*/}}
{{- define "tracing.jaegerConfig" -}}
{{- if .Values.tracing.enabled -}}
JAEGER_AGENT_HOST: {{ .Values.tracing.jaeger.agent.host | default "jaeger-agent" }}
JAEGER_AGENT_PORT: {{ .Values.tracing.jaeger.agent.port | default "6831" }}
JAEGER_ENDPOINT: {{ .Values.tracing.jaeger.endpoint | default "" }}
JAEGER_SERVICE_NAME: {{ include "chart.fullname" . }}
JAEGER_SAMPLER_TYPE: {{ .Values.tracing.jaeger.sampler.type | default "const" }}
JAEGER_SAMPLER_PARAM: {{ .Values.tracing.jaeger.sampler.param | default "1" }}
JAEGER_REPORTER_MAX_QUEUE_SIZE: {{ .Values.tracing.jaeger.reporter.maxQueueSize | default "100" }}
JAEGER_REPORTER_FLUSH_INTERVAL: {{ .Values.tracing.jaeger.reporter.flushInterval | default "1s" }}
{{- with .Values.tracing.jaeger.tags }}
JAEGER_TAGS: {{ . | join "," }}
{{- end }}
{{- end }}
{{- end }}

{{/*
tracing.otlpConfig
*/}}
{{- define "tracing.otlpConfig" -}}
{{- if .Values.tracing.enabled -}}
OTEL_SERVICE_NAME: {{ include "chart.fullname" . }}
OTEL_SERVICE_VERSION: {{ .Chart.AppVersion }}
OTEL_RESOURCE_ATTRIBUTES: service.name={{ include "chart.fullname" . }},service.version={{ .Chart.AppVersion }},deployment.environment={{ .Values.environment | default "development" }}
{{- if .Values.tracing.otlp.endpoint }}
OTEL_EXPORTER_OTLP_ENDPOINT: {{ .Values.tracing.otlp.endpoint }}
{{- end }}
{{- if .Values.tracing.otlp.headers }}
OTEL_EXPORTER_OTLP_HEADERS: {{ .Values.tracing.otlp.headers | join "," }}
{{- end }}
OTEL_TRACES_SAMPLER: {{ .Values.tracing.otlp.sampler | default "parentbased_traceidratio" }}
OTEL_TRACES_SAMPLER_ARG: {{ .Values.tracing.otlp.samplerArg | default "1.0" }}
{{- end }}
{{- end }}

{{/*
logging.structured
*/}}
{{- define "logging.structured" -}}
LOG_LEVEL: {{ .Values.logging.level | default "info" }}
LOG_FORMAT: {{ .Values.logging.format | default "json" }}
{{- if .Values.logging.correlation.enabled }}
LOG_CORRELATION_ENABLED: "true"
LOG_CORRELATION_HEADER: {{ .Values.logging.correlation.header | default "X-Correlation-ID" }}
{{- end }}
{{- if .Values.logging.sampling.enabled }}
LOG_SAMPLING_ENABLED: "true"
LOG_SAMPLING_RATE: {{ .Values.logging.sampling.rate | default "0.1" }}
{{- end }}
{{- end }}

{{/*
logging.fluentdConfig
*/}}
{{- define "logging.fluentdConfig" -}}
{{- if .Values.logging.fluentd.enabled -}}
FLUENTD_HOST: {{ .Values.logging.fluentd.host | default "fluentd" }}
FLUENTD_PORT: {{ .Values.logging.fluentd.port | default "24224" }}
FLUENTD_TAG: {{ .Values.logging.fluentd.tag | default (include "chart.fullname" .) }}
FLUENTD_BUFFER_LIMIT: {{ .Values.logging.fluentd.bufferLimit | default "8MB" }}
FLUENTD_TIMEOUT: {{ .Values.logging.fluentd.timeout | default "3.0" }}
{{- end }}
{{- end }}

{{/*
metrics.annotations
*/}}
{{- define "metrics.annotations" -}}
{{- if .Values.metrics.enabled -}}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ .Values.metrics.port | default 9090 }}"
prometheus.io/path: "{{ .Values.metrics.path | default "/metrics" }}"
{{- if .Values.metrics.scheme }}
prometheus.io/scheme: "{{ .Values.metrics.scheme }}"
{{- end }}
{{- end }}
{{- end }}

{{/*
health.probes
*/}}
{{- define "health.probes" -}}
{{- $healthPath := .Values.health.path | default "/health" -}}
{{- $readyPath := .Values.health.readiness.path | default "/ready" -}}
{{- $port := .Values.service.port | default 8080 -}}
livenessProbe:
  httpGet:
    path: {{ $healthPath }}
    port: {{ $port }}
    {{- if .Values.health.liveness.httpHeaders }}
    httpHeaders:
      {{- toYaml .Values.health.liveness.httpHeaders | nindent 6 }}
    {{- end }}
  initialDelaySeconds: {{ .Values.health.liveness.initialDelaySeconds | default 30 }}
  periodSeconds: {{ .Values.health.liveness.periodSeconds | default 10 }}
  timeoutSeconds: {{ .Values.health.liveness.timeoutSeconds | default 5 }}
  successThreshold: {{ .Values.health.liveness.successThreshold | default 1 }}
  failureThreshold: {{ .Values.health.liveness.failureThreshold | default 3 }}
readinessProbe:
  httpGet:
    path: {{ $readyPath }}
    port: {{ $port }}
    {{- if .Values.health.readiness.httpHeaders }}
    httpHeaders:
      {{- toYaml .Values.health.readiness.httpHeaders | nindent 6 }}
    {{- end }}
  initialDelaySeconds: {{ .Values.health.readiness.initialDelaySeconds | default 5 }}
  periodSeconds: {{ .Values.health.readiness.periodSeconds | default 5 }}
  timeoutSeconds: {{ .Values.health.readiness.timeoutSeconds | default 3 }}
  successThreshold: {{ .Values.health.readiness.successThreshold | default 1 }}
  failureThreshold: {{ .Values.health.readiness.failureThreshold | default 3 }}
{{- end }}

{{/*
health.startupProbe
*/}}
{{- define "health.startupProbe" -}}
{{- if .Values.health.startup.enabled -}}
{{- $startupPath := .Values.health.startup.path | default "/health" -}}
{{- $port := .Values.service.port | default 8080 -}}
startupProbe:
  httpGet:
    path: {{ $startupPath }}
    port: {{ $port }}
    {{- if .Values.health.startup.httpHeaders }}
    httpHeaders:
      {{- toYaml .Values.health.startup.httpHeaders | nindent 6 }}
    {{- end }}
  initialDelaySeconds: {{ .Values.health.startup.initialDelaySeconds | default 10 }}
  periodSeconds: {{ .Values.health.startup.periodSeconds | default 10 }}
  timeoutSeconds: {{ .Values.health.startup.timeoutSeconds | default 5 }}
  successThreshold: {{ .Values.health.startup.successThreshold | default 1 }}
  failureThreshold: {{ .Values.health.startup.failureThreshold | default 30 }}
{{- end }}
{{- end }}

{{/*
alerting.rules
*/}}
{{- define "alerting.rules" -}}
{{- $serviceName := include "chart.fullname" . -}}
- alert: {{ $serviceName }}HighErrorRate
  expr: rate(http_requests_total{job="{{ $serviceName }}", status=~"5.."}[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
    service: {{ $serviceName }}
  annotations:
    summary: "High error rate detected"
    description: "{{ $serviceName }} has error rate above 10% for more than 5 minutes"

- alert: {{ $serviceName }}HighLatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="{{ $serviceName }}"}[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
    service: {{ $serviceName }}
  annotations:
    summary: "High latency detected"
    description: "{{ $serviceName }} 95th percentile latency is above 500ms"

- alert: {{ $serviceName }}LowAvailability
  expr: avg_over_time(up{job="{{ $serviceName }}"}[5m]) < 0.9
  for: 2m
  labels:
    severity: critical
    service: {{ $serviceName }}
  annotations:
    summary: "Service availability is low"
    description: "{{ $serviceName }} availability is below 90%"
{{- end }}

{{/*
dashboard.annotations
*/}}
{{- define "dashboard.annotations" -}}
{{- if .Values.grafana.dashboard.enabled -}}
grafana.io/dashboard: "{{ .Values.grafana.dashboard.id | default (include "chart.fullname" .) }}"
grafana.io/folder: "{{ .Values.grafana.dashboard.folder | default "applications" }}"
{{- end }}
{{- end }}

{{/*
validation.semver
*/}}
{{- define "validation.semver" -}}
{{- $version := . -}}
{{- if not (regexMatch "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$" $version) -}}
{{- fail (printf "Invalid semantic version: %s. Must follow semver format (e.g., 1.2.3, 1.0.0-alpha.1)" $version) -}}
{{- end -}}
{{- $version }}
{{- end }}

{{/*
validation.k8sName
*/}}
{{- define "validation.k8sName" -}}
{{- $name := . -}}
{{- if not (regexMatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$" $name) -}}
{{- fail (printf "Invalid Kubernetes resource name: %s. Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric characters" $name) -}}
{{- end -}}
{{- if gt (len $name) 63 -}}
{{- fail (printf "Kubernetes resource name too long: %s. Maximum 63 characters allowed" $name) -}}
{{- end -}}
{{- $name }}
{{- end }}

{{/*
validation.dnsLabel
*/}}
{{- define "validation.dnsLabel" -}}
{{- $label := . -}}
{{- if not (regexMatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$" $label) -}}
{{- fail (printf "Invalid DNS label: %s. Must be lowercase alphanumeric with hyphens" $label) -}}
{{- end -}}
{{- if gt (len $label) 63 -}}
{{- fail (printf "DNS label too long: %s. Maximum 63 characters allowed" $label) -}}
{{- end -}}
{{- $label }}
{{- end }}

{{/*
validation.email
*/}}
{{- define "validation.email" -}}
{{- $email := . -}}
{{- if not (regexMatch "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$" $email) -}}
{{- fail (printf "Invalid email address: %s" $email) -}}
{{- end -}}
{{- $email }}
{{- end }}

{{/*
validation.url
*/}}
{{- define "validation.url" -}}
{{- $url := . -}}
{{- if not (regexMatch "^https?://[a-zA-Z0-9.-]+(?:[:/][^\\s]*)?$" $url) -}}
{{- fail (printf "Invalid URL: %s. Must be a valid HTTP or HTTPS URL" $url) -}}
{{- end -}}
{{- $url }}
{{- end }}

{{/*
validation.port
*/}}
{{- define "validation.port" -}}
{{- $port := . | int -}}
{{- if or (lt $port 1) (gt $port 65535) -}}
{{- fail (printf "Invalid port number: %d. Must be between 1 and 65535" $port) -}}
{{- end -}}
{{- $port }}
{{- end }}

{{/*
validation.memorySize
*/}}
{{- define "validation.memorySize" -}}
{{- $size := . -}}
{{- if not (regexMatch "^[0-9]+(\\.[0-9]+)?(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E)?$" $size) -}}
{{- fail (printf "Invalid memory size: %s. Use format like '512Mi', '2Gi', '1.5Gi'" $size) -}}
{{- end -}}
{{- $size }}
{{- end }}

{{/*
validation.cpuSize
*/}}
{{- define "validation.cpuSize" -}}
{{- $cpu := . -}}
{{- if not (regexMatch "^[0-9]+(\\.[0-9]+)?m?$" $cpu) -}}
{{- fail (printf "Invalid CPU size: %s. Use format like '500m', '1', '1.5', '2000m'" $cpu) -}}
{{- end -}}
{{- $cpu }}
{{- end }}

{{/*
validation.duration
*/}}
{{- define "validation.duration" -}}
{{- $duration := . -}}
{{- if not (regexMatch "^[0-9]+(\\.[0-9]+)?(ns|us|µs|ms|s|m|h)$" $duration) -}}
{{- fail (printf "Invalid duration: %s. Use format like '30s', '5m', '2h', '100ms'" $duration) -}}
{{- end -}}
{{- $duration }}
{{- end }}

{{/*
validation.percentage
*/}}
{{- define "validation.percentage" -}}
{{- $percentage := . -}}
{{- if regexMatch "^[0-9]+%$" ($percentage | toString) -}}
{{- $num := $percentage | toString | trimSuffix "%" | int -}}
{{- if or (lt $num 0) (gt $num 100) -}}
{{- fail (printf "Invalid percentage: %s. Must be between 0%% and 100%%" $percentage) -}}
{{- end -}}
{{- else -}}
{{- $num := $percentage | int -}}
{{- if or (lt $num 0) (gt $num 100) -}}
{{- fail (printf "Invalid percentage: %d. Must be between 0 and 100" $num) -}}
{{- end -}}
{{- end -}}
{{- $percentage }}
{{- end }}

{{/*
validation.ipAddress
*/}}
{{- define "validation.ipAddress" -}}
{{- $ip := . -}}
{{- if not (regexMatch "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$" $ip) -}}
{{- fail (printf "Invalid IP address: %s. Must be a valid IPv4 address" $ip) -}}
{{- end -}}
{{- $ip }}
{{- end }}

{{/*
validation.cidr
*/}}
{{- define "validation.cidr" -}}
{{- $cidr := . -}}
{{- if not (regexMatch "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/([0-9]|[1-2][0-9]|3[0-2])$" $cidr) -}}
{{- fail (printf "Invalid CIDR notation: %s. Must be a valid IPv4 CIDR (e.g., 192.168.1.0/24)" $cidr) -}}
{{- end -}}
{{- $cidr }}
{{- end }}

{{/*
validation.base64
*/}}
{{- define "validation.base64" -}}
{{- $value := . -}}
{{- if not (regexMatch "^[A-Za-z0-9+/]*={0,2}$" $value) -}}
{{- fail (printf "Invalid base64 string: %s" $value) -}}
{{- end -}}
{{- $value }}
{{- end }}

{{/*
validation.uuid
*/}}
{{- define "validation.uuid" -}}
{{- $uuid := . -}}
{{- if not (regexMatch "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" ($uuid | lower)) -}}
{{- fail (printf "Invalid UUID: %s. Must be a valid UUID format" $uuid) -}}
{{- end -}}
{{- $uuid }}
{{- end }}

{{/*
validation.cronSchedule
*/}}
{{- define "validation.cronSchedule" -}}
{{- $cron := . -}}
{{- $parts := regexSplit "\\s+" $cron -1 -}}
{{- if ne (len $parts) 5 -}}
{{- fail (printf "Invalid cron schedule: %s. Must have 5 parts (minute hour day month weekday)" $cron) -}}
{{- end -}}
{{- range $part := $parts -}}
{{- if not (regexMatch "^(\\*|[0-9,-/]+|\\*\\/[0-9]+)$" $part) -}}
{{- fail (printf "Invalid cron part: %s in schedule %s" $part $cron) -}}
{{- end -}}
{{- end -}}
{{- $cron }}
{{- end }}

{{/*
validation.imagePullPolicy
*/}}
{{- define "validation.imagePullPolicy" -}}
{{- $policy := . -}}
{{- if not (has $policy (list "Always" "IfNotPresent" "Never")) -}}
{{- fail (printf "Invalid image pull policy: %s. Must be one of: Always, IfNotPresent, Never" $policy) -}}
{{- end -}}
{{- $policy }}
{{- end }}

{{/*
validation.logLevel
*/}}
{{- define "validation.logLevel" -}}
{{- $level := . | lower -}}
{{- if not (has $level (list "trace" "debug" "info" "warn" "warning" "error" "fatal" "panic")) -}}
{{- fail (printf "Invalid log level: %s. Must be one of: trace, debug, info, warn, error, fatal, panic" .) -}}
{{- end -}}
{{- $level }}
{{- end }}

{{/*
validation.serviceType
*/}}
{{- define "validation.serviceType" -}}
{{- $type := . -}}
{{- if not (has $type (list "ClusterIP" "NodePort" "LoadBalancer" "ExternalName")) -}}
{{- fail (printf "Invalid service type: %s. Must be one of: ClusterIP, NodePort, LoadBalancer, ExternalName" $type) -}}
{{- end -}}
{{- $type }}
{{- end }}

{{/*
validation.storageAccessMode
*/}}
{{- define "validation.storageAccessMode" -}}
{{- $mode := . -}}
{{- if not (has $mode (list "ReadWriteOnce" "ReadOnlyMany" "ReadWriteMany" "ReadWriteOncePod")) -}}
{{- fail (printf "Invalid storage access mode: %s. Must be one of: ReadWriteOnce, ReadOnlyMany, ReadWriteMany, ReadWriteOncePod" $mode) -}}
{{- end -}}
{{- $mode }}
{{- end }}

{{/*
validation.required
*/}}
{{- define "validation.required" -}}
{{- $value := .value -}}
{{- $fieldName := .field | default "field" -}}
{{- if or (not $value) (and (kindIs "string" $value) (eq (trim $value) "")) -}}
{{- fail (printf "Required field '%s' is missing or empty" $fieldName) -}}
{{- end -}}
{{- $value }}
{{- end }}

{{/*
validation.nonEmpty
*/}}
{{- define "validation.nonEmpty" -}}
{{- $list := . -}}
{{- if not (and $list (gt (len $list) 0)) -}}
{{- fail "List cannot be empty" -}}
{{- end -}}
{{- $list }}
{{- end }}

{{/*
validation.range
*/}}
{{- define "validation.range" -}}
{{- $value := .value | int -}}
{{- $min := .min | int -}}
{{- $max := .max | int -}}
{{- if or (lt $value $min) (gt $value $max) -}}
{{- fail (printf "Value %d is out of range [%d, %d]" $value $min $max) -}}
{{- end -}}
{{- $value }}
{{- end }}
