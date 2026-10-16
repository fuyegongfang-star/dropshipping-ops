import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard'
import { PermissionsGuard } from '../../common/auth/rbac/permissions.guard'
import { RequirePermissions } from '../../common/auth/rbac/require-permissions.decorator'
import {
  PERMISSION_RESOURCES,
  SCOPE_DIMENSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  ALL_PERMISSIONS,
  type PermissionResource,
} from '../../common/auth/rbac/permissions'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

interface RoleOut {
  id: string
  name: string
  scope: string | null
  permissions: string[]
  system: boolean
  createdAt: string
}

/**
 * RBAC 管理接口（任务 4.5，方案 §22）。
 * 提供权限点目录、租户角色视图，以及角色创建（受 rbac:manage 权限守卫保护，演示接口级 RBAC）。
 */
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly prisma: PrismaService) {}

  /** 权限点目录 + 作用域维度（前端渲染权限矩阵） */
  @Get('permissions')
  getCatalog(): ApiResponse<{
    resources: PermissionResource[]
    scopes: { code: string; label: string }[]
  }> {
    return ok({ resources: PERMISSION_RESOURCES, scopes: SCOPE_DIMENSIONS })
  }

  /** 角色蓝图（系统内置角色 → 默认权限点），便于前端快速建角色 */
  @Get('role-blueprints')
  getBlueprints(): ApiResponse<Record<string, string[]>> {
    return ok(ROLE_PERMISSIONS)
  }

  /** 当前租户的角色列表（含解析后的权限点） */
  @Get('roles')
  async listRoles(@TenantId() tenantId: string): Promise<ApiResponse<RoleOut[]>> {
    const rows = await this.prisma.role.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
    return ok(
      rows.map<RoleOut>((r) => ({
        id: r.id,
        name: r.name,
        scope: r.scope,
        permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
        system: SYSTEM_ROLES.includes(r.name),
        createdAt: r.createdAt.toISOString(),
      })),
    )
  }

  /** 创建租户角色：必须 rbac:manage 权限（演示接口级 RBAC 拦截） */
  @Post('roles')
  @RequirePermissions('rbac:manage')
  async createRole(
    @TenantId() tenantId: string,
    @Body() body: { name: string; permissions?: string[]; scope?: string },
  ): Promise<ApiResponse<RoleOut>> {
    const name = body.name?.trim()
    if (!name) throw new BusinessException('RBAC_ROLE_NAME_REQUIRED', '角色名不能为空', HttpStatus.BAD_REQUEST)
    const perms = (body.permissions ?? []).filter((p) => ALL_PERMISSIONS.includes(p))
    const role = await this.prisma.role.create({
      data: { tenantId, name, scope: body.scope ?? 'all', permissions: perms },
    })
    return ok({
      id: role.id,
      name: role.name,
      scope: role.scope,
      permissions: perms,
      system: false,
      createdAt: role.createdAt.toISOString(),
    })
  }

  /** 为租户用户分配角色：必须 rbac:manage 权限 */
  @Post('users/:userId/roles')
  @RequirePermissions('rbac:manage')
  async assignRoles(
    @TenantId() tenantId: string,
    @Param('userId') userId: string,
    @Body() body: { roleIds: string[] },
  ): Promise<ApiResponse<{ assigned: number }>> {
    const roleIds = body.roleIds ?? []
    let assigned = 0
    for (const roleId of roleIds) {
      const exists = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } })
      if (!exists) continue
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { tenantId, userId, roleId },
        update: {},
      })
      assigned++
    }
    return ok({ assigned })
  }
}
