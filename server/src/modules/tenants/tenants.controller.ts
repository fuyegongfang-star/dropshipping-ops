import { Body, Controller, Get, Post } from '@nestjs/common'
import { TenantsService } from './tenants.service'
import { ok } from '../../common/response/api-response'

/**
 * 租户管理接口（演示多租户模式，§0/§17）。
 * 生产环境需超管鉴权（§22），此处仅示范结构。
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Get()
  async list() {
    return ok(await this.svc.list())
  }

  @Post()
  async create(@Body() body: { name: string; code: string }) {
    return ok(await this.svc.create(body.name, body.code))
  }
}
