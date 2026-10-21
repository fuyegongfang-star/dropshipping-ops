/**
 * 拉单并发与限流守卫（任务 5.4，方案 §30 容量）。
 *
 * 防止两类容量风险：
 *   1. 同一店铺被并发重复拉单（在途锁）：以 shopId 去重，避免重复落库与平台限流。
 *   2. 单租户拉单任务数失控（并发信号量）：以 tenantId 计数，超过上限直接拒绝，防止雪崩。
 *
 * 纯内存实现（§30 待 Redis 共享，跨实例场景由 Redis 原子计数替换），不依赖外部基础设施，
 * 单元可测；在途锁带 TTL 兜底，异常未释放时自动过期，避免死锁（§31 边界处理）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { Injectable } from '@nestjs/common'
import { CAPACITY_CONFIG, type CapacityConfig } from '../../common/capacity/capacity.config'
import { AppLogger } from '../../common/logger/app.logger'

/** 拉单准入结果 */
export interface ThrottleResult {
  /** 是否准入（可立即执行拉单） */
  ok: boolean
  /** 拒绝原因（ok=false 时填充） */
  reason?: string
  /** 当前租户在途拉单数（准入时回吐，便于诊断） */
  tenantActive?: number
}

/** 容量实时统计（诊断端点与压测观测用） */
export interface ThrottleStats {
  inflightShopCount: number
  perTenantActive: Record<string, number>
  maxConcurrentPullsPerTenant: number
  pullInflightTtlMs: number
}

@Injectable()
export class SyncThrottleService {
  // 在途店铺锁：shopId → 获取时间戳（用于 TTL 过期判定）
  private readonly inflightShops = new Map<string, number>()
  // 租户在途计数：tenantId → 活跃拉单数
  private readonly tenantActive = new Map<string, number>()
  // 店铺 → 租户映射（释放时精确回退租户计数）
  private readonly shopTenant = new Map<string, string>()
  // 配置（可注入覆盖，便于测试）
  private readonly config: CapacityConfig

  constructor(
    private readonly logger: AppLogger,
    config: CapacityConfig = CAPACITY_CONFIG,
  ) {
    this.config = config
  }

  /**
   * 尝试准入拉单任务：先清理过期在途锁（TTL 兜底），再校验同店铺去重与租户并发上限。
   * 准入成功时登记锁、租户映射与计数；释放由 release 负责。
   */
  acquire(shopId: string, tenantId: string): ThrottleResult {
    // 仅清理本店铺的过期锁（O(1) 命中），避免全量扫描开销
    const ts = this.inflightShops.get(shopId)
    if (ts !== undefined && Date.now() - ts > this.config.pullInflightTtlMs) {
      this.release(shopId)
    }

    if (this.inflightShops.has(shopId)) {
      return { ok: false, reason: `店铺 ${shopId} 拉单进行中（在途锁未释放）` }
    }
    const active = this.tenantActive.get(tenantId) ?? 0
    if (active >= this.config.maxConcurrentPullsPerTenant) {
      return {
        ok: false,
        reason: `租户 ${tenantId} 拉单并发已达上限 ${this.config.maxConcurrentPullsPerTenant}`,
        tenantActive: active,
      }
    }
    this.inflightShops.set(shopId, Date.now())
    this.shopTenant.set(shopId, tenantId)
    this.tenantActive.set(tenantId, active + 1)
    return { ok: true, tenantActive: active + 1 }
  }

  /** 释放拉单锁与租户计数（必达，调用方须在 finally 中执行）。 */
  release(shopId: string): void {
    const tenantId = this.shopTenant.get(shopId)
    if (!this.inflightShops.delete(shopId)) return // 未持有锁则跳过
    this.shopTenant.delete(shopId)
    const tenant = tenantId ?? ''
    const active = this.tenantActive.get(tenant) ?? 0
    if (active <= 1) this.tenantActive.delete(tenant)
    else this.tenantActive.set(tenant, active - 1)
  }

  /** 容量实时统计（诊断端点与压测观测用）。 */
  getStats(): ThrottleStats {
    const perTenantActive: Record<string, number> = {}
    for (const [t, n] of this.tenantActive.entries()) perTenantActive[t] = n
    return {
      inflightShopCount: this.inflightShops.size,
      perTenantActive,
      maxConcurrentPullsPerTenant: this.config.maxConcurrentPullsPerTenant,
      pullInflightTtlMs: this.config.pullInflightTtlMs,
    }
  }

  /** 测试/运维重置（清空所有在途与计数）。 */
  reset(): void {
    this.inflightShops.clear()
    this.tenantActive.clear()
    this.shopTenant.clear()
  }
}
