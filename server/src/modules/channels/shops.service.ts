/**
 * 店铺查询服务（配套前端「渠道中心」可视化）。
 * 按 tenantId 过滤，演示多店铺/多渠道归属（§3）。
 *
 * 负责人：人工补开发（可视化闭环）｜ 创建：2026-10-11
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { Prisma } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

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

  /**
   * 新增店铺（渠道绑定，§3）。tenantId 来自租户上下文（§0/§17 隔离），
   * authConfig 默认 null（演示态无需凭证即可拉单）。
   */
  create(
    tenantId: string,
    dto: { platform: string; name: string; authConfig?: Record<string, unknown> | null },
  ) {
    // authConfig 为 Json? 字段：传值则写入（按 Prisma InputJsonValue 约束转型），null/未传则不写（DB 默认 null）。
    const data: Prisma.ShopCreateInput = {
      tenantId,
      platform: dto.platform,
      name: dto.name,
    }
    if (dto.authConfig != null) {
      data.authConfig = dto.authConfig as unknown as Prisma.InputJsonValue
    }
    return this.prisma.shop.create({ data })
  }

  /**
   * 解绑店铺：先校验归属（同租户），再删除。
   * 不属本租户 → 403 越权；不存在 → 404，避免 IDOR 误删（§17.4）。
   */
  async remove(tenantId: string, id: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id } })
    if (!shop) {
      throw new BusinessException('SHOP_NOT_FOUND', '店铺不存在', HttpStatus.NOT_FOUND)
    }
    if (shop.tenantId !== tenantId) {
      throw new BusinessException('SHOP_FORBIDDEN', '无权操作其他租户的店铺', HttpStatus.FORBIDDEN)
    }
    await this.prisma.shop.delete({ where: { id } })
    return { id }
  }
}
