import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { UmbrellaRutter } from '../src/lib/umbrellaRutter.js';

const helmAvailable = spawnSync('helm', ['version', '--short'], { stdio: 'ignore' }).status === 0;
const helmIt = helmAvailable ? it : it.skip;
const cleanupDirectories: string[] = [];

afterEach(() => {
  while (cleanupDirectories.length > 0) {
    const directory = cleanupDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  cleanupDirectories.push(directory);
  return directory;
}

describe('UmbrellaRutter dependency-only subcharts', () => {
  it('writes remote dependencies without synthesizing a local chart', async () => {
    const outDir = makeTempDir('timonel-umbrella-remote-');
    const umbrella = new UmbrellaRutter({
      meta: { name: 'remote-parent', version: '1.0.0' },
      subcharts: [
        {
          name: 'ingress-nginx',
          version: '4.15.1',
          repository: 'https://kubernetes.github.io/ingress-nginx',
          condition: 'ingress-nginx.enabled',
        },
      ],
    });

    await umbrella.write(outDir);

    const chart = parse(readFileSync(join(outDir, 'Chart.yaml'), 'utf8')) as {
      dependencies: Array<Record<string, unknown>>;
    };
    expect(chart.dependencies).toEqual([
      expect.objectContaining({
        name: 'ingress-nginx',
        version: '4.15.1',
        repository: 'https://kubernetes.github.io/ingress-nginx',
        condition: 'ingress-nginx.enabled',
      }),
    ]);
    expect(existsSync(join(outDir, 'charts', 'ingress-nginx'))).toBe(false);
  });

  helmIt('copies vendored charts without regenerating them and renders through Helm', async () => {
    const sourceDir = makeTempDir('timonel-vendored-source-');
    const outDir = makeTempDir('timonel-umbrella-vendored-');
    mkdirSync(join(sourceDir, 'templates'), { recursive: true });
    writeFileSync(
      join(sourceDir, 'Chart.yaml'),
      'apiVersion: v2\nname: fluent-bit\nversion: 1.2.3\ntype: application\n',
    );
    writeFileSync(join(sourceDir, 'values.yaml'), 'enabled: true\n');
    writeFileSync(
      join(sourceDir, 'templates', 'configmap.yaml'),
      [
        'apiVersion: v1',
        'kind: ConfigMap',
        'metadata:',
        '  name: fluent-bit-vendored',
        'data:',
        '  source: vendored',
        '',
      ].join('\n'),
    );

    const umbrella = new UmbrellaRutter({
      meta: { name: 'vendored-parent', version: '1.0.0' },
      subcharts: [
        {
          name: 'fluent-bit',
          version: '1.2.3',
          sourceDirectory: sourceDir,
          condition: 'fluent-bit.enabled',
        },
      ],
    });

    await umbrella.write(outDir);

    expect(readFileSync(join(outDir, 'charts', 'fluent-bit', 'Chart.yaml'), 'utf8')).toContain(
      'name: fluent-bit',
    );
    expect(
      readFileSync(join(outDir, 'charts', 'fluent-bit', 'templates', 'configmap.yaml'), 'utf8'),
    ).toContain('source: vendored');

    const parent = parse(readFileSync(join(outDir, 'Chart.yaml'), 'utf8')) as {
      dependencies: Array<Record<string, unknown>>;
    };
    expect(parent.dependencies[0]).toEqual(
      expect.objectContaining({
        name: 'fluent-bit',
        version: '1.2.3',
        repository: 'file://./charts/fluent-bit',
      }),
    );

    execFileSync('helm', ['lint', outDir], { stdio: 'pipe' });
    const rendered = execFileSync('helm', ['template', 'vendored-parent', outDir], {
      encoding: 'utf8',
    });
    expect(rendered).toContain('name: fluent-bit-vendored');
    expect(rendered).toContain('source: vendored');
  });

  it('rejects a vendored source that is not a directory', async () => {
    const sourceRoot = makeTempDir('timonel-vendored-file-');
    const outDir = makeTempDir('timonel-umbrella-invalid-vendor-');
    const sourceFile = join(sourceRoot, 'not-a-chart.txt');
    writeFileSync(sourceFile, 'invalid');

    const umbrella = new UmbrellaRutter({
      meta: { name: 'invalid-vendor', version: '1.0.0' },
      subcharts: [
        {
          name: 'fluent-bit',
          version: '1.2.3',
          sourceDirectory: sourceFile,
        },
      ],
    });

    await expect(umbrella.write(outDir)).rejects.toThrow(
      'Vendored subchart source must be an existing directory',
    );
  });

  it('rejects vendored sources that overlap the generated destination', async () => {
    const projectDir = makeTempDir('timonel-vendored-overlap-');
    const outDir = join(projectDir, 'dist');
    mkdirSync(outDir, { recursive: true });

    const umbrella = new UmbrellaRutter({
      meta: { name: 'overlap-parent', version: '1.0.0' },
      subcharts: [
        {
          name: 'project-copy',
          version: '1.0.0',
          sourceDirectory: projectDir,
        },
      ],
    });

    await expect(umbrella.write(outDir)).rejects.toThrow(
      'Vendored subchart source and destination must not overlap',
    );
    expect(existsSync(join(outDir, 'charts', 'project-copy'))).toBe(false);
  });

  it('cleans a partial vendored destination when copying fails', async () => {
    const sourceDir = makeTempDir('timonel-vendored-failure-source-');
    const outDir = makeTempDir('timonel-vendored-failure-out-');
    writeFileSync(
      join(sourceDir, 'Chart.yaml'),
      'apiVersion: v2\nname: broken-vendor\nversion: 1.0.0\n',
    );
    symlinkSync(join(sourceDir, 'Chart.yaml'), join(sourceDir, 'linked-chart.yaml'));

    const umbrella = new UmbrellaRutter({
      meta: { name: 'failure-parent', version: '1.0.0' },
      subcharts: [
        {
          name: 'broken-vendor',
          version: '1.0.0',
          sourceDirectory: sourceDir,
        },
      ],
    });

    await expect(umbrella.write(outDir)).rejects.toThrow('cannot contain symbolic links');
    expect(existsSync(join(outDir, 'charts', 'broken-vendor'))).toBe(false);
  });
});
