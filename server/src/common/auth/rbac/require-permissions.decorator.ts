import { SetMetadata } from '@nestjs/common'

/**
 * 接口级权限声明（任务 4.5，§22）。
 * 用法：@RequirePermissions('finance:manage') 或 @RequirePermissions('rbac:manage','tenant:manage')
 * 配合 PermissionsGuard 校验当前用户权限集合是否包含全部所需权限点。
 */
export const REQUIRE_PERMISSIONS_KEY = 'require_permissions'

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions)
