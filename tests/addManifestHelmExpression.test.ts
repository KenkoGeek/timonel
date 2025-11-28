import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { helmInclude, Rutter } from '../src/index.js';

describe('addManifest with HelmExpression', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'timonel-helmexpr-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('accepts HelmExpression as metadata.name and preserves template content', () => {
    const rutter = new Rutter({
      meta: {
        name: 'helm-expression',
        version: '0.0.0',
      },
    });

    expect(() =>
      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata: {
            name: helmInclude('chart.name', '.'),
          },
        },
        'serviceaccount',
      ),
    ).not.toThrow();

    const outputDir = join(workDir, 'chart');
    rutter.write(outputDir);

    const yaml = readFileSync(join(outputDir, 'templates', 'serviceaccount.yaml'), 'utf8');
    // helmInclude uses {{- by default now
    expect(yaml).toContain('{{- include "chart.name" . -}}');
    expect(yaml).not.toContain('__helmExpression');
  });
});
