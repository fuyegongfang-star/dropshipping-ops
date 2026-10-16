import { enforceTenantIsolation, TENANT_SCOPED_MODELS } from './tenant-isolation'
import { BusinessException } from '../response/business.exception'

describe('tenant-isolation (§17.1/§17.4)', () => {
  it('隔离模型清单非空且包含核心业务模型', () => {
    expect(TENANT_SCOPED_MODELS.size).toBeGreaterThan(0)
    for (const m of ['Order', 'Wallet', 'Bill', 'Shipment', 'CarrierAccount']) {
      expect(TENANT_SCOPED_MODELS.has(m)).toBe(true)
    }
  })

  it('无租户上下文时完全透明（不收窄、不拦截平台聚合）', () => {
    expect(() =>
      enforceTenantIsolation({ model: 'Bill', action: 'findMany', args: { where: {} } }, undefined),
    ).not.toThrow()
    expect(() =>
      enforceTenantIsolation(
        { model: 'Shipment', action: 'create', args: { data: { tenantId: 't-other' } } },
        undefined,
      ),
    ).not.toThrow()
  })

  it('读取：上下文租户与 where.tenantId 冲突 → 拦截（IDOR）', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Order', action: 'findMany', args: { where: { tenantId: 't-victim' } } },
        't-self',
      ),
    ).toThrow(BusinessException)
  })

  it('读取：租户一致 / 漏写 tenantId → 放行（服务层负责显式隔离）', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Order', action: 'findMany', args: { where: { tenantId: 't-self' } } },
        't-self',
      ),
    ).not.toThrow()
    expect(() =>
      enforceTenantIsolation({ model: 'Order', action: 'findMany', args: { where: {} } }, 't-self'),
    ).not.toThrow()
  })

  it('写入：create 的 tenantId 与上下文冲突 → 拦截（防客户端覆盖）', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Wallet', action: 'create', args: { data: { tenantId: 't-victim' } } },
        't-self',
      ),
    ).toThrow(BusinessException)
  })

  it('写入：updateMany 条件 tenantId 冲突 → 拦截（防越权批量改）', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Order', action: 'updateMany', args: { where: { tenantId: 't-victim' }, data: { status: 'x' } } },
        't-self',
      ),
    ).toThrow(BusinessException)
  })

  it('写入：租户一致 → 放行', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Wallet', action: 'create', args: { data: { tenantId: 't-self' } } },
        't-self',
      ),
    ).not.toThrow()
  })

  it('非隔离模型（如 Carrier 平台目录）不受约束', () => {
    expect(() =>
      enforceTenantIsolation(
        { model: 'Carrier', action: 'create', args: { data: { tenantId: 't-any' } } },
        't-self',
      ),
    ).not.toThrow()
  })
})
