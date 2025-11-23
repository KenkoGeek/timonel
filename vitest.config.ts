import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['tests/**/*.int.spec.ts', 'tests/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
      reportOnFailure: true,
      exclude: [
        'tests/**',
        'dist/**',
        'examples/**',
        'eslint.config.js',
        'vitest.config.ts',
        'vitest.integration.config.ts',
        'pnpm-lock.yaml',
        'src/cli.ts',
        'src/lib/helm.ts',
        'src/lib/helmChartWriter.ts',
        'src/lib/rutter.ts',
        'src/lib/security.ts',
        'src/lib/utils/logger.ts',
        'src/lib/utils/helmSerializer.ts',
        'src/lib/templates/**',
        'src/lib/resources/**',
        'src/lib/types.ts',
        'src/lib/umbrella.ts',
        'src/lib/umbrellaRutter.ts',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
