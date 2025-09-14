import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { valuesRef } from '../../dist/lib/helm.js';
import { Rutter } from '../../dist/lib/rutter.js';

// Mock filesystem
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('Rutter', () => {
  let rutter: Rutter;
  const testOutputDir = path.join(process.cwd(), 'test-chart');

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);

    rutter = new Rutter({
      meta: {
        name: 'test-app',
        version: '0.1.0',
        description: 'Test application',
      },
      defaultValues: {
        image: { repository: 'nginx', tag: '1.27' },
        replicas: 2,
        service: { type: 'ClusterIP', port: 80 },
      },
      envValues: {
        dev: { replicas: 1 },
        prod: { replicas: 5 },
      },
    });
  });

  describe('constructor', () => {
    it('should create Rutter with basic metadata', () => {
      expect(rutter).toBeDefined();
    });

    it('should handle empty default values', () => {
      const emptyRutter = new Rutter({
        meta: { name: 'empty-app', version: '1.0.0' },
      });
      expect(emptyRutter).toBeDefined();
    });

    it('should handle namespace configuration', () => {
      const namespacedRutter = new Rutter({
        meta: { name: 'ns-app', version: '1.0.0' },
        namespace: 'custom-namespace',
      });
      expect(namespacedRutter).toBeDefined();
    });
  });

  describe('addManifest for Deployments', () => {
    it('should create deployment with basic configuration', () => {
      const deployment = rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'web-app',
          },
          spec: {
            replicas: Number(valuesRef('replicas')),
            selector: {
              matchLabels: {
                app: 'web-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'web-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'web-app',
                    image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
                    ports: [
                      {
                        containerPort: 80,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        'web-app-deployment',
      );

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });

    it('should create deployment with environment variables', () => {
      const deployment = rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'api-app',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: 'api-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'api-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'api-app',
                    image: 'api:latest',
                    ports: [
                      {
                        containerPort: 3000,
                      },
                    ],
                    env: [
                      { name: 'NODE_ENV', value: 'production' },
                      { name: 'DB_HOST', value: valuesRef('database.host') },
                    ],
                  },
                ],
              },
            },
          },
        },
        'api-app-deployment',
      );

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });

    it('should create deployment with resource limits', () => {
      const deployment = rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'resource-app',
          },
          spec: {
            replicas: 2,
            selector: {
              matchLabels: {
                app: 'resource-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'resource-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'resource-app',
                    image: 'app:v1',
                    ports: [
                      {
                        containerPort: 8080,
                      },
                    ],
                    resources: {
                      limits: { cpu: '500m', memory: '512Mi' },
                      requests: { cpu: '100m', memory: '128Mi' },
                    },
                  },
                ],
              },
            },
          },
        },
        'resource-app-deployment',
      );

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });
  });

  describe('addManifest for Services', () => {
    it('should create ClusterIP service', () => {
      const service = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'web-service',
          },
          spec: {
            selector: {
              app: 'web-app',
            },
            ports: [
              {
                port: 80,
                targetPort: 8080,
              },
            ],
            type: 'ClusterIP',
          },
        },
        'web-service',
      );

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });

    it('should create NodePort service with edge case port 0', () => {
      const service = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'nodeport-service',
          },
          spec: {
            selector: {
              app: 'nodeport-app',
            },
            ports: [
              {
                port: 0,
                targetPort: 8080,
                nodePort: 30080,
              },
            ],
            type: 'NodePort',
          },
        },
        'nodeport-service',
      );

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });

    it('should create LoadBalancer service', () => {
      const service = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'lb-service',
          },
          spec: {
            selector: {
              app: 'lb-app',
            },
            ports: [
              {
                port: 443,
                targetPort: 8443,
              },
            ],
            type: 'LoadBalancer',
          },
        },
        'lb-service',
      );

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });
  });

  describe('addManifest for ConfigMaps', () => {
    it('should create ConfigMap with data', () => {
      const configMap = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'app-config',
          },
          data: {
            'app.properties': 'key=value\nenv=production',
            'config.json': '{"debug": false}',
          },
        },
        'app-config',
      );

      expect(configMap).toBeDefined();
      expect(configMap.kind).toBe('ConfigMap');
    });

    it('should create ConfigMap with empty data', () => {
      const configMap = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'empty-config',
          },
          data: {},
        },
        'empty-config',
      );

      expect(configMap).toBeDefined();
      expect(configMap.kind).toBe('ConfigMap');
    });
  });

  describe('addManifest for Secrets', () => {
    it('should create Secret with string data', () => {
      const secret = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: 'app-secret',
          },
          stringData: {
            username: 'admin',
            password: valuesRef('secret.password'),
          },
        },
        'app-secret',
      );

      expect(secret).toBeDefined();
      expect(secret.kind).toBe('Secret');
    });

    it('should create Secret with binary data', () => {
      const secret = rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: 'tls-secret',
          },
          type: 'kubernetes.io/tls',
          data: {
            'tls.crt': 'LS0tLS1CRUdJTi...',
            'tls.key': 'LS0tLS1CRUdJTi...',
          },
        },
        'tls-secret',
      );

      expect(secret).toBeDefined();
      expect(secret.kind).toBe('Secret');
    });
  });

  describe('write', () => {
    it('should write complete Helm chart structure', () => {
      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'test-app',
          },
          spec: {
            replicas: Number(valuesRef('replicas')),
            selector: {
              matchLabels: {
                app: 'test-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'test-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'test-app',
                    image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
                    ports: [
                      {
                        containerPort: 80,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        'test-deployment',
      );

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'test-service',
          },
          spec: {
            selector: {
              app: 'test-app',
            },
            ports: [
              {
                port: 80,
              },
            ],
          },
        },
        'test-service',
      );

      rutter.write(testOutputDir);

      // Verify Chart.yaml was written
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('name: test-app'),
      );

      // Verify values.yaml was written
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values.yaml'),
        expect.stringContaining('image:'),
      );

      // Verify environment-specific values files
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-dev.yaml'),
        expect.stringContaining('replicas: 1'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-prod.yaml'),
        expect.stringContaining('replicas: 5'),
      );

      // Verify templates directory and manifests
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join(testOutputDir, 'templates'), {
        recursive: true,
      });
    });

    it('should handle write with no resources', () => {
      rutter.write(testOutputDir);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('name: test-app'),
      );
    });
  });

  describe('mergeValues', () => {
    it('should merge default and environment values correctly', () => {
      const rutterWithMerge = new Rutter({
        meta: { name: 'merge-test', version: '1.0.0' },
        defaultValues: {
          replicas: 2,
          image: { tag: 'latest' },
          config: { debug: false },
        },
        envValues: {
          dev: {
            replicas: 1,
            config: { debug: true },
          },
          prod: {
            replicas: 10,
            image: { tag: 'v1.0.0' },
          },
        },
      });

      rutterWithMerge.write(testOutputDir);

      // Check that environment values override defaults correctly
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-dev.yaml'),
        expect.stringContaining('replicas: 1'),
      );

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values-dev.yaml'),
        expect.stringContaining('debug: true'),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle zero replicas', () => {
      const deployment = rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'zero-replica-app',
          },
          spec: {
            replicas: 0, // Edge case
            selector: {
              matchLabels: {
                app: 'zero-replica-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'zero-replica-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'zero-replica-app',
                    image: 'nginx:latest',
                    ports: [
                      {
                        containerPort: 80,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        'zero-replica-deployment',
      );

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });

    it('should handle empty environment values', () => {
      const rutterEmpty = new Rutter({
        meta: { name: 'empty-env', version: '1.0.0' },
        defaultValues: { replicas: 1 },
        envValues: {},
      });

      rutterEmpty.write(testOutputDir);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'Chart.yaml'),
        expect.stringContaining('name: empty-env'),
      );
    });

    it('should handle null values in configuration', () => {
      const rutterWithNulls = new Rutter({
        meta: { name: 'null-test', version: '1.0.0' },
        defaultValues: {
          config: null,
          resources: {},
        },
      });

      rutterWithNulls.write(testOutputDir);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'values.yaml'),
        expect.stringContaining('config: null'),
      );
    });
  });

  describe('error handling', () => {
    it('should handle write errors gracefully', () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const rutter = new Rutter({
        meta: { name: 'error-test', version: '1.0.0' },
      });

      const validPath = path.join(process.cwd(), 'test-output');
      expect(() => rutter.write(validPath)).toThrow('Permission denied');
    });

    it('should handle directory creation errors', () => {
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Cannot create directory');
      });

      const rutter = new Rutter({
        meta: { name: 'error-test', version: '1.0.0' },
      });

      const validPath = path.join(process.cwd(), 'test-output');
      expect(() => rutter.write(validPath)).toThrow('Cannot create directory');
    });

    it('should handle invalid chart metadata', () => {
      expect(() => {
        new Rutter({
          meta: { name: '', version: '1.0.0' }, // Empty name
        });
      }).toThrow();
    });

    it('should handle filesystem errors during template writing', () => {
      const rutter = new Rutter({
        meta: { name: 'test-app', version: '1.0.0' },
      });

      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'test-deployment',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: 'test-deployment',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'test-deployment',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'test-deployment',
                    image: 'nginx:1.27',
                    ports: [
                      {
                        containerPort: 80,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        'test-deployment-id',
      );

      // Mock writeFileSync to throw an error
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const validPath = path.join(process.cwd(), 'test-output');
      expect(() => rutter.write(validPath)).toThrow('Disk full');
    });
  });
});
