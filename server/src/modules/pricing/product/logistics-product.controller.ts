/**
 * 物流产品目录 / 费率卡入口（任务 4.6，方案 §4 / §23 运营配置后台）。
 * 运营侧维护合约价产品：CRUD + 费率卡成本试算；全部 @TenantId() 租户隔离。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-16
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common'
import { HttpStatus } from '@nestjs/common'
import { ApiResponse, ok } from '../../../common/response/api-response'
import { TenantId } from '../../../common/tenant/tenant.decorator'
import { BusinessException } from '../../../common/response/business.exception'
import {
  LogisticsProductService,
} from './logistics-product.service'
import {
  CreateLogisticsProductDto,
  UpdateLogisticsProductDto,
  LogisticsProductOut,
  RateCardQuote,
} from './logistics-product.types'

@Controller('pricing/products')
export class LogisticsProductController {
  constructor(private readonly service: LogisticsProductService) {}

  /** 列出当前租户的全部物流产品 */
  @Get()
  async list(@TenantId() tenantId: string): Promise<ApiResponse<LogisticsProductOut[]>> {
    return ok(await this.service.list(tenantId))
  }

  /** 创建物流产品 */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateLogisticsProductDto,
  ): Promise<ApiResponse<LogisticsProductOut>> {
    return ok(await this.service.create(tenantId, dto))
  }

  /** 更新物流产品 */
  @Put(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLogisticsProductDto,
  ): Promise<ApiResponse<LogisticsProductOut>> {
    return ok(await this.service.update(tenantId, id, dto))
  }

  /** 删除物流产品 */
  @Delete(':id')
  async remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return ok(await this.service.remove(tenantId, id))
  }

  /** 费率卡成本试算：传入计费重（kg） */
  @Get(':id/rate')
  async rate(
    @Param('id') id: string,
    @Query('weightKg') weightKg: string,
  ): Promise<ApiResponse<RateCardQuote>> {
    const kg = Number(weightKg)
    if (!Number.isFinite(kg) || kg < 0) {
      throw new BusinessException('PRODUCT_WEIGHT_INVALID', `计费重必须为 ≥0 的数字，收到：${weightKg}`, HttpStatus.BAD_REQUEST)
    }
    return ok(await this.service.computeCarrierCost(id, kg))
  }
}
