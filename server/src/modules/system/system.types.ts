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
