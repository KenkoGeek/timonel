import { App } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';
import { describe, expect, it } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';

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
});
