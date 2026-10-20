import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { PrismaModule } from './database/prisma.module'
import { AuthModule } from './common/auth/auth.module'
import { HealthModule } from './modules/health/health.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { TenantMiddleware } from './common/tenant/tenant.middleware'
import { HttpModule } from './common/http/http.module'
import { ChannelsModule } from './modules/channels/channels.module'
import { OrdersModule } from './modules/orders/orders.module'
import { CatalogModule } from './modules/catalog/catalog.module'
import { CarriersModule } from './modules/carriers/carriers.module'
import { PricingModule } from './modules/pricing/pricing.module'
import { FinanceModule } from './modules/finance/finance.module'
import { BillingModule } from './modules/billing/billing.module'
import { SystemModule } from './modules/system/system.module'
import { RbacModule } from './modules/rbac/rbac.module'
import { ReportsModule } from './modules/reports/reports.module'
import { ClaimsModule } from './modules/claims/claims.module'
import { RiskModule } from './modules/risk/risk.module'
import { OpenApiModule } from './modules/openapi/openapi.module'

/**
 * 根模块：装配全局配置、数据库、鉴权、健康检查与业务模块（方案 §0/§11）。
 * 租户解析中间件对所有 /api 路由生效，确保请求级租户上下文注入（§0/§17）。
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    HttpModule,
    ChannelsModule,
    OrdersModule,
    CatalogModule,
    CarriersModule,
    PricingModule,
    FinanceModule,
    BillingModule,
    SystemModule,
    RbacModule,
    ReportsModule,
    ClaimsModule,
    RiskModule,
    OpenApiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 租户解析：从子域名/请求头解析并注入 AsyncLocalStorage（§0/§17）
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
