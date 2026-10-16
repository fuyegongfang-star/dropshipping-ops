import { HttpStatus } from '@nestjs/common'
import { BusinessException } from '../response/business.exception'

/**
 * 租户隔离强制层（任务 4.4，方案 §17.1/§17.4）。
 *
 * 设计原则（防御性、零误杀）：
 * - 本仓采用「共享库 + tenant_id 行级隔离」（§0/§17 既定方案，schema-per-tenant 经评估在高并发多租户下运维成本过高，不予采用）。
 * - 服务层已按租户显式注入 tenant_id（§0/§17 主机制）；本层作为**纵深防御**，只做一件事：
 *   当请求携带合法租户上下文（网关/子域名/JWT 注入）时，**拦截任何与上下文租户不一致的 tenant_id 读写**，
 *   杜绝客户端伪造 / URL 篡改导致的越权（IDOR，§17.4）与跨租户数据泄漏。
 * - 平台级聚合（账单 / 对账 / 利润等跨租户统计）在无租户上下文时执行，本层对其**完全透明、不收窄、不拦截**，避免破坏既有聚合语义。
 * - 不做自动注入式强制（会误伤平台聚合），仅做冲突拦截——这是经过评估后的安全取舍。
 */

/** 全部带 tenant_id 的业务模型（数据模型增强要点 §7，共 39 个；新增时务必同步此表） */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  'Asn',
  'Bill',
  'Bin',
  'CarrierAccount',
  'Claim',
  'ComplianceRule',
  'CycleCount',
  'Inventory',
  'LedgerEntry',
  'LogisticsProduct',
  'MarkupRule',
  'Order',
  'OrderEvent',
  'OrderHold',
  'OrderItem',
  'PickTask',
  'Product',
  'Quote',
  'RateQuote',
  'ReverseOrder',
  'Role',
  'Shipment',
  'ShipmentLeg',
  'Shop',
  'Sku',
  'Supplier',
  'SupplierOrder',
  'SupplierSettlement',
  'SupplierSku',
  'SurchargeRule',
  'TrackingEvent',
  'User',
  'UserRole',
  'Wallet',
  'Warehouse',
  'WebhookEvent',
  'ZoneMap',
])

const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

const READ_ACTIONS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])

/** Prisma 操作参数中可能出现的 tenant_id 位置（in 数组查询不做覆盖判定） */
interface ScopeArgs {
  where?: { tenantId?: string | string[] }
  data?: { tenantId?: string | string[] }
  create?: { tenantId?: string | string[] }
  update?: { tenantId?: string | string[] }
}

/** 从 Prisma 操作参数中提取被操作的 tenant_id（兼容 where/data/create/update 与 in 查询） */
function extractTenantId(args: ScopeArgs | undefined, slot: 'where' | 'data' | 'create' | 'update'): string | undefined {
  if (!args) return undefined
  let v: string | string[] | undefined
  switch (slot) {
    case 'where':
      v = args.where?.tenantId
      break
    case 'data':
      v = args.data?.tenantId
      break
    case 'create':
      v = args.create?.tenantId ?? args.data?.tenantId
      break
    case 'update':
      v = args.update?.tenantId ?? args.data?.tenantId
      break
  }
  // in / 数组查询不做覆盖判定（交由服务层显式租户过滤）
  return Array.isArray(v) ? undefined : (v as string | undefined)
}

/** 越权判定：上下文租户存在且与被操作租户不一致 → 拦截（§17.4 IDOR） */
function assertNoOverride(clientTenant: string | undefined, requestTenant: string | undefined, actionLabel: string): void {
  if (requestTenant && clientTenant && clientTenant !== requestTenant) {
    throw new BusinessException(
      'TENANT_ISOLATION_VIOLATION',
      `禁止跨租户${actionLabel}：请求上下文租户(${requestTenant}) 与数据租户(${clientTenant}) 不一致`,
      HttpStatus.FORBIDDEN,
    )
  }
}

/**
 * 在 Prisma 操作前执行租户隔离校验（纯函数，可直接单测）。
 * @param requestTenant 当前请求上下文租户；为空表示平台级操作（放行，不收窄）。
 */
export function enforceTenantIsolation(
  params: { model?: string; action: string; args?: unknown },
  requestTenant?: string,
): void {
  const { model, action, args } = params
  if (!model || !TENANT_SCOPED_MODELS.has(model)) return
  const scoped = args as ScopeArgs | undefined
  if (READ_ACTIONS.has(action)) {
    assertNoOverride(extractTenantId(scoped, 'where'), requestTenant, '查询')
  } else if (WRITE_ACTIONS.has(action)) {
    assertNoOverride(extractTenantId(scoped, 'create'), requestTenant, '写入')
    assertNoOverride(extractTenantId(scoped, 'update'), requestTenant, '更新')
    assertNoOverride(extractTenantId(scoped, 'where'), requestTenant, '条件')
  }
}
