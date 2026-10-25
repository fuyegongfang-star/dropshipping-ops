/**
 * 中转仓看板控制器（任务 6.5）。
 * 路由前缀 /transfer，全部端点按租户隔离。
 */

import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TransferService } from './transfer.service'
import { ScanTransferDto } from './transfer.dto'

@Controller('transfer')
export class TransferController {
  constructor(private readonly svc: TransferService) {}

  /** 中转仓看板（6.5）：中转仓列表 + 待作业采购单（含关联订单概览） */
  @Get('board')
  async board(@TenantId() tenantId: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getBoard(tenantId))
  }

  /** 扫码到货入库（6.6）：快递单号/SKU 条码/采购单号 → 解析采购单 → 到货登记 → 推进状态 → 匹配订单 */
  @Post('scan')
  async scan(@TenantId() tenantId: string, @Body() dto: ScanTransferDto): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.scan(tenantId, dto))
  }
}
