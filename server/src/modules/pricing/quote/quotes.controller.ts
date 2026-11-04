/**
 * 试算门户入口（任务 3.7，方案 §4 运费试算门户(正式)）。
 * 商户自助试算 → 生成可锁定 quote_id → 渠道自选 → 带入下单（§4.0 模式B / §4.6）。
 * 复用比价引擎（trial 模式）+ 加价层（§5/§10），与真实下单价口径一致。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../../common/response/api-response'
import { TenantId } from '../../../common/tenant/tenant.decorator'
import { PricingEngineService } from '../pricing-engine.service'
import { CompareRequest } from '../pricing.types'
import { QuotesService } from './quotes.service'
import { Quote } from './quote.types'

@Controller('pricing/quotes')
export class QuotesController {
  constructor(
    private readonly engine: PricingEngineService,
    private readonly quotes: QuotesService,
  ) {}

  /** 商户自助试算：跑比价+加价（trial 多列表），落库生成 quote_id + 有效期（§4.3/§4.6） */
  @Post()
  async create(@TenantId() tenantId: string, @Body() req: CompareRequest): Promise<ApiResponse<Quote>> {
    const res = await this.engine.compare(tenantId, { ...req, trial: true })
    const currency = res.quotes[0]?.currency ?? 'CNY'
    const quote = await this.quotes.create(tenantId, req, res.quotes, currency)
    return ok(quote)
  }

  /** 取试算单（租户隔离 + 过期校验，§4.6） */
  @Get(':id')
  async get(@TenantId() tenantId: string, @Param('id') id: string): Promise<ApiResponse<Quote>> {
    return ok(await this.quotes.get(tenantId, id))
  }

  /** 商户渠道自选：标记 selectedProductCode（§4.0 模式B） */
  @Patch(':id/select')
  async select(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { productCode: string },
  ): Promise<ApiResponse<Quote>> {
    return ok(await this.quotes.select(tenantId, id, body.productCode))
  }
}
