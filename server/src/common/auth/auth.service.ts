import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from './users/users.service'

/**
 * 鉴权服务（方案 §0/§22）。
 * 登录：校验 tenantId+email+password，成功后签发携带 tenantId 与 sub 的 JWT（租户绑定）。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * 登录签发令牌。
   * @param tenantId 租户 ID（由调用方从请求上下文或登录体获得）
   */
  async login(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<{ token: string }> {
    const user = await this.users.validate(email, password, tenantId)
    if (!user) throw new UnauthorizedException('账号或密码错误')

    // 令牌绑定租户与角色（§0/§17 数据隔离；§22 RBAC 接口级权限校验）
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: user.roles,
    }
    return { token: await this.jwt.signAsync(payload) }
  }
}
