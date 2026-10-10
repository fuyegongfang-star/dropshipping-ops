/**
 * 合规校验（任务 1.4 审单占位，方案 §19 申报合规自动化）。
 * 当前为占位：HS Code / IOSS / EORI / VAT / Section321 自动校验（§19）在阶段3 落地，暂跳过。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'
import { ReviewCheck, ReviewContext, ReviewResult } from '../review.types'

@Injectable()
export class ComplianceCheck implements ReviewCheck {
  readonly name = 'compliance'

  // TODO(ops): 2026-11 接入 §19 合规规则（HS/IOSS/EORI/VAT/Section321）后实现申报合规自动校验。
  async check(_ctx: ReviewContext): Promise<ReviewResult> {
    return {
      checkName: this.name,
      passed: true,
      skipped: true,
      note: '合规规则（§19）未接入，合规校验暂跳过',
    }
  }
}
