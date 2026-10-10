/**
 * 黑名单校验（任务 1.4 审单，方案 §26 风控前置）。
 * 校验收件人手机号/邮箱/姓名是否命中黑名单（§26 风控黑名单）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'
import { ReviewCheck, ReviewContext, ReviewResult } from '../review.types'
import { BlacklistService } from '../blacklist.service'

@Injectable()
export class BlacklistCheck implements ReviewCheck {
  readonly name = 'blacklist'

  constructor(private readonly blacklist: BlacklistService) {}

  async check(ctx: ReviewContext): Promise<ReviewResult> {
    const recipient = (ctx.recipient ?? {}) as Record<string, unknown>
    const tokens = [recipient.phone, recipient.email, recipient.name]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map((v) => v.trim().toLowerCase())

    for (const token of tokens) {
      if (this.blacklist.isBlocked(token)) {
        return { checkName: this.name, passed: false, reason: `命中黑名单: ${token}` }
      }
    }
    return { checkName: this.name, passed: true }
  }
}
