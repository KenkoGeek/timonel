import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Rutter } from '../../dist/lib/rutter.js';
import { valuesRef } from '../../dist/lib/helm.js';

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
        appVersion: '1.0.0',
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

  describe('addDeployment', () => {
    it('should create deployment with basic configuration', () => {
      const deployment = rutter.addDeployment({
        name: 'web-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: Number(valuesRef('replicas')),
        containerPort: 80,
      });

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });

    it('should create deployment with environment variables', () => {
      const deployment = rutter.addDeployment({
        name: 'api-app',
        image: 'api:latest',
        replicas: 1,
        containerPort: 3000,
        env: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'DB_HOST', value: valuesRef('database.host') },
        ],
      });

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });

    it('should create deployment with resource limits', () => {
      const deployment = rutter.addDeployment({
        name: 'resource-app',
        image: 'app:v1',
        replicas: 2,
        containerPort: 8080,
        resources: {
          limits: { cpu: '500m', memory: '512Mi' },
          requests: { cpu: '100m', memory: '128Mi' },
        },
      });

      expect(deployment).toBeDefined();
      expect(deployment.kind).toBe('Deployment');
    });
  });

  describe('addService', () => {
    it('should create ClusterIP service', () => {
      const service = rutter.addService({
        name: 'web-service',
        port: 80,
        targetPort: 8080,
        type: 'ClusterIP',
      });

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });

    it('should create NodePort service with edge case port 0', () => {
      const service = rutter.addService({
        name: 'nodeport-service',
        port: 0, // Edge case
        targetPort: 8080,
        type: 'NodePort',
        nodePort: 30080,
      });

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });

    it('should create LoadBalancer service', () => {
      const service = rutter.addService({
        name: 'lb-service',
        port: 443,
        targetPort: 8443,
        type: 'LoadBalancer',
      });

      expect(service).toBeDefined();
      expect(service.kind).toBe('Service');
    });
  });

  describe('addConfigMap', () => {
    it('should create ConfigMap with data', () => {
      const configMap = rutter.addConfigMap({
        name: 'app-config',
        data: {
          'app.properties': 'key=value\nenv=production',
          'config.json': '{"debug": false}',
        },
      });

      expect(configMap).toBeDefined();
      expect(configMap.kind).toBe('ConfigMap');
    });

    it('should create ConfigMap with empty data', () => {
      const configMap = rutter.addConfigMap({
        name: 'empty-config',
        data: {},
      });

      expect(configMap).toBeDefined();
      expect(configMap.kind).toBe('ConfigMap');
    });
  });

  describe('addSecret', () => {
    it('should create Secret with string data', () => {
      const secret = rutter.addSecret({
        name: 'app-secret',
        stringData: {
          username: 'admin',
          password: valuesRef('secret.password'),
        },
      });

      expect(secret).toBeDefined();
      expect(secret.kind).toBe('Secret');
    });

    it('should create Secret with binary data', () => {
      const secret = rutter.addSecret({
        name: 'tls-secret',
        type: 'kubernetes.io/tls',
        data: {
          'tls.crt': 'LS0tLS1CRUdJTi...',
          'tls.key': 'LS0tLS1CRUdJTi...',
        },
      });

      expect(secret).toBeDefined();
      expect(secret.kind).toBe('Secret');
    });
  });

  describe('write', () => {
    it('should write complete Helm chart structure', () => {
      rutter.addDeployment({
        name: 'test-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: Number(valuesRef('replicas')),
        containerPort: 80,
      });

      rutter.addService({
        name: 'test-service',
        port: 80,
      });

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
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join(testOutputDir, 'templates'),
        { recursive: true },
      );
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
      const deployment = rutter.addDeployment({
        name: 'zero-replica-app',
        image: 'nginx:latest',
        replicas: 0, // Edge case
        containerPort: 80,
      });

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
});
