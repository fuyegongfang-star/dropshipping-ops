import { Controller, Get } from '@nestjs/common'
import { ok } from '../../common/response/api-response'
import { Public } from '../../common/auth/public.decorator'

/**
 * 健康检查（部署/探活用，方案 §11）。必须公开（§17.1，review A1）。
 */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return ok({ status: 'ok', time: new Date().toISOString() })
  }
}
