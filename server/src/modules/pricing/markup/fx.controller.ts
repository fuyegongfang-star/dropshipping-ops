/**
 * 币种汇率入口（任务 4.6，方案 §10.3 / §23 运营配置后台）。
 * 暴露 GET /pricing/fx（列出展示用汇率对）与 PUT /pricing/fx/:base/:quote（运营手动覆盖汇率）。
 * 汇率用于成本（CNY 结算）与客户售价（USD 展示）的归一换算；生产环境由定时任务刷新并落快照。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-17
 */

import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { ApiResponse, ok } from '../../../common/response/api-response'
import { FxService } from './fx.service'

/** 汇率对外结构（与前端 web/src/api/pricing.ts 的 FxRate 对齐） */
export interface FxRateView {
  base: string
  quote: string
  rate: number
  updatedAt: string
}

@Controller('pricing/fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  /** 列出展示用汇率对（仅前端展示所需的若干交叉汇率，避免一次性暴露全部中间态）。 */
  @Get()
  list(): ApiResponse<FxRateView[]> {
    return ok(this.fx.listRates())
  }

  /** 手动覆盖某币种对的汇率；汇率必须为正数（诚实失败，避免 0/负汇率误算）。落库 + 更新缓存。 */
  @Put(':base/:quote')
  async update(
    @Param('base') base: string,
    @Param('quote') quote: string,
    @Body() body: { rate?: number },
  ): Promise<ApiResponse<FxRateView>> {
    return ok(await this.fx.updateRate(base, quote, Number(body?.rate)))
  }
}
