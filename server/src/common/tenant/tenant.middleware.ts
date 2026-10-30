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

  /**
   * 综合解析租户（§17.1 安全修正，review A2）：
   *  **已携带合法 JWT 时，以令牌内 tenantId 为准**，忽略客户端自报的 x-tenant-id，
   *  杜绝「伪造请求头冒充租户」的越权。
   *  仅当请求未携带 Bearer 令牌时，才回退到 x-tenant-id/子域名（适用于网关注入租户的可信场景）。
   *  令牌非法/过期，或令牌合法但租户未知：返回 null，交由全局 JwtAuthGuard 拒绝。
   */
  private async resolve(req: Request): Promise<{ id: string; code: string } | null> {
    const auth = req.headers['authorization']
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice(7)
      try {
        const payload = this.jwt.verify<{ tenantId?: string }>(token)
        if (payload?.tenantId) {
          const t = await this.tenants.findIdByCode(payload.tenantId)
          // 令牌合法且租户存在：以认证身份为准（客户端自报头被忽略）
          if (t) return { id: t.id, code: payload.tenantId }
          // 令牌合法但租户未知：拒绝，不回退到客户端自报头（防越权）
          return null
        }
      } catch {
        // 令牌非法/过期：不解析租户，交由 JwtAuthGuard 拒绝
        return null
      }
    }

    // 无 Bearer 令牌：回退到 x-tenant-id / 子域名（仅可信网关场景应使用）
    const headerTenant = req.headers['x-tenant-id']
    const code =
      (typeof headerTenant === 'string' ? headerTenant : headerTenant?.[0]) ??
      this.resolveFromHost(req.hostname)
    if (code) {
      const t = await this.tenants.findIdByCode(code)
      if (t) return { id: t.id, code }
    }
    return null
  }

  /** 从子域名解析租户 code：tenant1.example.com → tenant1 */
  private resolveFromHost(hostname: string): string | undefined {
    const sub = hostname?.split('.')[0]
    return sub && sub !== 'www' && sub !== 'api' ? sub : undefined
  }
}
