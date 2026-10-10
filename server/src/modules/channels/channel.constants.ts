/**
 * 渠道适配器常量与枚举（方案 §3 渠道接入 / §0 全渠道）。
 * 渠道（Channel）= 订单来源平台（Shopify/Amazon/淘宝/抖音…）；与承运商（Carrier）区分。
 * 枚举值对齐 Prisma `Shop.platform` 字段（见 schema.prisma）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

/** 渠道平台代码（对齐 Shop.platform） */
export enum ChannelPlatform {
  SHOPIFY = 'shopify',
  AMAZON = 'amazon',
  TIKTOK = 'tiktok',
  TAOBAO = 'taobao',
  DOUYIN = 'douyin',
  INDEPENDENT = 'independent',
  MOCK = 'mock', // 仅用于开发与测试（无真实平台），便于框架自测
}

/**
 * 渠道归一化订单状态。
 * 拉单后统一映射到系统内部订单状态机的初始态 `pending_review`（§13.1），
 * 由后续审单引擎（§1.4）驱动状态流转。
 */
export enum ChannelOrderStatus {
  CREATED = 'created',
  PAID = 'paid',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  UNKNOWN = 'unknown',
}

/** 渠道健康状态 */
export interface ChannelHealth {
  healthy: boolean // 适配器是否可用
  latencyMs?: number // 探测耗时（毫秒）
  message?: string // 附加说明
}

/** 拉单选项（游标分页 / 时间增量拉取） */
export interface ChannelPullOptions {
  since?: string // 增量拉取起点（UTC ISO）；首次全量可不传
  cursor?: string // 平台游标（分页）
  limit?: number // 单页上限
}

/**
 * 拉单结果汇总（ChannelSyncService 返回与日志）。
 * 设计：单条订单失败不中断整体（看门狗：单点失败跳过，§0/§31），失败计入 failed+errors。
 */
export interface ChannelPullSummary {
  shopId: string // 店铺 ID
  platform: ChannelPlatform // 渠道平台
  created: number // 新建订单数
  updated: number // 更新订单数（已存在，刷新快照）
  skipped: number // 跳过数（预留）
  failed: number // 失败条数
  errors: string[] // 失败明细（platformOrderNo: 原因）
}
