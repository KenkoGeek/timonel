import { describe, it, expect } from 'vitest';

import { Rutter } from '../../src/lib/rutter';

describe('Helm Quote Escaping - Global Solution Tests', () => {
  // Helper function to test processHelmTemplates directly
  const testProcessHelmTemplates = (input: string): string => {
    const rutter = new Rutter({
      meta: {
        name: 'test-chart',
        version: '1.0.0',
        description: 'Test chart',
      },
    });
    // Access private method for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rutter as any).processHelmTemplates(input);
  };

  describe('Include statements', () => {
    it('should fix escaped quotes in include statements with nindent', () => {
      const input = `template: "{{ include \\"common.labels\\" . | nindent 4 }}"`;
      const expected = `template: {{ include "common.labels" . | nindent 4 }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should fix escaped quotes in simple include statements', () => {
      const input = `template: "{{ include \\"common.name\\" . }}"`;
      const expected = `template: {{ include "common.name" . }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('toYaml function', () => {
    it('should handle toYaml with nindent', () => {
      const input = `config: "{{ .Values.config | toYaml | nindent 2 }}"`;
      const expected = `config: {{ .Values.config | toYaml | nindent 2 }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle toYaml in key-value pairs', () => {
      const input = `data: "{{ .Values.data | toYaml }}"`;
      const expected = `data: {{ .Values.data | toYaml }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('quote function', () => {
    it('should handle quote function calls', () => {
      const input = `value: "{{ .Values.name | quote }}"`;
      const expected = `value: {{ .Values.name | quote }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle quote with escaped internal quotes', () => {
      const input = `value: "{{ quote \\"default-value\\" }}"`;
      const expected = `value: {{ quote "default-value" }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('tpl function', () => {
    it('should handle tpl function calls', () => {
      const input = `template: "{{ tpl .Values.template . }}"`;
      const expected = `template: {{ tpl .Values.template . }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Conditional expressions', () => {
    it('should handle if-else conditionals', () => {
      const input = `value: "{{- if .Values.enabled }}enabled{{- else }}disabled{{- end }}"`;
      const expected = `value: {{- if .Values.enabled }}enabled{{- else }}disabled{{- end }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle with statements', () => {
      const input = `config: "{{- with .Values.config }}{{ . | toYaml }}{{- end }}"`;
      const expected = `config: {{- with .Values.config }}{{ . | toYaml }}{{- end }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Complex expressions', () => {
    it('should handle multiple pipes and functions', () => {
      const input = `value: "{{ .Values.name | default \\"app\\" | quote }}"`;
      const expected = `value: {{ .Values.name | default "app" | quote }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle Chart object with replace function', () => {
      const input = `name: "{{ .Chart.Name | replace \\"_\\" \\"-\\" | trunc 63 }}"`;
      const expected = `name: {{ .Chart.Name | replace "_" "-" | trunc 63 }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Range loops', () => {
    it('should handle range loops', () => {
      const input = `items: "{{- range .Values.items }}{{ . }}{{- end }}"`;
      const expected = `items: {{- range .Values.items }}{{ . }}{{- end }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Built-in objects', () => {
    it('should handle Values object references', () => {
      const input = `replicas: "{{ .Values.replicas | int }}"`;
      const expected = `replicas: {{ .Values.replicas | int }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle Release object references', () => {
      const input = `name: "{{ .Release.Name }}"`;
      const expected = `name: {{ .Release.Name }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should handle Chart object references', () => {
      const input = `version: "{{ .Chart.Version }}"`;
      const expected = `version: {{ .Chart.Version }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Array/List items', () => {
    it('should handle Helm expressions in array items', () => {
      const input = `items:\n  - "{{ .Values.item1 }}"\n  - "{{ .Values.item2 }}"`;
      const expected = `items:\n  - {{ .Values.item1 }}\n  - {{ .Values.item2 }}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty Helm expressions', () => {
      const input = `value: "{{}}"`;
      const expected = `value: {{}}`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });

    it('should not affect regular quoted strings', () => {
      const input = `message: "Hello World"`;
      const expected = `message: "Hello World"`;
      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });

  describe('Real-world complex examples', () => {
    it('should handle complex deployment template', () => {
      const input = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: "{{ include \\"app.fullname\\" . }}"
  labels: "{{ include \\"app.labels\\" . | nindent 4 }}"
spec:
  replicas: "{{ .Values.replicaCount | int }}"
  selector:
    matchLabels: "{{ include \\"app.selectorLabels\\" . | nindent 6 }}"
  template:
    metadata:
      labels: "{{ include \\"app.selectorLabels\\" . | nindent 8 }}"
    spec:
      containers:
      - name: "{{ .Chart.Name }}"
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        ports:
        - containerPort: "{{ .Values.service.port | int }}"`;

      const expected = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "app.fullname" . }}
  labels: {{ include "app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount | int }}
  selector:
    matchLabels: {{ include "app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{ include "app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: {{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}
        ports:
        - containerPort: {{ .Values.service.port | int }}`;

      expect(testProcessHelmTemplates(input)).toBe(expected);
    });
  });
});
