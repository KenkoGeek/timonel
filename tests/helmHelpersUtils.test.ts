import { describe, it, expect } from 'vitest';

import {
  getDefaultHelpers,
  generateHelpersTemplate,
  getHelpersByCategory,
  createHelper,
  STANDARD_HELPERS,
  FILE_ACCESS_HELPERS,
  TEMPLATE_FUNCTION_HELPERS,
  SPRIG_HELPERS,
  KUBERNETES_HELPERS,
  AWS_HELPERS,
} from '../src/lib/utils/helmHelpers.js';

describe('Helm Helpers Utils', () => {
  describe('getDefaultHelpers', () => {
    it('should return standard helpers by default', () => {
      const helpers = getDefaultHelpers();
      expect(helpers).toEqual(expect.arrayContaining(STANDARD_HELPERS));
      expect(helpers).toEqual(expect.arrayContaining(FILE_ACCESS_HELPERS));
      expect(helpers).toEqual(expect.arrayContaining(TEMPLATE_FUNCTION_HELPERS));
      expect(helpers).toEqual(expect.arrayContaining(SPRIG_HELPERS));
      expect(helpers).toEqual(expect.arrayContaining(KUBERNETES_HELPERS));
    });

    it('should include AWS helpers when specified', () => {
      const helpers = getDefaultHelpers('aws');
      expect(helpers).toEqual(expect.arrayContaining(AWS_HELPERS));
    });

    it('should exclude categories when options are false', () => {
      const helpers = getDefaultHelpers(undefined, {
        includeFileAccess: false,
        includeTemplateFunction: false,
        includeSprig: false,
        includeKubernetes: false,
        includeEnv: false,
        includeGitops: false,
        includeObservability: false,
        includeValidation: false,
      });

      // Should still contain STANDARD_HELPERS
      expect(helpers).toEqual(expect.arrayContaining(STANDARD_HELPERS));

      // Should not contain others
      expect(helpers).not.toEqual(expect.arrayContaining(FILE_ACCESS_HELPERS));
      expect(helpers).not.toEqual(expect.arrayContaining(TEMPLATE_FUNCTION_HELPERS));
      expect(helpers).not.toEqual(expect.arrayContaining(SPRIG_HELPERS));
      expect(helpers).not.toEqual(expect.arrayContaining(KUBERNETES_HELPERS));
    });
  });

  describe('generateHelpersTemplate', () => {
    it('should generate a string template', () => {
      const template = generateHelpersTemplate();
      expect(typeof template).toBe('string');
      expect(template).toContain('{{- define "chart.name" -}}');
    });

    it('should include custom helpers', () => {
      const custom = [{ name: 'custom.helper', template: 'custom content' }];
      const template = generateHelpersTemplate(undefined, custom);
      expect(template).toContain('{{- define "custom.helper" -}}');
      expect(template).toContain('custom content');
    });
  });

  describe('getHelpersByCategory', () => {
    it('should return standard categories', () => {
      expect(getHelpersByCategory('standard')).toEqual(STANDARD_HELPERS);
      expect(getHelpersByCategory('fileAccess')).toEqual(FILE_ACCESS_HELPERS);
      expect(getHelpersByCategory('templateFunction')).toEqual(TEMPLATE_FUNCTION_HELPERS);
      expect(getHelpersByCategory('sprig')).toEqual(SPRIG_HELPERS);
      expect(getHelpersByCategory('kubernetes')).toEqual(KUBERNETES_HELPERS);
      expect(getHelpersByCategory('aws')).toEqual(AWS_HELPERS);
    });

    it('should return new categories', () => {
      const envHelpers = getHelpersByCategory('env');
      expect(envHelpers.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown category', () => {
      // @ts-expect-error Testing invalid category
      expect(getHelpersByCategory('unknown')).toEqual([]);
    });
  });

  describe('createHelper', () => {
    it('should create a helper definition', () => {
      const helper = createHelper('my.helper', 'content');
      expect(helper).toEqual({ name: 'my.helper', template: 'content' });
    });
  });
});
