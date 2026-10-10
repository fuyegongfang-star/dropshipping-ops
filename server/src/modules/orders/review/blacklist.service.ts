/**
 * 黑名单服务（任务 1.4 审单引擎依赖，方案 §26 风控前置）。
 * 当前为内存集合（可从环境变量 BLACKLIST_TOKENS 种子），生产应接入数据库黑名单（§26）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'

@Injectable()
export class BlacklistService {
  // 内存黑名单集合（手机号/邮箱/姓名等令牌）
  private readonly blocked = new Set<string>()

  constructor() {
    // 从环境变量种子（逗号分隔）；生产替换为 DB/§26 风控黑名单
    const seed = process.env.BLACKLIST_TOKENS
    if (seed) {
      seed.split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => this.blocked.add(t))
    }
  }

  /** 是否命中黑名单（大小写不敏感） */
  isBlocked(token: string): boolean {
    return this.blocked.has(token.trim().toLowerCase())
  }

  /** 运行时追加黑名单令牌（§26 风控联动预留） */
  add(token: string): void {
    this.blocked.add(token.trim().toLowerCase())
  }
}
