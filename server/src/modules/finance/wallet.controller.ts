/**
 * 收款账务入口（任务 4.1，方案 §16）。
 * 暴露钱包概要、充值、授信、冻结/解冻、扣费、退款、结算与流水查询；全部按租户隔离（§0/§17）。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { WalletService } from './wallet.service'
import {
  ChargeDto,
  CreditLimitDto,
  FreezeDto,
  LedgerItem,
  RefundDto,
  SettleDto,
  UnfreezeDto,
  WalletAmountDto,
  WalletSummary,
} from './wallet.types'

@Controller('finance')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /** 钱包概要（可用余额 / 冻结 / 授信 / 可用额度） */
  @Get('wallet')
  async getWallet(
    @TenantId() tenantId: string,
    @Query('currency') currency?: string,
  ): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.getSummary(tenantId, currency))
  }

  /** 记账流水（按时间倒序） */
  @Get('ledger')
  async getLedger(
    @TenantId() tenantId: string,
    @Query('currency') currency?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiResponse<LedgerItem[]>> {
    const list = await this.wallet.listLedger(
      tenantId,
      currency,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    )
    return ok(list)
  }

  /** 充值（§16.1 预充值钱包） */
  @Post('wallet/recharge')
  async recharge(@TenantId() tenantId: string, @Body() dto: WalletAmountDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.recharge(tenantId, dto))
  }

  /** 设置信用账期授信额度（§16.1 credit） */
  @Post('wallet/credit-limit')
  async setCreditLimit(@TenantId() tenantId: string, @Body() dto: CreditLimitDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.setCreditLimit(tenantId, dto))
  }

  /** 下单锁价：冻结 sell_price（§16.3） */
  @Post('wallet/freeze')
  async freeze(@TenantId() tenantId: string, @Body() dto: FreezeDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.freeze(tenantId, dto))
  }

  /** 取消订单解冻（§13 逆向） */
  @Post('wallet/unfreeze')
  async unfreeze(@TenantId() tenantId: string, @Body() dto: UnfreezeDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.unfreeze(tenantId, dto))
  }

  /** 实际扣费（按 sell_price 落账，优先消耗冻结） */
  @Post('wallet/charge')
  async charge(@TenantId() tenantId: string, @Body() dto: ChargeDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.charge(tenantId, dto))
  }

  /** 退款回钱包（撤单/退货） */
  @Post('wallet/refund')
  async refund(@TenantId() tenantId: string, @Body() dto: RefundDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.refund(tenantId, dto))
  }

  /** 与承运商/供应商结算（平台支出） */
  @Post('wallet/settle')
  async settle(@TenantId() tenantId: string, @Body() dto: SettleDto): Promise<ApiResponse<WalletSummary>> {
    return ok(await this.wallet.settle(tenantId, dto))
  }
}
