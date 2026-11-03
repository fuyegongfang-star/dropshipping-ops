/**
 * 凭证存储端口与内存实现（任务 8.1 / 11.1，方案 §17.2）。
 *
 * 采用端口/适配器（Port-Adapter）模式：
 * - CredentialStorePort 定义存储契约（与具体介质无关，全部异步以兼容 Prisma）。
 * - InMemoryCredentialStore 为演示/单测实现（进程级）。
 * - PrismaCredentialStore 为生产实现（落库 PostgreSQL + 租户隔离），2026-11-03 夜间批次补完。
 *   所有方法均为异步，上层服务（PlatformCredentialService）统一 await，调用方无需感知介质差异。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次，2026-11-03 下沉 Prisma
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

/**
 * 凭证存储端口（介质无关）。
 * 全部异步：真实持久化（Prisma）天然异步，内存实现同样返回 Promise 以保证契约一致。
 */
export interface CredentialStorePort {
  save(value: PlatformCredentialValue): Promise<void>
  get(tenantId: string, platform: PlatformKind): Promise<PlatformCredentialValue | undefined>
  list(tenantId: string): Promise<PlatformCredentialValue[]>
  delete(tenantId: string, platform: PlatformKind): Promise<void>
}

/** DI 令牌（便于 module 内替换为不同实现） */
export const CREDENTIAL_STORE = Symbol('CREDENTIAL_STORE')

/** 内存实现：演示与单测用，进程级生命周期（生产由 PrismaCredentialStore 替换） */
@Injectable()
export class InMemoryCredentialStore implements CredentialStorePort {
  private readonly map = new Map<string, PlatformCredentialValue>()

  private key(tenantId: string, platform: PlatformKind): string {
    return `${tenantId}:${platform}`
  }

  async save(value: PlatformCredentialValue): Promise<void> {
    this.map.set(this.key(value.tenantId, value.platform), value)
  }

  async get(tenantId: string, platform: PlatformKind): Promise<PlatformCredentialValue | undefined> {
    return this.map.get(this.key(tenantId, platform))
  }

  async list(tenantId: string): Promise<PlatformCredentialValue[]> {
    return Array.from(this.map.values()).filter((v) => v.tenantId === tenantId)
  }

  async delete(tenantId: string, platform: PlatformKind): Promise<void> {
    this.map.delete(this.key(tenantId, platform))
  }
}
