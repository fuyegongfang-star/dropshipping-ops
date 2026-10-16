import { SecretEncryptionService } from './secret-encryption.service'

describe('SecretEncryptionService (§17.2)', () => {
  const svc = new SecretEncryptionService()

  it('加密后可解密还原明文（AES-256-GCM 往返）', () => {
    const plain = 'yun_express_secret_abc123'
    const token = svc.encrypt(plain)
    expect(token).not.toContain(plain) // 不落明文
    expect(svc.decrypt(token)).toBe(plain)
  })

  it('不同明文密文不同（确定性 IV 不应导致可预测）', () => {
    const a = svc.encrypt('hello')
    const b = svc.encrypt('hello')
    expect(a).not.toBe(b) // 随机 IV
    expect(svc.decrypt(a)).toBe('hello')
    expect(svc.decrypt(b)).toBe('hello')
  })

  it('篡改密文在解密时抛错（GCM 认证标签防护）', () => {
    const token = svc.encrypt('top-secret')
    const buf = Buffer.from(token, 'base64')
    buf[buf.length - 1] ^= 0xff // 翻转最后一位
    const tampered = buf.toString('base64')
    expect(() => svc.decrypt(tampered)).toThrow()
  })

  it('hash 不可逆且确定（相同明文同值）', () => {
    const h1 = svc.hash('password')
    const h2 = svc.hash('password')
    expect(h1).toBe(h2)
    expect(h1).not.toContain('password')
  })
})
