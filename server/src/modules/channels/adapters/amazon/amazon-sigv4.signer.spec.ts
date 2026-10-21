/**
 * AmazonSigV4Signer 单测（方案 §29 AWS SigV4 签名）。
 * 对照 AWS 官方 SigV4 测试套件「get-vanilla」向量离线验证
 * （https://docs.aws.amazon.com/general/latest/gr/signature-v4-test-suite.html），
 * 不依赖任何真实网络或 AWS 凭证，纯算法断言。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-20
 */

import { createHash } from 'crypto'
import { AmazonSigV4Signer } from './amazon-sigv4.signer'

/** 固定时间戳的签名器（对照 AWS 测试向量需确定性 amzDate） */
class FixedSigner extends AmazonSigV4Signer {
  protected getAmzDate(): string {
    return '20150830T123600Z'
  }
}

describe('AmazonSigV4Signer（§29 AWS SigV4）', () => {
  it('对照 AWS get-vanilla 测试向量：生成与官方一致的 Signature', async () => {
    const signer = new FixedSigner(
      'AKIDEXAMPLE',
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      'us-east-1',
      'service', // 注意：普通 service 测试向量不含 x-amz-content-sha256
    )

    const signed = await signer.sign({
      url: 'http://example.amazonaws.com/',
      method: 'GET',
      headers: {},
    })

    // AWS 官方 get-vanilla 期望签名（确定性断言，验证算法正确性）
    expect(signed.headers['Authorization']).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
    expect(signed.headers['host']).toBe('example.amazonaws.com')
    expect(signed.headers['x-amz-date']).toBe('20150830T123600Z')
  })

  it('execute-api 场景注入 x-amz-content-sha256 且 Signature 头含该签名头', async () => {
    const signer = new FixedSigner(
      'AKIDEXAMPLE',
      'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      'us-east-1',
      'execute-api', // SP-API 真实服务名
    )

    const signed = await signer.sign({
      url: 'https://sellingpartnerapi-na.amazon.com/orders/v0/orders',
      method: 'GET',
      headers: { 'x-amz-access-token': 'Atza|xyz' },
    })

    expect(signed.headers['x-amz-content-sha256']).toBeDefined()
    expect(signed.headers['Authorization']).toContain('SignedHeaders=host;x-amz-access-token;x-amz-content-sha256;x-amz-date')
    expect(signed.headers['Authorization']).toMatch(/Signature=[0-9a-f]{64}/)
  })

  it('POST 带 body：x-amz-content-sha256 等于 body 的 SHA256', async () => {
    const signer = new FixedSigner('AKID', 'SECRET', 'us-east-1', 'execute-api')
    const body = { a: 1 }
    const signed = await signer.sign({
      url: 'https://example.com/path',
      method: 'POST',
      headers: {},
      body,
    })
    // 与签名器一致：body 经 JSON.stringify 后取 SHA256（SP-API 校验该值）
    const expected = createHash('sha256').update(JSON.stringify(body)).digest('hex')
    expect(signed.headers['x-amz-content-sha256']).toBe(expected)
  })

  it('无 body：x-amz-content-sha256 为空串 SHA256（e3b0c4...）', async () => {
    const signer = new FixedSigner('AKID', 'SECRET', 'us-east-1', 'execute-api')
    const signed = await signer.sign({ url: 'https://example.com/path', method: 'GET', headers: {} })
    expect(signed.headers['x-amz-content-sha256']).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})
