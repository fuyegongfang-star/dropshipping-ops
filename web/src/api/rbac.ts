import http from './http'

/** 权限资源分组（任务 4.5，§22） */
export interface PermissionResource {
  group: string
  groupLabel: string
  items: { code: string; label: string }[]
}

/** 作用域维度 */
export interface ScopeDimension {
  code: string
  label: string
}

/** 租户角色（含解析后的权限点） */
export interface RoleOut {
  id: string
  name: string
  scope: string | null
  permissions: string[]
  system: boolean
  createdAt: string
}

/** RBAC 接口（任务 4.5，§22；演示模式由 mock-data 拦截） */
export const rbacApi = {
  /** 权限点目录 + 作用域维度 */
  getCatalog: () => http.get<{ resources: PermissionResource[]; scopes: ScopeDimension[] }>('/rbac/permissions'),
  /** 角色蓝图（系统内置角色 → 默认权限点） */
  getBlueprints: () => http.get<Record<string, string[]>>('/rbac/role-blueprints'),
  /** 当前租户角色列表 */
  getRoles: () => http.get<RoleOut[]>('/rbac/roles'),
  /** 创建租户角色（需 rbac:manage 权限） */
  createRole: (body: { name: string; permissions?: string[]; scope?: string }) =>
    http.post<RoleOut>('/rbac/roles', body),
  /** 为用户分配角色（需 rbac:manage 权限） */
  assignRoles: (userId: string, roleIds: string[]) =>
    http.post<{ assigned: number }>(`/rbac/users/${userId}/roles`, { roleIds }),
}
