import { describe, it, expect } from 'vitest';
import { App } from 'cdk8s';

import { Rutter } from '../src/lib/rutter';
import {
  helmInclude,
  helmFragment,
  createHelmExpression,
} from '../src/lib/utils/helmControlStructures';

describe('Enterprise Helm Scenarios from Enterprise Chart', (): void => {
  it('should handle complex conditional annotations (AWS vs Azure vs GCP)', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-ingress', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // Migrated from legacy helmIf to createHelmExpression (type-safe)
    rutter.addManifest(
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'test-ingress',
          annotations: createHelmExpression(`
            {{- if eq .Values.global.env.HOST_ENV "AWS_K8" -}}
            kubernetes.io/ingress.class: alb
            alb.ingress.kubernetes.io/actions.ssl-redirect: '{"Type": "redirect", "RedirectConfig": { "Protocol": "HTTPS", "Port": "443", "StatusCode": "HTTP_301"}}'
            alb.ingress.kubernetes.io/certificate-arn: {{ .Values.ingress.certificate }}
            alb.ingress.kubernetes.io/group.name: {{ .Values.ingress.load_balancer_name | default "my-org" }}
            {{- else if eq .Values.global.env.HOST_ENV "AZURE_K8" -}}
            kubernetes.io/ingress.class: nginx
            cert-manager.io/cluster-issuer: letsencrypt-prod
            nginx.ingress.kubernetes.io/ssl-redirect: "true"
            {{- else if eq .Values.global.env.HOST_ENV "GCP_K8" -}}
            kubernetes.io/ingress.class: {{ .Values.ingress.className | default "gce" }}
            ingress.gcp.kubernetes.io/pre-shared-cert: {{ .Values.ingress.certificate }}
            {{- else -}}
            kubernetes.io/ingress.class: nginx
            cert-manager.io/cluster-issuer: letsencrypt-prod
            {{- end -}}
          `),
        },
      },
      'ingress',
    );

    const assets = await rutter.toSynthArray();
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

  it('should handle nested range with conditionals (env vars from deployment)', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-deployment', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // Migrated from legacy helmIf, helmRange to createHelmExpression (type-safe)
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
                  env: createHelmExpression(`
                    {{- if and .Values.envKeys (kindIs "slice" .Values.envKeys) }}
                    {{- range $key := .Values.envKeys }}
                    {{- if and $.Values.env (kindIs "map" $.Values.env) (hasKey $.Values.env $key) }}
                    - name: {{ $key }}
                      value: {{ index $.Values.env $key | quote }}
                    {{- else if and $.Values.global.env (kindIs "map" $.Values.global.env) (hasKey $.Values.global.env $key) }}
                    - name: {{ $key }}
                      value: {{ index $.Values.global.env $key | quote }}
                    {{- end }}
                    {{- end }}
                    {{- end }}
                    {{- if and .Values.secretKeys (kindIs "slice" .Values.secretKeys) }}
                    {{- range $key := .Values.secretKeys }}
                    - name: {{ $key }}
                      valueFrom:
                        secretKeyRef:
                          name: {{ if and $.Values.secrets (kindIs "map" $.Values.secrets) (hasKey $.Values.secrets $key) }}{{ $.Values.secretName }}-{{ $.Chart.Name }}{{ else }}{{ $.Values.secretName }}{{ end }}
                          key: {{ $key }}
                          optional: true
                    {{- end }}
                    {{- end }}
                  `),
                },
              ],
            },
          },
        },
      },
      'deployment',
    );

    const assets = await rutter.toSynthArray();
    const yaml = assets[0].yaml;

    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('env:');
    expect(yaml).toContain('{{- if and .Values.envKeys');
    expect(yaml).toContain('{{- range $key := .Values.envKeys }}');
    expect(yaml).toContain('{{- if and $.Values.env');
    expect(yaml).toContain('valueFrom:');
    expect(yaml).toContain('secretKeyRef:');
  });

  it('should handle toYaml with nindent (common pattern)', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-pod', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // Migrated from legacy helmWith to createHelmExpression (type-safe)
    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: 'test-pod',
          annotations: createHelmExpression(
            '{{- with .Values.podAnnotations }}{{- toYaml . | nindent 8 }}{{- end }}',
          ),
        },
        spec: {
          securityContext: createHelmExpression(
            '{{- toYaml .Values.podSecurityContext | nindent 8 }}',
          ),
          containers: [
            {
              name: 'app',
              image: 'test:latest',
              resources: createHelmExpression('{{- toYaml .Values.resources | nindent 12 }}'),
            },
          ],
        },
      },
      'pod',
    );

    const assets = await rutter.toSynthArray();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- toYaml');
    expect(yaml).toContain('| nindent');
  });

  it('should handle range over map with key-value pairs (secrets)', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-secret', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // Migrated from legacy helmRange to createHelmExpression (type-safe)
    rutter.addConditionalManifest(
      {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: 'test-secret',
        },
        type: 'Opaque',
        stringData: createHelmExpression(
          '{{- range $key, $value := .Values.secrets }}{{ $key }}: {{ $value | quote }}{{- end }}',
        ),
      },
      'secrets',
      'secrets',
    );

    const assets = await rutter.toSynthArray();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- if .Values.secrets }}');
    // New format: Helm expressions are unquoted YAML blocks
    expect(yaml).toContain('stringData:');
    expect(yaml).toContain('{{- range $key, $value := .Values.secrets }}');
    expect(yaml).toContain('{{ $key }}: {{ $value | quote }}');
  });

  it('should handle include with nindent (labels pattern)', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-service', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // helmInclude is still valid (not legacy)
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

    const assets = await rutter.toSynthArray();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- include');
    expect(yaml).toContain('| nindent');
  });

  it('should handle complex nested conditionals with hasKey', async (): Promise<void> => {
    const app = new App();
    const rutter = new Rutter({
      meta: { name: 'test-complex', version: '1.0.0' },
      scope: app,
      chartProps: { disableResourceNameHashes: true },
    });

    // Migrated from legacy helmIf to createHelmExpression (type-safe)
    rutter.addManifest(
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'test-complex',
          annotations: helmFragment(
            createHelmExpression(`
              {{- if hasKey .Values.ingress "ip_whitelist" -}}
              alb.ingress.kubernetes.io/inbound-cidrs: {{ .Values.ingress.ip_whitelist }}
              {{- end -}}
            `),
            createHelmExpression(`
              {{- if eq (default "internet-facing" .Values.ingress.scheme) "internal" -}}
              service.beta.kubernetes.io/azure-load-balancer-internal: "true"
              {{- end -}}
            `),
          ),
        },
      },
      'complex',
    );

    const assets = await rutter.toSynthArray();
    const yaml = assets[0].yaml;

    expect(yaml).toContain('{{- if hasKey');
    expect(yaml).toContain('{{- if eq (default');
  });
});
