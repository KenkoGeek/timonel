import { describe, it, expect } from 'vitest';

import {
  generateHelpersTemplate,
  getDefaultHelpers,
  formatHelpers,
  STANDARD_HELPERS,
  AWS_HELPERS,
  AZURE_HELPERS,
  GCP_HELPERS,
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

  describe('AZURE_HELPERS', () => {
    it('should be an array of Azure-specific helpers', () => {
      expect(Array.isArray(AZURE_HELPERS)).toBe(true);
      expect(AZURE_HELPERS.length).toBeGreaterThan(0);
    });

    it('should contain Azure-specific helpers', () => {
      const helperNames = AZURE_HELPERS.map((h) => h.name);
      expect(helperNames).toContain('azure.resourceGroup');
      expect(helperNames).toContain('azure.subscriptionId');
    });

    it('should have valid Azure helper definitions', () => {
      AZURE_HELPERS.forEach((helper) => {
        expect(helper.name).toBeTruthy();
        expect(helper.template).toBeTruthy();
        expect(helper.name).toMatch(/^azure\./);
      });
    });
  });

  describe('GCP_HELPERS', () => {
    it('should be an array of GCP-specific helpers', () => {
      expect(Array.isArray(GCP_HELPERS)).toBe(true);
      expect(GCP_HELPERS.length).toBeGreaterThan(0);
    });

    it('should contain GCP-specific helpers', () => {
      const helperNames = GCP_HELPERS.map((h) => h.name);
      expect(helperNames).toContain('gcp.projectId');
      expect(helperNames).toContain('gcp.region');
    });

    it('should have valid GCP helper definitions', () => {
      GCP_HELPERS.forEach((helper) => {
        expect(helper.name).toBeTruthy();
        expect(helper.template).toBeTruthy();
        expect(helper.name).toMatch(/^gcp\./);
      });
    });
  });

  describe('getDefaultHelpers', () => {
    it('should return standard helpers by default', () => {
      const helpers = getDefaultHelpers();
      expect(Array.isArray(helpers)).toBe(true);
      expect(helpers.length).toBe(STANDARD_HELPERS.length);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name');
      expect(helperNames).toContain('chart.labels');
    });

    it('should return AWS helpers when specified', () => {
      const helpers = getDefaultHelpers('aws');
      expect(Array.isArray(helpers)).toBe(true);
      expect(helpers.length).toBe(STANDARD_HELPERS.length + AWS_HELPERS.length);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name'); // Standard
      expect(helperNames).toContain('aws.region'); // AWS
    });

    it('should return Azure helpers when specified', () => {
      const helpers = getDefaultHelpers('azure');
      expect(Array.isArray(helpers)).toBe(true);
      expect(helpers.length).toBe(STANDARD_HELPERS.length + AZURE_HELPERS.length);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name'); // Standard
      expect(helperNames).toContain('azure.resourceGroup'); // Azure
    });

    it('should return GCP helpers when specified', () => {
      const helpers = getDefaultHelpers('gcp');
      expect(Array.isArray(helpers)).toBe(true);
      expect(helpers.length).toBe(STANDARD_HELPERS.length + GCP_HELPERS.length);

      const helperNames = helpers.map((h) => h.name);
      expect(helperNames).toContain('chart.name'); // Standard
      expect(helperNames).toContain('gcp.projectId'); // GCP
    });

    it('should handle invalid cloud provider', () => {
      // @ts-expect-error - Testing invalid input
      const helpers = getDefaultHelpers('invalid');
      expect(Array.isArray(helpers)).toBe(true);
      expect(helpers.length).toBe(STANDARD_HELPERS.length);
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

    it('should generate helpers template with Azure helpers', () => {
      const result = generateHelpersTemplate('azure');

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "azure.resourceGroup" -}}');
      expect(result).toContain('{{- define "azure.subscriptionId" -}}');
    });

    it('should generate helpers template with GCP helpers', () => {
      const result = generateHelpersTemplate('gcp');

      expect(result).toContain('{{- define "chart.name" -}}');
      expect(result).toContain('{{- define "gcp.projectId" -}}');
      expect(result).toContain('{{- define "gcp.region" -}}');
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
