import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { tenantStorage } from './tenant.context'
import { TenantsService } from '../../modules/tenants/tenants.service'

/**
 * 租户解析中间件（方案 §0/§17）。
 * 从子域名或请求头 x-tenant-id 解析租户标识，再查库解析为租户 UUID，注入 AsyncLocalStorage。
 *
 * 安全：生产环境建议由网关注入并校验 x-tenant-id（防伪造），本中间件做应用层兜底；
 * 停用租户不解析（防越权访问被停客户数据）。
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenants: TenantsService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const headerTenant = req.headers['x-tenant-id']
    const code =
      (typeof headerTenant === 'string' ? headerTenant : headerTenant?.[0]) ??
      this.resolveFromHost(req.hostname)

    if (!code) {
      // 未携带租户标识：放行，由需要租户的接口在 TenantGuard 中拦截
      next()
      return
    }

    // 解析 code → UUID；不存在或停用则不注入租户上下文
    const tenant = await this.tenants.findIdByCode(code)
    if (!tenant) {
      next()
      return
    }

    tenantStorage.run({ tenantId: tenant.id, tenantCode: code }, () => next())
  }

  /** 从子域名解析租户 code：tenant1.example.com → tenant1 */
  private resolveFromHost(hostname: string): string | undefined {
    const sub = hostname?.split('.')[0]
    return sub && sub !== 'www' && sub !== 'api' ? sub : undefined
  }
}
