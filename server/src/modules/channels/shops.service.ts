/**
 * 店铺查询服务（配套前端「渠道中心」可视化）。
 * 按 tenantId 过滤，演示多店铺/多渠道归属（§3）。
 *
 * 负责人：人工补开发（可视化闭环）｜ 创建：2026-10-11
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 租户下的店铺列表（渠道来源） */
  list(tenantId: string) {
    return this.prisma.shop.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
