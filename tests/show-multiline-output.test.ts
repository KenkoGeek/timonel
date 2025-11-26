import { App } from 'cdk8s';
import { describe, it, expect } from 'vitest';

import { Rutter } from '../src/lib/rutter';
import { createHelmExpression } from '../src/lib/utils/helmControlStructures';

describe('Multiline Verification - Show Actual Output', () => {
  it('should show IF multiline output', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'test-if',
          annotations: createHelmExpression(`{{- if .Values.enabled }}
enabled: "true"
status: "active"
environment: "production"
{{- end }}`),
        },
      },
      'if-test',
    );

    const yaml = rutter['toSynthArray']()[0].yaml;
    console.log('\n📝 IF MULTILINEA OUTPUT:\n' + '='.repeat(60));
    console.log(yaml);
    console.log('='.repeat(60));

    // New format: Helm expressions are generated as native YAML blocks (no quotes)
    expect(yaml).toContain('annotations:');
    expect(yaml).toContain('{{- if .Values.enabled }}');
    expect(yaml).toContain('{{- end }}');
  });

  it('should show WITH multiline output', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'test-with' },
        data: {
          config: createHelmExpression(`{{- with .Values.database }}
host: {{ .host }}
port: {{ .port }}
username: {{ .username }}
{{- end }}`),
        },
      },
      'with-test',
    );

    const yaml = rutter['toSynthArray']()[0].yaml;
    console.log('\n📝 WITH MULTILINEA OUTPUT:\n' + '='.repeat(60));
    console.log(yaml);
    console.log('='.repeat(60));

    // New format: Helm expressions are generated as native YAML blocks (no quotes)
    expect(yaml).toContain('config:');
    expect(yaml).toContain('{{- with .Values.database }}');
    expect(yaml).toContain('{{- end }}');
  });

  it('should show RANGE multiline output', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'test-range' },
        data: {
          services: createHelmExpression(`{{- range $name, $service := .Values.services }}
{{ $name }}:
  enabled: {{ $service.enabled }}
  replicas: {{ $service.replicas }}
{{- end }}`),
        },
      },
      'range-test',
    );

    const yaml = rutter['toSynthArray']()[0].yaml;
    console.log('\n📝 RANGE MULTILINEA OUTPUT:\n' + '='.repeat(60));
    console.log(yaml);
    console.log('='.repeat(60));

    // New format: Helm expressions are generated as native YAML blocks (no quotes)
    expect(yaml).toContain('services:');
    expect(yaml).toContain('{{- range $name, $service := .Values.services }}');
    expect(yaml).toContain('{{- end }}');
  });

  it('should show IF-ELSE-IF multiline output (multi-cloud)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'test-ingress',
          annotations: createHelmExpression(`{{- if eq .Values.cloud "aws" }}
kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/scheme: internet-facing
{{- else if eq .Values.cloud "azure" }}
kubernetes.io/ingress.class: nginx
cert-manager.io/cluster-issuer: letsencrypt-prod
{{- else if eq .Values.cloud "gcp" }}
kubernetes.io/ingress.class: gce
{{- else }}
kubernetes.io/ingress.class: nginx
{{- end }}`),
        },
      },
      'ingress-test',
    );

    const yaml = rutter['toSynthArray']()[0].yaml;
    console.log('\n📝 IF-ELSE-IF MULTILINEA OUTPUT (Multi-Cloud):\n' + '='.repeat(60));
    console.log(yaml);
    console.log('='.repeat(60));

    // New format: Helm expressions are generated as native YAML blocks (no quotes)
    expect(yaml).toContain('annotations:');
    expect(yaml).toContain('{{- if eq .Values.cloud');
    expect(yaml).toContain('{{- else if eq .Values.cloud');
    expect(yaml).toContain('{{- else }}');
    expect(yaml).toContain('{{- end }}');
  });
});
