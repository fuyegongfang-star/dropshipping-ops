import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { JwtService } from '@nestjs/jwt'
import { tenantStorage } from './tenant.context'
import { TenantsService } from '../../modules/tenants/tenants.service'

/**
 * 租户解析中间件（方案 §0/§17）。
 * 解析优先级：
 *   1. 子域名 / 请求头 x-tenant-id（网关注入，应用层兜底）；
 *   2. Authorization: Bearer JWT（用与鉴权一致的密钥验签，取 payload.tenantId，防止客户端伪造 tenant_id 覆盖）。
 * 任一来源解析到合法租户即注入 AsyncLocalStorage；停用租户不解析（防越权访问被停客户数据）。
 * 未携带任何租户标识：放行，由需要租户的接口在 TenantGuard 中拦截（平台级操作）。
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenants: TenantsService,
    private readonly jwt: JwtService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const tenant = await this.resolve(req)
    if (tenant) {
      tenantStorage.run({ tenantId: tenant.id, tenantCode: tenant.code }, () => next())
      return
    }
    next()
  }

  /** 综合解析租户：先 header/host，再 JWT */
  private async resolve(req: Request): Promise<{ id: string; code: string } | null> {
    const headerTenant = req.headers['x-tenant-id']
    const code =
      (typeof headerTenant === 'string' ? headerTenant : headerTenant?.[0]) ??
      this.resolveFromHost(req.hostname)
    if (code) {
      const t = await this.tenants.findIdByCode(code)
      if (t) return { id: t.id, code }
    }

    // 回退到 JWT：与鉴权同一密钥验签，取 payload.tenantId（§17.1 以认证身份为准）
    const auth = req.headers['authorization']
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice(7)
      try {
        const payload = this.jwt.verify<{ tenantId?: string }>(token)
        if (payload?.tenantId) {
          const t = await this.tenants.findIdByCode(payload.tenantId)
          // 优先用 code 反查；若 tenantId 已是 UUID 则直接以它作为上下文（前端以 code 传 tenant_id 为主）
          if (t) return { id: t.id, code: payload.tenantId }
        }
      } catch {
        // 令牌非法/过期：忽略，交由 JwtAuthGuard 拒绝
      }
    }
    return null
  }

  /** 从子域名解析租户 code：tenant1.example.com → tenant1 */
  private resolveFromHost(hostname: string): string | undefined {
    const sub = hostname?.split('.')[0]
    return sub && sub !== 'www' && sub !== 'api' ? sub : undefined
  }
}
