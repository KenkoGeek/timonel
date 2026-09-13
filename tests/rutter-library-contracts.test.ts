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

  it('binds typed Helm values into primitive cdk8s-plus fields without manifest fallbacks', async () => {
    interface Values {
      replicaCount: number;
      image: { repository: string };
      service: { port: number };
    }

    const values = valuesRef<Values>();
    const rutter = new Rutter({
      meta: { name: 'helm-bindings', version: '1.0.0' },
      defaultValues: {
        replicaCount: 2,
        image: { repository: 'nginx' },
        service: { port: 8080 },
      },
    });

    const deployment = new kplus.Deployment(rutter.getChart(), 'Application', {
      metadata: { name: 'helm-bindings' },
      replicas: 1,
      containers: [{ name: 'app', image: 'placeholder', portNumber: 8080 }],
    });

    rutter.bindHelmValue(deployment, '/spec/replicas', values.replicaCount);
    rutter.bindHelmValue(
      deployment,
      '/spec/template/spec/containers/0/image',
      values.image.repository,
    );
    rutter.bindHelmValue(
      deployment,
      '/spec/template/spec/containers/0/ports/0/containerPort',
      values.service.port,
    );

    const [asset] = await rutter.toSynthArray();

    expect(asset?.yaml).toContain('replicas: {{ .Values.replicaCount }}');
    expect(asset?.yaml).toContain('image: {{ .Values.image.repository }}');
    expect(asset?.yaml).toContain('containerPort: {{ .Values.service.port }}');
  });

  it('rejects non-absolute Helm binding paths', () => {
    const values = valuesRef<{ replicas: number }>();
    const rutter = new Rutter({
      meta: { name: 'invalid-binding', version: '1.0.0' },
    });
    const deployment = new kplus.Deployment(rutter.getChart(), 'Application', {
      containers: [{ name: 'app', image: 'nginx' }],
    });

    expect(() => rutter.bindHelmValue(deployment, 'spec/replicas', values.replicas)).toThrow(
      'absolute JSON pointer',
    );
  });
});
