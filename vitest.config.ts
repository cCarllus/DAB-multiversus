import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';

import baseViteConfig from './config/vite/vite.config';

export default mergeConfig(
  baseViteConfig,
  defineConfig({
    test: {
      setupFiles: ['./tests/setup/base.setup.ts'],
      coverage: {
        provider: 'v8',
        reportsDirectory: './coverage',
        include: [
          'app/backend/**/*.ts',
          'app/desktop/**/*.ts',
          'app/frontend/**/*.ts',
          'app/game/**/*.ts',
          'app/shared/constants/**/*.ts',
          'app/shared/i18n/**/*.ts',
          'config/env/**/*.ts',
        ],
        exclude: [
          '**/*.d.ts',
          'app/**/types/**/*.ts',
          'app/shared/contracts/**/*.ts',
          'app/shared/types/**/*.ts',
          'tests/**/*.ts',
        ],
        thresholds: {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  }),
);
