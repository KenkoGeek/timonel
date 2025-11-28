import { describe, it, expect } from 'vitest';
import { App, Chart } from 'cdk8s';

import { Rutter } from '../src/lib/rutter';
import { helmIf, helmRange, helmWith } from '../src/lib/utils/helmControlStructures';
import { dumpHelmAwareYaml } from '../src/lib/utils/helmYamlSerializer';

describe('Complex Helm Scenarios', () => {
  // Helper to generate YAML for a single manifest
  function generateYaml(manifest: unknown): string {
    const mockApp = new App();
    const mockChart = new Chart(mockApp, 'test-chart');

    const rutter = new Rutter({
      meta: { name: 'test', version: '1.0.0' },
      scope: mockApp,
      chartProps: { disableResourceNameHashes: true },
    });

    // Mock the internal chart to use our mockChart
    // @ts-expect-error - accessing private property for testing
    rutter.chart = mockChart;

    const apiObj = rutter.addManifest(manifest as Record<string, unknown>, 'test-manifest');

    // Use the serializer directly to verify the core logic.
    return dumpHelmAwareYaml(manifest);
  }

  it('should correctly serialize multiline if-block in map field', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'test-config',
        annotations: helmIf('.Values.enabled', `enabled: "true"\nstatus: "active"`),
      },
    };

    const yaml = generateYaml(manifest);
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('annotations:');
    expect(yaml).toContain('{{- if .Values.enabled -}}');
    expect(yaml).toContain('enabled: "true"');
    expect(yaml).toContain('status: "active"');
    expect(yaml).toContain('{{- end -}}');
  });

  it('should correctly serialize nested range loops', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'nested-range' },
      data: {
        config: helmRange(
          '$key, $val',
          '.Values.items',
          `{{ $key }}:\n  {{- range $val.subitems }}\n  - {{ . }}\n  {{- end }}`,
        ),
      },
    };

    const yaml = generateYaml(manifest);
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('config:');
    expect(yaml).toContain('{{- range $key, $val := .Values.items -}}');
    expect(yaml).toContain('{{- range $val.subitems }}');
    expect(yaml).toContain('{{- end -}}');
  });

  it('should correctly serialize with-block changing scope', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'with-block' },
      data: {
        settings: helmWith('.Values.settings', `debug: {{ .debug }}\nlogLevel: {{ .logLevel }}`),
      },
    };

    const yaml = generateYaml(manifest);
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('settings:');
    expect(yaml).toContain('{{- with .Values.settings -}}');
    expect(yaml).toContain('debug: {{ .debug }}');
    expect(yaml).toContain('logLevel: {{ .logLevel }}');
    expect(yaml).toContain('{{- end -}}');
  });

  it('should correctly serialize complex logic with operators', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'complex-logic' },
      data: {
        feature: helmIf(
          'and .Values.enabled (not .Values.disabled) (or .Values.featureA .Values.featureB)',
          `enabled: true\npriority: high`,
          `enabled: false`,
        ),
      },
    };

    const yaml = generateYaml(manifest);
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('feature:');
    expect(yaml).toContain('{{- if and .Values.enabled');
    expect(yaml).toContain('enabled: true');
    expect(yaml).toContain('priority: high');
    expect(yaml).toContain('{{- else -}}');
    expect(yaml).toContain('enabled: false');
    expect(yaml).toContain('{{- end -}}');
  });

  it('should correctly serialize mixed content', () => {
    const manifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'mixed-content',
        annotations: {
          'static-key': 'static-value',
          'dynamic-block': helmIf('.Values.dynamic', `dynamic: true`),
        },
      },
    };

    const yaml = generateYaml(manifest);
    expect(yaml).toContain('static-key: static-value');
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('dynamic-block:');
    expect(yaml).toContain('{{- if .Values.dynamic -}}');
    expect(yaml).toContain('dynamic: true');
    expect(yaml).toContain('{{- end -}}');
  });
});
