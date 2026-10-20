import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { OpenApiClientContext } from './openapi.types'

/**
 * 开放平台客户端装饰器（任务 5.2，方案 §28）。
 * 从请求中提取 OpenApiGuard 注入的开放客户端上下文（clientId/tenantId/scopes），
 * 供资源接口按租户与作用域隔离访问。
 */
export const OpenApiClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OpenApiClientContext | null => {
    const req = ctx.switchToHttp().getRequest()
    return req.openApiClient ?? null
  },
)
