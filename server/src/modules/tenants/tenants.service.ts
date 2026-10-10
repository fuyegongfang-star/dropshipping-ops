import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

/**
 * 租户服务（方案 §0/§17）。
 * 关键示范：所有查询基于 tenantId 过滤；行级隔离不依赖调用方自觉。
 * 同时提供 code→UUID 解析，供 TenantMiddleware 在请求级注入租户上下文。
 */
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析租户标识 code → UUID（仅供 TenantMiddleware 在请求入口调用）。
   * 已停用租户返回 null（§17 防越权/防访问被停客户数据）。
   */
  async findIdByCode(code: string): Promise<{ id: string } | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code },
      select: { id: true, status: true },
    })
    if (!tenant || tenant.status !== 'active') return null
    return { id: tenant.id }
  }

  /** 租户列表（演示用，生产需超管权限，§22） */
  async list(): Promise<unknown[]> {
    return this.prisma.tenant.findMany({
      select: { id: true, name: true, code: true, status: true },
    })
  }

  /** 创建租户（演示用） */
  async create(name: string, code: string): Promise<unknown> {
    return this.prisma.tenant.create({ data: { name, code } })
  }
}
