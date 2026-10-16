import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { resolvePermissions } from './permissions'
import { REQUIRE_PERMISSIONS_KEY } from './require-permissions.decorator'

/**
 * 权限守卫（任务 4.5，§22）。
 * 从请求上下文（JWT 解析出的 roles）解出权限集合，校验是否包含接口声明的全部权限点；
 * 任一缺失即 403 拒绝，实现对象级/操作级 RBAC（防越权，§17.4 的接口侧落地）。
 * 未携带 roles 的请求按「无权限」处理（必须登录且分配角色）。
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>()
    const roles = req?.user?.roles ?? []
    const perms = resolvePermissions(roles)
    const ok = required.every((p) => perms.has(p))
    if (!ok) {
      throw new ForbiddenException(`缺少所需权限：${required.join(', ')}`)
    }
    return true
  }
}
