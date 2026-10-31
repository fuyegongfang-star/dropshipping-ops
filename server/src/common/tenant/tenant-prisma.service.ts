import { Injectable, HttpStatus } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/response/business.exception'
import { getTenantId } from './tenant.context'
import { TENANT_SCOPED_MODELS } from './tenant-isolation'

/**
 * 租户作用域 Prisma 客户端（任务 9.4，review A4 · 缺省拒绝）。
 *
 * 背景：原 tenant-isolation 中间件（`$use`）仅做「冲突拦截」——当 `where`/`data`
 * 里**显式**出现与上下文不一致的 `tenantId` 才拒绝。对
 * `prisma.order.findUnique({ where: { id } })`、`prisma.bill.update({ where: { id } })`
 * 这类**完全不带 tenantId** 的查询全部放行 → 任何已认证用户可用资源 id 越权
 * 读/写他人数据（IDOR）。本服务在 PrismaService 之上包一层 `$extends` 查询拦截器，
 * **缺省把当前请求租户注入 where**，实现「缺省拒绝」。
 *
 * 注入策略（与方案 §17 / 任务 4.4 一致，避免误伤平台聚合）：
 * - 仅对 TENANT_SCOPED_MODELS 生效；平台级聚合（无租户上下文）完全透明、不收窄。
 * - 范围读/批量写（findMany/findFirst/count/aggregate/groupBy/updateMany/deleteMany）：
 *   where 不含 tenantId 时直接注入（IDOR 主战场）。
 * - 单条 update/delete（where 仅含唯一键）：Prisma 允许在唯一过滤之外叠加非唯一字段，
 *   因此同样注入 tenantId —— 跨租户更新影响 0 行 → Prisma 抛「记录不存在」→ 诚实拒绝。
 * - findUnique：Prisma **禁止**往 findUnique.where 强加非唯一字段（会报
 *   "Argument tenantId for where is unknown"），故改为**重写为 findFirst** 并注入 tenantId，
 *   语义不变（按 id 至多命中一行），但实现了缺省拒绝。
 * - 上下文无租户（平台聚合）：读操作完全透明；写操作在生产态抛 TenantScopeViolation
 *   （缺省拒绝的兜底），开发/测试态仅告警，避免破坏既有聚合语义（tenant-isolation.ts 同口径）。
 */

/** 注入点 token：与全局 PrismaService 区分，逐模块迁移高危读路径时使用。 */
export const TENANT_PRISMA = Symbol('TENANT_PRISMA')

/** 范围类 + 批量写：where 支持任意过滤，可安全注入 tenantId */
const RANGE_OPS = new Set<string>([
  'findMany',
  'findFirst',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
])

/** 单条写：where 仅含唯一键，但 Prisma 允许叠加非唯一 tenantId 过滤（叠加后跨租户更新影响 0 行即拒绝） */
const SINGLE_WRITE_OPS = new Set<string>(['update', 'delete'])

/** 所有写操作（无上下文时开发态告警 / 生产态抛错用） */
const WRITE_OPS = new Set<string>([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * 缺省拒绝异常：生产态下作用域模型写操作缺失租户上下文时抛出（防御层兜底）。
 * 读取路径在无上下文时保持透明（平台聚合合法），不抛此异常。
 */
export class TenantScopeViolation extends BusinessException {
  constructor(model: string, operation: string) {
    super(
      'TENANT_SCOPE_VIOLATION',
      `作用域模型 ${model}.${operation} 缺失租户上下文（生产态禁止无租户写操作）`,
      HttpStatus.FORBIDDEN,
    )
  }
}

function isScoped(model?: string): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model)
}

/**
 * 拦截器决策结果（纯函数，便于单测，无需真实数据库）。
 * - `query`：透传 args（可能已注入 tenantId）。
 * - `rewrite-findFirst`：findUnique 改写为 findFirst，并注入 tenantId。
 * - `throw`：生产态无上下文写操作，拒绝执行。
 */
export type ScopePlan =
  | { kind: 'query'; args: Record<string, unknown> | undefined }
  | { kind: 'rewrite-findFirst'; args: Record<string, unknown> }
  | { kind: 'throw' }

/**
 * 计算一次作用域查询应如何处理（缺省拒绝核心逻辑，纯函数）。
 * @param isProduction 是否生产环境（无上下文写操作是否抛错）
 */
export function planScope(
  model: string | undefined,
  operation: string,
  args: Record<string, unknown> | undefined,
  tenantId: string | undefined,
  isProduction: boolean,
): ScopePlan {
  if (!isScoped(model)) return { kind: 'query', args }
  const where = (args?.['where'] as Record<string, unknown> | undefined) ?? undefined

  // 无租户上下文：平台级聚合合法放行；写操作在生产态抛错、开发/测试态告警后放行。
  if (!tenantId) {
    if (WRITE_OPS.has(operation)) {
      if (isProduction) return { kind: 'throw' }
      // 开发/测试态：保持透明（不破坏聚合语义），调用方负责告警。
    }
    return { kind: 'query', args }
  }

  // 已带 tenantId：幂等放行（不重复注入，避免误伤显式过滤）。
  if (where && where['tenantId'] !== undefined) return { kind: 'query', args }

  // findUnique 不能强加非唯一 tenantId → 改写为 findFirst（语义不变，实现缺省拒绝）。
  if (operation === 'findUnique') {
    return { kind: 'rewrite-findFirst', args: { ...(args ?? {}), where: { ...(where ?? {}), tenantId } } }
  }

  // 范围类 / 单条写：直接注入 tenantId 到 where。
  if (RANGE_OPS.has(operation) || SINGLE_WRITE_OPS.has(operation)) {
    return { kind: 'query', args: { ...args, where: { ...(where ?? {}), tenantId } } }
  }

  // 其余操作（create 等）保持透明，由服务层显式租户过滤。
  return { kind: 'query', args }
}

@Injectable()
export class TenantPrismaService {
  /** 已注入租户作用域的 Prisma 客户端（仅高危模块迁移后注入此客户端） */
  public readonly client: PrismaClient

  constructor(prisma: PrismaService) {
    // base 持有原始 PrismaService（已注册 $use 冲突拦截），用于 findUnique→findFirst 改写时调用，
    // 避免经 $extends 自身递归；base 上的 $use 仍会对改写后的 findFirst 做冲突校验。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = prisma as any
    const client = prisma.$extends({
      query: {
        $allModels: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async $allOperations({ model, operation, args, query }: any) {
            const tenantId = getTenantId()
            const plan = planScope(
              model,
              operation,
              args,
              tenantId,
              process.env.NODE_ENV === 'production',
            )
            if (plan.kind === 'throw') {
              throw new TenantScopeViolation(model as string, operation)
            }
            if (plan.kind === 'rewrite-findFirst') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return base[model].findFirst(plan.args)
            }
            return query(plan.args)
          },
        },
      },
    })
    this.client = client as unknown as PrismaClient
  }
}

/** 供 DI 工厂使用的类型（避免循环依赖时直接使用类） */
export type TenantPrismaClient = PrismaClient
