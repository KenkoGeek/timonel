import { describe, it, expect } from 'vitest';
import { App } from 'cdk8s';

import { Rutter } from '../src/lib/rutter';
import {
  helmIf,
  helmRange,
  helmWith,
  helmInclude,
  helmFragment,
  createHelmExpression,
} from '../src/lib/utils/helmControlStructures';

describe('Enterprise Helm Scenarios from Enterprise Chart', () => {
  it('should handle complex conditional annotations (AWS vs Azure vs GCP)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-ingress', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'test-ingress',
          annotations: helmIf(
            'eq .Values.global.env.HOST_ENV "AWS_K8"',
            `kubernetes.io/ingress.class: alb
alb.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
alb.ingress.kubernetes.io/certificate-arn: {{ .Values.ingress.certificate }}
alb.ingress.kubernetes.io/group.name: {{ .Values.ingress.load_balancer_name | default "my-org" }}`,
            helmIf(
              'eq .Values.global.env.HOST_ENV "AZURE_K8"',
              `kubernetes.io/ingress.class: nginx
cert-manager.io/cluster-issuer: letsencrypt-prod
nginx.ingress.kubernetes.io/ssl-redirect: "true"`,
              helmIf(
                'eq .Values.global.env.HOST_ENV "GCP_K8"',
                `kubernetes.io/ingress.class: {{ .Values.ingress.className | default "gce" }}
ingress.gcp.kubernetes.io/pre-shared-cert: {{ .Values.ingress.certificate }}`,
                `kubernetes.io/ingress.class: nginx
cert-manager.io/cluster-issuer: letsencrypt-prod`,
              ),
            ),
          ),
        },
      },
      'ingress',
    );

    const assets = rutter['toSynthArray']();
    expect(assets.length).toBeGreaterThan(0);

    const yaml = assets[0].yaml;
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('annotations:');
    expect(yaml).toContain('{{- if eq .Values.global.env.HOST_ENV "AWS_K8" -}}');
    expect(yaml).toContain('kubernetes.io/ingress.class');
    expect(yaml).toContain('{{- else if eq .Values.global.env.HOST_ENV "AZURE_K8" -}}');
    expect(yaml).toContain('{{- else if eq .Values.global.env.HOST_ENV "GCP_K8" -}}');
    expect(yaml).toContain('{{- else -}}');
    expect(yaml).toContain('{{- end -}}');
  });

  it('should handle nested range with conditionals (env vars from deployment)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-deployment', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'test-deployment' },
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: 'app',
                  image: 'test:latest',
                  env: helmFragment(
                    helmIf(
                      'and .Values.envKeys (kindIs "slice" .Values.envKeys)',
                      helmRange(
                        '$key',
                        '.Values.envKeys',
                        helmIf(
                          'and $.Values.env (kindIs "map" $.Values.env) (hasKey $.Values.env $key)',
                          `- name: {{ $key }}\n  value: {{ index $.Values.env $key | quote }}`,
                          helmIf(
                            'and $.Values.global.env (kindIs "map" $.Values.global.env) (hasKey $.Values.global.env $key)',
                            `- name: {{ $key }}\n  value: {{ index $.Values.global.env $key | quote }}`,
                          ),
                        ),
                      ),
                    ),
                    helmIf(
                      'and .Values.secretKeys (kindIs "slice" .Values.secretKeys)',
                      helmRange(
                        '$key',
                        '.Values.secretKeys',
                        helmFragment(
                          `- name: {{ $key }}\n  valueFrom:\n    secretKeyRef:\n      name: `,
                          helmIf(
                            'and $.Values.secrets (kindIs "map" $.Values.secrets) (hasKey $.Values.secrets $key)',
                            `             {{ $.Values.secretName }}-{{ $.Chart.Name }}`,
                            `             {{ $.Values.secretName }}`,
                          ),
                          `      key: {{ $key }}\n      optional: true`,
                        ),
                      ),
                    ),
                  ),
                },
              ],
            },
          },
        },
      },
      'deployment',
    );

    const assets = rutter['toSynthArray']();
    const yaml = assets[0].yaml;

    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('env:');
    expect(yaml).toContain('{{- if and .Values.envKeys');
    expect(yaml).toContain('{{- range $key := .Values.envKeys -}}');
    expect(yaml).toContain('{{- if and $.Values.env');
    expect(yaml).toContain('valueFrom:');
    expect(yaml).toContain('secretKeyRef:');
  });

  it('should handle toYaml with nindent (common pattern)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-pod', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: 'test-pod',
          annotations: helmWith('.Values.podAnnotations', `{{- toYaml . | nindent 8 }}`),
        },
        spec: {
          securityContext: createHelmExpression(
            `{{- toYaml .Values.podSecurityContext | nindent 8 }}`,
          ),
          containers: [
            {
              name: 'app',
              image: 'test:latest',
              resources: createHelmExpression(`{{- toYaml .Values.resources | nindent 12 }}`),
            },
          ],
        },
      },
      'pod',
    );

    const assets = rutter['toSynthArray']();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- toYaml');
    expect(yaml).toContain('| nindent');
  });

  it('should handle range over map with key-value pairs (secrets)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-secret', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addConditionalManifest(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: 'test-secret',
        },
        type: 'Opaque',
        stringData: helmRange(
          '$key, $value',
          '.Values.secrets',
          `{{ $key }}: {{ $value | quote }}`,
        ),
      },
      'secrets',
      'secrets',
    );

    const assets = rutter['toSynthArray']();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- if .Values.secrets }}');
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('stringData:');
    expect(yaml).toContain('{{- range $key, $value := .Values.secrets -}}');
    expect(yaml).toContain('{{ $key }}: {{ $value | quote }}');
  });

  it('should handle include with nindent (labels pattern)', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-service', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'test-service',
          labels: helmInclude('test-service.labels', '.', { pipe: 'nindent 4' }),
        },
        spec: {
          selector: helmInclude('test-service.selectorLabels', '.', { pipe: 'nindent 6' }),
        },
      },
      'service',
    );

    const assets = rutter['toSynthArray']();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- include');
    expect(yaml).toContain('| nindent');
  });

  it('should handle complex nested conditionals with hasKey', () => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-complex', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'test-complex',
          annotations: helmFragment(
            helmIf(
              'hasKey .Values.ingress "ip_whitelist"',
              'alb.ingress.kubernetes.io/inbound-cidrs: {{ .Values.ingress.ip_whitelist }}',
            ),
            helmIf(
              'eq (default "internet-facing" .Values.ingress.scheme) "internal"',
              'service.beta.kubernetes.io/azure-load-balancer-internal: "true"',
            ),
          ),
        },
      },
      'complex',
    );

    const assets = rutter['toSynthArray']();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- if hasKey');
    expect(yaml).toContain('{{- if eq (default');
  });
});
