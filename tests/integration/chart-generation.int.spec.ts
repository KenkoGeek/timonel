import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { valuesRef, numberRef } from '../../dist/lib/helm.js';
import { Rutter } from '../../dist/lib/rutter.js';

describe('Chart Generation Integration', () => {
  const testChartsDir = path.join(__dirname, '__charts__');
  const testChartPath = path.join(testChartsDir, 'integration-test-chart');

  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testChartsDir)) {
      fs.mkdirSync(testChartsDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test charts - TEMPORARILY DISABLED FOR DEBUGGING
    // if (fs.existsSync(testChartPath)) {
    //   fs.rmSync(testChartPath, { recursive: true, force: true });
    // }
  });

  describe('Complete Chart Generation', () => {
    it('should generate a valid Helm chart with all components', () => {
      const rutter = new Rutter({
        meta: {
          name: 'integration-test-app',
          version: '1.0.0',
          description: 'Integration test application',
        },
        defaultValues: {
          image: {
            repository: 'nginx',
            tag: '1.27',
            pullPolicy: 'IfNotPresent',
          },
          replicas: 3,
          service: {
            type: 'ClusterIP',
            port: 80,
          },
          ingress: {
            enabled: false,
            className: 'nginx',
            hosts: [
              {
                host: 'example.local',
                paths: [{ path: '/', pathType: 'Prefix' }],
              },
            ],
          },
          resources: {
            limits: {
              cpu: '500m',
              memory: '512Mi',
            },
            requests: {
              cpu: '250m',
              memory: '256Mi',
            },
          },
        },
        envValues: {
          dev: {
            replicas: 1,
            resources: {
              limits: { cpu: '200m', memory: '256Mi' },
              requests: { cpu: '100m', memory: '128Mi' },
            },
          },
          staging: {
            replicas: 2,
            ingress: { enabled: true },
          },
          prod: {
            replicas: 5,
            ingress: { enabled: true },
            resources: {
              limits: { cpu: '1000m', memory: '1Gi' },
              requests: { cpu: '500m', memory: '512Mi' },
            },
          },
        },
      });

      // Add Deployment
      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'integration-test-app',
          },
          spec: {
            replicas: numberRef('replicas'),
            selector: {
              matchLabels: {
                app: 'integration-test-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'integration-test-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'integration-test-app',
                    image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
                    ports: [
                      {
                        containerPort: 8080,
                      },
                    ],
                    env: [
                      { name: 'NODE_ENV', value: 'production' },
                      { name: 'PORT', value: '8080' },
                    ],
                    resources: {
                      limits: {
                        cpu: valuesRef('resources.limits.cpu'),
                        memory: valuesRef('resources.limits.memory'),
                      },
                      requests: {
                        cpu: valuesRef('resources.requests.cpu'),
                        memory: valuesRef('resources.requests.memory'),
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        'integration-deployment',
      );

      // Add Service
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'integration-test-service',
          },
          spec: {
            selector: {
              app: 'integration-test-app',
            },
            ports: [
              {
                port: numberRef('service.port'),
                targetPort: 8080,
              },
            ],
            type: valuesRef('service.type'),
          },
        },
        'integration-service',
      );

      // Add ConfigMap
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'integration-test-config',
          },
          data: {
            'app.properties': 'debug=false\nlog.level=info',
            'config.json': '{"feature": {"enabled": true}}',
          },
        },
        'integration-configmap',
      );

      // Add Secret
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: 'integration-test-secret',
          },
          stringData: {
            'database-url':
              'postgresql://example-user:example-password@example-host:5432/example-db',
            'api-key': 'example-api-key-value',
          },
        },
        'integration-secret',
      );

      // Generate the chart
      rutter.write(testChartPath);

      // Verify chart structure
      expect(fs.existsSync(testChartPath)).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'Chart.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values-dev.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values-staging.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values-prod.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'templates'))).toBe(true);

      // Verify Chart.yaml content
      const chartYaml = fs.readFileSync(path.join(testChartPath, 'Chart.yaml'), 'utf8');
      expect(chartYaml).toContain('name: integration-test-app');
      expect(chartYaml).toContain('version: 1.0.0');
      expect(chartYaml).toContain('apiVersion: v2');

      // Verify values.yaml content
      const valuesYaml = fs.readFileSync(path.join(testChartPath, 'values.yaml'), 'utf8');
      expect(valuesYaml).toContain('repository: nginx');
      expect(valuesYaml).toContain('tag: "1.27"');
      expect(valuesYaml).toContain('replicas: 3');

      // Verify environment-specific values
      const devValues = fs.readFileSync(path.join(testChartPath, 'values-dev.yaml'), 'utf8');
      expect(devValues).toContain('replicas: 1');

      const prodValues = fs.readFileSync(path.join(testChartPath, 'values-prod.yaml'), 'utf8');
      expect(prodValues).toContain('replicas: 5');

      // Verify templates exist
      const templatesDir = path.join(testChartPath, 'templates');
      const templateFiles = fs.readdirSync(templatesDir);
      expect(templateFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Helm Validation', () => {
    it('should pass helm lint validation', () => {
      // Ensure helm is available - test should fail if not
      execSync('helm version', { stdio: 'ignore', env: process.env });

      expect(() => {
        execSync(`helm lint ${testChartPath}`, { stdio: 'pipe', env: process.env });
      }).not.toThrow();
    });

    it('should generate valid Kubernetes manifests with helm template', () => {
      // Ensure helm is available - test should fail if not
      execSync('helm version', { stdio: 'ignore', env: process.env });

      const output = execSync(`helm template test-release ${testChartPath}`, {
        encoding: 'utf8',
        env: process.env,
      });

      // Verify basic Kubernetes resource structure
      expect(output).toContain('apiVersion: apps/v1');
      expect(output).toContain('kind: Deployment');
      expect(output).toContain('apiVersion: v1');
      expect(output).toContain('kind: Service');
      expect(output).toContain('kind: ConfigMap');
      expect(output).toContain('kind: Secret');

      // Verify template rendering
      expect(output).toContain('image: "nginx:1.27"');
      expect(output).toContain('replicas: 3');
    });

    it('should generate different manifests for different environments', () => {
      // Ensure helm is available - test should fail if not
      execSync('helm version', { stdio: 'ignore', env: process.env });

      const devOutput = execSync(
        `helm template test-release ${testChartPath} -f ${testChartPath}/values-dev.yaml`,
        { encoding: 'utf8', env: process.env },
      );

      const prodOutput = execSync(
        `helm template test-release ${testChartPath} -f ${testChartPath}/values-prod.yaml`,
        { encoding: 'utf8', env: process.env },
      );

      // Dev should have 1 replica
      expect(devOutput).toContain('replicas: 1');
      // Prod should have 5 replicas
      expect(prodOutput).toContain('replicas: 5');
    });
  });

  describe('Kubernetes Validation', () => {
    it('should validate with kubeconform if available', () => {
      // Ensure kubeconform is available - test should fail if not
      execSync('kubeconform -v', { stdio: 'ignore', env: process.env });

      // Ensure helm is available - test should fail if not
      execSync('helm version', { stdio: 'ignore', env: process.env });

      // Generate manifests and validate with kubeconform
      const manifests = execSync(`helm template test-release ${testChartPath}`, {
        encoding: 'utf8',
        env: process.env,
      });

      // Write manifests to temporary file
      const tempManifestPath = path.join(testChartsDir, 'temp-kubeconform.yaml');
      fs.writeFileSync(tempManifestPath, manifests);

      try {
        // Validate with kubeconform - test should fail if validation fails
        expect(() => {
          execSync(`kubeconform ${tempManifestPath}`, { stdio: 'pipe', env: process.env });
        }).not.toThrow();
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempManifestPath)) {
          fs.unlinkSync(tempManifestPath);
        }
      }
    });

    it('should validate with helm kubeconform plugin if available', () => {
      // Ensure helm is available - test should fail if not
      execSync('helm version', { stdio: 'ignore', env: process.env });

      // Ensure helm kubeconform plugin is installed - test should fail if not
      execSync('helm plugin list | grep kubeconform', { stdio: 'ignore', env: process.env });

      // Validate chart using helm kubeconform plugin - test should fail if validation fails
      expect(() => {
        execSync(`helm kubeconform ${testChartPath}`, { stdio: 'pipe', env: process.env });
      }).not.toThrow();
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle chart with zero replicas', () => {
      const rutter = new Rutter({
        meta: {
          name: 'zero-replica-app',
          version: '1.0.0',
        },
        defaultValues: {
          image: { repository: 'nginx', tag: 'latest' },
          replicas: 0, // Edge case
        },
      });

      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'zero-replica-app',
          },
          spec: {
            replicas: Number(valuesRef('replicas')),
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
        'zero-replica-deployment',
      );

      const zeroReplicaPath = path.join(testChartsDir, 'zero-replica-chart');
      rutter.write(zeroReplicaPath);

      expect(fs.existsSync(zeroReplicaPath)).toBe(true);

      // Clean up
      if (fs.existsSync(zeroReplicaPath)) {
        fs.rmSync(zeroReplicaPath, { recursive: true, force: true });
      }
    });

    it('should handle chart with NodePort service and port 0', () => {
      const rutter = new Rutter({
        meta: {
          name: 'nodeport-app',
          version: '1.0.0',
        },
        defaultValues: {
          image: { repository: 'nginx', tag: 'latest' },
          service: {
            type: 'NodePort',
            port: 0, // Edge case
            nodePort: 30080,
          },
        },
      });

      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'nodeport-app',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: 'nodeport-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'nodeport-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'nodeport-app',
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
        'nodeport-deployment',
      );

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'nodeport-service-2',
          },
          spec: {
            selector: {
              app: 'nodeport-app',
            },
            ports: [
              {
                port: numberRef('service.port'),
                targetPort: 80,
                nodePort: numberRef('service.nodePort'),
              },
            ],
            type: valuesRef('service.type'),
          },
        },
        'nodeport-service',
      );

      const nodePortPath = path.join(testChartsDir, 'nodeport-chart');
      rutter.write(nodePortPath);

      expect(fs.existsSync(nodePortPath)).toBe(true);

      // Verify the service configuration
      const valuesYaml = fs.readFileSync(path.join(nodePortPath, 'values.yaml'), 'utf8');
      expect(valuesYaml).toContain('port: 0');
      expect(valuesYaml).toContain('nodePort: 30080');

      // Clean up
      if (fs.existsSync(nodePortPath)) {
        fs.rmSync(nodePortPath, { recursive: true, force: true });
      }
    });
  });
});
