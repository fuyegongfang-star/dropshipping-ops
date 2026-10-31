import { planScope, TenantPrismaService, TenantScopeViolation } from './tenant-prisma.service'
import { TENANT_SCOPED_MODELS } from './tenant-isolation'

/**
 * 租户隔离缺省拒绝（任务 9.4，review A4）隔离测试。
 * 直接对核心纯函数 planScope 断言，无需真实数据库即可覆盖缺省拒绝的所有分支；
 * 另对 TenantPrismaService 的构造与客户端形态做冒烟校验。
 */
describe('tenant-prisma 缺省拒绝（9.4 / A4）', () => {
  describe('planScope 核心逻辑', () => {
    it('(a) 有上下文 + 范围查询缺 tenantId → 自动注入当前租户（跨租户 IDOR 缺省拒绝）', () => {
      const plan = planScope('Order', 'findMany', { where: {} }, 't-self', false)
      expect(plan.kind).toBe('query')
      if (plan.kind === 'query') {
        expect((plan.args?.['where'] as Record<string, unknown>).tenantId).toBe('t-self')
      }
    })

    it('(a) count / groupBy / updateMany 等范围操作同样注入', () => {
      for (const op of ['count', 'groupBy', 'updateMany', 'deleteMany', 'findFirst', 'aggregate']) {
        const plan = planScope('Bill', op, { where: {} }, 't-self', false)
        expect(plan.kind).toBe('query')
        if (plan.kind === 'query') {
          expect((plan.args?.['where'] as Record<string, unknown>).tenantId).toBe('t-self')
        }
      }
    })

    it('(a) 单条 update/delete（where 仅唯一键）注入 tenantId → 跨租户更新影响 0 行即拒绝', () => {
      const plan = planScope('Bill', 'update', { where: { id: 'b-1' } }, 't-self', false)
      expect(plan.kind).toBe('query')
      if (plan.kind === 'query') {
        expect(plan.args?.['where']).toEqual({ id: 'b-1', tenantId: 't-self' })
      }
      const del = planScope('PickTask', 'delete', { where: { id: 'p-1' } }, 't-self', false)
      if (del.kind === 'query') {
        expect((del.args?.['where'] as Record<string, unknown>).tenantId).toBe('t-self')
      }
    })

    it('(b) findUnique 改写为 findFirst 并注入 tenantId（绕开 Prisma 唯一键限制）', () => {
      const plan = planScope('Order', 'findUnique', { where: { id: 'o-1' } }, 't-self', false)
      expect(plan.kind).toBe('rewrite-findFirst')
      if (plan.kind === 'rewrite-findFirst') {
        expect(plan.args?.['where']).toEqual({ id: 'o-1', tenantId: 't-self' })
      }
    })

    it('(b) 无租户上下文 + 读取 → 完全透明（平台级聚合不收窄、不拦截）', () => {
      const plan = planScope('Bill', 'findMany', { where: {} }, undefined, false)
      expect(plan.kind).toBe('query')
      if (plan.kind === 'query') {
        expect(plan.args?.['where']).toEqual({})
      }
    })

    it('(b) 已显式带 tenantId → 幂等放行（不重复注入，避免误伤显式过滤）', () => {
      const plan = planScope('Order', 'findMany', { where: { tenantId: 't-self', status: 'paid' } }, 't-self', false)
      expect(plan.kind).toBe('query')
      if (plan.kind === 'query') {
        expect(plan.args?.['where']).toEqual({ tenantId: 't-self', status: 'paid' })
      }
    })

    it('(c) 非作用域模型（平台级目录）完全透明，绝不注入', () => {
      // Carrier 不在 TENANT_SCOPED_MODELS，平台承运商目录跨租户共享
      expect(TENANT_SCOPED_MODELS.has('Carrier')).toBe(false)
      const plan = planScope('Carrier', 'findMany', { where: {} }, 't-self', false)
      expect(plan.kind).toBe('query')
      if (plan.kind === 'query') {
        expect(plan.args?.['where']).toEqual({})
      }
    })

    it('(c) 生产态无租户上下文写操作 → 抛 TenantScopeViolation（缺省拒绝兜底）', () => {
      const plan = planScope('Bill', 'create', { data: { total: 10 } }, undefined, true)
      expect(plan.kind).toBe('throw')
    })

    it('(c) 生产态无租户上下文读取 → 仍透明（平台聚合合法，不抛错）', () => {
      const plan = planScope('Bill', 'findMany', { where: {} }, undefined, true)
      expect(plan.kind).toBe('query')
    })

    it('(c) 开发/测试态无租户上下文写操作 → 透明（仅告警，不抛错）', () => {
      const plan = planScope('Bill', 'create', { data: { total: 10 } }, undefined, false)
      expect(plan.kind).toBe('query')
    })
  })

  describe('TenantPrismaService 构造与客户端', () => {
    it('构造不抛错且暴露 PrismaClient 形态的作用域客户端', () => {
      // 用最小桩替代真实 PrismaService（无需连接数据库）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stub = { $extends: (() => stub) as any } as any
      const svc = new TenantPrismaService(stub)
      expect(svc).toBeInstanceOf(TenantPrismaService)
      expect(svc.client).toBeDefined()
    })
  })

  describe('TenantScopeViolation 异常形态', () => {
    it('继承 BusinessException 且携带业务错误码', () => {
      const e = new TenantScopeViolation('Bill', 'create')
      expect(e).toBeInstanceOf(TenantScopeViolation)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((e as any).bizCode).toBe('TENANT_SCOPE_VIOLATION')
    })
  })
})
