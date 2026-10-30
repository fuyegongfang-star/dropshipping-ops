import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '../public.decorator'

/**
 * 全局鉴权守卫（§17.1，review A1）。
 * 默认要求合法 JWT（Bearer），与既有 JwtStrategy 联动；
 * 标注 @Public() 的路由（登录 / 健康检查 / OAuth 令牌端点）跳过校验。
 * 业务级 RBAC 仍由各控制器上的 @UseGuards(PermissionsGuard) 负责，本守卫只管「是否登录」。
 */
@Injectable()
export class GlobalAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }
    return super.canActivate(context)
  }
}
