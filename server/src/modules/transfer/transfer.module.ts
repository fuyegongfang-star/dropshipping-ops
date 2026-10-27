import { Module } from '@nestjs/common'
import { TransferController } from './transfer.controller'
import { TransferService } from './transfer.service'
import { PurchaseOrderModule } from '../purchase-orders/purchase-order.module'
import { ShipmentsModule } from '../shipments/shipments.module'

/**
 * 中转仓作业流模块（阶段6 6.5–6.9）。
 * 6.5 落地「中转仓看板」(GET /transfer/board)；6.6 扫码到货、6.7 打包、6.8 出单、6.9 出库在此模块陆续扩展。
 * 复用 PurchaseOrderModule 的自动匹配能力（6.4，扫码到货后自动关联店铺订单）；
 * 6.9 出库复用 ShipmentsModule 的 fulfill/recordTracking（回写平台 + 轨迹驱动订单状态机）。
 */
@Module({
  imports: [PurchaseOrderModule, ShipmentsModule],
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
