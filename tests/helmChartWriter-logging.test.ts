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
  it('creates the fallback logger lazily and reuses it across batch writes', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();

    const { TimonelLogger } = await import('../src/lib/utils/logger.js');
    const beforeWriterImport = process.listenerCount('exit');
    const { HelmChartWriter } = await import('../src/lib/helmChartWriter.js');

    expect(process.listenerCount('exit')).toBe(beforeWriterImport);

    const directories: string[] = [];
    const customLogger = new TimonelLogger({ silent: true, prettyPrint: false });

    try {
      const customOutDir = mkdtempSync(join(tmpdir(), 'timonel-listener-custom-'));
      directories.push(customOutDir);
      HelmChartWriter.write({
        outDir: customOutDir,
        meta: { name: 'custom-logger', version: '0.0.0' },
        assets: [],
        logger: customLogger,
      });
      expect(process.listenerCount('exit')).toBe(beforeWriterImport);

      const firstOutDir = mkdtempSync(join(tmpdir(), 'timonel-listener-default-'));
      directories.push(firstOutDir);
      HelmChartWriter.write({
        outDir: firstOutDir,
        meta: { name: 'default-0', version: '0.0.0' },
        assets: [],
      });

      const afterFirstDefaultWrite = process.listenerCount('exit');
      expect(afterFirstDefaultWrite).toBeGreaterThanOrEqual(beforeWriterImport);

      for (let index = 1; index < 15; index += 1) {
        const outDir = mkdtempSync(join(tmpdir(), 'timonel-listener-default-'));
        directories.push(outDir);
        HelmChartWriter.write({
          outDir,
          meta: { name: `default-${index}`, version: '0.0.0' },
          assets: [],
        });
      }

      expect(process.listenerCount('exit')).toBe(afterFirstDefaultWrite);
    } finally {
      for (const directory of directories) {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
});
