/**
 * @fileoverview Validation helpers for Helm templates with type safety and format validation
 * @since 2.11.0
 */

import type { HelperDefinition } from './types.js';

/**
 * Validation helpers for type safety and format validation
 *
 * These helpers provide comprehensive validation for common data types and formats
 * used in Kubernetes and cloud-native applications. They follow security best practices
 * and provide clear error messages for debugging and troubleshooting.
 *
 * @since 2.11.0
 */
export const VALIDATION_HELPERS: HelperDefinition[] = [
  {
    name: 'validation.semver',
    template: `{{- $version := . -}}
{{- if not (regexMatch "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$" $version) -}}
{{- fail (printf "Invalid semantic version: %s. Must follow semver format (e.g., 1.2.3, 1.0.0-alpha.1)" $version) -}}
{{- end -}}
{{- $version }}`,
  },
  {
    name: 'validation.k8sName',
    template: `{{- $name := . -}}
{{- if not (regexMatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$" $name) -}}
{{- fail (printf "Invalid Kubernetes resource name: %s. Must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric characters" $name) -}}
{{- end -}}
{{- if gt (len $name) 63 -}}
{{- fail (printf "Kubernetes resource name too long: %s. Maximum 63 characters allowed" $name) -}}
{{- end -}}
{{- $name }}`,
  },
  {
    name: 'validation.dnsLabel',
    template: `{{- $label := . -}}
{{- if not (regexMatch "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$" $label) -}}
{{- fail (printf "Invalid DNS label: %s. Must be lowercase alphanumeric with hyphens" $label) -}}
{{- end -}}
{{- if gt (len $label) 63 -}}
{{- fail (printf "DNS label too long: %s. Maximum 63 characters allowed" $label) -}}
{{- end -}}
{{- $label }}`,
  },
  {
    name: 'validation.email',
    template: `{{- $email := . -}}
{{- if not (regexMatch "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$" $email) -}}
{{- fail (printf "Invalid email address: %s" $email) -}}
{{- end -}}
{{- $email }}`,
  },
  {
    name: 'validation.url',
    template: `{{- $url := . -}}
{{- if not (regexMatch "^https?://[a-zA-Z0-9.-]+(?:[:/][^\\\\s]*)?$" $url) -}}
{{- fail (printf "Invalid URL: %s. Must be a valid HTTP or HTTPS URL" $url) -}}
{{- end -}}
{{- $url }}`,
  },
  {
    name: 'validation.port',
    template: `{{- $port := . | int -}}
{{- if or (lt $port 1) (gt $port 65535) -}}
{{- fail (printf "Invalid port number: %d. Must be between 1 and 65535" $port) -}}
{{- end -}}
{{- $port }}`,
  },
  {
    name: 'validation.memorySize',
    template: `{{- $size := . -}}
{{- if not (regexMatch "^[0-9]+(\\\\.[0-9]+)?(Ki|Mi|Gi|Ti|Pi|Ei|K|M|G|T|P|E)?$" $size) -}}
{{- fail (printf "Invalid memory size: %s. Use format like '512Mi', '2Gi', '1.5Gi'" $size) -}}
{{- end -}}
{{- $size }}`,
  },
  {
    name: 'validation.cpuSize',
    template: `{{- $cpu := . -}}
{{- if not (regexMatch "^[0-9]+(\\\\.[0-9]+)?m?$" $cpu) -}}
{{- fail (printf "Invalid CPU size: %s. Use format like '500m', '1', '1.5', '2000m'" $cpu) -}}
{{- end -}}
{{- $cpu }}`,
  },
  {
    name: 'validation.duration',
    template: `{{- $duration := . -}}
{{- if not (regexMatch "^[0-9]+(\\\\.[0-9]+)?(ns|us|µs|ms|s|m|h)$" $duration) -}}
{{- fail (printf "Invalid duration: %s. Use format like '30s', '5m', '2h', '100ms'" $duration) -}}
{{- end -}}
{{- $duration }}`,
  },
  {
    name: 'validation.percentage',
    template: `{{- $percentage := . -}}
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
{{- $percentage }}`,
  },
  {
    name: 'validation.ipAddress',
    template: `{{- $ip := . -}}
{{- if not (regexMatch "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$" $ip) -}}
{{- fail (printf "Invalid IP address: %s. Must be a valid IPv4 address" $ip) -}}
{{- end -}}
{{- $ip }}`,
  },
  {
    name: 'validation.cidr',
    template: `{{- $cidr := . -}}
{{- if not (regexMatch "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/([0-9]|[1-2][0-9]|3[0-2])$" $cidr) -}}
{{- fail (printf "Invalid CIDR notation: %s. Must be a valid IPv4 CIDR (e.g., 192.168.1.0/24)" $cidr) -}}
{{- end -}}
{{- $cidr }}`,
  },
  {
    name: 'validation.base64',
    template: `{{- $value := . -}}
{{- if not (regexMatch "^[A-Za-z0-9+/]*={0,2}$" $value) -}}
{{- fail (printf "Invalid base64 string: %s" $value) -}}
{{- end -}}
{{- $value }}`,
  },
  {
    name: 'validation.uuid',
    template: `{{- $uuid := . -}}
{{- if not (regexMatch "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" ($uuid | lower)) -}}
{{- fail (printf "Invalid UUID: %s. Must be a valid UUID format" $uuid) -}}
{{- end -}}
{{- $uuid }}`,
  },
  {
    name: 'validation.cronSchedule',
    template: `{{- $cron := . -}}
{{- $parts := regexSplit "\\\\s+" $cron -1 -}}
{{- if ne (len $parts) 5 -}}
{{- fail (printf "Invalid cron schedule: %s. Must have 5 parts (minute hour day month weekday)" $cron) -}}
{{- end -}}
{{- range $part := $parts -}}
{{- if not (regexMatch "^(\\\\*|[0-9,-/]+|\\\\*\\\\/[0-9]+)$" $part) -}}
{{- fail (printf "Invalid cron part: %s in schedule %s" $part $cron) -}}
{{- end -}}
{{- end -}}
{{- $cron }}`,
  },
  {
    name: 'validation.imagePullPolicy',
    template: `{{- $policy := . -}}
{{- if not (has $policy (list "Always" "IfNotPresent" "Never")) -}}
{{- fail (printf "Invalid image pull policy: %s. Must be one of: Always, IfNotPresent, Never" $policy) -}}
{{- end -}}
{{- $policy }}`,
  },
  {
    name: 'validation.logLevel',
    template: `{{- $level := . | lower -}}
{{- if not (has $level (list "trace" "debug" "info" "warn" "warning" "error" "fatal" "panic")) -}}
{{- fail (printf "Invalid log level: %s. Must be one of: trace, debug, info, warn, error, fatal, panic" .) -}}
{{- end -}}
{{- $level }}`,
  },
  {
    name: 'validation.serviceType',
    template: `{{- $type := . -}}
{{- if not (has $type (list "ClusterIP" "NodePort" "LoadBalancer" "ExternalName")) -}}
{{- fail (printf "Invalid service type: %s. Must be one of: ClusterIP, NodePort, LoadBalancer, ExternalName" $type) -}}
{{- end -}}
{{- $type }}`,
  },
  {
    name: 'validation.storageAccessMode',
    template: `{{- $mode := . -}}
{{- if not (has $mode (list "ReadWriteOnce" "ReadOnlyMany" "ReadWriteMany" "ReadWriteOncePod")) -}}
{{- fail (printf "Invalid storage access mode: %s. Must be one of: ReadWriteOnce, ReadOnlyMany, ReadWriteMany, ReadWriteOncePod" $mode) -}}
{{- end -}}
{{- $mode }}`,
  },
  {
    name: 'validation.required',
    template: `{{- $value := .value -}}
{{- $fieldName := .field | default "field" -}}
{{- if or (not $value) (and (kindIs "string" $value) (eq (trim $value) "")) -}}
{{- fail (printf "Required field '%s' is missing or empty" $fieldName) -}}
{{- end -}}
{{- $value }}`,
  },
  {
    name: 'validation.nonEmpty',
    template: `{{- $list := . -}}
{{- if not (and $list (gt (len $list) 0)) -}}
{{- fail "List cannot be empty" -}}
{{- end -}}
{{- $list }}`,
  },
  {
    name: 'validation.range',
    template: `{{- $value := .value | int -}}
{{- $min := .min | int -}}
{{- $max := .max | int -}}
{{- if or (lt $value $min) (gt $value $max) -}}
{{- fail (printf "Value %d is out of range [%d, %d]" $value $min $max) -}}
{{- end -}}
{{- $value }}`,
  },
];
