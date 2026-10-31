import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'

/**
 * 角色守卫（任务 9.5，review A6）。
 * 从请求上下文（全局 JWT 守卫注入的 req.user.roles）读取当前用户角色，
 * 校验是否包含接口声明的任一角色；全部缺失即 403 拒绝。
 * 未携带 roles（理论上已被全局守卫拦截）按「无角色」处理，拒绝放行。
 *
 * 与 PermissionsGuard 的区别：本守卫按「角色名」粗粒度校验（如平台管理员 super），
 * 适用于仅需区分平台运营方 / 商户租户的管理类接口（如开放平台客户端管理）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>()
    const roles = req?.user?.roles ?? []
    const ok = required.some((r) => roles.includes(r))
    if (!ok) {
      throw new ForbiddenException(`需要角色权限：${required.join(' / ')}`)
    }
    return true
  }
}
