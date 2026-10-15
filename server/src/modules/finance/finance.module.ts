/**
 * 收款账务模块（任务 4.1，方案 §16）。
 * 装配钱包服务与 REST 入口；依赖 PrismaService（全局）与 AppLogger。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Module } from '@nestjs/common'
import { WalletController } from './wallet.controller'
import { WalletService } from './wallet.service'

@Module({
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class FinanceModule {}
