/**
 * 加价规则配置服务单测（任务 4.6，方案 §23 运营配置后台）。
 * 验证：种子规则载入、新建/更新/删除、目标空校验、负数加价幅度回落。
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-17
 */

import 'reflect-metadata'
import { NotFoundException } from '@nestjs/common'
import { MarkupConfigService } from './markup-config.service'
import { CreateMarkupConfigDto } from './markup-config.types'

type StubLogger = {
  debug: jest.Mock
  warn: jest.Mock
  error: jest.Mock
  log: jest.Mock
  verbose: jest.Mock
}
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

describe('MarkupConfigService (4.6 运营配置)', () => {
  let svc: MarkupConfigService
  beforeEach(() => {
    svc = new MarkupConfigService(stubLogger() as unknown as never)
  })

  it('种子规则可列出且全局基准为 12%', () => {
    const list = svc.list()
    expect(list.length).toBeGreaterThanOrEqual(6)
    expect(list.find((r) => r.id === 'mk_global')?.value).toBe(12)
  })

  it('新建规则生成唯一 id 并进入列表', () => {
    const dto: CreateMarkupConfigDto = {
      scope: 'carrier',
      target: '测试承运商',
      mode: 'percent',
      value: 10,
      priority: 50,
    }
    const r = svc.create(dto)
    expect(r.id).toBeTruthy()
    expect(svc.list().find((x) => x.id === r.id)).toBeTruthy()
  })

  it('新建目标为空时拒绝', () => {
    expect(() =>
      svc.create({ scope: 'global', target: '   ', mode: 'percent', value: 5, priority: 1 }),
    ).toThrow()
  })

  it('负数加价幅度回落到 0（防误填）', () => {
    const r = svc.create({ scope: 'global', target: 'X', mode: 'percent', value: -5, priority: 1 })
    expect(r.value).toBe(0)
  })

  it('更新仅覆盖传入字段', () => {
    const r = svc.create({ scope: 'global', target: 'X', mode: 'percent', value: 5, priority: 1 })
    const u = svc.update(r.id, { value: 20, enabled: false })
    expect(u.value).toBe(20)
    expect(u.enabled).toBe(false)
    expect(u.target).toBe('X')
  })

  it('删除不存在的规则抛 NotFound', () => {
    expect(() => svc.remove('nope')).toThrow(NotFoundException)
  })

  it('删除后列表数量减少', () => {
    const r = svc.create({ scope: 'global', target: 'Y', mode: 'percent', value: 5, priority: 1 })
    const before = svc.list().length
    svc.remove(r.id)
    expect(svc.list().length).toBe(before - 1)
  })
})
