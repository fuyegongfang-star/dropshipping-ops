import { Module } from '@nestjs/common'
import { PurchaseOrderController } from './purchase-order.controller'
import { PurchaseOrderService } from './purchase-order.service'

/**
 * 采购单模块（任务 6.2，方案 §21 衍生 / 阶段6 中转仓作业流）。
 * 提供：采购单 CRUD 与状态机；复用全局 PrismaModule 与租户隔离中间件（§0/§17）。
 */
@Module({
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
