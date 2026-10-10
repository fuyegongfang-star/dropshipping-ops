/**
 * 前端 ESLint 配置（方案 §31 代码整齐）：Vue3 + TS。
 */
module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  extends: ['plugin:vue/vue3-recommended', 'eslint-config-prettier'],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  ignorePatterns: ['dist', 'node_modules'],
}
