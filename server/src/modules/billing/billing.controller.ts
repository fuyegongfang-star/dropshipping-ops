/**
 * 商户账单与承运商对账入口（任务 4.2，方案 §9/§10/§16.4）。
 *
 * 路由（前缀 /billing）：
 * - POST /billing/bills/generate        生成商户账单（按账期聚合 sell_price，平台级）
 * - GET  /billing/bills                 商户账单列表（按租户隔离，§0/§17）
 * - GET  /billing/bills/:id             账单详情
 * - POST /billing/bills/:id/issue       出账（draft → issued）
 * - POST /billing/bills/:id/settle      结清（issued → settled）
 * - POST /billing/reconciliations/generate  生成承运商对账（按承运商+账期聚合 carrier_cost）
 * - GET  /billing/reconciliations       承运商对账列表（平台级）
 * - GET  /billing/reconciliations/:id   对账详情
 * - POST /billing/reconciliations/:id/match    匹配（open → matched）
 * - POST /billing/reconciliations/:id/close    关闭（→ closed）
 * - GET  /billing/profit                平台利润核算（§9 spread）
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { BillingService } from './billing.service'
import { BillItem, ReconciliationItem, ProfitSummary, GenerateResult } from './billing.types'

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** 生成商户账单（按账期聚合 sell_price，平台级/超管操作） */
  @Post('bills/generate')
  async generateBills(
    @Query('period') period: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<ApiResponse<GenerateResult>> {
    return ok(await this.billing.generateBills(period, tenantId))
  }

  /** 商户账单列表（按租户隔离） */
  @Get('bills')
  async listBills(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
  ): Promise<ApiResponse<BillItem[]>> {
    return ok(await this.billing.listBills(tenantId, status))
  }

  @Get('bills/:id')
  async getBill(@Param('id') id: string): Promise<ApiResponse<BillItem>> {
    return ok(await this.billing.getBill(id))
  }

  /** 出账：草稿 → 已出账 */
  @Post('bills/:id/issue')
  async issueBill(@Param('id') id: string): Promise<ApiResponse<BillItem>> {
    return ok(await this.billing.issueBill(id))
  }

  /** 结清：已出账 → 已结清 */
  @Post('bills/:id/settle')
  async settleBill(@Param('id') id: string): Promise<ApiResponse<BillItem>> {
    return ok(await this.billing.settleBill(id))
  }

  /** 生成承运商对账（按承运商+账期聚合 carrier_cost，平台级操作） */
  @Post('reconciliations/generate')
  async generateReconciliations(@Query('period') period: string): Promise<ApiResponse<GenerateResult>> {
    return ok(await this.billing.generateReconciliations(period))
  }

  /** 承运商对账列表（平台级，跨租户） */
  @Get('reconciliations')
  async listReconciliations(@Query('status') status?: string): Promise<ApiResponse<ReconciliationItem[]>> {
    return ok(await this.billing.listReconciliations(status))
  }

  @Get('reconciliations/:id')
  async getReconciliation(@Param('id') id: string): Promise<ApiResponse<ReconciliationItem>> {
    return ok(await this.billing.getReconciliation(id))
  }

  /** 匹配：未对账 → 已匹配 */
  @Post('reconciliations/:id/match')
  async matchReconciliation(@Param('id') id: string): Promise<ApiResponse<ReconciliationItem>> {
    return ok(await this.billing.matchReconciliation(id))
  }

  /** 关闭对账 */
  @Post('reconciliations/:id/close')
  async closeReconciliation(@Param('id') id: string): Promise<ApiResponse<ReconciliationItem>> {
    return ok(await this.billing.closeReconciliation(id))
  }

  /** 平台利润核算（§9 spread = Σ sell_price − Σ carrier_cost） */
  @Get('profit')
  async getProfit(@Query('period') period: string): Promise<ApiResponse<ProfitSummary>> {
    return ok(await this.billing.getProfitSummary(period))
  }
}
