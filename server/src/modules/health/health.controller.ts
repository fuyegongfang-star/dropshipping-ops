import { Controller, Get } from '@nestjs/common'
import { ok } from '../../common/response/api-response'

/**
 * 健康检查（部署/探活用，方案 §11）。
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return ok({ status: 'ok', time: new Date().toISOString() })
  }
}
