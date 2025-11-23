import { describe, it, expect } from 'vitest';

import {
  valuesRef,
  requiredValuesRef,
  helm,
  quote,
  indent,
  template,
  include,
  createTypedRef,
  numberRef,
  boolRef,
  stringRef,
  floatRef,
  conditionalRef,
  conditionalManifest,
  defaultRef,
  base64Ref,
  jsonRef,
  helmIf,
  helmWith,
  helmRange,
  helmIfElseIf,
} from '../src/lib/helm';

describe('Helm Helpers', () => {
  describe('valuesRef', () => {
    it('should create a valid values reference', () => {
      expect(valuesRef('image.tag')).toBe('{{ .Values.image.tag }}');
    });

    it('should throw error for invalid path', () => {
      expect(() => valuesRef('invalid path')).toThrow('Invalid Helm template path');
    });
  });

  describe('requiredValuesRef', () => {
    it('should create a required values reference', () => {
      expect(requiredValuesRef('image.tag')).toBe(
        '{{ required "image.tag is required" .Values.image.tag }}',
      );
    });

    it('should create a required values reference with custom message', () => {
      expect(requiredValuesRef('image.tag', 'Tag needed')).toBe(
        '{{ required "Tag needed" .Values.image.tag }}',
      );
    });

    it('should escape quotes in message', () => {
      expect(requiredValuesRef('key', 'Message with "quotes"')).toBe(
        '{{ required "Message with \\"quotes\\"" .Values.key }}',
      );
    });
  });

  describe('helm object', () => {
    it('should have correct release name', () => {
      expect(helm.releaseName).toBe('{{ .Release.Name }}');
    });
    it('should have correct chart name', () => {
      expect(helm.chartName).toBe('{{ .Chart.Name }}');
    });
    it('should have correct chart version', () => {
      expect(helm.chartVersion).toBe('{{ .Chart.Version }}');
    });
    it('should have correct namespace', () => {
      expect(helm.namespace).toBe('{{ .Release.Namespace }}');
    });
  });

  describe('quote', () => {
    it('should quote helm expressions', () => {
      expect(quote('{{ .Values.foo }}')).toBe("'{{ .Values.foo }}'");
    });

    it('should not quote normal strings', () => {
      expect(quote('normal string')).toBe('normal string');
    });
  });

  describe('indent', () => {
    it('should indent lines', () => {
      expect(indent(2, 'line1\nline2')).toBe('  line1\n  line2');
    });

    it('should not indent empty lines', () => {
      expect(indent(2, 'line1\n\nline2')).toBe('  line1\n\n  line2');
    });
  });

  describe('template', () => {
    it('should create template call', () => {
      expect(template('my-template')).toBe('{{ template "my-template" . }}');
    });

    it('should create template call with context', () => {
      expect(template('my-template', '.Values')).toBe('{{ template "my-template" .Values }}');
    });
  });

  describe('include', () => {
    it('should create include call', () => {
      expect(include('my-template')).toBe('{{ include "my-template" . }}');
    });

    it('should create include call with context', () => {
      expect(include('my-template', '.Values')).toBe('{{ include "my-template" .Values }}');
    });
  });

  describe('createTypedRef', () => {
    it('should create number ref', () => {
      expect(createTypedRef('count', 'number')).toBe('{{ .Values.count | int }}');
    });

    it('should create boolean ref', () => {
      expect(createTypedRef('enabled', 'boolean')).toBe('{{ .Values.enabled | toBool }}');
    });

    it('should create string ref', () => {
      expect(createTypedRef('name', 'string')).toBe('{{ .Values.name | toString }}');
    });

    it('should create float ref', () => {
      expect(createTypedRef('ratio', 'float')).toBe('{{ .Values.ratio | float64 }}');
    });

    it('should handle defaults', () => {
      expect(createTypedRef('count', 'number', { withDefault: true, defaultValue: 5 })).toBe(
        '{{ .Values.count | int | default 5 }}',
      );
    });

    it('should handle quoted string defaults', () => {
      expect(
        createTypedRef('name', 'string', {
          withDefault: true,
          defaultValue: 'default',
          quote: true,
        }),
      ).toBe('{{ .Values.name | toString | default "default" }}');
    });
  });

  describe('typed refs wrappers', () => {
    it('numberRef should work', () => {
      expect(numberRef('count')).toBe('{{ .Values.count | int }}');
    });
    it('boolRef should work', () => {
      expect(boolRef('enabled')).toBe('{{ .Values.enabled | toBool }}');
    });
    it('stringRef should work', () => {
      expect(stringRef('name')).toBe('{{ .Values.name | toString | quote }}');
    });
    it('floatRef should work', () => {
      expect(floatRef('ratio')).toBe('{{ .Values.ratio | float64 }}');
    });
  });

  describe('conditionalRef', () => {
    it('should create conditional reference', () => {
      expect(conditionalRef('secret', 'enabled')).toBe(
        '{{ if .Values.enabled }}{{ .Values.secret }}{{ end }}',
      );
    });
  });

  describe('conditionalManifest', () => {
    it('should wrap manifest in condition', () => {
      const yaml = 'kind: Pod\nmetadata:\n  name: pod';
      const expected = `{{ if .Values.enabled }}
${yaml}
{{ end }}`;
      expect(conditionalManifest(yaml, 'enabled')).toBe(expected);
    });
  });

  describe('defaultRef', () => {
    it('should create default reference', () => {
      expect(defaultRef('tag', 'latest')).toBe('{{ .Values.tag | default "latest" }}');
    });
  });

  describe('base64Ref', () => {
    it('should create base64 reference', () => {
      expect(base64Ref('secret')).toBe('{{ .Values.secret | b64enc }}');
    });
  });

  describe('jsonRef', () => {
    it('should create json reference', () => {
      expect(jsonRef('config')).toBe('{{ .Values.config | toJson }}');
    });
  });

  describe('helmIf', () => {
    it('should create if block', () => {
      const result = helmIf('eq .Values.env "prod"', 'content');
      expect(result).toContain('{{- if eq .Values.env "prod" }}');
      expect(result).toContain('content');
      expect(result).toContain('{{- end }}');
    });

    it('should create if-else block', () => {
      const result = helmIf('condition', 'trueContent', 'falseContent');
      expect(result).toContain('{{- else }}');
      expect(result).toContain('falseContent');
    });
  });

  describe('helmWith', () => {
    it('should create with block', () => {
      const result = helmWith('.Values.nested', 'content');
      expect(result).toContain('{{- with .Values.nested }}');
      expect(result).toContain('content');
      expect(result).toContain('{{- end }}');
    });

    it('should create with-else block', () => {
      const result = helmWith('.Values.nested', 'content', 'elseContent');
      expect(result).toContain('{{- else }}');
      expect(result).toContain('elseContent');
    });
  });

  describe('helmRange', () => {
    it('should create simple range', () => {
      const result = helmRange('.Values.list', 'content');
      expect(result).toContain('{{- range .Values.list }}');
    });

    it('should create key-value range', () => {
      const result = helmRange('.Values.map', 'content', { keyValue: true });
      expect(result).toContain('{{- range $key, $value := .Values.map }}');
    });

    it('should create indexed range', () => {
      const result = helmRange('.Values.list', 'content', { indexVar: '$i', itemVar: '$val' });
      expect(result).toContain('{{- range $i, $val := .Values.list }}');
    });
  });

  describe('helmIfElseIf', () => {
    it('should create if-elseif-else block', () => {
      const branches = [
        { condition: 'cond1', content: 'content1' },
        { condition: 'cond2', content: 'content2' },
      ];
      const result = helmIfElseIf(branches, 'defaultContent');
      expect(result).toContain('{{- if cond1 }}');
      expect(result).toContain('content1');
      expect(result).toContain('{{- else if cond2 }}');
      expect(result).toContain('content2');
      expect(result).toContain('{{- else }}');
      expect(result).toContain('defaultContent');
      expect(result).toContain('{{- end }}');
    });

    it('should throw if branches empty', () => {
      expect(() => helmIfElseIf([])).toThrow('At least one branch is required');
    });
  });
});
