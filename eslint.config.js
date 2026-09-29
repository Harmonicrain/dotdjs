import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Packages that must stay runnable in Node, the browser and a Web Worker.
 * They may not import rendering, UI or browser-only code.
 */
const HEADLESS_PACKAGES = ['packages/sim/**', 'packages/protocol/**', 'packages/room/**'];

const HEADLESS_FORBIDDEN_IMPORTS = [
  { group: ['three', 'three/*'], message: 'Headless packages must not depend on rendering.' },
  { group: ['react', 'react-dom', 'react/*'], message: 'Headless packages must not depend on UI.' },
  { group: ['zustand', 'zustand/*'], message: 'Headless packages must not depend on UI state.' },
  { group: ['@dotd/client', '@dotd/server'], message: 'Packages must not import apps.' },
];

export default tseslint.config(
  { ignores: ['legacy/**', '**/dist/**', '**/node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: HEADLESS_PACKAGES,
    rules: {
      'no-restricted-imports': ['error', { patterns: HEADLESS_FORBIDDEN_IMPORTS }],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Headless code must not touch the DOM.' },
        { name: 'document', message: 'Headless code must not touch the DOM.' },
        { name: 'Date', message: 'Use the simulation tick, never wall-clock time.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in @dotd/sim.' },
      ],
    },
  },
  {
    files: ['packages/room/**'],
    rules: {
      // The room legitimately needs wall-clock time to pace ticks, but only via its injected clock.
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Headless code must not touch the DOM.' },
        { name: 'document', message: 'Headless code must not touch the DOM.' },
      ],
    },
  },
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['apps/server/**', '**/*.config.{js,ts}', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
