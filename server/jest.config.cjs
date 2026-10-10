/**
 * Jest 配置（Node 全栈，ts-jest 转译 TypeScript）。
 * 测试环境为 node；src 下 *.spec.ts 为测试文件。
 */
module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
