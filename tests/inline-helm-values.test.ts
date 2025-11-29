import { describe, it, expect } from 'vitest';
import { App, Chart } from 'cdk8s';
import { Rutter } from '../src/lib/rutter';
import { helmIf, createHelmExpression as helm } from '../src/lib/utils/helmControlStructures';
import { dumpHelmAwareYaml } from '../src/lib/utils/helmYamlSerializer';

describe('Inline Helm Values', () => {
    function generateYaml(manifest: unknown): string {
        return dumpHelmAwareYaml(manifest);
    }

    it('should serialize inline if-else for scalar fields', () => {
        const manifest = {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: 'test' },
            spec: {
                replicas: helmIf(
                    'not .Values.autoscaling.enabled',
                    helm('{{ .Values.replicaCount }}'),
                    undefined,
                    { inline: true }
                )
            }
        };

        const yaml = generateYaml(manifest);
        // Expected: replicas: {{- if not .Values.autoscaling.enabled }} {{ .Values.replicaCount }} {{- end }}
        // Or similar inline format without newlines that break YAML
        expect(yaml).toContain('replicas: {{- if not .Values.autoscaling.enabled -}}{{ .Values.replicaCount }}{{- end -}}');
    });
});
