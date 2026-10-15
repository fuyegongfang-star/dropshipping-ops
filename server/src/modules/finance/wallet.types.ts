/**
 * 收款账务 DTO 与响应类型（任务 4.1，方案 §16）。
 * 覆盖：钱包概要、充值、冻结/解冻、实际扣费、退款、结算与信用账期授信。
 */

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator'

/** 复式记账类型（§16.2：只增不改的流水类型） */
export type LedgerType =
  | 'recharge' // 充值（钱包增）
  | 'freeze' // 下单锁价（冻结可用）
  | 'unfreeze' // 取消订单解冻
  | 'charge' // 实际扣费（按 sell_price）
  | 'refund' // 撤单/退货退款
  | 'settle' // 与承运商/供应商结算（平台支出）

/** 带金额的通用请求（充值/冻结/扣费/退款/结算共用） */
export class WalletAmountDto {
  /** 金额（≥0.01，单位：钱包基准币） */
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number

  /** 币种（可选，省略走钱包基准币；跨币充值将按 §10 汇率折算，本期直接同币） */
  @IsOptional()
  @IsString()
  currency?: string

  /** 关联业务类型（order / bill / refund，便于对账） */
  @IsOptional()
  @IsString()
  refType?: string

  /** 关联业务 ID（如订单号） */
  @IsOptional()
  @IsString()
  refId?: string

  /** 备注（如充值渠道 / 操作人） */
  @IsOptional()
  @IsString()
  remark?: string
}

export class FreezeDto extends WalletAmountDto {}
export class UnfreezeDto extends WalletAmountDto {}
export class ChargeDto extends WalletAmountDto {}
export class RefundDto extends WalletAmountDto {}
export class SettleDto extends WalletAmountDto {}

/** 设置信用账期授信额度（§16.1 credit） */
export class CreditLimitDto {
  /** 授信额度（≥0；0 表示无账期，仅预充值模式） */
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit: number

  @IsOptional()
  @IsString()
  currency?: string
}

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
  /** 可用额度 = balance - frozen + creditLimit（下单前校验依据） */
  available: number
  /** 钱包状态：active / frozen / closed */
  status: string
}

/** 单条记账流水（§16.2 只增不改） */
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
