import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-electron',
      'dist-backend',
      'release',
      'node_modules',
      '.electron-dev',
      'config/electron/build-resources',
      'storage/uploads',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['app/frontend/**/*.{ts,tsx}', 'app/game/**/*.{ts,tsx}', 'app/shared/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
    },
  },
  {
    files: ['app/desktop/**/*.ts', 'app/backend/**/*.ts', 'config/**/*.ts', 'scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['scripts/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['app/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
