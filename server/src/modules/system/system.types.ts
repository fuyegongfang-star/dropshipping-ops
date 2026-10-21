/** 安全与多租户加固态势（任务 4.4，方案 §17；只读诊断） */
export interface SecurityStatus {
  /** 隔离模式：共享库 + 行级隔离（tenant_id）为主，Prisma 中间件做 IDOR 纵深防御 */
  isolationMode: string
  /** 带 tenant_id 的隔离模型数量 */
  tenantScopedModelCount: number
  /** 隔离模型清单（便于审计核对） */
  tenantScopedModels: string[]
  /** 敏感凭据加密算法 */
  secretEncryption: string
  /** 数据库层行级安全策略（RLS）是否已启用 */
  rlsEnabled: boolean
  /** PII 脱敏/加密合规（§17.3）落地状态 */
  piiMasking: string
  /** 越权防护（§17.4 IDOR）机制描述 */
  idorGuard: string
  /** 传输与审计（§17.5）状态 */
  transportAudit: string
}

/** 拉单限流守卫实时统计（与客户端 ThrottleStats 同口径，§30 容量诊断） */
export interface ThrottleStatsDto {
  /** 当前在途店铺锁数量 */
  inflightShopCount: number
  /** 各租户在途拉单数 */
  perTenantActive: Record<string, number>
  /** 单租户拉单并发上限（来自 CAPACITY_CONFIG） */
  maxConcurrentPullsPerTenant: number
  /** 单店铺在途锁有效期（毫秒，来自 CAPACITY_CONFIG） */
  pullInflightTtlMs: number
}

/** 容量与灾备诊断态势（任务 5.4，方案 §30） */
export interface CapacityStatus {
  /** 容量阈值与灾备目标（集中配置，CAPACITY_CONFIG 镜像） */
  config: {
    /** 单租户同时拉单上限 */
    maxConcurrentPullsPerTenant: number
    /** 单店铺在途锁有效期（毫秒） */
    pullInflightTtlMs: number
    /** 比价实时池单批并发上限 */
    pricingConcurrencyLimit: number
    /** 灾备恢复时间目标（毫秒） */
    rtoObjectiveMs: number
    /** 灾备恢复点目标（毫秒） */
    rpoObjectiveMs: number
    /** 数据库全量备份保留天数 */
    dbBackupRetentionDays: number
    /** 对象存储备份保留天数 */
    objectBackupRetentionDays: number
    /** 数据库全量备份 cron */
    dbBackupCron: string
    /** 对象存储增量备份 cron */
    objectsBackupCron: string
  }
  /** 拉单限流守卫实时统计（运行时观测） */
  throttle: ThrottleStatsDto
  /** 容量/灾备落地说明（便于运维核对 §30 各项） */
  notes: string[]
}
