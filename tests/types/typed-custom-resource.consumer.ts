import { Rutter, TypedCustomResource, valuesRef, type HelmExpression } from '../../dist/index.js';

interface ServiceMonitorBody {
  spec: {
    selector: {
      matchLabels: Record<string, string>;
    };
    endpoints: Array<{
      port: string;
      interval: string | HelmExpression;
    }>;
  };
}

const values = valuesRef<{ monitoring: { interval: string } }>();
const chart = new Rutter({ meta: { name: 'consumer-crd', version: '1.0.0' } });

const serviceMonitor = new TypedCustomResource<ServiceMonitorBody>(
  chart.getChart(),
  'ServiceMonitor',
  {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'ServiceMonitor',
    metadata: { name: 'consumer-monitor' },
    body: {
      spec: {
        selector: { matchLabels: { app: 'api' } },
        endpoints: [{ port: 'metrics', interval: values.monitoring.interval.toExpression() }],
      },
    },
  },
);

const port: string = serviceMonitor.body.spec.endpoints[0]!.port;
void port;

new TypedCustomResource<ServiceMonitorBody>(chart.getChart(), 'InvalidMonitor', {
  apiVersion: 'monitoring.coreos.com/v1',
  kind: 'ServiceMonitor',
  body: {
    spec: {
      selector: { matchLabels: { app: 'api' } },
      // @ts-expect-error ServiceMonitor endpoint port must be a string.
      endpoints: [{ port: 9090, interval: '30s' }],
    },
  },
});

new TypedCustomResource<ServiceMonitorBody>(chart.getChart(), 'ReservedRootKey', {
  apiVersion: 'monitoring.coreos.com/v1',
  kind: 'ServiceMonitor',
  body: {
    spec: {
      selector: { matchLabels: { app: 'api' } },
      endpoints: [{ port: 'metrics', interval: '30s' }],
    },
    // @ts-expect-error apiVersion is owned by TypedCustomResourceProps, not the typed body.
    apiVersion: 'override/v1',
  },
});
