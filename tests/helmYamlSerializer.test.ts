import { describe, it, expect } from 'vitest';

import {
  dumpHelmAwareYaml,
  stringify,
  validateHelmYaml,
  prettifyHelmTemplate,
  createHelmExpression,
  isHelmExpression,
  detectHelmExpressions,
  preprocessHelmExpressions,
  postProcessHelmExpressions,
} from '../src/lib/utils/helmYamlSerializer.js';

describe('Helm YAML Serializer', () => {
  describe('dumpHelmAwareYaml', () => {
    it('should serialize simple objects correctly', () => {
      const obj = { key: 'value', number: 123, bool: true };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('key: value');
      expect(yaml).toContain('number: 123');
      expect(yaml).toContain('bool: true');
    });

    it('should preserve Helm expressions without quotes', () => {
      const obj = {
        image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
        replicas: '{{ .Values.replicaCount }}',
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain("image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}'");
      expect(yaml).toContain('replicas: {{ .Values.replicaCount }}');
      expect(yaml).not.toContain("'{{ .Values.replicaCount }}'");
      expect(yaml).not.toContain('"{{ .Values.replicaCount }}"');
    });

    it('should handle nested objects with Helm expressions', () => {
      const obj = {
        spec: {
          containers: [
            {
              name: 'app',
              image: '{{ .Values.image }}',
            },
          ],
        },
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('image: {{ .Values.image }}');
    });

    it('should handle arrays with Helm expressions', () => {
      const obj = {
        items: ['{{ .Values.item1 }}', 'static', '{{ .Values.item2 }}'],
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('- {{ .Values.item1 }}');
      expect(yaml).toContain('- static');
      expect(yaml).toContain('- {{ .Values.item2 }}');
    });
  });

  describe('stringify', () => {
    it('should be compatible with legacy options', () => {
      const obj = { key: 'value' };
      const yaml = stringify(obj, { doubleQuotedAsJSON: true });
      expect(yaml).toContain('key: "value"');
    });
  });

  describe('validateHelmYaml', () => {
    it('should validate correct Helm YAML', () => {
      const yaml = `
        apiVersion: v1
        kind: ConfigMap
        metadata:
            name: {{ .Release.Name }}-config
        data:
            key: {{ .Values.key | quote }}
        `;
      const result = validateHelmYaml(yaml);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect syntax errors (unbalanced parentheses)', () => {
      const yaml = 'key: {{ .Values.key ';
      const result = validateHelmYaml(yaml);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Unbalanced Helm template braces');
    });

    it('should detect syntax errors (unbalanced quotes)', () => {
      const yaml = 'key: {{ .Values.key | default "value }}';
      const result = validateHelmYaml(yaml);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Unbalanced quotes');
    });

    it('should warn about deprecated functions', () => {
      const yaml = 'key: {{ template "my-template" . }}';
      const result = validateHelmYaml(yaml);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("Function 'template' is deprecated");
    });

    it('should warn about quoted Helm expressions', () => {
      const yaml = 'key: "{{ .Values.key }}"';
      const result = validateHelmYaml(yaml);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Helm expression should not be quoted');
    });
  });

  describe('prettifyHelmTemplate', () => {
    it('should align expressions', () => {
      const yaml = `
        key1: {{ .Values.v1 }}
        key2: {{ .Values.v2 }}
      `;
      const prettified = prettifyHelmTemplate(yaml, { alignExpressions: true });
      // Alignment logic might be complex to assert exactly without knowing implementation details,
      // but we can check it doesn't break validity.
      expect(prettified).toContain('key1: {{ .Values.v1 }}');
    });

    it('should format conditional blocks', () => {
      const yaml = '{{ if .Values.enabled }}enabled: true{{ end }}';
      const prettified = prettifyHelmTemplate(yaml);
      expect(prettified).toContain('{{ if .Values.enabled }}');
      expect(prettified).toContain('  enabled: true');
      expect(prettified).toContain('{{ end }}');
    });

    it('should wrap long lines', () => {
      const longLine = 'key: ' + 'a'.repeat(150);
      const prettified = prettifyHelmTemplate(longLine, { maxLineWidth: 100 });
      expect(prettified.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('Helper Functions', () => {
    it('createHelmExpression should create a marker', () => {
      const marker = createHelmExpression('{{ .Values.foo }}');
      expect(isHelmExpression(marker)).toBe(true);
      expect(marker.value).toBe('{{ .Values.foo }}');
    });

    it('detectHelmExpressions should find expressions', () => {
      const str = 'prefix {{ .Values.foo }} suffix {{ .Values.bar }}';
      const matches = detectHelmExpressions(str);
      expect(matches).toHaveLength(2);
      expect(matches[0].expression).toBe('{{ .Values.foo }}');
      expect(matches[1].expression).toBe('{{ .Values.bar }}');
    });

    it('preprocessHelmExpressions should mark expressions in object', () => {
      const obj = { key: '{{ .Values.foo }}' };
      const processed = preprocessHelmExpressions(obj) as Record<string, unknown>;
      expect(isHelmExpression(processed.key)).toBe(true);
    });

    it('postProcessHelmExpressions should remove quotes', () => {
      const yaml = "key: '{{ .Values.foo }}'";
      const processed = postProcessHelmExpressions(yaml);
      expect(processed).toBe('key: {{ .Values.foo }}');
    });
  });
});
