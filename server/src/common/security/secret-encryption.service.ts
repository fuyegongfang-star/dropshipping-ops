import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { Injectable, Logger } from '@nestjs/common'

/**
 * 密钥加密服务（任务 4.4，方案 §17.2）。
 *
 * 承运商 API key / secret 等敏感凭据**加密存储、运行时解密、不落明文库**（§17.2 的轻量 KMS 落地）：
 * - AES-256-GCM（带认证标签，防篡改）加密明文；输出 base64(iv|tag|ciphertext) 可安全入库。
 * - 主密钥取自环境变量 APP_MASTER_KEY（base64 编码的 ≥32 字节）；缺失时回退开发态默认密钥并告警——
 *   生产必须由密钥管理系统 / 环境变量注入，严禁使用默认密钥。
 * - 提供不可逆 hash（口令比对 / 索引，不还原明文）。
 */
const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const DEV_MASTER_KEY = 'dev-only-insecure-master-key-32b!!' // 仅本地/演示，生产必须替换

@Injectable()
export class SecretEncryptionService {
  private readonly masterKey: Buffer
  private readonly logger = new Logger(SecretEncryptionService.name)

  constructor() {
    const raw = process.env.APP_MASTER_KEY
    this.masterKey = SecretEncryptionService.deriveKey(raw)
    if (!raw) {
      this.logger.warn(
        '[Security] 未配置 APP_MASTER_KEY，使用开发态默认密钥；生产必须通过环境变量注入 ≥32 字节 base64 主密钥（§17.2）',
      )
    }
  }

  private static deriveKey(raw?: string): Buffer {
    if (raw) {
      const buf = Buffer.from(raw, 'base64')
      if (buf.length >= 32) return buf.subarray(0, 32)
      this.throwKeyError()
    }
    return Buffer.from(DEV_MASTER_KEY, 'utf8').subarray(0, 32)
  }

  private static throwKeyError(): never {
    throw new Error('APP_MASTER_KEY 长度不足 32 字节（base64 解码后），请注入合规主密钥（§17.2）')
  }

  /** 加密明文密钥/口令，返回可安全落库的 token（base64: iv|tag|ciphertext） */
  encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, this.masterKey, iv)
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, enc]).toString('base64')
  }

  /** 解密 token 还原明文（§17.2 运行时解密，不落明文库） */
  decrypt(token: string): string {
    const buf = Buffer.from(token, 'base64')
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const enc = buf.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, this.masterKey, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  }

  /** 不可逆哈希（用于口令比对/索引，不还原明文） */
  hash(plain: string): string {
    return createHash('sha256').update(plain).digest('base64')
  }
}
