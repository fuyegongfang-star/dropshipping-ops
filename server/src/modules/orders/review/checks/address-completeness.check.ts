/**
 * 地址完整性校验（任务 1.4 审单，方案 §18 地址校验前置）。
 * 校验收件人必填字段；完整地址标准化/分区/可达性判定见 §18（阶段3）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'
import { ReviewCheck, ReviewContext, ReviewResult } from '../review.types'

/** 收件人必填字段（§18 完整规则在阶段3 接入） */
const REQUIRED_FIELDS = ['name', 'country', 'city', 'address1'] as const

@Injectable()
export class AddressCompletenessCheck implements ReviewCheck {
  readonly name = 'address-completeness'

  async check(ctx: ReviewContext): Promise<ReviewResult> {
    const recipient = (ctx.recipient ?? {}) as Record<string, unknown>
    const missing = REQUIRED_FIELDS.filter((field) => !recipient[field])
    if (missing.length > 0) {
      return { checkName: this.name, passed: false, reason: `收件信息缺失: ${missing.join(',')}` }
    }
    return { checkName: this.name, passed: true }
  }
}
