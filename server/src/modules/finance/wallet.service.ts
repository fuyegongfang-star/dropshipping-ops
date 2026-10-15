/**
 * 收款账务核心服务（任务 4.1，方案 §16 平台收款与商户账务）。
 *
 * 模型要点（§16）：
 * - 钱包 wallet：可用余额 balance、冻结 frozen、信用账期 creditLimit、基准币 currency、状态 status。
 * - 复式记账 ledger_entries：只增不改；每笔资金变动落一条，balanceAfter 记录变动后可用余额。
 * - 资金流（§16.3）：充值→wallet 增；下单锁价→冻结 sell_price；实际 booking→扣减（charge）；
 *   撤单/退货→refund 回 wallet；与承运商结算→settle（平台支出）。
 * - 冻结/解冻只动 frozen 字段，可用额度 available = balance - frozen + creditLimit，下单前据此校验。
 *
 * 币种按 wallet 基准币（§16.2），本期同币操作；跨币折算待 §10 FX 接入。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import {
  CreditLimitDto,
  LedgerItem,
  LedgerType,
  WalletAmountDto,
  WalletSummary,
} from './wallet.types'

const DEFAULT_CURRENCY = 'CNY'

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  // ---- 钱包读取 ----------------------------------------------------------

  /** 取钱包概要（不存在返回全 0 默认态，不在 GET 上产生写副作用） */
  async getSummary(tenantId: string, currency = DEFAULT_CURRENCY): Promise<WalletSummary> {
    const w = await this.findWallet(tenantId, currency)
    if (!w) {
      return {
        tenantId,
        currency,
        balance: 0,
        frozen: 0,
        creditLimit: 0,
        available: 0,
        status: 'active',
      }
    }
    return this.toSummary(w)
  }

  /** 记账流水列表（按时间倒序，便于对账 §16.4） */
  async listLedger(
    tenantId: string,
    currency = DEFAULT_CURRENCY,
    limit = 50,
    offset = 0,
  ): Promise<LedgerItem[]> {
    const w = await this.findWallet(tenantId, currency)
    if (!w) return []
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { walletId: w.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
    return rows.map((r) => ({
      id: r.id,
      type: r.type as LedgerType,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      refType: r.refType,
      refId: r.refId,
      remark: r.remark,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  // ---- 资金操作（复式记账核心） ------------------------------------------

  /** 充值：钱包可用余额增加，记 recharge 流水（§16.1 预充值） */
  async recharge(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    this.assertActive(w.status)
    const delta = new Prisma.Decimal(dto.amount)
    const newBalance = new Prisma.Decimal(w.balance).plus(delta)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { balance: newBalance },
    })
    await this.appendLedger(tenantId, wallet.id, 'recharge', delta, newBalance, dto, currency)
    this.logger.log(`[Wallet] 充值 tenant=${tenantId} amount=${dto.amount} ${currency}`)
    return this.toSummary(wallet)
  }

  /** 设置信用账期授信额度（§16.1 credit，0 = 仅预充值模式） */
  async setCreditLimit(tenantId: string, dto: CreditLimitDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { creditLimit: new Prisma.Decimal(dto.creditLimit) },
    })
    this.logger.log(`[Wallet] 授信额度 tenant=${tenantId} creditLimit=${dto.creditLimit} ${currency}`)
    return this.toSummary(wallet)
  }

  /** 冻结：下单锁价，占用可用额度（available 校验），仅动 frozen（§16.1 预充值冻结） */
  async freeze(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    this.assertActive(w.status)
    const delta = new Prisma.Decimal(dto.amount)
    const available = new Prisma.Decimal(w.balance).minus(w.frozen).plus(w.creditLimit)
    if (available.lt(delta)) {
      throw new BusinessException(
        'WALLET_INSUFFICIENT',
        `可用额度不足：需 ${dto.amount}，当前可用 ${available.toFixed(2)} ${currency}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const newFrozen = new Prisma.Decimal(w.frozen).plus(delta)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { frozen: newFrozen },
    })
    // 冻结不改变可用余额，记 0 金额流水用于审计
    await this.appendLedger(tenantId, wallet.id, 'freeze', new Prisma.Decimal(0), wallet.balance, dto, currency)
    this.logger.log(`[Wallet] 冻结 tenant=${tenantId} amount=${dto.amount} refId=${dto.refId ?? ''}`)
    return this.toSummary(wallet)
  }

  /** 解冻：取消订单释放冻结（§13 逆向），仅动 frozen */
  async unfreeze(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    const delta = new Prisma.Decimal(dto.amount)
    // 避免冻结被减成负数（超额解冻视为全部释放）
    const newFrozen = Prisma.Decimal.max(new Prisma.Decimal(w.frozen).minus(delta), new Prisma.Decimal(0))
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { frozen: newFrozen },
    })
    await this.appendLedger(tenantId, wallet.id, 'unfreeze', new Prisma.Decimal(0), wallet.balance, dto, currency)
    this.logger.log(`[Wallet] 解冻 tenant=${tenantId} amount=${dto.amount} refId=${dto.refId ?? ''}`)
    return this.toSummary(wallet)
  }

  /** 实际扣费：优先消耗冻结，不足部分从可用余额/信用额度扣（§16.3 booking 扣减） */
  async charge(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    this.assertActive(w.status)
    const delta = new Prisma.Decimal(dto.amount)
    const available = new Prisma.Decimal(w.balance).minus(w.frozen).plus(w.creditLimit)
    if (available.lt(delta)) {
      throw new BusinessException(
        'WALLET_INSUFFICIENT',
        `可用额度不足：需 ${dto.amount}，当前可用 ${available.toFixed(2)} ${currency}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    // 扣费释放对应冻结额度，并从余额扣除全额（冻结本是可用余额的预留，花费须出余额；
    // 若余额不足则扣成负数，表示动用信用账期，余额上限受 creditLimit 约束已由上方 available 校验保证）
    const fromFrozen = Prisma.Decimal.min(new Prisma.Decimal(w.frozen), delta)
    const newFrozen = new Prisma.Decimal(w.frozen).minus(fromFrozen)
    const newBalance = new Prisma.Decimal(w.balance).minus(delta)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { frozen: newFrozen, balance: newBalance },
    })
    await this.appendLedger(tenantId, wallet.id, 'charge', delta.negated(), newBalance, dto, currency)
    this.logger.log(`[Wallet] 扣费 tenant=${tenantId} amount=${dto.amount} refId=${dto.refId ?? ''}`)
    return this.toSummary(wallet)
  }

  /** 退款：撤单/退货资金回 wallet（§16.4 关联 §13 逆向） */
  async refund(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    const delta = new Prisma.Decimal(dto.amount)
    const newBalance = new Prisma.Decimal(w.balance).plus(delta)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { balance: newBalance },
    })
    await this.appendLedger(tenantId, wallet.id, 'refund', delta, newBalance, dto, currency)
    this.logger.log(`[Wallet] 退款 tenant=${tenantId} amount=${dto.amount} refId=${dto.refId ?? ''}`)
    return this.toSummary(wallet)
  }

  /** 结算：平台与承运商/供应商结算支出（§16.3 spread 中的平台成本侧） */
  async settle(tenantId: string, dto: WalletAmountDto): Promise<WalletSummary> {
    const currency = dto.currency || DEFAULT_CURRENCY
    const w = await this.ensureWallet(tenantId, currency)
    this.assertActive(w.status)
    const delta = new Prisma.Decimal(dto.amount)
    const available = new Prisma.Decimal(w.balance).minus(w.frozen).plus(w.creditLimit)
    if (available.lt(delta)) {
      throw new BusinessException(
        'WALLET_INSUFFICIENT',
        `可用额度不足：需结算 ${dto.amount}，当前可用 ${available.toFixed(2)} ${currency}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const newBalance = new Prisma.Decimal(w.balance).minus(delta)
    const wallet = await this.prisma.wallet.update({
      where: { id: w.id },
      data: { balance: newBalance },
    })
    await this.appendLedger(tenantId, wallet.id, 'settle', delta.negated(), newBalance, dto, currency)
    this.logger.log(`[Wallet] 结算 tenant=${tenantId} amount=${dto.amount} refId=${dto.refId ?? ''}`)
    return this.toSummary(wallet)
  }

  // ---- 内部工具 ----------------------------------------------------------

  private async findWallet(tenantId: string, currency: string) {
    return this.prisma.wallet.findUnique({
      where: { tenantId_currency: { tenantId, currency } },
    })
  }

  private async ensureWallet(tenantId: string, currency: string) {
    let w = await this.findWallet(tenantId, currency)
    if (!w) {
      w = await this.prisma.wallet.create({
        data: { tenantId, currency, balance: 0, frozen: 0, creditLimit: 0, status: 'active' },
      })
    }
    return w
  }

  /** 钱包被风控冻结时禁止资金进出（§16.1 status） */
  private assertActive(status: string): void {
    if (status !== 'active') {
      throw new BusinessException('WALLET_FROZEN', `钱包状态为 ${status}，禁止资金操作`, HttpStatus.FORBIDDEN)
    }
  }

  private async appendLedger(
    tenantId: string,
    walletId: string,
    type: LedgerType,
    amount: Prisma.Decimal,
    balanceAfter: Prisma.Decimal,
    dto?: WalletAmountDto,
    _currency?: string,
  ): Promise<void> {
    await this.prisma.ledgerEntry.create({
      data: {
        tenantId,
        walletId,
        type,
        amount,
        balanceAfter,
        refType: dto?.refType ?? null,
        refId: dto?.refId ?? null,
        remark: dto?.remark ?? null,
      },
    })
  }

  private toSummary(w: {
    tenantId: string
    currency: string
    balance: Prisma.Decimal | number
    frozen: Prisma.Decimal | number
    creditLimit: Prisma.Decimal | number
    status: string
  }): WalletSummary {
    const balance = Number(w.balance)
    const frozen = Number(w.frozen)
    const creditLimit = Number(w.creditLimit)
    return {
      tenantId: w.tenantId,
      currency: w.currency,
      balance,
      frozen,
      creditLimit,
      available: balance - frozen + creditLimit,
      status: w.status,
    }
  }
}
