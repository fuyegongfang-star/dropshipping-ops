import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { getTenantId } from './tenant.context'

/**
 * 控制器参数装饰器：直接注入当前租户 ID。
 * 用法：@TenantId() tenantId: string
 * 便于在控制器层显式拿到租户（多数场景下 Service 通过 getTenantId() 隐式获取即可）。
 */
export const TenantId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | undefined => {
    return getTenantId()
  },
)
