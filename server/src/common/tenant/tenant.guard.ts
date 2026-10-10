import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { getTenantId } from './tenant.context'

/**
 * 租户必填守卫（方案 §17 防越权）。
 * 标注 @UseGuards(TenantGuard) 的接口，若请求上下文无有效租户则直接拒绝。
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return !!getTenantId()
  }
}
