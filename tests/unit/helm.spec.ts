import { describe, it, expect } from 'vitest';

import {
  valuesRef,
  requiredValuesRef,
  include,
  template,
  numberRef,
  boolRef,
  quote,
  indent,
  helm,
  conditionalRef,
  defaultRef,
  base64Ref,
  jsonRef,
} from '../../src/lib/helm.js';

describe('Helm Template Helpers', () => {
  describe('valuesRef', () => {
    it('should create basic values reference', () => {
      const result = valuesRef('image.tag');
      expect(result).toBe('{{ .Values.image.tag }}');
    });

    it('should handle nested paths', () => {
      const result = valuesRef('database.connection.host');
      expect(result).toBe('{{ .Values.database.connection.host }}');
    });

    it('should handle single level paths', () => {
      const result = valuesRef('replicas');
      expect(result).toBe('{{ .Values.replicas }}');
    });

    it('should handle paths with numbers', () => {
      const result = valuesRef('items.0.name');
      expect(result).toBe('{{ .Values.items.0.name }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => valuesRef('')).toThrow('Invalid Helm template path');
      expect(() => valuesRef('.invalid')).toThrow('Invalid Helm template path');
      expect(() => valuesRef('invalid path')).toThrow('Invalid Helm template path');
      expect(() => valuesRef('invalid@path')).toThrow('Invalid Helm template path');
    });
  });

  describe('requiredValuesRef', () => {
    it('should create required values reference with default message', () => {
      const result = requiredValuesRef('database.password');
      expect(result).toBe(
        '{{ required "database.password is required" .Values.database.password }}',
      );
    });

    it('should create required values reference with custom message', () => {
      const result = requiredValuesRef('api.key', 'API key must be provided');
      expect(result).toBe('{{ required "API key must be provided" .Values.api.key }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => requiredValuesRef('')).toThrow('Invalid Helm template path');
      expect(() => requiredValuesRef('.invalid')).toThrow('Invalid Helm template path');
      expect(() => requiredValuesRef('invalid path')).toThrow('Invalid Helm template path');
      expect(() => requiredValuesRef('invalid@path')).toThrow('Invalid Helm template path');
    });
  });

  describe('include', () => {
    it('should create include template reference', () => {
      const result = include('myapp.labels', '.');
      expect(result).toBe('{{ include "myapp.labels" . }}');
    });

    it('should create include with custom context', () => {
      const result = include('myapp.selectorLabels', '.Values.deployment');
      expect(result).toBe('{{ include "myapp.selectorLabels" .Values.deployment }}');
    });

    it('should use default context when not provided', () => {
      const result = include('myapp.labels');
      expect(result).toBe('{{ include "myapp.labels" . }}');
    });

    it('should handle empty template name', () => {
      const result = include('');
      expect(result).toBe('{{ include "" . }}');
    });
  });

  describe('template', () => {
    it('should create template reference', () => {
      const result = template('myapp.labels', '.');
      expect(result).toBe('{{ template "myapp.labels" . }}');
    });

    it('should create template with custom context', () => {
      const result = template('myapp.selectorLabels', '.Values.deployment');
      expect(result).toBe('{{ template "myapp.selectorLabels" .Values.deployment }}');
    });

    it('should use default context when not provided', () => {
      const result = template('myapp.labels');
      expect(result).toBe('{{ template "myapp.labels" . }}');
    });
  });

  describe('numberRef', () => {
    it('should create number reference with int cast', () => {
      const result = numberRef('deployment.replicas');
      expect(result).toBe('{{ .Values.deployment.replicas | int }}');
    });

    it('should handle nested paths', () => {
      const result = numberRef('database.connection.port');
      expect(result).toBe('{{ .Values.database.connection.port | int }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => numberRef('')).toThrow('Invalid Helm template path');
      expect(() => numberRef('.invalid')).toThrow('Invalid Helm template path');
      expect(() => numberRef('invalid path')).toThrow('Invalid Helm template path');
      expect(() => numberRef('invalid@path')).toThrow('Invalid Helm template path');
    });
  });

  describe('boolRef', () => {
    it('should create boolean reference with toBool cast', () => {
      const result = boolRef('feature.enabled');
      expect(result).toBe('{{ .Values.feature.enabled | toBool }}');
    });

    it('should handle nested paths', () => {
      const result = boolRef('database.ssl.enabled');
      expect(result).toBe('{{ .Values.database.ssl.enabled | toBool }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => boolRef('')).toThrow('Invalid Helm template path');
      expect(() => boolRef('.invalid')).toThrow('Invalid Helm template path');
      expect(() => boolRef('invalid path')).toThrow('Invalid Helm template path');
      expect(() => boolRef('invalid@path')).toThrow('Invalid Helm template path');
    });
  });

  describe('quote', () => {
    it('should quote Helm template expressions', () => {
      const result = quote('{{ .Values.image.tag }}');
      expect(result).toBe("'{{ .Values.image.tag }}'");
    });

    it('should not quote regular strings', () => {
      const result = quote('nginx:1.21');
      expect(result).toBe('nginx:1.21');
    });

    it('should handle complex Helm expressions', () => {
      const result = quote('{{ .Values.image.tag | default "latest" }}');
      expect(result).toBe('\'{{ .Values.image.tag | default "latest" }}\'');
    });

    it('should handle empty strings', () => {
      const result = quote('');
      expect(result).toBe('');
    });
  });

  describe('indent', () => {
    it('should indent single line', () => {
      const result = indent(4, 'line1');
      expect(result).toBe('    line1');
    });

    it('should indent multiple lines', () => {
      const result = indent(2, 'line1\nline2');
      expect(result).toBe('  line1\n  line2');
    });

    it('should handle empty lines', () => {
      const result = indent(4, 'line1\n\nline3');
      expect(result).toBe('    line1\n\n    line3');
    });

    it('should handle zero indentation', () => {
      const result = indent(0, 'line1\nline2');
      expect(result).toBe('line1\nline2');
    });
  });

  describe('helm object', () => {
    it('should provide release name reference', () => {
      expect(helm.releaseName).toBe('{{ .Release.Name }}');
    });

    it('should provide chart name reference', () => {
      expect(helm.chartName).toBe('{{ .Chart.Name }}');
    });

    it('should provide chart version reference', () => {
      expect(helm.chartVersion).toBe('{{ .Chart.Version }}');
    });

    it('should provide namespace reference', () => {
      expect(helm.namespace).toBe('{{ .Release.Namespace }}');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle special characters in paths', () => {
      expect(() => valuesRef('path-with-dashes')).not.toThrow();
      expect(() => valuesRef('path_with_underscores')).not.toThrow();
    });

    it('should reject paths with spaces', () => {
      expect(() => valuesRef('path with spaces')).toThrow('Invalid Helm template path');
    });

    it('should handle very long paths', () => {
      const longPath = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z';
      expect(() => valuesRef(longPath)).not.toThrow();
    });

    it('should handle numeric-only path segments', () => {
      const result = valuesRef('items.0.1.name');
      expect(result).toBe('{{ .Values.items.0.1.name }}');
    });

    it('should handle complex indentation scenarios', () => {
      const multilineText = 'line1\n  line2\n    line3';
      const result = indent(2, multilineText);
      expect(result).toBe('  line1\n    line2\n      line3');
    });

    it('should handle template names with special characters', () => {
      const result = include('my-app.labels');
      expect(result).toBe('{{ include "my-app.labels" . }}');

      const result2 = template('my_app.selector_labels');
      expect(result2).toBe('{{ template "my_app.selector_labels" . }}');
    });
  });

  describe('integration scenarios', () => {
    it('should work together for complex template generation', () => {
      const imageRepo = valuesRef('image.repository');
      const imageTag = valuesRef('image.tag');
      const replicas = numberRef('replicas');
      const enabled = boolRef('feature.enabled');

      expect(imageRepo).toBe('{{ .Values.image.repository }}');
      expect(imageTag).toBe('{{ .Values.image.tag }}');
      expect(replicas).toBe('{{ .Values.replicas | int }}');
      expect(enabled).toBe('{{ .Values.feature.enabled | toBool }}');
    });

    it('should handle quoted template expressions in YAML context', () => {
      const templateExpr = valuesRef('image.tag');
      const quoted = quote(templateExpr);

      expect(templateExpr).toBe('{{ .Values.image.tag }}');
      expect(quoted).toBe("'{{ .Values.image.tag }}'");
    });

    it('should handle indented multi-line template content', () => {
      const labels = include('myapp.labels');
      const indentedLabels = indent(4, labels);

      expect(indentedLabels).toBe('    {{ include "myapp.labels" . }}');
    });
  });

  describe('conditionalRef', () => {
    it('should create conditional values reference', () => {
      const result = conditionalRef('database.secretName', 'database.enabled');
      expect(result).toBe(
        '{{ if .Values.database.enabled }}{{ .Values.database.secretName }}{{ end }}',
      );
    });

    it('should handle nested paths for both value and condition', () => {
      const result = conditionalRef('app.config.url', 'features.external.enabled');
      expect(result).toBe(
        '{{ if .Values.features.external.enabled }}{{ .Values.app.config.url }}{{ end }}',
      );
    });

    it('should throw error for invalid value path', () => {
      expect(() => conditionalRef('', 'enabled')).toThrow('Invalid Helm template path');
      expect(() => conditionalRef('invalid path', 'enabled')).toThrow('Invalid Helm template path');
    });

    it('should throw error for invalid condition path', () => {
      expect(() => conditionalRef('value', '')).toThrow('Invalid Helm template condition path');
      expect(() => conditionalRef('value', 'invalid@condition')).toThrow(
        'Invalid Helm template condition path',
      );
    });
  });

  describe('defaultRef', () => {
    it('should create values reference with default fallback', () => {
      const result = defaultRef('image.tag', 'latest');
      expect(result).toBe('{{ .Values.image.tag | default "latest" }}');
    });

    it('should handle numeric default values', () => {
      const result = defaultRef('replicas', '3');
      expect(result).toBe('{{ .Values.replicas | default "3" }}');
    });

    it('should escape quotes in default value', () => {
      const result = defaultRef('message', 'Hello "World"');
      expect(result).toBe('{{ .Values.message | default "Hello \\"World\\"" }}');
    });

    it('should escape backslashes in default value', () => {
      const result = defaultRef('path', 'C:\\Program Files');
      expect(result).toBe('{{ .Values.path | default "C:\\\\Program Files" }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => defaultRef('', 'default')).toThrow('Invalid Helm template path');
      expect(() => defaultRef('invalid path', 'default')).toThrow('Invalid Helm template path');
    });
  });

  describe('base64Ref', () => {
    it('should create base64-encoded values reference', () => {
      const result = base64Ref('secrets.apiKey');
      expect(result).toBe('{{ .Values.secrets.apiKey | b64enc }}');
    });

    it('should handle nested paths', () => {
      const result = base64Ref('app.credentials.token');
      expect(result).toBe('{{ .Values.app.credentials.token | b64enc }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => base64Ref('')).toThrow('Invalid Helm template path');
      expect(() => base64Ref('invalid@path')).toThrow('Invalid Helm template path');
    });
  });

  describe('jsonRef', () => {
    it('should create JSON-serialized values reference', () => {
      const result = jsonRef('app.config');
      expect(result).toBe('{{ .Values.app.config | toJson }}');
    });

    it('should handle nested configuration paths', () => {
      const result = jsonRef('database.connection.options');
      expect(result).toBe('{{ .Values.database.connection.options | toJson }}');
    });

    it('should throw error for invalid paths', () => {
      expect(() => jsonRef('')).toThrow('Invalid Helm template path');
      expect(() => jsonRef('invalid path')).toThrow('Invalid Helm template path');
    });
  });

  describe('integration scenarios', () => {
    it('should work together for complex template generation', () => {
      const imageRepo = valuesRef('image.repository');
      const imageTag = valuesRef('image.tag');
      const replicas = numberRef('replicas');
      const enabled = boolRef('feature.enabled');

      expect(imageRepo).toBe('{{ .Values.image.repository }}');
      expect(imageTag).toBe('{{ .Values.image.tag }}');
      expect(replicas).toBe('{{ .Values.replicas | int }}');
      expect(enabled).toBe('{{ .Values.feature.enabled | toBool }}');
    });

    it('should handle quoted template expressions in YAML context', () => {
      const templateExpr = valuesRef('image.tag');
      const quoted = quote(templateExpr);

      expect(templateExpr).toBe('{{ .Values.image.tag }}');
      expect(quoted).toBe("'{{ .Values.image.tag }}'");
    });

    it('should combine new helper functions effectively', () => {
      const conditionalSecret = conditionalRef('database.password', 'database.enabled');
      const defaultImage = defaultRef('image.tag', 'latest');
      const encodedToken = base64Ref('auth.token');
      const configJson = jsonRef('app.settings');

      expect(conditionalSecret).toBe(
        '{{ if .Values.database.enabled }}{{ .Values.database.password }}{{ end }}',
      );
      expect(defaultImage).toBe('{{ .Values.image.tag | default "latest" }}');
      expect(encodedToken).toBe('{{ .Values.auth.token | b64enc }}');
      expect(configJson).toBe('{{ .Values.app.settings | toJson }}');
    });
  });
});
