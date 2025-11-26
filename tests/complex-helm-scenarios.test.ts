import { describe, it, expect } from 'vitest';
import { App, Chart, ApiObject } from 'cdk8s';
import { Rutter } from '../src/lib/rutter';
import { createHelmExpression } from '../src/lib/utils/helmYamlSerializer';
import { dumpHelmAwareYaml } from '../src/lib/utils/helmYamlSerializer';

describe('Complex Helm Scenarios', () => {
    // Helper to generate YAML for a single manifest
    function generateYaml(manifest: any): string {
        const mockApp = new App();
        const mockChart = new Chart(mockApp, 'test-chart');

        const rutter = new Rutter({
            meta: { name: 'test', version: '1.0.0' },
            scope: mockApp,
            chartProps: { disableResourceNameHashes: true }
        });

        // Mock the internal chart to use our mockChart
        // @ts-ignore - accessing private property for testing
        rutter.chart = mockChart;

        const apiObj = rutter.addManifest(manifest, 'test-manifest');

        // Use the serializer directly to verify the core logic.
        return dumpHelmAwareYaml(manifest);
    }

    it('should correctly serialize multiline if-block in map field', () => {
        const manifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: 'test-config',
                annotations: createHelmExpression(`{{- if .Values.enabled }}
enabled: "true"
status: "active"
{{- end }}`)
            }
        };

        const yaml = generateYaml(manifest);
        expect(yaml).toContain(`annotations: "{{- if .Values.enabled }}

    enabled: \\"true\\"

    status: \\"active\\"

    {{- end }}"`);
    });

    it('should correctly serialize nested range loops', () => {
        const manifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'nested-range' },
            data: {
                config: createHelmExpression(`{{- range $key, $val := .Values.items }}
{{ $key }}:
  {{- range $val.subitems }}
  - {{ . }}
  {{- end }}
{{- end }}`)
            }
        };

        const yaml = generateYaml(manifest);
        expect(yaml).toContain(`config: "{{- range $key, $val := .Values.items }}

    {{ $key }}:

    \\  {{- range $val.subitems }}

    \\  - {{ . }}

    \\  {{- end }}

    {{- end }}"`);
    });

    it('should correctly serialize with-block changing scope', () => {
        const manifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'with-block' },
            data: {
                settings: createHelmExpression(`{{- with .Values.settings }}
debug: {{ .debug }}
logLevel: {{ .logLevel }}
{{- end }}`)
            }
        };

        const yaml = generateYaml(manifest);
        expect(yaml).toContain(`settings: "{{- with .Values.settings }}

    debug: {{ .debug }}

    logLevel: {{ .logLevel }}

    {{- end }}"`);
    });

    it('should correctly serialize complex logic with operators', () => {
        const manifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'complex-logic' },
            data: {
                feature: createHelmExpression(`{{- if and .Values.enabled (not .Values.disabled) (or .Values.featureA .Values.featureB) }}
enabled: true
priority: high
{{- else }}
enabled: false
{{- end }}`)
            }
        };

        const yaml = generateYaml(manifest);
        expect(yaml).toContain(`feature: "{{- if and .Values.enabled (not .Values.disabled) (or .Values.featureA
    .Values.featureB) }}

    enabled: true

    priority: high

    {{- else }}

    enabled: false

    {{- end }}"`);
    });

    it('should correctly serialize mixed content', () => {
        const manifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: 'mixed-content',
                annotations: {
                    'static-key': 'static-value',
                    'dynamic-block': createHelmExpression(`{{- if .Values.dynamic }}
dynamic: true
{{- end }}`)
                }
            }
        };

        const yaml = generateYaml(manifest);
        expect(yaml).toContain('static-key: static-value');
        expect(yaml).toContain(`dynamic-block: "{{- if .Values.dynamic }}

      dynamic: true

      {{- end }}"`);
    });
});
