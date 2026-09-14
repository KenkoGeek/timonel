import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { App } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { Rutter } from '../src/lib/rutter.js';
import { valuesRef } from '../src/lib/utils/valuesRef.js';

const cleanupDirectories: string[] = [];

afterEach(() => {
  while (cleanupDirectories.length > 0) {
    const directory = cleanupDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('Rutter public library contracts', () => {
  it('always returns a Promise from toSynthArray()', async () => {
    const rutter = new Rutter({
      meta: { name: 'promise-contract', version: '1.0.0' },
    });

    const result = rutter.toSynthArray();

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toEqual([]);
  });

  it('does not expose raw manifest escape hatches', () => {
    const rutter = new Rutter({
      meta: { name: 'typed-only', version: '1.0.0' },
    });

    expect('addManifest' in rutter).toBe(false);
    expect('addTemplateManifest' in rutter).toBe(false);
    expect('addConditionalManifest' in rutter).toBe(false);
    expect('getAssets' in rutter).toBe(false);
  });

  it('writes the full Helm chart metadata surface through Rutter', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'timonel-rutter-meta-'));
    const rutter = new Rutter({
      meta: {
        name: 'metadata-chart',
        version: '1.2.3',
        appVersion: '2026.09.13',
        type: 'application',
        kubeVersion: '>=1.30.0-0',
        icon: 'https://example.com/icon.svg',
        dependencies: [
          {
            name: 'redis',
            version: '20.0.0',
            repository: 'https://charts.example.com',
            condition: 'redis.enabled',
          },
        ],
      },
    });

    try {
      await rutter.write(outDir);
      const chartYaml = parse(readFileSync(join(outDir, 'Chart.yaml'), 'utf8')) as Record<
        string,
        unknown
      >;

      expect(chartYaml).toMatchObject({
        name: 'metadata-chart',
        version: '1.2.3',
        appVersion: '2026.09.13',
        type: 'application',
        kubeVersion: '>=1.30.0-0',
        icon: 'https://example.com/icon.svg',
        dependencies: [
          {
            name: 'redis',
            version: '20.0.0',
            repository: 'https://charts.example.com',
            condition: 'redis.enabled',
          },
        ],
      });
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
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
    new kplus.ConfigMap(rutter.getChart(), 'AlwaysConfig', {
      metadata: { name: 'always-config' },
      data: { mode: 'always' },
    });

    rutter.when(values.restart.enabled.and(values.restart.forced.not()), account);

    const assets = await rutter.toSynthArray();
    const accountAsset = assets.find((asset) => asset.id === 'RestartAccount');
    const configAsset = assets.find((asset) => asset.id === 'AlwaysConfig');

    expect(assets).toHaveLength(2);
    expect(accountAsset?.yaml).toContain(
      '{{- if and .Values.restart.enabled (not .Values.restart.forced) }}',
    );
    expect(accountAsset?.yaml).toContain('kind: ServiceAccount');
    expect(accountAsset?.yaml).toContain('{{- end }}');
    expect(configAsset?.yaml).toContain('kind: ConfigMap');
    expect(configAsset?.yaml).toContain('mode: always');
    expect(configAsset?.yaml).not.toContain('{{- if');
    expect(configAsset?.yaml).not.toContain('{{- end }}');
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

  it('packages chart files configured through props and addChartFile()', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'timonel-rutter-files-'));
    cleanupDirectories.push(outDir);

    const rutter = new Rutter({
      meta: { name: 'chart-files', version: '1.0.0' },
      chartFiles: [{ destination: 'files/service-inputs.json', content: '{"a":1}\n' }],
    });
    rutter.addChartFile({ destination: 'files/apply.mjs', content: 'export default true;\n' });

    expect(rutter.getChartFiles()).toHaveLength(2);
    await rutter.write(outDir);

    expect(existsSync(join(outDir, 'files', 'service-inputs.json'))).toBe(true);
    expect(readFileSync(join(outDir, 'files', 'service-inputs.json'), 'utf8')).toBe('{"a":1}\n');
    expect(readFileSync(join(outDir, 'files', 'apply.mjs'), 'utf8')).toBe('export default true;\n');
  });
});
