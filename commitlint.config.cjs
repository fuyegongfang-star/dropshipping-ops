/**
 * 提交信息规范（Conventional Commits，方案 §31）。
 * 格式：<type>(<scope>): <中文简述>
 * type: feat | fix | refactor | docs | chore | test | perf | style
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'perf', 'style'],
    ],
    'header-max-length': [2, 'always', 120],
  },
}
