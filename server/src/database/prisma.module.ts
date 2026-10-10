import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * 全局 Prisma 模块（方案 §11）：PrismaService 声明为全局，任意模块可直接注入，避免重复实例化。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
