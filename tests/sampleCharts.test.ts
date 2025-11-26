import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';
import { createUmbrella } from '../src/lib/umbrella.js';
import type { UmbrellaRutter } from '../src/lib/umbrellaRutter.js';

function createWebServiceChart(name: string, image: string, port: number): Rutter {
  const rutter = new Rutter({
    meta: {
      name,
      version: '0.1.0',
      description: `${name} sample service`,
    },
    defaultValues: {
      replicaCount: 1,
      image: {
        repository: image,
        pullPolicy: 'IfNotPresent',
      },
      service: {
        port,
      },
    },
  });

  rutter.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name,
        labels: {
          app: name,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: { app: name },
        },
        template: {
          metadata: {
            labels: { app: name },
          },
          spec: {
            containers: [
              {
                name,
                image,
                ports: [
                  {
                    containerPort: port,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    `${name}-deployment`,
  );

  rutter.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${name}-svc`,
        labels: {
          app: name,
        },
      },
      spec: {
        selector: { app: name },
        ports: [
          {
            port,
            targetPort: port,
          },
        ],
      },
    },
    `${name}-service`,
  );

  return rutter;
}

describe('sample chart generation', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'timonel-samples-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('creates a simple application chart', () => {
    const chart = createWebServiceChart('simple-web', 'nginx:1.27', 80);
    const chartDir = join(workDir, 'simple-web');

    chart.write(chartDir);

    expect(existsSync(join(chartDir, 'Chart.yaml'))).toBe(true);
    expect(existsSync(join(chartDir, 'templates', 'simple-web-deployment.yaml'))).toBe(true);
    expect(existsSync(join(chartDir, 'templates', 'simple-web-service.yaml'))).toBe(true);

    const deploymentYaml = readFileSync(
      join(chartDir, 'templates', 'simple-web-deployment.yaml'),
      'utf8',
    );

    // Check for expected content in the YAML (don't parse it since Helm templates aren't valid YAML)
    expect(deploymentYaml).toContain('name: simple-web');
    expect(deploymentYaml).toContain('app: simple-web');
    expect(deploymentYaml).toContain('helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}');
    expect(deploymentYaml).toContain('app.kubernetes.io/name:');
    expect(deploymentYaml).toContain('image: nginx:1.27');
    expect(deploymentYaml).toContain('containerPort: 80');

    const values = readFileSync(join(chartDir, 'values.yaml'), 'utf8');
    expect(values).toContain('replicaCount: 1');
    expect(values).toContain('port: 80');
  });

  it('creates an umbrella chart with two services', () => {
    const frontend = createWebServiceChart('frontend', 'nginx:1.27', 80);
    const backend = createWebServiceChart('backend', 'kennethreitz/httpbin', 8080);

    const umbrella: UmbrellaRutter = createUmbrella({
      meta: {
        name: 'demo-umbrella',
        version: '0.1.0',
        description: 'Umbrella chart for demo workloads',
      },
      subcharts: [
        { name: 'frontend', rutter: frontend, version: '0.1.0' },
        { name: 'backend', rutter: backend, version: '0.1.0', condition: 'backend.enabled' },
      ],
      defaultValues: {
        global: {
          imagePullPolicy: 'IfNotPresent',
        },
      },
    });

    const umbrellaDir = join(workDir, 'demo-umbrella');
    umbrella.write(umbrellaDir);

    expect(existsSync(join(umbrellaDir, 'charts', 'frontend', 'Chart.yaml'))).toBe(true);
    expect(existsSync(join(umbrellaDir, 'charts', 'backend', 'Chart.yaml'))).toBe(true);

    const chartYamlContent = readFileSync(join(umbrellaDir, 'Chart.yaml'), 'utf8');

    // Check for expected dependencies in Chart.yaml
    expect(chartYamlContent).toContain('name: frontend');
    expect(chartYamlContent).toContain('version: 0.1.0');
    expect(chartYamlContent).toContain('repository: file://./charts/frontend');
    expect(chartYamlContent).toContain('name: backend');
    expect(chartYamlContent).toContain('condition: backend.enabled');
    expect(chartYamlContent).toContain('repository: file://./charts/backend');

    const umbrellaValues = readFileSync(join(umbrellaDir, 'values.yaml'), 'utf8');
    expect(umbrellaValues).toContain('frontend:');
    expect(umbrellaValues).toContain('backend:');
    expect(umbrellaValues).toContain('global:');
  });
});
