import { Controller, Get } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TENANT_SCOPED_MODELS } from '../../common/tenant/tenant-isolation'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import { SecurityStatus } from './system.types'

/**
 * 系统安全态势诊断（任务 4.4，方案 §17）。
 * 只读接口：返回当前多租户隔离 / 密钥加密 / 越权防护等加固落地情况，供「安全加固」页与运维核对。
 */
@Controller('system')
export class SystemController {
  constructor(private readonly secret: SecretEncryptionService) {}

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
}
