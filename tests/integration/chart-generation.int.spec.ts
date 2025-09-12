import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { Rutter } from '../../dist/lib/rutter.js';
import { valuesRef } from '../../dist/lib/helm.js';

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
    // Clean up test charts
    if (fs.existsSync(testChartPath)) {
      fs.rmSync(testChartPath, { recursive: true, force: true });
    }
  });

  describe('Complete Chart Generation', () => {
    it('should generate a valid Helm chart with all components', () => {
      const rutter = new Rutter({
        meta: {
          name: 'integration-test-app',
          version: '1.0.0',
          description: 'Integration test application',
          appVersion: '1.0.0',
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
      rutter.addDeployment({
        name: 'integration-test-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: Number(valuesRef('replicas')),
        containerPort: 8080,
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
      });

      // Add Service
      rutter.addService({
        name: 'integration-test-service', // Use unique name
        port: Number(valuesRef('service.port')),
        targetPort: 8080,
        type: valuesRef('service.type'),
      });

      // Add ConfigMap
      rutter.addConfigMap({
        name: 'integration-test-config',
        data: {
          'app.properties': 'debug=false\nlog.level=info',
          'config.json': '{"feature": {"enabled": true}}',
        },
      });

      // Add Secret
      rutter.addSecret({
        name: 'integration-test-secret',
        stringData: {
          'database-url': 'postgresql://user:pass@localhost:5432/db',
          'api-key': 'secret-api-key',
        },
      });

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
      // Skip if helm is not available
      try {
        execSync('helm version', { stdio: 'ignore' });
      } catch {
        console.warn('Helm not available, skipping helm lint test');
        return;
      }

      expect(() => {
        execSync(`helm lint ${testChartPath}`, { stdio: 'pipe' });
      }).not.toThrow();
    });

    it('should generate valid Kubernetes manifests with helm template', () => {
      // Skip if helm is not available
      try {
        execSync('helm version', { stdio: 'ignore' });
      } catch {
        console.warn('Helm not available, skipping helm template test');
        return;
      }

      const output = execSync(`helm template test-release ${testChartPath}`, {
        encoding: 'utf8',
      });

      // Verify basic Kubernetes resource structure
      expect(output).toContain('apiVersion: apps/v1');
      expect(output).toContain('kind: Deployment');
      expect(output).toContain('apiVersion: v1');
      expect(output).toContain('kind: Service');
      expect(output).toContain('kind: ConfigMap');
      expect(output).toContain('kind: Secret');

      // Verify template rendering
      expect(output).toContain('image: nginx:1.27');
      expect(output).toContain('replicas: 3');
    });

    it('should generate different manifests for different environments', () => {
      // Skip if helm is not available
      try {
        execSync('helm version', { stdio: 'ignore' });
      } catch {
        console.warn('Helm not available, skipping environment-specific test');
        return;
      }

      const devOutput = execSync(
        `helm template test-release ${testChartPath} -f ${testChartPath}/values-dev.yaml`,
        { encoding: 'utf8' },
      );

      const prodOutput = execSync(
        `helm template test-release ${testChartPath} -f ${testChartPath}/values-prod.yaml`,
        { encoding: 'utf8' },
      );

      // Dev should have 1 replica
      expect(devOutput).toContain('replicas: 1');
      // Prod should have 5 replicas
      expect(prodOutput).toContain('replicas: 5');
    });
  });

  describe('Kubernetes Validation', () => {
    it('should pass kubectl dry-run validation', () => {
      // Skip if kubectl is not available
      try {
        execSync('kubectl version --client', { stdio: 'ignore' });
      } catch {
        console.warn('kubectl not available, skipping kubectl validation test');
        return;
      }

      // Skip if helm is not available
      try {
        execSync('helm version', { stdio: 'ignore' });
      } catch {
        console.warn('Helm not available, skipping kubectl validation test');
        return;
      }

      // Generate manifests and validate with kubectl
      const manifests = execSync(`helm template test-release ${testChartPath}`, {
        encoding: 'utf8',
      });

      // Write manifests to temporary file
      const tempManifestPath = path.join(testChartsDir, 'temp-manifests.yaml');
      fs.writeFileSync(tempManifestPath, manifests);

      try {
        expect(() => {
          execSync(`kubectl apply --dry-run=client -f ${tempManifestPath}`, {
            stdio: 'pipe',
          });
        }).not.toThrow();
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempManifestPath)) {
          fs.unlinkSync(tempManifestPath);
        }
      }
    });

    it('should validate with kubeconform if available', () => {
      // Skip if kubeconform is not available
      try {
        execSync('kubeconform -v', { stdio: 'ignore' });
      } catch {
        console.warn('kubeconform not available, skipping kubeconform validation test');
        return;
      }

      // Skip if helm is not available
      try {
        execSync('helm version', { stdio: 'ignore' });
      } catch {
        console.warn('Helm not available, skipping kubeconform validation test');
        return;
      }

      // Generate manifests and validate with kubeconform
      const manifests = execSync(`helm template test-release ${testChartPath}`, {
        encoding: 'utf8',
      });

      // Write manifests to temporary file
      const tempManifestPath = path.join(testChartsDir, 'temp-kubeconform.yaml');
      fs.writeFileSync(tempManifestPath, manifests);

      try {
        expect(() => {
          execSync(`kubeconform ${tempManifestPath}`, { stdio: 'pipe' });
        }).not.toThrow();
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempManifestPath)) {
          fs.unlinkSync(tempManifestPath);
        }
      }
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

      rutter.addDeployment({
        name: 'zero-replica-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: Number(valuesRef('replicas')),
        containerPort: 80,
      });

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

      rutter.addDeployment({
        name: 'nodeport-app',
        image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
        replicas: 1,
        containerPort: 80,
      });

      rutter.addService({
        name: 'nodeport-service-2', // Use unique name
        port: Number(valuesRef('service.port')),
        targetPort: 80,
        type: valuesRef('service.type'),
        nodePort: Number(valuesRef('service.nodePort')),
      });

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
