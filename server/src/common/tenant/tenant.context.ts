import { AsyncLocalStorage } from 'async_hooks'

/**
 * 租户上下文（方案 §0/§17）：通过 AsyncLocalStorage 在单次请求链路内传递租户信息。
 * 设计要点：Service 层无需逐层透传 tenantId 参数，统一从此处读取，
 * 从机制上保证「行级隔离」不被遗漏（任何漏写 tenantId 的查询都拿不到上下文而报错/显式处理）。
 */
export interface TenantContext {
  tenantId: string // 租户 UUID（解析自 code，见 TenantMiddleware）
  tenantCode?: string // 租户标识（子域名/请求头）
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

/**
 * 获取当前请求的租户 ID。
 * 定时任务 / 非请求上下文调用时返回 undefined —— 调用方必须显式决定兜底策略（如超管旁路）。
 */
export function getTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId
}

/** 获取当前请求的租户上下文（含 code） */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore()
}
