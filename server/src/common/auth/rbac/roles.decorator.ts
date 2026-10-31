import { SetMetadata } from '@nestjs/common'

/**
 * 角色守卫声明（任务 9.5，review A6）。
 * 用法：@Roles('super') 或 @Roles('super', 'super_admin')
 * 配合 RolesGuard 校验当前登录用户（JWT 解析出的 roles）是否包含所列角色之一；
 * 全部缺失即 403 拒绝（防越权，§17.4 接口侧落地）。
 */
export const ROLES_KEY = 'require_roles'

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)
