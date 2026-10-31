import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { OpenApiService } from './openapi.service'
import { OpenApiController } from './openapi.controller'
import { OpenApiGuard } from './openapi.guard'
import { RolesGuard } from '../../common/auth/rbac/roles.guard'

/**
 * 开放平台模块（任务 5.2，方案 §28 开放 API 与生态集成）。
 * 注册本地 JwtModule（复用全局 jwtSecret 签发/验签开放令牌），
 * 装配 OpenApiService + OpenApiGuard + OpenApiController。
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret', { infer: true }) ?? 'change-me-in-prod',
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [OpenApiController],
  providers: [OpenApiService, OpenApiGuard, RolesGuard],
  exports: [OpenApiService],
})
export class OpenApiModule {}
