/**
 * 云途 HMAC-SHA256 请求签名（任务 3.2，方案 §1.1 鉴权矩阵）。
 * 云途要求每个业务请求附带签名头防篡改；本助手用 Node 内置 crypto 实现，无额外依赖（§1.2.5）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { createHmac } from 'node:crypto'

/**
 * 计算云途请求签名。
 * 规范化串 = `${appId}.${timestampMs}.${body}`，以 apiKey 为密钥做 HMAC-SHA256（hex）。
 * TODO(ops): 2026-11 联调时以云途开放平台官网「签名规范」为准校正规范化串拼接顺序（§1.1）；
 *            本实现为合理默认，且为唯一签名落点，便于一处修正。
 */
export function signYunExpressRequest(
  apiKey: string,
  appId: string,
  timestampMs: number,
  body: string,
): string {
  const canonical = `${appId}.${timestampMs}.${body}`
  return createHmac('sha256', apiKey).update(canonical).digest('hex')
}
