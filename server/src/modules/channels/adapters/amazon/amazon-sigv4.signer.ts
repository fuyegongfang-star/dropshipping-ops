/**
 * Amazon SP-API AWS SigV4 请求签名器（方案 §29：AWS SigV4 签名）。
 *
 * SP-API 所有读写端点（FBA Inbound / Shipping / Reports 等）除 LWA 头外，
 * 必须用 AWS Signature Version 4 对请求做签名，否则 AWS 返回 403。
 * 阶段1 评估阶段用 NoopAmazonSigner 占位；本实现是阶段5「完整对接」的真实 SigV4，
 * 纯算法（Node crypto HMAC-SHA256），可在本机以 AWS 官方测试向量离线验证（见同名 spec）。
 *
 * 签名流程（https://docs.aws.amazon.com/general/latest/gr/signature-version-4.html）：
 *   1. 任务（Task）：拼接规范请求头（host/x-amz-date/可能 x-amz-content-sha256/x-amz-security-token）。
 *   2. 规范请求（CanonicalRequest）：method + path + query + 规范头 + 签名头列表 + payload 哈希。
 *   3. 待签字符串（StringToSign）：算法 + 时间戳 + 凭证作用域 + 规范请求哈希。
 *   4. 签名（Signature）：以 secret 派生签名密钥，对 StringToSign 做 HMAC-SHA256。
 *   5. Authorization 头：填入算法/凭证作用域/签名头列表/签名。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-20
 */

import { createHash, createHmac } from 'crypto'
import { AmazonRequestSigner, AmazonSignRequest } from './amazon-adapter'

/** 十六进制编码 */
function hex(buf: Buffer | string): string {
  return Buffer.isBuffer(buf) ? buf.toString('hex') : Buffer.from(buf).toString('hex')
}

/** SHA256 哈希（默认返回 hex） */
function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest()
}

/** HMAC-SHA256（以 hex 返回） */
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

/**
 * 真实 SigV4 签名器。
 * 构造需 AWS 凭证（IAM 用户/角色）、区域与 SP-API 服务名（固定 `execute-api`）。
 */
export class AmazonSigV4Signer implements AmazonRequestSigner {
  constructor(
    private readonly awsAccessKeyId: string,
    private readonly awsSecretKey: string,
    private readonly region: string,
    private readonly service = 'execute-api',
    /** 临时凭证的会话令牌（STS 假定角色场景），可选 */
    private readonly sessionToken?: string,
  ) {}

  async sign(req: AmazonSignRequest): Promise<AmazonSignRequest> {
    const url = new URL(req.url)
    const amzDate = this.getAmzDate()
    const dateStamp = amzDate.slice(0, 8) // YYYYMMDD

    const headers: Record<string, string> = { ...req.headers }
    headers['host'] = url.host
    headers['x-amz-date'] = amzDate
    if (this.sessionToken) headers['x-amz-security-token'] = this.sessionToken

    // payload 哈希（SP-API 的 execute-api 强制校验 x-amz-content-sha256；
    // 普通 service 测试向量不含该头，故仅在 execute-api 下注入，保证与 AWS 向量一致）
    const bodyStr = req.body == null ? '' : typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const payloadHash = hex(sha256(bodyStr))
    if (this.service === 'execute-api') headers['x-amz-content-sha256'] = payloadHash

    // 规范头：键小写并排序，值去首尾空白并压缩内部空白（§ SigV4 规则）
    const sortedKeys = Object.keys(headers)
      .map((k) => k.toLowerCase())
      .sort()
    const canonicalHeaders = sortedKeys
      .map((k) => `${k}:${String(headers[k]).trim().replace(/\s+/g, ' ')}\n`)
      .join('')
    const signedHeaderList = sortedKeys.join(';')

    // 规范请求
    const canonicalQuery = this.canonicalQueryString(url.searchParams)
    const canonicalRequest = [
      req.method.toUpperCase(),
      this.canonicalUri(url.pathname),
      canonicalQuery,
      canonicalHeaders,
      signedHeaderList,
      payloadHash,
    ].join('\n')

    // 待签字符串
    const scope = `${dateStamp}/${this.region}/${this.service}/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      hex(sha256(canonicalRequest)),
    ].join('\n')

    // 派生签名密钥并签名
    const signingKey = this.deriveSigningKey(dateStamp)
    const signature = hex(hmac(signingKey, stringToSign))

    // Authorization 头
    headers['Authorization'] =
      `AWS4-HMAC-SHA256 Credential=${this.awsAccessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaderList}, Signature=${signature}`

    return { ...req, headers }
  }

  /** 派生签名密钥（kSecret→kDate→kRegion→kService→kSigning） */
  private deriveSigningKey(dateStamp: string): Buffer {
    const kSecret = `AWS4${this.awsSecretKey}`
    const kDate = hmac(kSecret, dateStamp)
    const kRegion = hmac(kDate, this.region)
    const kService = hmac(kRegion, this.service)
    return hmac(kService, 'aws4_request')
  }

  /** 规范 URI：路径需 RFC3986 编码（空格→%20，不编码 /），保留尾斜杠 */
  private canonicalUri(pathname: string): string {
    if (!pathname) return '/'
    return pathname
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
  }

  /** 规范查询串：键/值 RFC3986 编码并排序，空值保留等号 */
  private canonicalQueryString(params: URLSearchParams): string {
    const pairs: string[] = []
    params.sort()
    for (const [k, v] of params.entries()) {
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    }
    return pairs.join('&')
  }

  /** 当前 amzDate（UTC，ISO8601 紧凑式 YYYYMMDDTHHMMSSZ）；测试可覆写以得到确定性签名 */
  protected getAmzDate(): string {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }
}
