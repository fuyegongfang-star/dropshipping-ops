import { Module } from '@nestjs/common'
import { ClaimsService } from './claims.service'
import { ClaimsController } from './claims.controller'

/**
 * 理赔模块（任务 4.8，方案 §20）。
 * 异常理赔管理：丢件/破损/延误/清关失败/拒收/地址错误；承运商/平台/保险责任分流。
 */
@Module({
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
