import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { ok } from '../../common/response/api-response'
import { Public } from './public.decorator'

/**
 * 登录接口（方案 §0/§22）。
 * 说明：head-start 阶段 tenantId 由登录体传入；生产应改由网关/子域名解析并强制（§17）。
 * 登录端点本身必须公开（@Public），否则无法换取令牌（§17.1，review A1）。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Public()
  async login(
    @Body() dto: { email: string; password: string; tenantId: string },
  ) {
    const { token } = await this.auth.login(dto.email, dto.password, dto.tenantId)
    return ok({ token }, '登录成功')
  }
}
