import { describe, it, expect } from 'vitest';

import {
  dumpHelmAwareYaml,
  parseHelmExpressions,
  stringify,
  validateHelmYaml,
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

    it('should handle nested objects', () => {
      const obj = {
        spec: {
          containers: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('name: app');
      expect(yaml).toContain('image: nginx:latest');
    });

    it('should handle arrays', () => {
      const obj = {
        items: ['item1', 'item2', 'item3'],
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('- item1');
      expect(yaml).toContain('- item2');
      expect(yaml).toContain('- item3');
    });
  });

  describe('stringify', () => {
    it('should serialize objects', () => {
      const obj = { key: 'value' };
      const yaml = stringify(obj);
      expect(yaml).toContain('key: value');
    });
  });

  describe('validateHelmYaml', () => {
    it('should validate ordinary Helm YAML', () => {
      const yaml = `
        apiVersion: v1
        kind: ConfigMap
        metadata:
            name: test-config
        data:
            key: {{ .Values.key }}
        `;
      const result = validateHelmYaml(yaml);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should classify parsed Helm expressions without overlapping regex matches', () => {
      const parsed = parseHelmExpressions(
        `
        {{ .Values.name }}
        {{/* comment */}}
        {{` +
          '`raw`' +
          `}}
        {{ include "chart.labels" . }}
        {{ define "chart.name" }}
      `,
      );

      expect(parsed.map((expression) => expression.type)).toEqual([
        'action-trimmed',
        'comment',
        'raw',
        'include-context',
        'block',
      ]);
    });

    it('should preserve delimiters embedded inside Helm string literals', () => {
      const raw = '{{`literal }} text`}}';
      const quoted = '{{ printf "literal }} text" }}';
      const parsed = parseHelmExpressions(`${raw}\n${quoted}`);

      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.expression).toBe(raw);
      expect(parsed[0]?.type).toBe('raw');
      expect(parsed[1]?.expression).toBe(quoted);
    });

    it('should parse multiline Helm expressions and keep deprecated-function warnings', () => {
      const yaml = '{{ template "chart.name"\n.Values }}';
      const parsed = parseHelmExpressions(yaml);
      const result = validateHelmYaml(yaml);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.startLine).toBe(1);
      expect(parsed[0]?.endLine).toBe(2);
      expect(
        result.warnings.some((warning) => warning.message.includes("Function 'template'")),
      ).toBe(true);
    });

    it('should warn for single- and double-quoted Helm expressions', () => {
      const result = validateHelmYaml(`
        data:
          first: '{{ .Values.first }}'
          second: "{{ .Values.second }}"
      `);

      const quotedWarnings = result.warnings.filter(
        (warning) => warning.message === 'Helm expression should not be quoted',
      );
      expect(quotedWarnings).toHaveLength(2);
      expect(quotedWarnings.map((warning) => warning.expression)).toEqual([
        "'{{ .Values.first }}'",
        '"{{ .Values.second }}"',
      ]);
    });

    it('should handle adversarial Helm-like input in linear time', () => {
      const repeatedOpeners = '{{{{'.repeat(2_000);
      const repeatedSpaces = `{{${' '.repeat(20_000)}value }}`;
      const repeatedQuotedOpeners = `"{{`.repeat(5_000);

      expect(() => validateHelmYaml(repeatedOpeners)).not.toThrow();
      expect(() => validateHelmYaml(repeatedSpaces)).not.toThrow();
      expect(() => validateHelmYaml(repeatedQuotedOpeners)).not.toThrow();
    });
  });
});
