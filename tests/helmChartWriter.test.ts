/**
 * @fileoverview Regression tests for HelmChartWriter asset handling.
 * @since 2.12.2
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HelmChartWriter } from '../src/lib/helmChartWriter.js';

describe('HelmChartWriter asset identifier handling', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'timonel-assets-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('preserves dots and hyphens in manifest filenames', () => {
    HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [
        {
          id: 'deployment.v1',
          yaml: 'apiVersion: v1\nkind: ConfigMap',
          target: 'templates',
        },
      ],
    });

    expect(existsSync(join(workDir, 'templates', 'deployment.v1.yaml'))).toBe(true);
  });

  it('supports nested asset directories without traversal', () => {
    HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [
        {
          id: 'config/maps/settings',
          yaml: 'apiVersion: v1\nkind: ConfigMap',
          target: 'templates',
        },
      ],
    });

    expect(existsSync(join(workDir, 'templates', 'config', 'maps', 'settings.yaml'))).toBe(true);
  });

  it('writes arbitrary text and binary chart files without changing filenames', () => {
    HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      assets: [],
      chartFiles: [
        { destination: 'files/service-inputs.json', content: '{"service":"api"}\n' },
        { destination: 'dashboards/icon.bin', content: new Uint8Array([0, 1, 2, 255]) },
      ],
    });

    expect(readFileSync(join(workDir, 'files', 'service-inputs.json'), 'utf8')).toBe(
      '{"service":"api"}\n',
    );
    expect([...readFileSync(join(workDir, 'dashboards', 'icon.bin'))]).toEqual([0, 1, 2, 255]);
  });

  it('rejects traversal, absolute paths, duplicates, and generated-file collisions', () => {
    const baseOptions = {
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      assets: [],
    } as const;

    expect(() =>
      HelmChartWriter.write({
        ...baseOptions,
        chartFiles: [{ destination: '../outside.txt', content: 'nope' }],
      }),
    ).toThrow('unsafe path segment');

    expect(() =>
      HelmChartWriter.write({
        ...baseOptions,
        chartFiles: [{ destination: '/tmp/outside.txt', content: 'nope' }],
      }),
    ).toThrow('must be relative');

    expect(() =>
      HelmChartWriter.write({
        ...baseOptions,
        chartFiles: [
          { destination: 'files/a.txt', content: 'one' },
          { destination: 'files/a.txt', content: 'two' },
        ],
      }),
    ).toThrow('Duplicate chart file destination');

    expect(() =>
      HelmChartWriter.write({
        ...baseOptions,
        chartFiles: [{ destination: 'Chart.yaml', content: 'overwrite' }],
      }),
    ).toThrow('already exists');
  });

  it('rejects chart-file prefix conflicts before writing any caller file', () => {
    expect(() =>
      HelmChartWriter.write({
        outDir: workDir,
        meta: { name: 'test-chart', version: '0.0.0' },
        assets: [],
        chartFiles: [
          { destination: 'files/a', content: 'parent-file' },
          { destination: 'files/a/b.json', content: 'child-file' },
        ],
      }),
    ).toThrow('conflicts with a parent file');

    expect(existsSync(join(workDir, 'files', 'a'))).toBe(false);
  });

  it('rejects chart-file destinations whose existing parent is a symbolic link', () => {
    const externalDir = mkdtempSync(join(tmpdir(), 'timonel-assets-external-'));
    try {
      symlinkSync(externalDir, join(workDir, 'files'), 'dir');

      expect(() =>
        HelmChartWriter.write({
          outDir: workDir,
          meta: { name: 'test-chart', version: '0.0.0' },
          assets: [],
          chartFiles: [{ destination: 'files/outside.json', content: 'blocked' }],
        }),
      ).toThrow('traverses a symbolic link');

      expect(existsSync(join(externalDir, 'outside.json'))).toBe(false);
    } finally {
      rmSync(externalDir, { recursive: true, force: true });
    }
  });
});
