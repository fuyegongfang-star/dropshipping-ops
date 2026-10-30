import { SetMetadata } from '@nestjs/common'

/**
 * 公开路由标记（§17.1，review A1）。
 * 标注 @Public() 的控制器/路由不受全局 JwtAuthGuard 约束，
 * 用于登录、健康检查、OAuth 令牌端点等本就无需用户 JWT 的入口。
 */
export const IS_PUBLIC_KEY = 'isPublic'

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
