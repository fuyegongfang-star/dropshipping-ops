/**
 * 中转仓看板控制器（任务 6.5）。
 * 路由前缀 /transfer，全部端点按租户隔离。
 */

import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TransferService } from './transfer.service'
import { ScanTransferDto, GenerateLabelDto } from './transfer.dto'

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

  /** 待打包队列（6.7）：已匹配订单聚合 + 核对差异预览 + 是否已生成打包任务。 */
  @Get('pack-queue')
  async packQueue(@TenantId() tenantId: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getPackQueue(tenantId))
  }

  /** 生成打包任务（6.7）：对全部「已匹配且已关联订单」的采购单聚合组创建打包任务（幂等）。 */
  @Post('pack-tasks/generate')
  async generatePackTasks(@TenantId() tenantId: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.generatePackTasks(tenantId))
  }

  /** 打包任务列表（6.7）。 */
  @Get('pack-tasks')
  async listPackTasks(@TenantId() tenantId: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.listPackTasks(tenantId))
  }

  /** 打包任务核对（6.7）：采购行项 vs 订单行项，逐行差异（差异高亮）。 */
  @Get('pack-tasks/:id/check')
  async packCheck(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getPackCheck(tenantId, id))
  }

  /** 标记打包（6.7）：打包任务置 packed，并推进聚合采购单状态。 */
  @Post('pack-tasks/:id/pack')
  async pack(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.pack(tenantId, id))
  }

  /** 可选跨境渠道（6.8）：中转仓出单可选渠道列表（演示态）。 */
  @Get('channels')
  async channels(@TenantId() tenantId: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.listChannels())
  }

  /** 生成跨境面单（6.8）：选渠道→建单（Shipment）+ 出 ZPL/预览面单，回填 PackTask。 */
  @Post('pack-tasks/:id/label')
  async generateLabel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: GenerateLabelDto,
  ): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.generateLabel(tenantId, id, dto))
  }

  /** 查看跨境面单（6.8）：返回已生成的面单（ZPL + 预览）。 */
  @Get('pack-tasks/:id/label')
  async getLabel(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getLabel(tenantId, id))
  }
}
