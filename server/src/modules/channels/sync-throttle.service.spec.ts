/**
 * 拉单限流守卫单测（任务 5.4，方案 §30 容量/测试强化）。
 * 覆盖：同店铺在途去重、租户并发上限拒绝、释放精确回退、TTL 过期兜底、统计口径、重置。
 * 纯内存、无外部依赖，可独立运行。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { SyncThrottleService } from './sync-throttle.service'
import { AppLogger } from '../../common/logger/app.logger'
import { CAPACITY_CONFIG } from '../../common/capacity/capacity.config'

/** 用极短 TTL 制造「过期兜底」场景，避免真实等待 30s。 */
const SHORT_TTL_CONFIG = { ...CAPACITY_CONFIG, pullInflightTtlMs: 5 }

describe('SyncThrottleService（§30 容量限流）', () => {
  it('同店铺并发去重：第一次准入，第二次被拒（在途锁生效）', () => {
    const svc = new SyncThrottleService(new AppLogger())
    expect(svc.acquire('shop-1', 't-A').ok).toBe(true)
    const second = svc.acquire('shop-1', 't-A')
    expect(second.ok).toBe(false)
    expect(second.reason).toContain('shop-1')
    svc.release('shop-1')
  })

  it('租户并发上限：达到上限后新增被拒（HTTP 429 语义 PULL_THROTTLED）', () => {
    // 临时缩小上限便于断言
    const svc = new SyncThrottleService(new AppLogger(), { ...CAPACITY_CONFIG, maxConcurrentPullsPerTenant: 2 })
    expect(svc.acquire('s1', 't-B').ok).toBe(true)
    expect(svc.acquire('s2', 't-B').ok).toBe(true)
    const third = svc.acquire('s3', 't-B')
    expect(third.ok).toBe(false)
    expect(third.tenantActive).toBe(2)
    // 释放一个后配额恢复
    svc.release('s1')
    expect(svc.acquire('s3', 't-B').ok).toBe(true)
  })

  it('释放精确回退租户计数：不同租户互不影响', () => {
    const svc = new SyncThrottleService(new AppLogger())
    svc.acquire('s1', 't-1')
    svc.acquire('s2', 't-2')
    svc.release('s1')
    const stats = svc.getStats()
    expect(stats.perTenantActive['t-1']).toBeUndefined()
    expect(stats.perTenantActive['t-2']).toBe(1)
    expect(stats.inflightShopCount).toBe(1)
  })

  it('TTL 过期兜底：持有超过 TTL 后再次 acquire 自动释放旧锁', async () => {
    const svc = new SyncThrottleService(new AppLogger(), SHORT_TTL_CONFIG)
    expect(svc.acquire('s-old', 't-C').ok).toBe(true)
    await new Promise((r) => setTimeout(r, 12)) // 超过 5ms TTL
    const retry = svc.acquire('s-old', 't-C')
    expect(retry.ok).toBe(true) // 旧锁已过期，可重新准入
    svc.release('s-old')
  })

  it('getStats 口径与 reset 清空', () => {
    const svc = new SyncThrottleService(new AppLogger())
    svc.acquire('s1', 't-1')
    svc.acquire('s2', 't-1')
    let stats = svc.getStats()
    expect(stats.inflightShopCount).toBe(2)
    expect(stats.perTenantActive['t-1']).toBe(2)
    expect(stats.maxConcurrentPullsPerTenant).toBe(CAPACITY_CONFIG.maxConcurrentPullsPerTenant)
    svc.reset()
    stats = svc.getStats()
    expect(stats.inflightShopCount).toBe(0)
    expect(stats.perTenantActive).toEqual({})
  })

  it('重复 release 安全（未持锁跳过，不抛异常）', () => {
    const svc = new SyncThrottleService(new AppLogger())
    expect(() => {
      svc.release('never-held')
      svc.acquire('s1', 't-1')
      svc.release('s1')
      svc.release('s1')
    }).not.toThrow()
  })
})
