import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import * as YAML from 'yaml';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { Rutter } from '../../dist/lib/rutter.js';
import { valuesRef, numberRef } from '../../dist/lib/helm.js';

describe('Basic Chart Generation Integration', () => {
  const testChartsDir = path.join(__dirname, '__charts__');
  const testChartPath = path.join(testChartsDir, 'basic-integration-test');

  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testChartsDir)) {
      fs.mkdirSync(testChartsDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test charts
    if (fs.existsSync(testChartPath)) {
      fs.rmSync(testChartPath, { recursive: true, force: true });
    }
  });

  describe('Complete Chart Generation', () => {
    it('should generate a valid Helm chart structure', () => {
      const rutter = new Rutter({
        meta: {
          name: 'basic-test-app',
          version: '1.0.0',
          description: 'Basic integration test application',
        },
        defaultValues: {
          image: {
            repository: 'nginx',
            tag: '1.27',
            pullPolicy: 'IfNotPresent',
          },
          replicas: 2,
          service: {
            type: 'ClusterIP',
            port: 80,
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
          prod: {
            replicas: 5,
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
            name: 'basic-test-app',
          },
          spec: {
            replicas: valuesRef('replicas'),
            selector: {
              matchLabels: {
                app: 'basic-test-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'basic-test-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'basic-test-app',
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
        'basic-deployment',
      );

      // Add Service
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'basic-test-service',
          },
          spec: {
            selector: {
              app: 'basic-test-app',
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
        'basic-service',
      );

      // Add ConfigMap
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'basic-test-config',
          },
          data: {
            'app.properties': 'debug=false\nlog.level=info',
            'config.json': '{"feature": {"enabled": true}}',
          },
        },
        'basic-configmap',
      );

      // Generate the chart
      rutter.write(testChartPath);

      // Verify chart structure
      expect(fs.existsSync(testChartPath)).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'Chart.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values-dev.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'values-prod.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(testChartPath, 'templates'))).toBe(true);

      // Verify Chart.yaml content
      const chartYaml = fs.readFileSync(path.join(testChartPath, 'Chart.yaml'), 'utf8');
      expect(chartYaml).toContain('name: basic-test-app');
      expect(chartYaml).toContain('version: 1.0.0');
      expect(chartYaml).toContain('apiVersion: v2');

      // Verify values.yaml content
      const valuesYaml = fs.readFileSync(path.join(testChartPath, 'values.yaml'), 'utf8');
      expect(valuesYaml).toContain('repository: nginx');
      expect(valuesYaml).toContain('tag: "1.27"');
      expect(valuesYaml).toContain('replicas: 2');

      // Verify environment-specific values
      const devValues = fs.readFileSync(path.join(testChartPath, 'values-dev.yaml'), 'utf8');
      expect(devValues).toContain('replicas: 1');

      const prodValues = fs.readFileSync(path.join(testChartPath, 'values-prod.yaml'), 'utf8');
      expect(prodValues).toContain('replicas: 5');

      // Verify templates exist
      const templatesDir = path.join(testChartPath, 'templates');
      const templateFiles = fs.readdirSync(templatesDir);
      expect(templateFiles.length).toBeGreaterThan(0);

      // Verify specific template files exist
      const yamlFiles = templateFiles.filter((f) => f.endsWith('.yaml'));
      expect(yamlFiles.length).toBeGreaterThan(0);

      // Validate with helm lint - test should fail if helm is not available
      execSync('helm version', { stdio: 'ignore', env: process.env });
      const result = execSync(`helm lint ${testChartPath}`, { encoding: 'utf8', env: process.env });
      console.log('Helm lint result:', result);
      expect(result).toContain('0 chart(s) failed');

      // Check that at least one template contains Kubernetes resources
      let foundKubernetesResource = false;
      for (const file of yamlFiles) {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        if (content.includes('apiVersion:') && content.includes('kind:')) {
          foundKubernetesResource = true;
          break;
        }
      }
      expect(foundKubernetesResource).toBe(true);
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
        'basic-zero-replica-deployment',
      );

      const zeroReplicaPath = path.join(testChartsDir, 'zero-replica-chart');
      rutter.write(zeroReplicaPath);

      expect(fs.existsSync(zeroReplicaPath)).toBe(true);

      // Verify the values contain zero replicas
      const valuesYaml = fs.readFileSync(path.join(zeroReplicaPath, 'values.yaml'), 'utf8');
      expect(valuesYaml).toContain('replicas: 0');

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
        'basic-nodeport-deployment',
      );

      rutter.addManifest(
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
                port: numberRef('service.port'),
                targetPort: 80,
              },
            ],
            type: valuesRef('service.type'),
          },
          nodePort: numberRef('service.nodePort'),
        },
        'basic-nodeport-service',
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

  describe('YAML Validation', () => {
    it('should generate valid YAML files', () => {
      const rutter = new Rutter({
        meta: {
          name: 'yaml-validation-test',
          version: '1.0.0',
        },
        defaultValues: {
          image: { repository: 'nginx', tag: 'latest' },
          replicas: 1,
        },
      });

      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'yaml-validation-test',
          },
          spec: {
            replicas: Number(valuesRef('replicas')),
            selector: {
              matchLabels: {
                app: 'yaml-validation-test',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'yaml-validation-test',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'yaml-validation-test',
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
        'basic-yaml-validation-deployment',
      );

      const yamlValidationPath = path.join(testChartsDir, 'yaml-validation-chart');
      rutter.write(yamlValidationPath);

      // Test that all YAML files can be parsed without errors
      const chartYaml = fs.readFileSync(path.join(yamlValidationPath, 'Chart.yaml'), 'utf8');
      expect(() => YAML.parse(chartYaml)).not.toThrow();

      const valuesYaml = fs.readFileSync(path.join(yamlValidationPath, 'values.yaml'), 'utf8');
      expect(() => YAML.parse(valuesYaml)).not.toThrow();

      // Test template files
      const templatesDir = path.join(yamlValidationPath, 'templates');
      const templateFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.yaml'));

      templateFiles.forEach((file) => {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        // Template files contain Helm expressions, so we just check they're not empty
        expect(content.trim().length).toBeGreaterThan(0);
      });

      // Clean up
      if (fs.existsSync(yamlValidationPath)) {
        fs.rmSync(yamlValidationPath, { recursive: true, force: true });
      }
    });
  });

  // Helm validation is now integrated into the main chart generation test above
});
