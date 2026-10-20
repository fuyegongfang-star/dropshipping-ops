import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { OpenApiClientContext } from './openapi.types'

/**
 * 开放平台鉴权守卫（任务 5.2，方案 §28）。
 * 校验请求头 `Authorization: Bearer <token>`，验签开放令牌（aud=openapi），
 * 把解析出的客户端上下文挂到 `req.openApiClient`，供资源接口读取与按作用域隔离。
 * 验签失败 / 非开放令牌 → 401。
 */
@Injectable()
export class OpenApiGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const header = req.headers?.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new UnauthorizedException('OPENAPI_TOKEN_MISSING')

    let payload: { sub: string; tenantId: string; scopes: string[]; aud: string }
    try {
      payload = this.jwt.verify(token)
    } catch {
      throw new UnauthorizedException('OPENAPI_TOKEN_INVALID')
    }
    if (payload.aud !== 'openapi') {
      throw new UnauthorizedException('OPENAPI_TOKEN_WRONG_AUD')
    }

    const clientCtx: OpenApiClientContext = {
      clientId: payload.sub,
      tenantId: payload.tenantId,
      scopes: (payload.scopes as OpenApiClientContext['scopes']) ?? [],
    }
    req.openApiClient = clientCtx
    return true
  }
}
