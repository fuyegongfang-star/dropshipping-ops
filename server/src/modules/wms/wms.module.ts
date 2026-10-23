import { Module } from '@nestjs/common'
import { WmsController } from './wms.controller'
import { WmsService } from './wms.service'

/**
 * WMS 模块（任务 2.2 入库/库存/拣货 + 2.3 海外仓模型，方案 §15）。
 * 提供：仓库(国内/海外)、入库预报(ASN)、上架、库存调整、拣货波次；复用全局 PrismaModule。
 */
@Module({
  controllers: [WmsController],
  providers: [WmsService],
  exports: [WmsService],
})
export class WmsModule {}
