import { App } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';
import { describe, expect, it } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';
import { valuesRef } from '../src/lib/utils/valuesRef.js';

describe('Rutter public library contracts', () => {
  it('always returns a Promise from toSynthArray()', async () => {
    const rutter = new Rutter({
      meta: { name: 'promise-contract', version: '1.0.0' },
    });

    const result = rutter.toSynthArray();

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual([]);
  });

  it('does not synthesize the deprecated raw-template compatibility placeholder', async () => {
    const rutter = new Rutter({
      meta: { name: 'raw-template', version: '1.0.0' },
    });

    rutter.addTemplateManifest(
      `apiVersion: v1
kind: Secret
metadata:
  name: wanted
stringData:
  token: test
`,
      'wanted-secret',
    );

    const assets = await rutter.toSynthArray();

    expect(assets).toHaveLength(1);
    expect(assets[0]?.id).toBe('wanted-secret');
    expect(assets[0]?.yaml).toContain('kind: Secret');
    expect(assets[0]?.yaml).not.toContain('kind: ConfigMap');
  });

  it('uses the supplied construct scope and exposes the real cdk8s chart', async () => {
    const app = new App();
    const rutter = new Rutter({
      scope: app,
      meta: { name: 'composed-chart', version: '1.0.0' },
    });

    expect(rutter.getChart().node.scope).toBe(app);

    new kplus.ConfigMap(rutter.getChart(), 'typed-config', {
      metadata: { name: 'typed-config' },
      data: { mode: 'typed' },
    });

    const assets = await rutter.toSynthArray();

    expect(assets).toHaveLength(1);
    expect(assets[0]?.yaml).toContain('kind: ConfigMap');
    expect(assets[0]?.yaml).toContain('mode: typed');
  });

  it('wraps a typed resource in a Helm ValuesRef condition', async () => {
    const values = valuesRef<{ restart: { enabled: boolean; forced: boolean } }>();
    const rutter = new Rutter({
      meta: { name: 'conditional-resource', version: '1.0.0' },
      defaultValues: { restart: { enabled: true, forced: false } },
    });

    const account = new kplus.ServiceAccount(rutter.getChart(), 'RestartAccount', {
      metadata: { name: 'restart-manager' },
    });

    rutter.when(values.restart.enabled.and(values.restart.forced.not()), account);

    const [asset] = await rutter.toSynthArray();

    expect(asset?.yaml).toContain(
      '{{- if and .Values.restart.enabled (not .Values.restart.forced) }}',
    );
    expect(asset?.yaml).toContain('kind: ServiceAccount');
    expect(asset?.yaml).toContain('{{- end }}');
  });

  it('rejects conditional resources owned by another chart', () => {
    const values = valuesRef<{ enabled: boolean }>();
    const rutter = new Rutter({ meta: { name: 'owner', version: '1.0.0' } });
    const other = new Rutter({ meta: { name: 'other', version: '1.0.0' } });
    const account = new kplus.ServiceAccount(other.getChart(), 'ForeignAccount');

    expect(() => rutter.when(values.enabled, account)).toThrow(
      'Conditional resource must belong to this Rutter chart',
    );
  });
});
