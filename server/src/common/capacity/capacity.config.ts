/**
 * 容量与灾备配置（任务 5.4，方案 §30 容量/灾备/测试）。
 *
 * 集中沉淀 §30 的容量阈值与灾备目标（RTO/RPO、备份策略），供拉单限流守卫、
 * 系统诊断端点与灾备脚本统一引用。常量化避免散落的 magic number（§31.3）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

/** 容量与灾备配置项（单位：毫秒 / 天；阈值用于运行时限流与诊断展示）。 */
export interface CapacityConfig {
  /** 单租户同时进行的拉单任务上限（超出则拒绝，防止雪崩，§30 容量）。 */
  maxConcurrentPullsPerTenant: number
  /** 单店铺拉单在途锁的有效期（毫秒）：异常未释放时自动过期，避免死锁。 */
  pullInflightTtlMs: number
  /** 比价实时池单批并发上限（L3 有界并行，§5/§30 容量）。 */
  pricingConcurrencyLimit: number
  /** 灾备恢复目标：RTO（恢复时间目标），毫秒。 */
  rtoObjectiveMs: number
  /** 灾备恢复点目标：RPO（数据丢失窗口），毫秒。 */
  rpoObjectiveMs: number
  /** 数据库全量备份保留天数。 */
  dbBackupRetentionDays: number
  /** 对象存储（MinIO）备份保留天数。 */
  objectBackupRetentionDays: number
  /** 数据库全量备份 cron（每日 03:10，避峰）。 */
  dbBackupCron: string
  /** 对象存储增量备份 cron（每 6 小时）。 */
  objectsBackupCron: string
}

/** §30 默认容量与灾备目标（可按环境覆盖）。 */
export const CAPACITY_CONFIG: CapacityConfig = {
  maxConcurrentPullsPerTenant: 8,
  pullInflightTtlMs: 30_000,
  pricingConcurrencyLimit: 12,
  rtoObjectiveMs: 1 * 60 * 60 * 1000, // 1 小时
  rpoObjectiveMs: 5 * 60 * 1000, // 5 分钟（WAL 归档）
  dbBackupRetentionDays: 30,
  objectBackupRetentionDays: 90,
  dbBackupCron: '10 3 * * *',
  objectsBackupCron: '0 */6 * * *',
}
