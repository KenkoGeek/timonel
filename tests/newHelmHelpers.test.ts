/**
 * @fileoverview Tests for new Helm helpers implementation
 * @since 2.11.0
 */

import { describe, expect, it } from 'vitest';

import {
  ENV_HELPERS,
  GITOPS_HELPERS,
  OBSERVABILITY_HELPERS,
  VALIDATION_HELPERS,
  getNewHelpersByCategory,
  getAvailableHelperCategories,
  getHelpersByOptions,
  formatNewHelpers,
  generateNewHelpersTemplate,
  validateHelperNames,
  getHelperStatistics,
  type HelperDefinition,
} from '../src/lib/utils/helmHelpers/index.js';
import { SPRIG_HELPERS } from '../src/lib/utils/helmHelpers.js';

describe('New Helm Helpers', () => {
  describe('Helper Categories', () => {
    it('should have environment helpers', () => {
      expect(ENV_HELPERS).toBeDefined();
      expect(ENV_HELPERS.length).toBeGreaterThan(0);
      expect(ENV_HELPERS[0]).toHaveProperty('name');
      expect(ENV_HELPERS[0]).toHaveProperty('template');
    });

    it('should have GitOps helpers', () => {
      expect(GITOPS_HELPERS).toBeDefined();
      expect(GITOPS_HELPERS.length).toBeGreaterThan(0);
      expect(GITOPS_HELPERS[0]).toHaveProperty('name');
      expect(GITOPS_HELPERS[0]).toHaveProperty('template');
    });

    it('should have observability helpers', () => {
      expect(OBSERVABILITY_HELPERS).toBeDefined();
      expect(OBSERVABILITY_HELPERS.length).toBeGreaterThan(0);
      expect(OBSERVABILITY_HELPERS[0]).toHaveProperty('name');
      expect(OBSERVABILITY_HELPERS[0]).toHaveProperty('template');
    });

    it('should have validation helpers', () => {
      expect(VALIDATION_HELPERS).toBeDefined();
      expect(VALIDATION_HELPERS.length).toBeGreaterThan(0);
      expect(VALIDATION_HELPERS[0]).toHaveProperty('name');
      expect(VALIDATION_HELPERS[0]).toHaveProperty('template');
    });

    it('should return helpers by category', () => {
      const envHelpers = getNewHelpersByCategory('env');
      expect(envHelpers).toBeDefined();
      expect(envHelpers.length).toEqual(ENV_HELPERS.length);

      const gitopsHelpers = getNewHelpersByCategory('gitops');
      expect(gitopsHelpers).toBeDefined();
      expect(gitopsHelpers.length).toEqual(GITOPS_HELPERS.length);
    });

    it('should throw error for unknown category', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid category
        getNewHelpersByCategory('invalid');
      }).toThrow('Unknown helper category: invalid');
    });

    it('should return available categories', () => {
      const categories = getAvailableHelperCategories();
      expect(categories).toContain('env');
      expect(categories).toContain('gitops');
      expect(categories).toContain('observability');
      expect(categories).toContain('validation');
    });
  });

  describe('Helper Options', () => {
    it('should return helpers based on options', () => {
      const helpers = getHelpersByOptions({
        includeEnv: true,
        includeGitops: false,
        includeObservability: false,
        includeValidation: false,
      });

      expect(helpers.length).toEqual(ENV_HELPERS.length);
      expect(helpers.every((h) => h.name.startsWith('env.') || h.name.startsWith('config.'))).toBe(
        true,
      );
    });

    it('should return multiple helper categories', () => {
      const helpers = getHelpersByOptions({
        includeEnv: true,
        includeValidation: true,
        includeGitops: false,
        includeObservability: false,
      });

      expect(helpers.length).toEqual(ENV_HELPERS.length + VALIDATION_HELPERS.length);
    });

    it('should return empty array when no options are set', () => {
      const helpers = getHelpersByOptions({});
      expect(helpers.length).toEqual(0);
    });
  });

  describe('Helper Formatting', () => {
    it('should format helpers into Helm template format', () => {
      const testHelpers: HelperDefinition[] = [
        { name: 'test.helper', template: '{{ .Values.test }}' },
      ];

      const formatted = formatNewHelpers(testHelpers);

      expect(formatted).toContain('{{/*');
      expect(formatted).toContain('test.helper');
      expect(formatted).toContain('*/}}');
      expect(formatted).toContain('{{- define "test.helper" -}}');
      expect(formatted).toContain('{{ .Values.test }}');
      expect(formatted).toContain('{{- end }}');
    });

    it('should generate complete helpers template', () => {
      const template = generateNewHelpersTemplate({
        includeEnv: true,
        includeValidation: true,
      });

      expect(template).toContain('env.required');
      expect(template).toContain('validation.semver');
      expect(template).toContain('{{- define');
      expect(template).toContain('{{- end }}');
    });
  });

  describe('Helper Validation', () => {
    it('should validate helper names', () => {
      const validHelpers: HelperDefinition[] = [
        { name: 'valid.helper', template: '{{ .Values.test }}' },
        { name: 'another_helper', template: '{{ .Values.test2 }}' },
        { name: 'helper-with-dashes', template: '{{ .Values.test3 }}' },
      ];

      expect(() => validateHelperNames(validHelpers)).not.toThrow();
    });

    it('should reject invalid helper names', () => {
      const invalidHelpers: HelperDefinition[] = [
        { name: '123invalid', template: '{{ .Values.test }}' }, // starts with number
        { name: 'invalid space', template: '{{ .Values.test2 }}' }, // contains space
      ];

      expect(() => validateHelperNames(invalidHelpers)).toThrow();
    });

    it('should detect duplicate helper names', () => {
      const duplicateHelpers: HelperDefinition[] = [
        { name: 'duplicate', template: '{{ .Values.test1 }}' },
        { name: 'duplicate', template: '{{ .Values.test2 }}' },
      ];

      expect(() => validateHelperNames(duplicateHelpers)).toThrow('Duplicate helper names found');
    });
  });

  describe('Helper Statistics', () => {
    it('should calculate helper statistics', () => {
      const testHelpers: HelperDefinition[] = [
        { name: 'env.test1', template: 'short' },
        { name: 'env.test2', template: 'this is a longer template' },
        { name: 'git.test', template: 'medium length' },
      ];

      const stats = getHelperStatistics(testHelpers);

      expect(stats.totalHelpers).toBe(3);
      expect(stats.categoryCounts).toHaveProperty('env', 2);
      expect(stats.categoryCounts).toHaveProperty('git', 1);
      expect(stats.longestHelper).toBe('env.test2');
      expect(stats.shortestHelper).toBe('env.test1');
      expect(stats.averageTemplateLength).toBeGreaterThan(0);
    });

    it('should handle empty helpers array', () => {
      const stats = getHelperStatistics([]);

      expect(stats.totalHelpers).toBe(0);
      expect(stats.averageTemplateLength).toBe(0);
      expect(Object.keys(stats.categoryCounts)).toHaveLength(0);
    });
  });

  describe('Specific Helper Content', () => {
    it('should have fixed env.getOrDefault helper', () => {
      // Check that env.getOrDefault helper is in SPRIG_HELPERS (moved from ENV_HELPERS to avoid duplication)
      const envHelper = SPRIG_HELPERS.find((h) => h.name === 'env.getOrDefault');
      expect(envHelper).toBeDefined();
      expect(envHelper?.template).toContain('.Values.env');
      expect(envHelper?.template).toContain('$default');
    });

    it('should have environment detection helpers', () => {
      const isDev = ENV_HELPERS.find((h) => h.name === 'env.isDev');
      const isProd = ENV_HELPERS.find((h) => h.name === 'env.isProd');
      const isStaging = ENV_HELPERS.find((h) => h.name === 'env.isStaging');

      expect(isDev).toBeDefined();
      expect(isProd).toBeDefined();
      expect(isStaging).toBeDefined();
    });

    it('should have Git metadata helpers', () => {
      const gitCommit = GITOPS_HELPERS.find((h) => h.name === 'git.commitSha');
      const gitBranch = GITOPS_HELPERS.find((h) => h.name === 'git.branch');

      expect(gitCommit).toBeDefined();
      expect(gitBranch).toBeDefined();
      expect(gitCommit?.template).toContain('.Values.git.commitSha');
      expect(gitBranch?.template).toContain('.Values.git.branch');
    });

    it('should have observability helpers', () => {
      const serviceMonitor = OBSERVABILITY_HELPERS.find(
        (h) => h.name === 'monitoring.serviceMonitor',
      );
      const healthProbes = OBSERVABILITY_HELPERS.find((h) => h.name === 'health.probes');

      expect(serviceMonitor).toBeDefined();
      expect(healthProbes).toBeDefined();
      expect(serviceMonitor?.template).toContain('ServiceMonitor');
      expect(healthProbes?.template).toContain('livenessProbe');
    });

    it('should have validation helpers', () => {
      const semver = VALIDATION_HELPERS.find((h) => h.name === 'validation.semver');
      const k8sName = VALIDATION_HELPERS.find((h) => h.name === 'validation.k8sName');

      expect(semver).toBeDefined();
      expect(k8sName).toBeDefined();
      expect(semver?.template).toContain('regexMatch');
      expect(k8sName?.template).toContain('63');
    });
  });
});
