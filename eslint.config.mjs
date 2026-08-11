import js from '@eslint/js';
import globals from 'globals';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

const nextAppFiles = [
  'apps/admin_web/**/*.{js,jsx,ts,tsx}',
  'apps/public_web/**/*.{js,jsx,ts,tsx}',
];

const nextAppConfig = nextVitals.map((config) => ({
  ...config,
  files: nextAppFiles,
}));

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.next-*/**',
      '**/build/**',
      '**/dist/**',
      '**/.dart_tool/**',
      '**/coverage/**',
      '**/logs/**',
      '**/next-env.d.ts',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      ...config.languageOptions,
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...config.rules,
      'no-undef': 'off',
    },
  })),
  ...nextAppConfig,
  {
    files: nextAppFiles,
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
];
