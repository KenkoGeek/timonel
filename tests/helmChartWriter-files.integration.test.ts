import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { HelmChartWriter } from '../src/lib/helmChartWriter.js';

const helmAvailable = spawnSync('helm', ['version', '--short'], { stdio: 'ignore' }).status === 0;
const helmIt = helmAvailable ? it : it.skip;

const cleanupDirectories: string[] = [];

afterEach(() => {
  while (cleanupDirectories.length > 0) {
    const directory = cleanupDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('HelmChartWriter packaged files', () => {
  helmIt('makes packaged files available through Helm .Files.Get', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'timonel-chart-files-'));
    cleanupDirectories.push(outDir);

    HelmChartWriter.write({
      outDir,
      meta: { name: 'chart-files', version: '1.0.0' },
      assets: [
        {
          id: 'files-check',
          target: 'templates',
          yaml: [
            'apiVersion: v1',
            'kind: ConfigMap',
            'metadata:',
            '  name: files-check',
            'data:',
            '  service-inputs.json: |-',
            '    {{ .Files.Get "files/service-inputs.json" | nindent 4 }}',
            '',
          ].join('\n'),
        },
      ],
      chartFiles: [
        {
          destination: 'files/service-inputs.json',
          content: '{"service":"api","enabled":true}\n',
        },
      ],
    });

    execFileSync('helm', ['lint', outDir], { stdio: 'pipe' });
    const rendered = execFileSync('helm', ['template', 'chart-files', outDir], {
      encoding: 'utf8',
    });

    expect(rendered).toContain('name: files-check');
    expect(rendered).toContain('{"service":"api","enabled":true}');
  });
});
