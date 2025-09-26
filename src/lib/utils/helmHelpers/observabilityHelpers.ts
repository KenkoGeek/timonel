/**
 * @fileoverview Observability helpers for Helm templates including monitoring, tracing, and logging
 * @since 2.11.0
 */

import type { HelperDefinition } from './types.js';

/**
 * Observability helpers for monitoring, tracing, and logging
 *
 * These helpers provide comprehensive observability patterns for modern cloud-native applications.
 * They support Prometheus monitoring, distributed tracing, structured logging, and health checks
 * following industry best practices for production workloads.
 *
 * @since 2.11.0
 */
export const OBSERVABILITY_HELPERS: HelperDefinition[] = [
  {
    name: 'monitoring.serviceMonitor',
    template: `{{- if and .Values.serviceMonitor.enabled .Values.metrics.enabled -}}
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
{{- end }}`,
  },
  {
    name: 'monitoring.prometheusRule',
    template: `{{- if .Values.prometheusRule.enabled -}}
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
{{- end }}`,
  },
  {
    name: 'tracing.jaegerConfig',
    template: `{{- if .Values.tracing.enabled -}}
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
{{- end }}`,
  },
  {
    name: 'tracing.otlpConfig',
    template: `{{- if .Values.tracing.enabled -}}
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
{{- end }}`,
  },
  {
    name: 'logging.structured',
    template: `LOG_LEVEL: {{ .Values.logging.level | default "info" }}
LOG_FORMAT: {{ .Values.logging.format | default "json" }}
{{- if .Values.logging.correlation.enabled }}
LOG_CORRELATION_ENABLED: "true"
LOG_CORRELATION_HEADER: {{ .Values.logging.correlation.header | default "X-Correlation-ID" }}
{{- end }}
{{- if .Values.logging.sampling.enabled }}
LOG_SAMPLING_ENABLED: "true"
LOG_SAMPLING_RATE: {{ .Values.logging.sampling.rate | default "0.1" }}
{{- end }}`,
  },
  {
    name: 'logging.fluentdConfig',
    template: `{{- if .Values.logging.fluentd.enabled -}}
FLUENTD_HOST: {{ .Values.logging.fluentd.host | default "fluentd" }}
FLUENTD_PORT: {{ .Values.logging.fluentd.port | default "24224" }}
FLUENTD_TAG: {{ .Values.logging.fluentd.tag | default (include "chart.fullname" .) }}
FLUENTD_BUFFER_LIMIT: {{ .Values.logging.fluentd.bufferLimit | default "8MB" }}
FLUENTD_TIMEOUT: {{ .Values.logging.fluentd.timeout | default "3.0" }}
{{- end }}`,
  },
  {
    name: 'metrics.annotations',
    template: `{{- if .Values.metrics.enabled -}}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ .Values.metrics.port | default 9090 }}"
prometheus.io/path: "{{ .Values.metrics.path | default "/metrics" }}"
{{- if .Values.metrics.scheme }}
prometheus.io/scheme: "{{ .Values.metrics.scheme }}"
{{- end }}
{{- end }}`,
  },
  {
    name: 'health.probes',
    template: `{{- $healthPath := .Values.health.path | default "/health" -}}
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
  failureThreshold: {{ .Values.health.readiness.failureThreshold | default 3 }}`,
  },
  {
    name: 'health.startupProbe',
    template: `{{- if .Values.health.startup.enabled -}}
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
{{- end }}`,
  },
  {
    name: 'alerting.rules',
    template: `{{- $serviceName := include "chart.fullname" . -}}
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
    description: "{{ $serviceName }} availability is below 90%"`,
  },
  {
    name: 'dashboard.annotations',
    template: `{{- if .Values.grafana.dashboard.enabled -}}
grafana.io/dashboard: "{{ .Values.grafana.dashboard.id | default (include "chart.fullname" .) }}"
grafana.io/folder: "{{ .Values.grafana.dashboard.folder | default "applications" }}"
{{- end }}`,
  },
];
