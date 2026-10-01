// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // Regras do docs/CONVENTIONS.md
    rules: {
      'no-console': 'warn',
    },
  },
  {
    // O plugin @typescript-eslint só é registrado pelo eslint-config-expo para arquivos TS.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
