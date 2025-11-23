/**
 * @fileoverview Regression tests for HelmChartWriter asset handling.
 * @since 2.12.2
 */
import { mkdtempSync, rmSync, existsSync } from 'fs';
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

  it('preserves dots and hyphens in manifest filenames', async () => {
    await HelmChartWriter.write({
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

  it('supports nested asset directories without traversal', async () => {
    await HelmChartWriter.write({
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
  it('handles missing optional fields gracefully', async () => {
    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
    });

    expect(existsSync(join(workDir, 'Chart.yaml'))).toBe(true);
    expect(existsSync(join(workDir, 'values.yaml'))).toBe(true);
    expect(existsSync(join(workDir, 'templates'))).toBe(true);
  });

  it('writes .helmignore if it does not exist', async () => {
    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
    });

    expect(existsSync(join(workDir, '.helmignore'))).toBe(true);
  });

  it('does not overwrite existing .helmignore', async () => {
    const helmIgnorePath = join(workDir, '.helmignore');
    mkdtempSync(workDir); // Ensure dir exists
    // Create dummy .helmignore

    require('fs').writeFileSync(helmIgnorePath, '# existing');

    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
    });

    const content = require('fs').readFileSync(helmIgnorePath, 'utf8');
    expect(content).toBe('# existing');
  });

  it('writes schema.json if provided', async () => {
    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
      valuesSchema: { type: 'object' },
    });

    expect(existsSync(join(workDir, 'values.schema.json'))).toBe(true);
  });

  it('writes NOTES.txt if provided', async () => {
    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
      notesTpl: 'Some notes',
    });

    expect(existsSync(join(workDir, 'templates', 'NOTES.txt'))).toBe(true);
  });

  it('writes helpers if provided', async () => {
    await HelmChartWriter.write({
      outDir: workDir,
      meta: { name: 'test-chart', version: '0.0.0' },
      defaultValues: {},
      envValues: {},
      assets: [],
      helpersTpl: [{ name: 'my-helper', template: 'content' }],
    });

    const helpersPath = join(workDir, 'templates', '_helpers.tpl');
    expect(existsSync(helpersPath)).toBe(true);

    const content = require('fs').readFileSync(helpersPath, 'utf8');
    expect(content).toContain('define "my-helper"');
  });
});
