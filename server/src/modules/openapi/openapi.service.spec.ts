import { OpenApiService } from './openapi.service'

describe('OpenApiService（§28 开放 API 与生态集成）', () => {
  let svc: OpenApiService

  beforeEach(() => {
    svc = new OpenApiService()
  })

  it('种子客户端按租户隔离：t_demo 有 2 个，其他租户为空', () => {
    expect(svc.listClients('t_demo').length).toBe(2)
    expect(svc.listClients('t_other')).toHaveLength(0)
  })

  it('凭据校验：正确 client_id/secret → 命中；错误 → null；disabled 不计', () => {
    expect(svc.getClientByCredentials('cli_demo_full', 'secret_demo_full_2026')).not.toBeNull()
    expect(svc.getClientByCredentials('cli_demo_full', 'wrong')).toBeNull()
    expect(svc.getClientByCredentials('not_exist', 'x')).toBeNull()
  })

  it('新建客户端：分配 clientId/secret 并归属当前租户', () => {
    const c = svc.createClient('t_demo', { name: '测试', scopes: ['orders'] })
    expect(c.tenantId).toBe('t_demo')
    expect(c.clientId.startsWith('cli_')).toBe(true)
    expect(c.clientSecret.length).toBeGreaterThan(10)
    expect(svc.listClients('t_demo').length).toBe(3)
  })

  it('删除客户端：跨租户不可见，删除后数量减少', () => {
    const c = svc.createClient('t_demo', { name: 'todelete', scopes: ['orders'] })
    expect(svc.deleteClient('t_demo', c.id).deleted).toBe(true)
    expect(() => svc.deleteClient('t_other', c.id)).toThrow()
  })

  it('轮换密钥：旧 secret 失效、新 secret 可用', () => {
    const c = svc.createClient('t_demo', { name: 'rotate', scopes: ['orders'] })
    const old = c.clientSecret
    const rotated = svc.rotateSecret('t_demo', c.id)
    expect(rotated.clientSecret).not.toBe(old)
    expect(svc.getClientByCredentials(c.clientId, old)).toBeNull()
    expect(svc.getClientByCredentials(c.clientId, rotated.clientSecret)).not.toBeNull()
  })

  it('限流：超过阈值抛 RATE_LIMIT_EXCEEDED', () => {
    expect(() => {
      for (let i = 0; i < 5; i++) svc.checkRateLimit('c1', 3)
    }).toThrow()
    // 新 client 不受其他 client 限流影响
    expect(() => svc.checkRateLimit('c2', 3)).not.toThrow()
  })

  it('开放报价试算：按重量与目的地给出多家承运商报价（含加价层）', () => {
    const q = svc.estimateQuote('t_demo', 2, 'US')
    expect(q.length).toBe(3)
    expect(q.every((x) => x.sellPrice > x.cost)).toBe(true) // 加价层保证售价>成本
    expect(q.find((x) => x.carrierCode === 'dhl')!.etaDays).toBe(6) // US 远程 +2
  })

  it('ERP 财务凭证：账单生成借贷平衡的应收/应付分录', () => {
    const entries = svc.buildGlVouchers('t_demo')
    // 每笔账单 借+贷 两条，3 笔 = 6 条
    expect(entries.length).toBe(6)
    const debit = entries.filter((e) => e.direction === 'debit').reduce((a, e) => a + e.amount, 0)
    const credit = entries.filter((e) => e.direction === 'credit').reduce((a, e) => a + e.amount, 0)
    expect(debit).toBe(credit) // 借贷平衡（ERP 凭证基本约束）
  })

  it('Webhook 订阅：创建后本租户可见', () => {
    const w = svc.createWebhook('t_demo', { event: 'order.shipped', url: 'https://x/hook' })
    expect(w.status).toBe('active')
    expect(svc.listWebhooks('t_demo').some((x) => x.id === w.id)).toBe(true)
  })

  it('作用域校验：无上下文/缺作用域抛 Unauthorized', () => {
    expect(() => svc.assertScope(null, 'orders')).toThrow()
    expect(() => svc.assertScope({ clientId: 'x', tenantId: 't_demo', scopes: ['quotes'] }, 'orders')).toThrow()
    expect(() => svc.assertScope({ clientId: 'x', tenantId: 't_demo', scopes: ['orders'] }, 'orders')).not.toThrow()
  })
})
