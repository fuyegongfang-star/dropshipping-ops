import { Module } from '@nestjs/common'
import { TenantsService } from './tenants.service'
import { TenantsController } from './tenants.controller'

/**
 * 租户模块（方案 §0/§17）。
 * 导出 TenantsService，供 AppModule 中的 TenantMiddleware 注入使用（code→UUID 解析）。
 */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
