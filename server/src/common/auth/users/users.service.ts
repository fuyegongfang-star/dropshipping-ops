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
   * @returns 命中且密码正确返回用户概要，否则返回 null（不暴露具体失败原因）。
   */
  async validate(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<{ id: string; tenantId: string; email: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    })
    if (!user) return null
    const matched = await bcrypt.compare(password, user.password)
    if (!matched) return null
    return { id: user.id, tenantId: user.tenantId, email: user.email }
  }
}
