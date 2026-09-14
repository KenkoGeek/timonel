import { describe, expect, it } from 'vitest';

import { PrometheusRule, ServiceMonitor } from '../src/lib/resources/monitoring.js';
import { Rutter } from '../src/lib/rutter.js';
import { valuesRef } from '../src/lib/utils/valuesRef.js';

describe('typed monitoring resources', () => {
  it('synthesizes ServiceMonitor and PrometheusRule through typed constructs', async () => {
    const chart = new Rutter({
      meta: { name: 'observability', version: '1.0.0' },
      defaultValues: { monitoring: { enabled: true }, rules: { enabled: true } },
    });
    const values = valuesRef<{
      monitoring: { enabled: boolean };
      rules: { enabled: boolean };
    }>();

    const monitor = new ServiceMonitor(chart.getChart(), 'ApiMonitor', {
      metadata: { name: 'api' },
      spec: {
        selector: { matchLabels: { app: 'api' } },
        endpoints: [{ port: 'http', path: '/metrics', interval: '30s', scrapeTimeout: '10s' }],
      },
    });
    const rule = new PrometheusRule(chart.getChart(), 'ApiRules', {
      metadata: { name: 'api' },
      spec: {
        groups: [
          {
            name: 'api.rules',
            rules: [
              {
                alert: 'ApiUnavailable',
                expr: 'up{job="api"} == 0',
                for: '5m',
                labels: { severity: 'critical' },
              },
            ],
          },
        ],
      },
    });

    chart.when(values.monitoring.enabled, monitor);
    chart.when(values.rules.enabled, rule);

    const assets = await chart.toSynthArray();
    const monitorYaml = assets.find((asset) => asset.id === 'ApiMonitor')?.yaml ?? '';
    const ruleYaml = assets.find((asset) => asset.id === 'ApiRules')?.yaml ?? '';

    expect(monitorYaml).toContain('{{- if .Values.monitoring.enabled }}');
    expect(monitorYaml).toContain('apiVersion: monitoring.coreos.com/v1');
    expect(monitorYaml).toContain('kind: ServiceMonitor');
    expect(monitorYaml).toContain('interval: 30s');
    expect(ruleYaml).toContain('{{- if .Values.rules.enabled }}');
    expect(ruleYaml).toContain('kind: PrometheusRule');
    expect(ruleYaml).toContain('alert: ApiUnavailable');
  });
});
