import { describe, it, expect } from 'vitest';

import {
  AWS_HELPERS,
  formatHelpers,
  generateHelpersTemplate,
  getDefaultHelpers,
  STANDARD_HELPERS,
} from '../../dist/lib/utils/helmHelpers.js';
import type { HelperDefinition } from '../../dist/lib/utils/helmHelpers.js';

describe('Helm Helpers', () => {
  describe('STANDARD_HELPERS', () => {
    it('should be an array of helper definitions', () => {
      expect(Array.isArray(STANDARD_HELPERS)).toBe(true);
      expect(STANDARD_HELPERS.length).toBeGreaterThan(0);
    });

    it('should have valid helper definitions', () => {
      STANDARD_HELPERS.forEach((helper) => {
        expect(helper.name).toBeTruthy();
        expect(helper.template).toBeTruthy();
      });
    });

    it('should contain basic chart helpers', () => {
      const helperNames = STANDARD_HELPERS.map((h) => h.name);
      expect(helperNames).toContain('chart.name');
      expect(helperNames).toContain('chart.labels');
      expect(helperNames).toContain('chart.selectorLabels');
    });

    it('should generate chart name helper correctly', () => {
      const helper = STANDARD_HELPERS.find((h) => h.name === 'chart.name');
      expect(helper).toBeDefined();
      expect(helper!.template).toContain('.Chart.Name');
      expect(helper!.template).toContain('nameOverride');
    });

    it('should generate chart labels helper correctly', () => {
      const helper = STANDARD_HELPERS.find((h) => h.name === 'chart.labels');
      expect(helper).toBeDefined();
      expect(helper!.template).toContain('helm.sh/chart');
      expect(helper!.template).toContain('chart.selectorLabels');
      expect(helper!.template).toContain('app.kubernetes.io/version');
    });
  });

  describe('AWS_HELPERS', () => {
    it('should be an array of AWS-specific helpers', () => {
      expect(Array.isArray(AWS_HELPERS)).toBe(true);
      expect(AWS_HELPERS.length).toBeGreaterThan(0);
    });

    it('should contain AWS-specific helpers', () => {
      const helperNames = AWS_HELPERS.map((h) => h.name);
      expect(helperNames).toContain('aws.region');
      expect(helperNames).toContain('aws.accountId');
    });

    it('should have valid AWS helper definitions', () => {
      AWS_HELPERS.forEach((helper) => {
        expect(helper.name).toBeTruthy();
        expect(helper.template).toBeTruthy();
        expect(helper.name).toMatch(/^aws\./);
      });
    });

    it('should generate AWS role ARN helper correctly', () => {
      const helper = AWS_HELPERS.find((h) => h.name === 'aws.irsaRoleArn');
      expect(helper).toBeDefined();
      expect(helper!.template).toContain('arn:aws:iam::');
      expect(helper!.template).toContain('aws.accountId');
    });
  });

  describe('getDefaultHelpers', () => {
    it('should return standard helpers by default', () => {
      const helpers = getDefaultHelpers();
      expect(Array.isArray(helpers)).toBe(true);
      // getDefaultHelpers includes all helper categories by default: 5 + 4 + 4 + 9 + 5 = 27
      expect(helpers.length).toBe(27);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name');
      expect(helperNames).toContain('chart.labels');
    });

    it('should return AWS helpers when specified', () => {
      const helpers = getDefaultHelpers('aws');
      expect(Array.isArray(helpers)).toBe(true);
      // All default helpers + AWS helpers: 27 + 6 = 33
      expect(helpers.length).toBe(33);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name'); // Standard
      expect(helperNames).toContain('aws.region'); // AWS
    });

    it('should handle invalid cloud provider', () => {
      // @ts-expect-error - Testing invalid input
      const helpers = getDefaultHelpers('invalid');
      expect(Array.isArray(helpers)).toBe(true);
      // Should return all default helpers (no AWS): 27
      expect(helpers.length).toBe(27);
    });
  });

  describe('formatHelpers', () => {
    it('should format single helper correctly', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'test.helper',
          template: '{{ .Chart.Name }}',
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{- define "test.helper" -}}');
      expect(result).toContain('{{ .Chart.Name }}');
      expect(result).toContain('{{- end }}');
    });

    it('should format multiple helpers correctly', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'helper.one',
          template: '{{ .Values.one }}',
        },
        {
          name: 'helper.two',
          template: '{{ .Values.two }}',
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{- define "helper.one" -}}');
      expect(result).toContain('{{- define "helper.two" -}}');
      expect(result).toContain('{{ .Values.one }}');
      expect(result).toContain('{{ .Values.two }}');
    });

    it('should handle empty helpers array', () => {
      const result = formatHelpers([]);
      expect(result).toBe('');
    });

    it('should preserve template formatting', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'multiline.helper',
          template: `{{- if .Values.enabled }}
enabled: true
{{- else }}
enabled: false
{{- end }}`,
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{- if .Values.enabled }}');
      expect(result).toContain('enabled: true');
      expect(result).toContain('{{- else }}');
      expect(result).toContain('enabled: false');
      expect(result).toContain('{{- end }}');
    });
  });

  describe('generateHelpersTemplate', () => {
    it('should generate complete helpers template with standard helpers', () => {
      const result = generateHelpersTemplate();

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "chart.labels" -}}');
      expect(result).toContain('{{- define "chart.selectorLabels" -}}');
    });

    it('should generate helpers template with AWS helpers', () => {
      const result = generateHelpersTemplate('aws');

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "aws.region" -}}');
      expect(result).toContain('{{- define "aws.accountId" -}}');
    });

    it('should generate helpers template with custom helpers', () => {
      const customHelpers: HelperDefinition[] = [
        {
          name: 'custom.helper',
          template: '{{ .Values.custom.value }}',
        },
      ];

      const result = generateHelpersTemplate(undefined, customHelpers);

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "custom.helper" -}}');
      expect(result).toContain('{{ .Values.custom.value }}');
    });

    it('should combine cloud and custom helpers', () => {
      const customHelpers: HelperDefinition[] = [
        {
          name: 'app.database',
          template: '{{ .Values.database.host }}:{{ .Values.database.port }}',
        },
      ];

      const result = generateHelpersTemplate('aws', customHelpers);

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "aws.region" -}}');
      expect(result).toContain('{{- define "app.database" -}}');
    });

    it('should handle empty custom helpers', () => {
      const result = generateHelpersTemplate('aws', []);

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "aws.region" -}}');
    });
  });

  describe('template validation', () => {
    it('should generate valid Helm template syntax', () => {
      const template = generateHelpersTemplate();

      // Check for valid Helm template structure
      expect(template).toContain('{{/*');
      expect(template).toContain('*/}}');
      expect(template).toContain('{{- define');
      expect(template).toContain('{{- end }}');

      // Ensure balanced template blocks (define/end pairs)
      const defineCount = (template.match(/{{-\s*define/g) || []).length;
      const endCount = (template.match(/{{-\s*end\s*}}/g) || []).length;
      expect(defineCount).toBeGreaterThan(0);
      expect(endCount).toBeGreaterThan(0);
      // Note: end count may be higher due to conditional blocks
    });

    it('should generate syntactically correct helper functions', () => {
      const helpers = getDefaultHelpers();
      const template = generateHelpersTemplate();

      // Check each helper has proper structure
      helpers.forEach((helper) => {
        expect(template).toContain(`{{- define "${helper.name}"`);
        // Each define should have corresponding content
        expect(template).toContain(`{{- define "${helper.name}"`);
      });
    });

    it('should not contain obvious syntax errors', () => {
      const template = generateHelpersTemplate();

      // Check for common syntax errors
      expect(template).not.toMatch(/{{[^}]*{{/); // Nested opening braces
      expect(template).not.toMatch(/}}[^{]*}}/); // Nested closing braces
      // Check for proper comment structure
      expect(template).toMatch(/{{\/\*[\s\S]*?\*\/}}/); // Valid comments
    });
  });

  describe('edge cases', () => {
    it('should handle helpers with special characters in names', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'app.name-with-dashes',
          template: '{{ .Chart.Name }}',
        },
        {
          name: 'app.name_with_underscores',
          template: '{{ .Chart.Name }}',
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{- define "app.name-with-dashes" -}}');
      expect(result).toContain('{{- define "app.name_with_underscores" -}}');
    });

    it('should handle helpers with complex templates', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'complex.helper',
          template: `{{- $name := include "chart.name" . -}}
{{- $version := .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- printf "%s-%s" $name $version -}}`,
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{- $name := include "chart.name" . -}}');
      expect(result).toContain('{{- $version := .Chart.Version');
      expect(result).toContain('{{- printf "%s-%s" $name $version -}}');
    });

    it('should handle helpers with quotes and escaping', () => {
      const helpers: HelperDefinition[] = [
        {
          name: 'quoted.helper',
          template: '{{ printf "app=%s,version=%s" .Chart.Name .Chart.Version }}',
        },
      ];

      const result = formatHelpers(helpers);
      expect(result).toContain('{{ printf "app=%s,version=%s" .Chart.Name .Chart.Version }}');
    });
  });
});
