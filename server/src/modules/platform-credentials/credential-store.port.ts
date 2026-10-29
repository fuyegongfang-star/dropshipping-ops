/**
 * 凭证存储端口与内存实现（任务 NEXT-1，方案 §17.2）。
 *
 * 采用端口/适配器（Port-Adapter）模式：
 * - CredentialStorePort 定义存储契约（与具体介质无关）。
 * - InMemoryCredentialStore 为当前实现（演示/单测可用，进程级）。
 * - 真实持久化（Prisma 落库 + 租户隔离）为 TODO：实现同一端口即可替换，无需改动上层服务。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次
 */

import { Injectable } from '@nestjs/common'
import { PlatformKind } from './platform-credentials.constants'

/** 凭证值对象（encryptedPayload 为加密后的 base64 token，绝不存明文） */
export interface PlatformCredentialValue {
  platform: PlatformKind
  tenantId: string
  encryptedPayload: string // base64(iv|tag|ciphertext)，由 SecretEncryptionService 产出
  status: 'active' | 'pending' | 'error'
  updatedAt: string // ISO
}

/** 凭证存储端口（介质无关，便于后续替换为 Prisma 实现） */
export interface CredentialStorePort {
  save(value: PlatformCredentialValue): void
  get(tenantId: string, platform: PlatformKind): PlatformCredentialValue | undefined
  list(tenantId: string): PlatformCredentialValue[]
  delete(tenantId: string, platform: PlatformKind): void
}

/** DI 令牌（便于 module 内替换为不同实现） */
export const CREDENTIAL_STORE = Symbol('CREDENTIAL_STORE')

/** 内存实现：演示与单测用，进程级生命周期（TODO 替换为 Prisma 持久化） */
@Injectable()
export class InMemoryCredentialStore implements CredentialStorePort {
  private readonly map = new Map<string, PlatformCredentialValue>()

  private key(tenantId: string, platform: PlatformKind): string {
    return `${tenantId}:${platform}`
  }

  save(value: PlatformCredentialValue): void {
    this.map.set(this.key(value.tenantId, value.platform), value)
  }

  get(tenantId: string, platform: PlatformKind): PlatformCredentialValue | undefined {
    return this.map.get(this.key(tenantId, platform))
  }

  list(tenantId: string): PlatformCredentialValue[] {
    return Array.from(this.map.values()).filter((v) => v.tenantId === tenantId)
  }

  delete(tenantId: string, platform: PlatformKind): void {
    this.map.delete(this.key(tenantId, platform))
  }
}
