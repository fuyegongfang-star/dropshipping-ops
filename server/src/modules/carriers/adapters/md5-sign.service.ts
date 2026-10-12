/**
 * 承运商 MD5 请求签名（任务 3.4，方案 §1.1 鉴权矩阵）。
 * 4PX / 燕文 均以 MD5(32 位小写) 对请求做签名防篡改；本助手用 Node 内置 crypto，无额外依赖（§1.2.5）。
 * 各承运商规范化串拼接顺序不同（见各自适配器），本助手只负责「给定 canonical 串 → 32 位小写 MD5」。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { createHash } from 'node:crypto'

/** 计算 32 位小写 MD5（§1.1：4PX/燕文 签名） */
export function md5Sign(canonical: string): string {
  return createHash('md5').update(canonical).digest('hex')
}
