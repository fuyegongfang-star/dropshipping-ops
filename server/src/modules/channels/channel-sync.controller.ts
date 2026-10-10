/**
 * 渠道同步控制器（任务 1.1/1.2 拉单 REST 入口，方案 §3/§11）。
 * 提供：按店铺拉单、已注册平台列表、按店铺健康检查。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { PrismaService } from '../../database/prisma.service'
import { ChannelSyncService } from './channel-sync.service'
import { ChannelRegistryService } from './channel-registry.service'
import { ChannelPlatform, ChannelHealth, ChannelPullSummary } from './channel.constants'
import { ChannelPullOptionsDto } from './dto/channel-pull-options.dto'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

@Controller('channels')
export class ChannelSyncController {
  constructor(
    private readonly sync: ChannelSyncService,
    private readonly registry: ChannelRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  /** 按店铺拉单并落库（§3 拉单） */
  @Post(':shopId/pull')
  async pull(
    @Param('shopId') shopId: string,
    @Body() body?: ChannelPullOptionsDto,
  ): Promise<ApiResponse<ChannelPullSummary>> {
    const summary = await this.sync.pullAndStore(shopId, body ?? {})
    return ok(summary)
  }

  /** 已注册渠道平台列表（实例 + 工厂去重） */
  @Get('platforms')
  listPlatforms(): ApiResponse<ChannelPlatform[]> {
    return ok(this.registry.listPlatforms())
  }

  /** 按店铺健康检查：解析适配器（含凭证）并探测连通性 */
  @Get(':shopId/health')
  async health(@Param('shopId') shopId: string): Promise<ApiResponse<ChannelHealth>> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, tenantId: true, platform: true, authConfig: true },
    })
    if (!shop) {
      throw new BusinessException('SHOP_NOT_FOUND', '店铺不存在', HttpStatus.NOT_FOUND)
    }
    const health = await this.registry.resolveForShop(shop).healthCheck()
    return ok(health)
  }
}
