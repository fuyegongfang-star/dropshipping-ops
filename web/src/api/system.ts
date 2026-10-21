import http from './http'

/** 安全与多租户加固态势（任务 4.4，方案 §17；只读诊断） */
export interface SecurityStatus {
  /** 隔离模式描述 */
  isolationMode: string
  /** 带 tenant_id 的隔离模型数量 */
  tenantScopedModelCount: number
  /** 隔离模型清单 */
  tenantScopedModels: string[]
  /** 敏感凭据加密算法 */
  secretEncryption: string
  /** 数据库层行级安全策略（RLS）是否启用 */
  rlsEnabled: boolean
  /** PII 脱敏/加密合规（§17.3）状态 */
  piiMasking: string
  /** 越权防护（§17.4 IDOR）机制描述 */
  idorGuard: string
  /** 传输与审计（§17.5）状态 */
  transportAudit: string
}

/** 拉单限流守卫实时统计（与后端 ThrottleStats 同口径，§30 容量诊断） */
export interface ThrottleStats {
  /** 当前在途店铺锁数量 */
  inflightShopCount: number
  /** 各租户在途拉单数 */
  perTenantActive: Record<string, number>
  /** 单租户拉单并发上限 */
  maxConcurrentPullsPerTenant: number
  /** 单店铺在途锁有效期（毫秒） */
  pullInflightTtlMs: number
}

/** 容量与灾备诊断态势（任务 5.4，方案 §30） */
export interface CapacityStatus {
  /** 容量阈值与灾备目标（集中配置镜像） */
  config: {
    maxConcurrentPullsPerTenant: number
    pullInflightTtlMs: number
    pricingConcurrencyLimit: number
    rtoObjectiveMs: number
    rpoObjectiveMs: number
    dbBackupRetentionDays: number
    objectBackupRetentionDays: number
    dbBackupCron: string
    objectsBackupCron: string
  }
  /** 拉单限流守卫实时统计 */
  throttle: ThrottleStats
  /** 容量/灾备落地说明 */
  notes: string[]
}

/** 系统诊断接口（任务 4.4 §17 / 5.4 §30；演示模式由 mock-data 拦截） */
export const systemApi = {
  /** 获取安全加固态势（隔离/加密/越权防护） */
  getSecurity: () => http.get<SecurityStatus>('/system/security'),
  /** 获取容量与灾备诊断（限流实时统计 + RTO/RPO + 备份策略，§30） */
  getCapacity: () => http.get<CapacityStatus>('/system/capacity'),
}
