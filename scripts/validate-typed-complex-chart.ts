import { rmSync } from 'fs';
import { resolve } from 'path';

import * as kplus from 'cdk8s-plus-33';

import { PrometheusRule, ServiceMonitor } from '../src/lib/resources/monitoring.js';
import { TypedCustomResource } from '../src/lib/resources/typedCustomResource.js';
import { Rutter } from '../src/lib/rutter.js';
import { valuesRef } from '../src/lib/utils/valuesRef.js';

const APP_NAME = 'typed-complex';

interface Values {
  app: { enabled: boolean };
  autoscaling: { enabled: boolean };
  monitoring: { enabled: boolean };
  rules: { enabled: boolean };
  extension: { enabled: boolean };
  replicas: number;
  environment: string;
}

async function main(): Promise<void> {
  const outDir = resolve(process.argv[2] ?? '.tmp/typed-complex-chart');
  rmSync(outDir, { recursive: true, force: true });

  const values = valuesRef<Values>();
  const chart = new Rutter({
    meta: {
      name: APP_NAME,
      version: '1.0.0',
      appVersion: '2026.09.13',
      description: 'Complex typed Timonel validation chart',
    },
    defaultValues: {
      app: { enabled: true },
      autoscaling: { enabled: true },
      monitoring: { enabled: true },
      rules: { enabled: true },
      extension: { enabled: true },
      replicas: 3,
      environment: 'production',
    },
  });

  const account = new kplus.ServiceAccount(chart.getChart(), 'AppAccount', {
    metadata: { name: APP_NAME },
  });
  chart.when(values.app.enabled, account);

  const config = new kplus.ConfigMap(chart.getChart(), 'AppConfig', {
    metadata: { name: APP_NAME },
    data: {
      environment: 'placeholder',
      mode: 'typed-only',
    },
  });
  chart.bindHelmValue(config, '/data/environment', values.environment);
  chart.when(values.app.enabled, config);

  const deployment = new kplus.Deployment(chart.getChart(), 'AppDeployment', {
    metadata: {
      name: APP_NAME,
      labels: { app: APP_NAME },
    },
    podMetadata: { labels: { app: APP_NAME } },
    serviceAccount: account,
    containers: [
      {
        name: 'api',
        image: 'nginx:1.27.5',
        portNumber: 8080,
        securityContext: {
          ensureNonRoot: true,
          allowPrivilegeEscalation: false,
          readOnlyRootFilesystem: true,
        },
        liveness: kplus.Probe.fromHttpGet('/', { port: 8080 }),
        readiness: kplus.Probe.fromHttpGet('/', { port: 8080 }),
        envVariables: {
          ENVIRONMENT: kplus.EnvValue.fromConfigMap(config, 'environment'),
        },
      },
    ],
  });
  chart.bindHelmValue(deployment, '/spec/replicas', values.replicas);
  chart.when(values.app.enabled, deployment);

  const service = deployment.exposeViaService({
    name: APP_NAME,
    serviceType: kplus.ServiceType.CLUSTER_IP,
    ports: [{ port: 80, targetPort: 8080 }],
  });
  chart.when(values.app.enabled, service);

  const autoscaler = new kplus.HorizontalPodAutoscaler(chart.getChart(), 'AppAutoscaler', {
    target: deployment,
    minReplicas: 2,
    maxReplicas: 10,
  });
  chart.when(values.autoscaling.enabled, autoscaler);

  const monitor = new ServiceMonitor(chart.getChart(), 'AppMonitor', {
    metadata: { name: APP_NAME },
    spec: {
      selector: { matchLabels: { app: APP_NAME } },
      endpoints: [
        {
          port: 'http',
          path: '/metrics',
          interval: '30s',
          scrapeTimeout: '10s',
        },
      ],
    },
  });
  chart.when(values.monitoring.enabled, monitor);

  const rules = new PrometheusRule(chart.getChart(), 'AppRules', {
    metadata: { name: APP_NAME },
    spec: {
      groups: [
        {
          name: 'typed-complex.rules',
          rules: [
            {
              alert: 'TypedComplexDown',
              expr: 'up{job="typed-complex"} == 0',
              for: '5m',
              labels: { severity: 'critical' },
              annotations: { summary: 'typed-complex is unavailable' },
            },
          ],
        },
      ],
    },
  });
  chart.when(values.rules.enabled, rules);

  const extension = new TypedCustomResource<{
    spec: { policy: 'strict'; selector: { matchLabels: Record<string, string> } };
  }>(chart.getChart(), 'TypedExtension', {
    apiVersion: 'example.timonel.dev/v1',
    kind: 'TypedExtension',
    metadata: { name: APP_NAME },
    body: {
      spec: {
        policy: 'strict',
        selector: { matchLabels: { app: APP_NAME } },
      },
    },
  });
  chart.when(values.extension.enabled, extension);

  await chart.write(outDir);
  process.stdout.write(`${outDir}\n`);
}

await main();
