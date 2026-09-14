import { App, Chart } from 'cdk8s';

import { PrometheusRule, ServiceMonitor } from '../../src/lib/resources/monitoring.js';
import { TypedCustomResource } from '../../src/lib/resources/typedCustomResource.js';

const app = new App();
const chart = new Chart(app, 'typed-only-consumer');

new ServiceMonitor(chart, 'Monitor', {
  metadata: { name: 'app' },
  spec: {
    selector: { matchLabels: { app: 'app' } },
    endpoints: [{ port: 'http', interval: '30s' }],
  },
});

new PrometheusRule(chart, 'Rules', {
  metadata: { name: 'app' },
  spec: {
    groups: [{ name: 'app.rules', rules: [{ alert: 'AppDown', expr: 'up == 0' }] }],
  },
});

new TypedCustomResource<{ spec: { mode: 'strict' | 'permissive' } }>(chart, 'Extension', {
  apiVersion: 'example.io/v1',
  kind: 'Extension',
  metadata: { name: 'app-extension' },
  body: { spec: { mode: 'strict' } },
});

new ServiceMonitor(chart, 'InvalidMonitor', {
  spec: {
    selector: {},
    endpoints: [
      {
        // @ts-expect-error endpoint interval is a duration string, not a number
        interval: 30,
      },
    ],
  },
});
