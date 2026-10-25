import { Module } from '@nestjs/common'
import { TransferController } from './transfer.controller'
import { TransferService } from './transfer.service'

/**
 * 中转仓作业流模块（阶段6 6.5–6.9）。
 * 6.5 落地「中转仓看板」(GET /transfer/board)；6.6 扫码到货、6.7 打包、6.8 出单、6.9 出库将在此模块陆续扩展。
 */
@Module({
  controllers: [TransferController],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
