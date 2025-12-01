import { describe, it, expect } from 'vitest';
import { valuesRef } from '../src/lib/utils/valuesRef.js';
import { postProcessFieldConditionals } from '../src/lib/utils/helmYamlSerializer.js';
import { Document } from 'yaml';

interface TestValues {
  enabled: boolean;
  replicas: number;
  items: string[];
  config: {
    key: string;
    value: string;
  };
}

describe('valuesRef field-level conditionals', () => {
  it('should handle simple field conditional', () => {
    const v = valuesRef<TestValues>();
    const obj = {
      replicas: v.if(v.enabled.not(), v.replicas),
    };
    
    // Simulate YAML serialization with marker
    const yaml = `spec:
  replicas: |-
    __FIELD_CONDITIONAL__:replicas:{{- if not .Values.enabled }}
  replicas: {{ .Values.replicas }}
{{- end }}`;
    
    const result = postProcessFieldConditionals(yaml);
    
    expect(result).toContain('{{- if not .Values.enabled }}');
    expect(result).toContain('replicas: {{ .Values.replicas }}');
    expect(result).toContain('{{- end }}');
    expect(result).not.toContain('__FIELD_CONDITIONAL__');
    expect(result).not.toContain('|-');
  });

  it('should handle field conditional with array', () => {
    const v = valuesRef<TestValues>();
    const obj = {
      items: v.if(v.enabled, v.items),
    };
    
    const yaml = `spec:
  items: |-
    __FIELD_CONDITIONAL__:items:{{- if .Values.enabled }}
  items:
    - {{ index .Values.items 0 }}
    - {{ index .Values.items 1 }}
{{- end }}`;
    
    const result = postProcessFieldConditionals(yaml);
    
    expect(result).toContain('{{- if .Values.enabled }}');
    expect(result).toContain('items:');
    expect(result).toContain('- {{ index .Values.items 0 }}');
    expect(result).not.toContain('__FIELD_CONDITIONAL__');
  });

  it('should handle field conditional with object', () => {
    const v = valuesRef<TestValues>();
    const obj = {
      config: v.if(v.enabled, v.config),
    };
    
    const yaml = `spec:
  config: |-
    __FIELD_CONDITIONAL__:config:{{- if .Values.enabled }}
  config:
    key: {{ .Values.config.key }}
    value: {{ .Values.config.value }}
{{- end }}`;
    
    const result = postProcessFieldConditionals(yaml);
    
    expect(result).toContain('{{- if .Values.enabled }}');
    expect(result).toContain('config:');
    expect(result).toContain('key: {{ .Values.config.key }}');
    expect(result).toContain('value: {{ .Values.config.value }}');
    expect(result).not.toContain('__FIELD_CONDITIONAL__');
  });

  it('should preserve correct indentation', () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  replicas: |-
    __FIELD_CONDITIONAL__:replicas:{{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
{{- end }}
  template:
    spec:
      containers:
        - name: app`;
    
    const result = postProcessFieldConditionals(yaml);
    
    // Check that indentation is correct (2 spaces for spec level)
    expect(result).toMatch(/^spec:\n  \{\{- if not \.Values\.autoscaling\.enabled \}\}/m);
    expect(result).toMatch(/^  replicas: \{\{ \.Values\.replicaCount \}\}/m);
    expect(result).toMatch(/^  \{\{- end \}\}/m);
  });
});
