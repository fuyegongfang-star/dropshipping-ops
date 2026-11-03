/**
 * 平台凭证服务（任务 8.1 / 11.1，方案 §17.2）。
 *
 * 职责：① 凭证加密落库（AES-256-GCM，经 SecretEncryptionService，不存明文）；
 *      ② 按租户+平台读取并解密还原结构化凭证；③ 必填字段校验；
 *      ④ 列表/删除。真实 API 联调交由 platform-adapter.factory.ts（TODO）。
 *
 * 多租户：凭证以 tenantId 隔离（存储端口实现须保证租户维度）。
 * 异步：存储端口（InMemory/Prisma）统一异步，本服务方法相应 await。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次，2026-11-03 下沉 Prisma
 */

import { Inject, Injectable, HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/response/business.exception'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import {
  CREDENTIAL_STORE,
  CredentialStorePort,
  PlatformCredentialValue,
} from './credential-store.port'
import { PLATFORM_META, PlatformKind } from './platform-credentials.constants'

@Injectable()
export class PlatformCredentialService {
  constructor(
    private readonly encryption: SecretEncryptionService,
    @Inject(CREDENTIAL_STORE) private readonly store: CredentialStorePort,
  ) {}

  /** 写入凭证：校验必填 → JSON 序列化 → 加密 → 落库（status=active） */
  async setCredential<T extends Record<string, unknown>>(
    tenantId: string,
    platform: PlatformKind,
    credential: T,
  ): Promise<void> {
    this.assertRequired(platform, credential)
    const encryptedPayload = this.encryption.encrypt(JSON.stringify(credential))
    const value: PlatformCredentialValue = {
      platform,
      tenantId,
      encryptedPayload,
      status: 'active',
      updatedAt: new Date().toISOString(),
    }
    await this.store.save(value)
  }

  /** 读取并解密凭证；缺失则抛业务异常（优雅失败，不返回 undefined 误导调用方） */
  async getCredential<T = Record<string, unknown>>(
    tenantId: string,
    platform: PlatformKind,
  ): Promise<T> {
    const value = await this.store.get(tenantId, platform)
    if (!value) {
      throw new BusinessException(
        'PLATFORM_CREDENTIAL_MISSING',
        `租户 ${tenantId} 未配置平台 ${platform} 凭证`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const plain = this.encryption.decrypt(value.encryptedPayload)
    return JSON.parse(plain) as T
  }

  /** 是否存在有效凭证 */
  async hasCredential(tenantId: string, platform: PlatformKind): Promise<boolean> {
    return (await this.store.get(tenantId, platform)) !== undefined
  }

  /** 读取凭证元信息（不解密，仅返回更新时间，供列表展示） */
  async getUpdatedAt(tenantId: string, platform: PlatformKind): Promise<string | undefined> {
    return (await this.store.get(tenantId, platform))?.updatedAt
  }

  /** 列出租户已配置的平台 */
  async listPlatforms(tenantId: string): Promise<PlatformKind[]> {
    return (await this.store.list(tenantId)).map((v) => v.platform)
  }

  /** 删除凭证 */
  async removeCredential(tenantId: string, platform: PlatformKind): Promise<void> {
    await this.store.delete(tenantId, platform)
  }

  /** 校验平台必填字段（缺字段抛业务异常，避免下游拿到半截凭证） */
  private assertRequired(platform: PlatformKind, credential: Record<string, unknown>): void {
    const meta = PLATFORM_META[platform]
    const missing = meta.requiredFields.filter(
      (f) => credential[f] === undefined || credential[f] === null || credential[f] === '',
    )
    if (missing.length > 0) {
      throw new BusinessException(
        'PLATFORM_CREDENTIAL_INCOMPLETE',
        `平台 ${platform} 凭证缺失必填字段: ${missing.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      )
    }
  }
}
