import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'prisma/migrations/**',
    ],
  },

  js.configs.recommended,

  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },

  // Node.js code: API, root config files, Playwright, Prisma seed
  {
    files: ['apps/api/**/*.js', '*.js', 'e2e/**/*.js', 'prisma/**/*.js', 'apps/web/vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright specs run in Node, but page.evaluate() callbacks run in the browser.
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['apps/api/tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },

  // Browser code: web app
  {
    files: ['apps/web/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/src/**/*.test.{js,jsx}', 'apps/web/src/test/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
  },

  // Must stay last: turns off rules that conflict with Prettier formatting.
  prettier,
];
