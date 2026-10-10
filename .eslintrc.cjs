/**
 * 根级 ESLint 基础配置（Node + TypeScript）。
 * 说明：各子项目（server / web）采用「自包含」配置（见各自目录 .eslintrc.cjs），
 * 以避免跨目录 extends 时的依赖解析问题；本文件作为根级基准，规则与子项目保持一致（方案 §31）。
 * 格式化由 Prettier 独立负责，ESLint 仅做类型与代码质量校验。
 */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
  },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage', '*.config.js', '*.config.cjs', 'prisma'],
}
