/**
 * 平台凭证 Prisma 持久化存储（任务 11.1，方案 §17.2）。
 *
 * 实现 `CredentialStorePort`，把平台凭证**真正落库 PostgreSQL**，替换原进程级内存实现：
 * - 行级隔离：所有读写均显式带 tenantId（与 InMemoryCredentialStore 行为一致），杜绝跨租户泄漏；
 * - 幂等覆盖：以 (tenantId, platform) 唯一约束做 upsert，重复 save 即覆盖，不会堆脏数据；
 * - 不落明文：仅持久化 SecretEncryptionService 产出的加密 token（encryptedPayload），与上游契约不变。
 *
 * 上层 `PlatformCredentialService` / 控制器 / 适配器工厂**仅增加 await**，业务逻辑零改动——
 * 仅本文件与模块绑定替换即可完成凭证存储下沉。
 *
 * 负责人：夜间自动开发引擎 ｜ 新增于 2026-11-03 夜间批次
 */

import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import {
  CredentialStorePort,
  PlatformCredentialValue,
} from './credential-store.port'
import { PlatformKind } from './platform-credentials.constants'

/** DB 行的 status 取值与端口契约对齐（DB 为自由字符串，做窄化转换） */
type StoredStatus = PlatformCredentialValue['status']

@Injectable()
export class PrismaCredentialStore implements CredentialStorePort {
  private readonly logger = new Logger(PrismaCredentialStore.name)

  constructor(private readonly prisma: PrismaService) {}

  /** 写入/覆盖凭证：以 (tenantId, platform) 唯一约束做幂等 upsert。 */
  async save(value: PlatformCredentialValue): Promise<void> {
    try {
      await this.prisma.platformCredential.upsert({
        where: { tenantId_platform: { tenantId: value.tenantId, platform: value.platform } },
        create: {
          tenantId: value.tenantId,
          platform: value.platform,
          encryptedPayload: value.encryptedPayload,
          status: value.status,
          updatedAt: new Date(value.updatedAt),
        },
        update: {
          encryptedPayload: value.encryptedPayload,
          status: value.status,
          updatedAt: new Date(value.updatedAt),
        },
      })
    } catch (err) {
      // 持久化失败不应让调用方拿到半截状态；记录后向外抛，由上层决定降级策略。
      this.logger.error(
        `[PrismaCredentialStore] 保存凭证失败 tenant=${value.tenantId} platform=${value.platform}`,
        err as Error,
      )
      throw err
    }
  }

  /** 读取凭证（按租户+平台唯一）；缺失返回 undefined（上层据此抛业务异常）。 */
  async get(tenantId: string, platform: PlatformKind): Promise<PlatformCredentialValue | undefined> {
    const row = await this.prisma.platformCredential.findUnique({
      where: { tenantId_platform: { tenantId, platform } },
    })
    return row ? this.toValue(row) : undefined
  }

  /** 列出租户下全部已配置平台凭证（行级隔离，不会跨租户）。 */
  async list(tenantId: string): Promise<PlatformCredentialValue[]> {
    const rows = await this.prisma.platformCredential.findMany({ where: { tenantId } })
    return rows.map((r) => this.toValue(r))
  }

  /** 删除凭证：按租户+平台定位，避免误删他租户数据。 */
  async delete(tenantId: string, platform: PlatformKind): Promise<void> {
    try {
      await this.prisma.platformCredential.deleteMany({ where: { tenantId, platform } })
    } catch (err) {
      this.logger.error(
        `[PrismaCredentialStore] 删除凭证失败 tenant=${tenantId} platform=${platform}`,
        err as Error,
      )
      throw err
    }
  }

  /** DB 行 → 端口值对象（ISO 字符串化的 updatedAt，便于前端/服务展示） */
  private toValue(row: Prisma.PlatformCredentialGetPayload<object>): PlatformCredentialValue {
    return {
      tenantId: row.tenantId,
      platform: row.platform as PlatformKind,
      encryptedPayload: row.encryptedPayload,
      status: row.status as StoredStatus,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
