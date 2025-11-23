import { describe, it, expect } from 'vitest';

import {
  getNewHelpersByCategory,
  getAvailableHelperCategories,
  getHelpersByCategories,
  getHelpersByOptions,
  formatNewHelpers,
  generateNewHelpersTemplate,
  getCachedNewHelpersTemplate,
  createNewHelper,
  validateHelperNames,
  filterHelpersByPattern,
  getHelperStatistics,
  ENV_HELPERS,
  GITOPS_HELPERS,
  OBSERVABILITY_HELPERS,
  VALIDATION_HELPERS,
} from '../src/lib/utils/helmHelpers/index';

describe('Helm Helpers Index', () => {
  describe('getNewHelpersByCategory', () => {
    it('should return env helpers', () => {
      const helpers = getNewHelpersByCategory('env');
      expect(helpers).toEqual(ENV_HELPERS);
    });

    it('should return gitops helpers', () => {
      const helpers = getNewHelpersByCategory('gitops');
      expect(helpers).toEqual(GITOPS_HELPERS);
    });

    it('should return observability helpers', () => {
      const helpers = getNewHelpersByCategory('observability');
      expect(helpers).toEqual(OBSERVABILITY_HELPERS);
    });

    it('should return validation helpers', () => {
      const helpers = getNewHelpersByCategory('validation');
      expect(helpers).toEqual(VALIDATION_HELPERS);
    });
  });

  describe('getAvailableHelperCategories', () => {
    it('should return all available categories', () => {
      const categories = getAvailableHelperCategories();
      expect(categories).toContain('env');
      expect(categories).toContain('gitops');
      expect(categories).toContain('observability');
      expect(categories).toContain('validation');
    });
  });

  describe('getHelpersByCategories', () => {
    it('should return helpers for specified categories', () => {
      const helpers = getHelpersByCategories(['env', 'validation']);
      expect(helpers).toEqual([...ENV_HELPERS, ...VALIDATION_HELPERS]);
    });

    it('should return empty array for empty categories', () => {
      const helpers = getHelpersByCategories([]);
      expect(helpers).toEqual([]);
    });
  });

  describe('getHelpersByOptions', () => {
    it('should return helpers based on options', () => {
      const helpers = getHelpersByOptions({
        includeEnv: true,
        includeGitops: false,
        includeObservability: true,
        includeValidation: false,
      });
      expect(helpers).toEqual([...ENV_HELPERS, ...OBSERVABILITY_HELPERS]);
    });

    it('should return all helpers if no options provided', () => {
      const helpers = getHelpersByOptions({});
      expect(helpers).toEqual([
        ...ENV_HELPERS,
        ...GITOPS_HELPERS,
        ...OBSERVABILITY_HELPERS,
        ...VALIDATION_HELPERS,
      ]);
    });
  });

  describe('formatNewHelpers', () => {
    it('should format helpers correctly', () => {
      const helpers = [{ name: 'test.helper', template: '{{ .Values.test }}' }];
      const formatted = formatNewHelpers(helpers);
      expect(formatted).toContain('{{- define "test.helper" -}}');
      expect(formatted).toContain('{{ .Values.test }}');
      expect(formatted).toContain('{{- end }}');
    });
  });

  describe('generateNewHelpersTemplate', () => {
    it('should generate template with selected helpers', () => {
      const template = generateNewHelpersTemplate({ includeEnv: true, includeGitops: false });
      expect(template).toContain('env.required');
      expect(template).not.toContain('gitops.argocd');
    });
  });

  describe('getCachedNewHelpersTemplate', () => {
    it('should return cached template', () => {
      const template1 = getCachedNewHelpersTemplate({ includeEnv: true });
      const template2 = getCachedNewHelpersTemplate({ includeEnv: true });
      expect(template1).toBe(template2);
    });
  });

  describe('createNewHelper', () => {
    it('should create a new helper definition', () => {
      const helper = createNewHelper('my.helper', 'content');
      expect(helper).toEqual({ name: 'my.helper', template: 'content' });
    });
  });

  describe('validateHelperNames', () => {
    it('should not throw for valid names', () => {
      const validHelpers = [{ name: 'env.get', template: '' }];
      expect(() => validateHelperNames(validHelpers)).not.toThrow();
    });

    it('should throw for invalid names', () => {
      const invalidHelpers = [{ name: 'invalid name', template: '' }];
      expect(() => validateHelperNames(invalidHelpers)).toThrow();
    });
  });

  describe('filterHelpersByPattern', () => {
    it('should filter helpers by name pattern', () => {
      const helpers = [...ENV_HELPERS, ...GITOPS_HELPERS];
      const filtered = filterHelpersByPattern(helpers, /^env\./);
      const expected = ENV_HELPERS.filter((h) => /^env\./.test(h.name));
      expect(filtered).toEqual(expected);
    });
  });

  describe('getHelperStatistics', () => {
    it('should return statistics', () => {
      const helpers = [...ENV_HELPERS];
      const stats = getHelperStatistics(helpers);
      expect(stats.totalHelpers).toBe(ENV_HELPERS.length);
      expect(stats.categoryCounts).toBeDefined();
    });
  });
});
