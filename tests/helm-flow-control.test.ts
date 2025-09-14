/**
 * @fileoverview Tests for Helm Flow Control functions
 * @since 1.4.0
 */

import { describe, it, expect } from 'vitest';

import { helmIf, helmWith, helmRange, helmIfElseIf } from '../src/lib/helm.js';

describe('Helm Flow Control Functions', () => {
  describe('helmIf', () => {
    it('should create a simple if block', () => {
      const result = helmIf('eq .Values.env "production"', 'replicas: 3');

      expect(result).toBe('{{- if eq .Values.env "production" }}\nreplicas: 3\n{{- end }}');
    });

    it('should create an if-else block', () => {
      const result = helmIf('eq .Values.env "production"', 'replicas: 3', 'replicas: 1');

      expect(result).toBe(
        '{{- if eq .Values.env "production" }}\nreplicas: 3\n{{- else }}\nreplicas: 1\n{{- end }}',
      );
    });

    it('should throw error for empty condition', () => {
      expect(() => helmIf('', 'content')).toThrow('Condition cannot be empty');
      expect(() => helmIf('   ', 'content')).toThrow('Condition cannot be empty');
    });

    it('should throw error for conditions with template delimiters', () => {
      expect(() => helmIf('{{ .Values.test }}', 'content')).toThrow(
        'Condition should not contain template delimiters',
      );
      expect(() => helmIf('test {{ something }}', 'content')).toThrow(
        'Condition should not contain template delimiters',
      );
    });
  });

  describe('helmWith', () => {
    it('should create a simple with block', () => {
      const result = helmWith('.Values.database', 'host: {{ .host }}\nport: {{ .port }}');

      expect(result).toBe(
        '{{- with .Values.database }}\nhost: {{ .host }}\nport: {{ .port }}\n{{- end }}',
      );
    });

    it('should create a with-else block', () => {
      const result = helmWith('.Values.database', 'host: {{ .host }}', 'host: "localhost"');

      expect(result).toBe(
        '{{- with .Values.database }}\nhost: {{ .host }}\n{{- else }}\nhost: "localhost"\n{{- end }}',
      );
    });

    it('should throw error for empty path', () => {
      expect(() => helmWith('', 'content')).toThrow('Path cannot be empty');
      expect(() => helmWith('   ', 'content')).toThrow('Path cannot be empty');
    });

    it('should throw error for path not starting with dot', () => {
      expect(() => helmWith('Values.test', 'content')).toThrow(
        'Path must start with "." (e.g., ".Values.config")',
      );
    });
  });

  describe('helmRange', () => {
    it('should create a simple range loop', () => {
      const result = helmRange('.Values.services', '- name: {{ .name }}\n  port: {{ .port }}');

      expect(result).toBe(
        '{{- range .Values.services }}\n- name: {{ .name }}\n  port: {{ .port }}\n{{- end }}',
      );
    });

    it('should create a key-value range loop', () => {
      const result = helmRange('.Values.env', '- name: {{ $key }}\n  value: {{ $value | quote }}', {
        keyValue: true,
      });

      expect(result).toBe(
        '{{- range $key, $value := .Values.env }}\n- name: {{ $key }}\n  value: {{ $value | quote }}\n{{- end }}',
      );
    });

    it('should create an indexed range loop', () => {
      const result = helmRange('.Values.items', '{{ $i }}: {{ $val }}', {
        indexVar: '$i',
        itemVar: '$val',
      });

      expect(result).toBe(
        '{{- range $i, $val := .Values.items }}\n{{ $i }}: {{ $val }}\n{{- end }}',
      );
    });

    it('should throw error for empty collection', () => {
      expect(() => helmRange('', 'content')).toThrow('Collection cannot be empty');
    });

    it('should throw error for collection not starting with dot', () => {
      expect(() => helmRange('Values.items', 'content')).toThrow(
        'Collection path must start with "." (e.g., ".Values.items")',
      );
    });
  });

  describe('helmIfElseIf', () => {
    it('should create a multi-branch conditional', () => {
      const result = helmIfElseIf(
        [
          {
            condition: 'eq .Values.environment "production"',
            content: 'replicas: 5',
          },
          {
            condition: 'eq .Values.environment "staging"',
            content: 'replicas: 2',
          },
        ],
        'replicas: 1',
      );

      expect(result).toBe(
        '{{- if eq .Values.environment "production" }}\nreplicas: 5\n{{- else if eq .Values.environment "staging" }}\nreplicas: 2\n{{- else }}\nreplicas: 1\n{{- end }}',
      );
    });

    it('should create conditional without default content', () => {
      const result = helmIfElseIf([
        {
          condition: 'eq .Values.env "prod"',
          content: 'replicas: 3',
        },
      ]);

      expect(result).toBe('{{- if eq .Values.env "prod" }}\nreplicas: 3\n{{- end }}');
    });

    it('should throw error for empty branches array', () => {
      expect(() => helmIfElseIf([])).toThrow('At least one branch is required');
    });

    it('should throw error for empty condition in branch', () => {
      expect(() => helmIfElseIf([{ condition: '', content: 'test' }])).toThrow(
        'Branch 0 condition cannot be empty',
      );
    });

    it('should throw error for condition with template delimiters', () => {
      expect(() => helmIfElseIf([{ condition: '{{ .Values.test }}', content: 'test' }])).toThrow(
        'Branch 0 condition should not contain template delimiters',
      );
    });
  });

  describe('Integration tests', () => {
    it('should work with complex nested scenarios', () => {
      const envConfig = helmIfElseIf(
        [
          {
            condition: 'eq .Values.environment "production"',
            content: helmWith(
              '.Values.production',
              'replicas: {{ .replicas }}\nresources: {{ .resources | toYaml | nindent 2 }}',
            ),
          },
          {
            condition: 'eq .Values.environment "staging"',
            content: 'replicas: 2\nresources:\n  limits:\n    memory: "1Gi"',
          },
        ],
        'replicas: 1',
      );

      expect(envConfig).toContain('{{- if eq .Values.environment "production" }}');
      expect(envConfig).toContain('{{- with .Values.production }}');
      expect(envConfig).toContain('{{- else if eq .Values.environment "staging" }}');
      expect(envConfig).toContain('{{- else }}');
      expect(envConfig).toContain('{{- end }}');
    });

    it('should handle range with conditional content', () => {
      const serviceList = helmRange(
        '.Values.services',
        helmIf(
          '.enabled',
          '- name: {{ .name }}\n  port: {{ .port }}\n  enabled: true',
          '# Service {{ .name }} is disabled',
        ),
      );

      expect(serviceList).toContain('{{- range .Values.services }}');
      expect(serviceList).toContain('{{- if .enabled }}');
      expect(serviceList).toContain('{{- else }}');
      expect(serviceList).toContain('{{- end }}');
    });
  });
});
