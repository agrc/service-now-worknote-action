const globals = require('globals');
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: ['**/dist/'],
  },
  ...compat.extends('eslint:recommended', 'prettier'),
  {
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.jest,
        ...globals.node,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },

      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
  },
];
