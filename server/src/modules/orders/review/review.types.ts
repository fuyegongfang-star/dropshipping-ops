/**
 * 审单引擎类型定义（任务 1.4，方案 §13/§18/§19）。
 * 审单 = 订单进入 approved 前的校验关卡：地址完整性 / 黑名单 / 库存 / 合规。
 * 各校验实现 ReviewCheck 接口，便于 §18（地址校验）、§19（合规自动化）后续补充。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

/** 单条校验结果 */
export interface ReviewResult {
  checkName: string // 校验名
  passed: boolean // 是否通过
  reason?: string // 失败原因
  skipped?: boolean // 是否跳过（如依赖未就绪，§1.7/§19）
  note?: string // 备注
}

/** 审单校验接口（可插拔，新增校验只需实现本接口并注册） */
export interface ReviewCheck {
  readonly name: string
  check(ctx: ReviewContext): Promise<ReviewResult>
}

/** 审单上下文（校验输入） */
export interface ReviewContext {
  tenantId: string
  orderId: string
  platformOrderNo: string
  recipient: Record<string, unknown> | null // 收件人（来自 Order.recipient，§17 脱敏）
  items: Array<{ skuCode?: string; quantity: number }>
}

/** 审单汇总结果 */
export interface ReviewSummary {
  orderId: string
  approved: boolean // 是否审核通过（→ approved）
  results: ReviewResult[] // 各校验明细
  reasons: string[] // 失败/拒绝原因列表
}
