import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { RiskService } from './risk.service'

describe('RiskService（§26 风控体系）', () => {
  let service: RiskService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RiskService],
    }).compile()
    service = module.get<RiskService>(RiskService)
  })

  it('种子数据按租户隔离：t_demo 有规则与订单，其他租户为空', () => {
    expect(service.listRules('t_demo').length).toBeGreaterThan(0)
    expect(service.listRules('t_other')).toHaveLength(0)
    expect(service.listOrders('t_demo').length).toBeGreaterThan(0)
    expect(service.listOrders('t_other')).toHaveLength(0)
  })

  it('规则引擎评分：同地址多单(>=2)命中累加对应分值', () => {
    const { score, level, hits } = service.evaluateRisk('t_demo', {
      amount: 88, currency: 'USD', sameAddressCount: 2, recentOrderCount: 2,
      trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [],
    })
    expect(hits.some((h) => h.ruleName === '同地址多单')).toBe(true)
    expect(score).toBeGreaterThanOrEqual(30)
    expect(level).toBe('medium')
  })

  it('黑名单命中强制判高风险且 reviewStatus=pending', () => {
    const orders = service.listOrders('t_demo')
    const bl = orders.find((o) => o.blacklisted)
    expect(bl).toBeDefined()
    expect(bl!.level).toBe('high')
    expect(bl!.reviewStatus).toBe('pending')
  })

  it('敏感货瞒报：申报与实际品类不符时命中', () => {
    const { hits } = service.evaluateRisk('t_demo', {
      amount: 100, currency: 'USD', sameAddressCount: 1, recentOrderCount: 1,
      trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'battery', blacklistHits: [],
    })
    expect(hits.some((h) => h.ruleName === '敏感货瞒报')).toBe(true)
  })

  it('人工审核：pending 订单可审批通过/驳回并留痕', () => {
    const pending = service.listOrders('t_demo').find((o) => o.reviewStatus === 'pending')!
    const approved = service.reviewOrder('t_demo', pending.id, { decision: 'approved', note: '核验无误' })
    expect(approved.reviewStatus).toBe('approved')
    expect(approved.reviewedBy).toBe('risk_operator')
    expect(approved.reviewNote).toBe('核验无误')

    const rejected = service.reviewOrder('t_demo', pending.id, { decision: 'rejected' })
    expect(rejected.reviewStatus).toBe('rejected')
  })

  it('跨租户访问风险订单抛 NotFound', () => {
    const o = service.listOrders('t_demo')[0]
    expect(() => service.getOrder('t_other', o.id)).toThrow(NotFoundException)
  })

  it('新建 / 删除规则：归属当前租户且可删除', () => {
    const created = service.createRule('t_demo', { name: '测试规则', category: 'fraud', score: 10 })
    expect(created.tenantId).toBe('t_demo')
    expect(service.deleteRule('t_demo', created.id).deleted).toBe(true)
    expect(() => service.deleteRule('t_demo', created.id)).toThrow(NotFoundException)
  })

  it('新增 / 移除黑名单：归属当前租户且可移除', () => {
    const added = service.addBlacklist('t_demo', { type: 'address', value: 'TEST|1', reason: 'x' })
    expect(added.tenantId).toBe('t_demo')
    expect(service.removeBlacklist('t_demo', added.id).deleted).toBe(true)
  })

  it('风控总览：scanned/blacklistCount 与种子规模一致', () => {
    const s = service.summary('t_demo')
    expect(s.scanned).toBe(service.listOrders('t_demo').length)
    expect(s.blacklistCount).toBeGreaterThan(0)
    expect(s.pendingReview).toBe(
      service.listOrders('t_demo').filter((o) => o.reviewStatus === 'pending').length,
    )
  })
})
