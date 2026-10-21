import { Controller, Get } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TENANT_SCOPED_MODELS } from '../../common/tenant/tenant-isolation'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import { SecurityStatus } from './system.types'
import { CapacityStatus } from './system.types'
import { CAPACITY_CONFIG } from '../../common/capacity/capacity.config'
import { SyncThrottleService } from '../channels/sync-throttle.service'

/**
 * 系统平台级只读诊断（任务 4.4 安全加固 / 5.4 容量灾备，方案 §17/§30）。
 * 只读接口：返回多租户隔离 / 密钥加密 / 越权防护加固态势，以及容量与灾备目标 + 拉单限流实时统计，
 * 供「容量与灾备」页与运维核对。
 */
@Controller('system')
export class SystemController {
  constructor(
    private readonly secret: SecretEncryptionService,
    private readonly throttle: SyncThrottleService,
  ) {}

  @Get('security')
  getSecurity(): ApiResponse<SecurityStatus> {
    const status: SecurityStatus = {
      isolationMode: '共享库 + tenant_id 行级隔离（§0/§17） + Prisma 中间件 IDOR 纵深防御',
      tenantScopedModelCount: TENANT_SCOPED_MODELS.size,
      tenantScopedModels: [...TENANT_SCOPED_MODELS].sort(),
      secretEncryption: 'AES-256-GCM（§17.2 凭据加密存储 / 运行时解密 / 不落明文库）',
      rlsEnabled: false,
      piiMasking: '规划中（§17.3：买家 PII 加密/脱敏 + 数据主体权利接口）',
      idorGuard: 'context-bound tenantId 冲突拦截（§17.4 防 IDOR / 防客户端覆盖）',
      transportAudit: 'TLS 全链路 + 操作审计日志（§17.5，WAF/限流见 §26）',
    }
    return ok(status)
  }

  /**
   * 容量与灾备诊断（§30）：返回集中配置的容量阈值/灾备目标（RTO/RPO/备份策略），
   * 以及拉单限流守卫的实时统计（在途锁/租户并发），供压测与运维观测。
   */
  @Get('capacity')
  getCapacity(): ApiResponse<CapacityStatus> {
    const stats = this.throttle.getStats()
    const status: CapacityStatus = {
      config: {
        maxConcurrentPullsPerTenant: CAPACITY_CONFIG.maxConcurrentPullsPerTenant,
        pullInflightTtlMs: CAPACITY_CONFIG.pullInflightTtlMs,
        pricingConcurrencyLimit: CAPACITY_CONFIG.pricingConcurrencyLimit,
        rtoObjectiveMs: CAPACITY_CONFIG.rtoObjectiveMs,
        rpoObjectiveMs: CAPACITY_CONFIG.rpoObjectiveMs,
        dbBackupRetentionDays: CAPACITY_CONFIG.dbBackupRetentionDays,
        objectBackupRetentionDays: CAPACITY_CONFIG.objectBackupRetentionDays,
        dbBackupCron: CAPACITY_CONFIG.dbBackupCron,
        objectsBackupCron: CAPACITY_CONFIG.objectsBackupCron,
      },
      throttle: {
        inflightShopCount: stats.inflightShopCount,
        perTenantActive: stats.perTenantActive,
        maxConcurrentPullsPerTenant: stats.maxConcurrentPullsPerTenant,
        pullInflightTtlMs: stats.pullInflightTtlMs,
      },
      notes: [
        '拉单限流：同店铺在途锁（TTL 兜底防死锁）+ 单租户并发上限，超限返回 PULL_THROTTLED（HTTP 429）。',
        '比价并发：L3 有界并行实时池（pricingConcurrencyLimit 上限，§5/§30）。',
        '面单异步：BullMQ 队列异步购标（§30，待消息队列接线）。',
        '灾备：每日全量 PG 备份 + 每 6h 对象存储增量，RPO 5min（WAL 归档），RTO 1h。',
        '压测：限流守卫与比价池单测覆盖（§30 测试强化），端到端压测待 CI 环境。',
      ],
    }
    return ok(status)
  }
}
