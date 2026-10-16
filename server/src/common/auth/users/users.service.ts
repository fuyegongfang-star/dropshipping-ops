import { Injectable } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../../../database/prisma.service'

/**
 * 用户服务（最小实现，供鉴权使用；完整用户/角色管理见阶段4，§22）。
 * 安全：密码经 bcrypt 哈希存储，校验时仅比对哈希，明文永不落库（§17）。
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 校验账号密码。
   * @returns 命中且密码正确返回用户概要（含角色名列表，供 RBAC 解析权限，§22），否则返回 null。
   */
  async validate(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<{ id: string; tenantId: string; email: string; roles: string[] } | null> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    })
    if (!user) return null
    const matched = await bcrypt.compare(password, user.password)
    if (!matched) return null
    const links = await this.prisma.userRole.findMany({ where: { tenantId, userId: user.id } })
    const roleIds = links.map((l) => l.roleId)
    const roleRows =
      roleIds.length > 0
        ? await this.prisma.role.findMany({ where: { tenantId, id: { in: roleIds } } })
        : []
    const roles = roleRows.map((r) => r.name)
    return { id: user.id, tenantId: user.tenantId, email: user.email, roles }
  }
}
