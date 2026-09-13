import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

afterAll(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('HelmChartWriter default logger lifecycle', () => {
  it('does not accumulate process exit listeners across batch writes', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { HelmChartWriter } = await import('../src/lib/helmChartWriter.js');

    const before = process.listenerCount('exit');
    const directories: string[] = [];

    try {
      for (let index = 0; index < 15; index += 1) {
        const outDir = mkdtempSync(join(tmpdir(), 'timonel-listener-'));
        directories.push(outDir);
        HelmChartWriter.write({
          outDir,
          meta: { name: `batch-${index}`, version: '0.0.0' },
          assets: [],
        });
      }

      expect(process.listenerCount('exit')).toBe(before);
    } finally {
      for (const directory of directories) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
});
