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
        'src/lib/rutter.ts',
        'src/lib/templates/**',
        'src/lib/resources/**',
        'src/lib/types.ts',
        'src/lib/umbrella.ts',
        'src/lib/umbrellaRutter.ts',
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
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
