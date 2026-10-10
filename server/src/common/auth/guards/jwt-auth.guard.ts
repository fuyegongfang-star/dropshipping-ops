import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * JWT 鉴权守卫（方案 §0/§22）。
 * 用法：在控制器或路由上标注 @UseGuards(JwtAuthGuard)，要求合法令牌；
 * 令牌中的 tenantId 将与请求级租户上下文联动，形成「租户 + 用户」双约束。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
