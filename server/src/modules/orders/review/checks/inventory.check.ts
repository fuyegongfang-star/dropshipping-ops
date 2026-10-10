/**
 * 库存可用性校验（任务 1.4 审单占位，方案 §13/§15）。
 * 当前为占位：平台↔内部 SKU 映射（§1.7）与 WMS 库存（§15）尚未完成，暂跳过。
 * 完成后在此实现「按 SKU 查 inventory 锁定/可用并比对 quantity」。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'
import { ReviewCheck, ReviewContext, ReviewResult } from '../review.types'

@Injectable()
export class InventoryCheck implements ReviewCheck {
  readonly name = 'inventory'

  // TODO(ops): 2026-11 接入 SKU 映射（§1.7）与 WMS 库存（§15）后实现库存可用性校验。
  // 届时读取 order.items 的 skuCode → inventory.available，不足则 passed=false 并挂起（order_holds）。
  async check(_ctx: ReviewContext): Promise<ReviewResult> {
    return {
      checkName: this.name,
      passed: true,
      skipped: true,
      note: 'SKU 映射/WMS 未完成（§1.7/§15），库存校验暂跳过',
    }
  }
}
