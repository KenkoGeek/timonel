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
});
