import { ApiObject, type Chart } from 'cdk8s';
import { describe, expect, it } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';
import { TypedCustomResource } from '../src/lib/resources/typedCustomResource.js';
import { valuesRef } from '../src/lib/utils/valuesRef.js';
import type { HelmExpression } from '../src/lib/utils/helmControlStructures.js';

interface ServiceMonitorBody {
  spec: {
    selector: { matchLabels: Record<string, string> };
    endpoints: Array<{
      port: string;
      interval: string | HelmExpression;
    }>;
  };
}

class ImportedWidget extends ApiObject {
  constructor(scope: Chart, id: string) {
    super(scope, id, {
      apiVersion: 'example.io/v1',
      kind: 'Widget',
      metadata: { name: 'imported-widget' },
      spec: { mode: 'generated-import' },
    });
  }
}

describe('TypedCustomResource', () => {
  it('preserves a typed body and renders Helm-aware extension API fields', async () => {
    const v = valuesRef<{ monitoring: { interval: string } }>();
    const rutter = new Rutter({
      meta: { name: 'typed-crd', version: '1.0.0' },
      defaultValues: { monitoring: { interval: '30s' } },
    });

    const monitor = new TypedCustomResource<ServiceMonitorBody>(rutter.getChart(), 'ApiMonitor', {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      metadata: { name: 'api-monitor' },
      body: {
        spec: {
          selector: { matchLabels: { app: 'api' } },
          endpoints: [
            {
              port: 'metrics',
              interval: v.monitoring.interval.toExpression(),
            },
          ],
        },
      },
    });

    expect(monitor.body.spec.endpoints[0]?.port).toBe('metrics');

    const [asset] = await rutter.toSynthArray();
    expect(asset?.yaml).toContain('apiVersion: monitoring.coreos.com/v1');
    expect(asset?.yaml).toContain('kind: ServiceMonitor');
    expect(asset?.yaml).toContain('interval: {{ .Values.monitoring.interval }}');
  });

  it('synthesizes cdk8s-import style ApiObject subclasses attached to the Rutter chart', async () => {
    const rutter = new Rutter({ meta: { name: 'imported-crd', version: '1.0.0' } });
    new ImportedWidget(rutter.getChart(), 'ImportedWidget');

    const [asset] = await rutter.toSynthArray();
    expect(asset?.id).toBe('ImportedWidget');
    expect(asset?.yaml).toContain('kind: Widget');
    expect(asset?.yaml).toContain('mode: generated-import');
  });
});
