import { describe, it, expect } from 'vitest';

import {
  dumpHelmAwareYaml,
  stringify,
  validateHelmYaml,
} from '../src/lib/utils/helmYamlSerializer.js';

describe('Helm YAML Serializer', () => {
  describe('dumpHelmAwareYaml', () => {
    it('should serialize simple objects correctly', () => {
      const obj = { key: 'value', number: 123, bool: true };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('key: value');
      expect(yaml).toContain('number: 123');
      expect(yaml).toContain('bool: true');
    });

    it('should handle nested objects', () => {
      const obj = {
        spec: {
          containers: [
            {
              name: 'app',
              image: 'nginx:latest',
            },
          ],
        },
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('name: app');
      expect(yaml).toContain('image: nginx:latest');
    });

    it('should handle arrays', () => {
      const obj = {
        items: ['item1', 'item2', 'item3'],
      };
      const yaml = dumpHelmAwareYaml(obj);
      expect(yaml).toContain('- item1');
      expect(yaml).toContain('- item2');
      expect(yaml).toContain('- item3');
    });
  });

  describe('stringify', () => {
    it('should serialize objects', () => {
      const obj = { key: 'value' };
      const yaml = stringify(obj);
      expect(yaml).toContain('key: value');
    });
  });

  describe('validateHelmYaml', () => {
    it('should return valid for any input (stub implementation)', () => {
      const yaml = `
        apiVersion: v1
        kind: ConfigMap
        metadata:
            name: test-config
        data:
            key: value
        `;
      const result = validateHelmYaml(yaml);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
