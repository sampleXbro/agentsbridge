import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        TextDecoder: 'readonly',
        document: 'readonly',
        Buffer: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': 'off', // use @typescript-eslint/no-unused-vars
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      // import/order disabled: eslint-plugin-import@2.x incompatible with ESLint 10
      'import/order': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: 'error',
    },
  },
  {
    files: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../../src/cli/commands/watch.js',
              message: 'Import watch via tests/harness/watch.js',
            },
            {
              name: '../../../../src/cli/commands/watch.js',
              message: 'Import watch via tests/harness/watch.js',
            },
            {
              name: '../../src/cli/commands/watch.js',
              message: 'Import watch via tests/harness/watch.js',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/reference/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:path',
              importNames: ['join', 'relative', 'normalize', 'isAbsolute', 'dirname', 'resolve'],
              message:
                'These node:path APIs are host-platform-aware and silently no-op the artifact map on Windows runners with POSIX-shaped roots (see tasks/lessons.md L180). Use pathApi(projectRoot) from src/core/path-helpers.ts. The `posix`, `win32`, and `basename` exports are still allowed for explicit POSIX-only operations on canonical strings.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      '*.config.*',
      'website/dist/',
      'website/.astro/',
      // Plugin fixtures simulate third-party packages; they intentionally use
      // CommonJS shapes and underscore-prefixed unused parameters that match
      // real-world plugin authors' code, not project source-style rules.
      'tests/fixtures/**/*.js',
    ],
  },
];
