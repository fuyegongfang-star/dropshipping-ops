import { Module } from '@nestjs/common'
import { SuppliersController } from './suppliers.controller'
import { SuppliersService } from './suppliers.service'

/**
 * 供应商代发模块（任务 1.9，方案 §21）。
 * 提供：供应商档案、代发单（推单）与状态机；复用全局 PrismaModule 的 PrismaService。
 */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
