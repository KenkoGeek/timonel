/* eslint-env node */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { project: false, ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import', 'unused-imports', 'sonarjs', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:sonarjs/recommended',
    'prettier',
  ],
  settings: { 'import/resolver': { typescript: true } },
  rules: {
    'no-console': 'off',
    'unused-imports/no-unused-imports': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
      },
    ],
    // Security rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',
  },
  overrides: [
    {
      files: ['src/cli.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
