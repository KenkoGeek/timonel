import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { load } from 'js-yaml';

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
    const deployment = load(deploymentYaml) as {
      metadata?: { labels?: Record<string, string>; name?: string };
      spec?: {
        template?: {
          spec?: {
            containers?: Array<{
              name: string;
              image: string;
              ports?: Array<{ containerPort: number }>;
            }>;
          };
        };
      };
    };

    expect(deployment.metadata?.name).toBe('simple-web');
    expect(deployment.metadata?.labels).toMatchObject({ app: 'simple-web' });
    expect(deploymentYaml).toContain("helm.sh/chart: '{{ .Chart.Name }}-{{ .Chart.Version }}'");
    expect(deploymentYaml).toContain('app.kubernetes.io/name: {{ include "chart.name" . }}');

    const deploymentContainer = deployment.spec?.template?.spec?.containers?.[0];
    expect(deploymentContainer?.image).toBe('nginx:1.27');
    expect(deploymentContainer?.ports?.[0]?.containerPort).toBe(80);

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

    const chartYaml = load(readFileSync(join(umbrellaDir, 'Chart.yaml'), 'utf8')) as {
      dependencies?: Array<{
        name: string;
        version: string;
        repository: string;
        condition?: string;
      }>;
    };
    expect(chartYaml.dependencies).toEqual([
      {
        name: 'frontend',
        version: '0.1.0',
        repository: 'file://./charts/frontend',
      },
      {
        name: 'backend',
        version: '0.1.0',
        repository: 'file://./charts/backend',
        condition: 'backend.enabled',
      },
    ]);

    const umbrellaValues = readFileSync(join(umbrellaDir, 'values.yaml'), 'utf8');
    expect(umbrellaValues).toContain('frontend:');
    expect(umbrellaValues).toContain('backend:');
    expect(umbrellaValues).toContain('global:');
  });
});
