import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { App } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';
import { afterEach, describe, expect, it } from 'vitest';

import { Rutter } from '../src/lib/rutter.js';

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
