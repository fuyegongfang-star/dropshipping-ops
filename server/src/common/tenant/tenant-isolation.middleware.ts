import type { PrismaClient, Prisma } from '@prisma/client'
import { getTenantId } from './tenant.context'
import { enforceTenantIsolation } from './tenant-isolation'

/**
 * 租户隔离 Prisma 中间件注册（任务 4.4，方案 §17.1/§17.4）。
 *
 * 把 enforceTenantIsolation 接入 Prisma 的全局 $use 拦截器：
 * 任何对租户隔离模型的读写，若请求上下文租户与数据/条件 tenant_id 冲突，直接抛 TENANT_ISOLATION_VIOLATION。
 * 平台级操作（无上下文租户）完全透明。热重载下只注册一次。
 */
export function registerTenantIsolation(prisma: PrismaClient): void {
  // $use 无法卸载，热重载/重复调用用标志位去重，避免中间件层层叠加
  const flag = '__tenantIsolationRegistered'
  if ((prisma as unknown as Record<string, boolean>)[flag]) return
  ;(prisma as unknown as Record<string, boolean>)[flag] = true

  prisma.$use((params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    // 每次操作实时读取异步上下文中的请求租户（§17 上下文绑定）
    const requestTenant = getTenantId()
    enforceTenantIsolation(
      { model: params.model, action: params.action, args: params.args },
      requestTenant,
    )
    return next(params)
  })
}
