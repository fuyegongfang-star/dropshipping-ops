import { Global, Module } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { TenantPrismaService, TENANT_PRISMA } from './tenant-prisma.service'

/**
 * 租户作用域 Prisma 客户端模块（任务 9.4）。
 *
 * 额外提供一个 `TENANT_PRISMA` token（与全局 PrismaService 区分），
 * 供高危模块（orders / purchase-orders / transfer / wms / carriers / billing / finance）
 * 在构造时注入「已注入租户作用域」的客户端，实现缺省拒绝。
 * 不替换全局 PrismaService，避免一次性波及所有查询（方案 §17 增量迁移原则）。
 */
@Global()
@Module({
  providers: [
    {
      provide: TENANT_PRISMA,
      useFactory: (prisma: PrismaService) => new TenantPrismaService(prisma).client,
      inject: [PrismaService],
    },
  ],
  exports: [TENANT_PRISMA],
})
export class TenantPrismaModule {}
