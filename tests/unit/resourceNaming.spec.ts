import { describe, it, expect } from 'vitest';

import {
  getResourceName,
  generateManifestName,
  sanitizeKubernetesName,
  isValidKubernetesName,
} from '../../dist/lib/utils/resourceNaming.js';
import type { KubernetesResource } from '../../dist/lib/utils/resourceNaming.js';

describe('Resource Naming', () => {
  describe('getResourceName', () => {
    it('should generate resource name from Kubernetes object', () => {
      const resource: KubernetesResource = {
        kind: 'Deployment',
        metadata: { name: 'my-app' },
      };
      const result = getResourceName(resource);
      expect(result).toBe('deployment-my-app');
    });

    it('should handle kind only', () => {
      const resource: KubernetesResource = {
        kind: 'Service',
      };
      const result = getResourceName(resource);
      expect(result).toBe('service');
    });

    it('should handle name only', () => {
      const resource: KubernetesResource = {
        metadata: { name: 'my-app' },
      };
      const result = getResourceName(resource);
      expect(result).toBe('my-app');
    });

    it('should handle empty resource', () => {
      const result = getResourceName({});
      expect(result).toBe('resource');
    });

    it('should handle null/undefined resource', () => {
      expect(getResourceName(null)).toBe('resource');
      expect(getResourceName(undefined)).toBe('resource');
    });

    it('should handle non-object resource', () => {
      expect(getResourceName('string')).toBe('resource');
      expect(getResourceName(123)).toBe('resource');
    });
  });

  describe('generateManifestName', () => {
    it('should generate manifest name with descriptive strategy', () => {
      const resource: KubernetesResource = {
        kind: 'Deployment',
        metadata: { name: 'my-app' },
      };
      const result = generateManifestName(resource, 'descriptive');
      expect(result).toBe('deployment-my-app');
    });

    it('should generate manifest name with numbered strategy', () => {
      const resource: KubernetesResource = {
        kind: 'Service',
        metadata: { name: 'web-service' },
      };
      const result = generateManifestName(resource, 'numbered', 5);
      expect(result).toBe('manifests-005');
    });

    it('should generate manifest name with kind-only strategy', () => {
      const resource: KubernetesResource = {
        kind: 'ConfigMap',
        metadata: { name: 'my-config' },
      };
      const result = generateManifestName(resource, 'kind-only');
      expect(result).toBe('configmap');
    });

    it('should generate manifest name with name-only strategy', () => {
      const resource: KubernetesResource = {
        kind: 'Secret',
        metadata: { name: 'my-secret' },
      };
      const result = generateManifestName(resource, 'name-only');
      expect(result).toBe('my-secret');
    });

    it('should use descriptive strategy by default', () => {
      const resource: KubernetesResource = {
        kind: 'StatefulSet',
        metadata: { name: 'my-complex-app-name' },
      };
      const result = generateManifestName(resource);
      expect(result).toBe('statefulset-my-complex-app-name');
    });

    it('should handle numbered strategy with prefix', () => {
      const resource: KubernetesResource = {
        kind: 'Deployment',
        metadata: { name: 'app' },
      };
      const result = generateManifestName(resource, 'numbered', 1, 'custom');
      expect(result).toBe('custom-001');
    });
  });

  describe('sanitizeKubernetesName', () => {
    it('should sanitize valid names unchanged', () => {
      expect(sanitizeKubernetesName('my-app')).toBe('my-app');
      expect(sanitizeKubernetesName('web-service-123')).toBe('web-service-123');
      expect(sanitizeKubernetesName('a')).toBe('a');
    });

    it('should convert uppercase to lowercase', () => {
      expect(sanitizeKubernetesName('MyApp')).toBe('myapp');
      expect(sanitizeKubernetesName('WEB-SERVICE')).toBe('web-service');
    });

    it('should replace invalid characters with hyphens', () => {
      expect(sanitizeKubernetesName('my_app')).toBe('my-app');
      expect(sanitizeKubernetesName('my.app')).toBe('my-app');
      expect(sanitizeKubernetesName('my@app')).toBe('my-app');
      expect(sanitizeKubernetesName('my app')).toBe('my-app');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeKubernetesName('-my-app-')).toBe('my-app');
      expect(sanitizeKubernetesName('--my-app--')).toBe('my-app');
    });

    it('should handle consecutive invalid characters', () => {
      expect(sanitizeKubernetesName('my___app')).toBe('my-app');
      expect(sanitizeKubernetesName('my...app')).toBe('my-app');
      expect(sanitizeKubernetesName('my   app')).toBe('my-app');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(70);
      const result = sanitizeKubernetesName(longName);
      expect(result.length).toBeLessThanOrEqual(63);
      expect(result).toBe('a'.repeat(63));
    });

    it('should handle edge cases', () => {
      expect(sanitizeKubernetesName('')).toBe('');
      expect(sanitizeKubernetesName('123')).toBe('123');
      expect(sanitizeKubernetesName('a-b-c')).toBe('a-b-c');
    });

    it('should handle names starting with numbers', () => {
      expect(sanitizeKubernetesName('123app')).toBe('123app');
      expect(sanitizeKubernetesName('1-app')).toBe('1-app');
    });

    it('should handle special Unicode characters', () => {
      expect(sanitizeKubernetesName('my-app-🚀')).toBe('my-app');
      expect(sanitizeKubernetesName('app-中文')).toBe('app');
    });
  });

  describe('isValidKubernetesName', () => {
    it('should validate correct names', () => {
      expect(isValidKubernetesName('my-app')).toBe(true);
      expect(isValidKubernetesName('web-service-123')).toBe(true);
      expect(isValidKubernetesName('a')).toBe(true);
      expect(isValidKubernetesName('app123')).toBe(true);
      expect(isValidKubernetesName('123app')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(isValidKubernetesName('')).toBe(false);
      expect(isValidKubernetesName('MyApp')).toBe(false); // uppercase
      expect(isValidKubernetesName('my_app')).toBe(false); // underscore
      expect(isValidKubernetesName('my.app')).toBe(false); // dot
      expect(isValidKubernetesName('my app')).toBe(false); // space
      expect(isValidKubernetesName('-my-app')).toBe(false); // leading hyphen
      expect(isValidKubernetesName('my-app-')).toBe(false); // trailing hyphen
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(64);
      expect(isValidKubernetesName(longName)).toBe(false);
    });

    it('should accept names at the length limit', () => {
      const maxLengthName = 'a'.repeat(63);
      expect(isValidKubernetesName(maxLengthName)).toBe(true);
    });

    it('should reject names with special characters', () => {
      expect(isValidKubernetesName('my@app')).toBe(false);
      expect(isValidKubernetesName('my#app')).toBe(false);
      expect(isValidKubernetesName('my$app')).toBe(false);
      expect(isValidKubernetesName('my%app')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidKubernetesName('a-')).toBe(false);
      expect(isValidKubernetesName('-a')).toBe(false);
      expect(isValidKubernetesName('--')).toBe(false);
      expect(isValidKubernetesName('a--b')).toBe(true); // consecutive hyphens in middle are ok
    });
  });

  describe('integration scenarios', () => {
    it('should work together for complete name processing', () => {
      const originalName = 'My_Complex.App@Name';
      const sanitized = sanitizeKubernetesName(originalName);
      const isValid = isValidKubernetesName(sanitized);
      
      const resource: KubernetesResource = {
        kind: 'Deployment',
        metadata: { name: sanitized },
      };
      const resourceName = getResourceName(resource);
      const manifestName = generateManifestName(resource);

      expect(sanitized).toBe('my-complex-app-name');
      expect(isValid).toBe(true);
      expect(resourceName).toBe('deployment-my-complex-app-name');
      expect(manifestName).toBe('deployment-my-complex-app-name');
    });

    it('should handle very long names in complete workflow', () => {
      const longName = 'very-long-application-name-that-exceeds-kubernetes-limits-and-needs-truncation';
      const sanitized = sanitizeKubernetesName(longName);
      const isValid = isValidKubernetesName(sanitized);
      
      const resource: KubernetesResource = {
        kind: 'Service',
        metadata: { name: sanitized },
      };
      const resourceName = getResourceName(resource);

      expect(sanitized.length).toBeLessThanOrEqual(63);
      expect(isValid).toBe(true);
      expect(resourceName).toContain('service');
      expect(resourceName).toContain(sanitized);
    });

    it('should handle names with mixed invalid characters', () => {
      const messyName = '__My.App@2024__';
      const sanitized = sanitizeKubernetesName(messyName);
      const isValid = isValidKubernetesName(sanitized);

      expect(sanitized).toBe('my-app-2024');
      expect(isValid).toBe(true);
    });
  });
});
