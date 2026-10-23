/**
 * 抖音渠道适配器（任务 2.1，方案 §3 国内渠道接入）。
 * 真实接入：抖音电商开放平台 订单 API（order.list / order.detail）+ 发货回传 API（order.logisticsAdd），
 * 需 appKey/appSecret + 店铺授权码（§17 加密存储于 Shop.authConfig）。
 *
 * 本实现为「无状态演示适配器」：返回抖音前缀的演示订单，回传/轨迹/查单返回成功桩，
 * 使 ChannelAdapter 框架可在无真实凭证情况下完成 2.1 链路验证与本地联调；
 * 真实 API 联调（凭证 + 端点 + 签名）待 2026-11 接入，届时改造为按店铺凭证的工厂型适配器
 * （同 Shopify/Amazon 的 registerFactory 模式）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../../../common/logger/app.logger'
import { RetryableHttpService } from '../../../../common/http/retryable-http.service'
import { AbstractChannelAdapter } from '../../abstract-channel.adapter'
import { ChannelPlatform, ChannelPullOptions, ChannelOrderStatus } from '../../channel.constants'
import { PulledChannelOrderResult } from '../../dto/pulled-order.dto'
import { ChannelFulfillmentDto, ChannelFulfillmentResult, ChannelTrackingResult } from '../../dto/channel-fulfillment.dto'

@Injectable()
export class DouyinAdapter extends AbstractChannelAdapter {
  constructor(http: RetryableHttpService, logger: AppLogger) {
    // 注册平台代码：抖音（DOUYIN）；真实部署时由工厂按店铺凭证构建实例
    super(ChannelPlatform.DOUYIN, http, logger)
  }

  /** 拉单：返回 1 条抖音前缀演示订单（含原始响应 raw 用于落库溯源） */
  async pullOrders(_options: ChannelPullOptions): Promise<PulledChannelOrderResult[]> {
    return [
      {
        order: {
          platformOrderNo: 'DY-1001',
          status: ChannelOrderStatus.PAID,
          items: [{ skuCode: 'SKU-DY-BLUE', title: '抖音演示商品-蓝', quantity: 2 }],
          recipient: {
            name: '抖音买家',
            phone: '13700000000',
            country: 'CN',
            city: '北京',
            address1: '抖音演示地址 2 号',
            zip: '100000',
          },
          currency: 'CNY',
          placedAt: '2026-10-21T09:30:00.000Z',
        },
        // raw 模拟平台原始响应，用于落 Order.raw（JSONB 溯源，§3）
        raw: { id: '1001', note: 'douyin demo raw payload' },
      },
    ]
  }

  /** 拉单确认：抖音无操作（真实实现应调用确认接口防重复拉取，§9.4） */
  async acknowledgeOrders(_orderNos: string[]): Promise<void> {
    this.logger.debug(`[Douyin] acknowledge ${_orderNos.length} orders (no-op demo)`)
  }

  /** 回传：抖音直接返回成功，回写运单号 */
  async pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    return {
      platformOrderNo: fulfillment.platformOrderNo,
      success: true,
      trackingNo: fulfillment.trackingNo,
      message: 'douyin fulfilled (demo)',
    }
  }

  /** 查单：抖音固定返回已支付 */
  async fetchOrderStatus(_platformOrderNo: string): Promise<ChannelOrderStatus> {
    return ChannelOrderStatus.PAID
  }

  /** 撤单：抖音无操作 */
  async cancelOrder(_platformOrderNo: string): Promise<void> {
    this.logger.debug(`[Douyin] cancel ${_platformOrderNo} (no-op demo)`)
  }

  /** 轨迹：抖音返回单条节点 */
  async getTracking(platformOrderNo: string): Promise<ChannelTrackingResult> {
    return {
      platformOrderNo,
      trackingNo: `DY-TRK-${platformOrderNo}`,
      status: ChannelOrderStatus.PAID,
      events: [
        {
          status: 'created',
          location: 'Douyin',
          occurredAt: '2026-10-21T11:00:00.000Z',
          description: 'order created (douyin demo)',
        },
      ],
    }
  }
}
