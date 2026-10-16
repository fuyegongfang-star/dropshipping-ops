import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { AppConfig } from '../../config/configuration'

/**
 * JWT 策略（方案 §0/§22）。
 * 从 Bearer 令牌解析 payload，校验关键字段（tenantId 必填），供 JwtAuthGuard 使用。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwtSecret', { infer: true }) ?? 'change-me-in-prod',
    })
  }

  async validate(payload: { sub: string; tenantId: string; email: string; roles?: string[] }) {
    // 租户信息缺失视为非法令牌（§17 防越权）
    if (!payload?.tenantId) {
      throw new UnauthorizedException('令牌缺少租户信息')
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles ?? [],
    }
  }
}
