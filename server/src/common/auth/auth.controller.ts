import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { ok } from '../../common/response/api-response'

/**
 * 登录接口（方案 §0/§22）。
 * 说明：head-start 阶段 tenantId 由登录体传入；生产应改由网关/子域名解析并强制（§17）。
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: { email: string; password: string; tenantId: string },
  ) {
    const { token } = await this.auth.login(dto.email, dto.password, dto.tenantId)
    return ok({ token }, '登录成功')
  }
}
