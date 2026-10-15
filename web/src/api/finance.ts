import http from './http'

/**
 * 收款账务接口封装（任务 4.1，方案 §16）。
 * 对接后端 `GET /finance/wallet`、`GET /finance/ledger` 与资金操作入口；
 * 演示模式下由 mock-data.ts 返回等价数据（含复式记账流水）。
 */

/** 复式记账类型（§16.2） */
export type LedgerType = 'recharge' | 'freeze' | 'unfreeze' | 'charge' | 'refund' | 'settle'

/** 钱包概要（前端卡片展示） */
export interface WalletSummary {
  tenantId: string
  currency: string
  /** 可用余额（充值累计 - 实际扣费 - 结算，不含冻结） */
  balance: number
  /** 冻结金额（在途订单锁价） */
  frozen: number
  /** 信用账期授信额度 */
  creditLimit: number
  /** 可用额度 = balance - frozen + creditLimit */
  available: number
  /** 钱包状态：active / frozen / closed */
  status: string
}

/** 单条记账流水 */
export interface LedgerItem {
  id: string
  type: LedgerType
  /** 带符号金额（充值/退款为正，扣费/结算为负，冻结/解冻为 0） */
  amount: number
  /** 变动后可用余额 */
  balanceAfter: number
  refType: string | null
  refId: string | null
  remark: string | null
  createdAt: string
}

/** 记账类型中文标签 */
export const LEDGER_LABELS: Record<LedgerType, string> = {
  recharge: '充值',
  freeze: '冻结',
  unfreeze: '解冻',
  charge: '扣费',
  refund: '退款',
  settle: '结算',
}

/** 记账类型徽章配色（与主题令牌一致） */
export const LEDGER_TAG_TYPE: Record<LedgerType, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
  recharge: 'success',
  refund: 'success',
  freeze: 'warning',
  unfreeze: 'info',
  charge: 'danger',
  settle: 'primary',
}

export const financeApi = {
  /** 钱包概要（可用额度 / 余额 / 冻结 / 授信） */
  getWallet: () => http.get<WalletSummary>('/finance/wallet'),
  /** 记账流水（按时间倒序） */
  getLedger: () => http.get<LedgerItem[]>('/finance/ledger'),
  /** 充值（§16.1 预充值） */
  recharge: (amount: number, remark?: string) =>
    http.post<WalletSummary>('/finance/wallet/recharge', { amount, remark: remark ?? '演示充值', refType: 'manual' }),
  /** 设置信用账期授信额度（§16.1 credit） */
  setCreditLimit: (creditLimit: number) =>
    http.post<WalletSummary>('/finance/wallet/credit-limit', { creditLimit }),
  /** 下单锁价：冻结 sell_price */
  freeze: (amount: number, refId: string, refType = 'order') =>
    http.post<WalletSummary>('/finance/wallet/freeze', { amount, refId, refType }),
  /** 取消订单解冻 */
  unfreeze: (amount: number, refId: string, refType = 'order') =>
    http.post<WalletSummary>('/finance/wallet/unfreeze', { amount, refId, refType }),
  /** 实际扣费（按 sell_price 落账，优先消耗冻结） */
  charge: (amount: number, refId: string, refType = 'order') =>
    http.post<WalletSummary>('/finance/wallet/charge', { amount, refId, refType }),
  /** 退款回钱包（撤单/退货） */
  refund: (amount: number, refId: string, refType = 'refund') =>
    http.post<WalletSummary>('/finance/wallet/refund', { amount, refId, refType }),
  /** 与承运商/供应商结算（平台支出） */
  settle: (amount: number, refId: string, refType = 'settle') =>
    http.post<WalletSummary>('/finance/wallet/settle', { amount, refId, refType }),
}
