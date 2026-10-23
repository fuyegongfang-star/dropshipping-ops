/**
 * 淘宝渠道适配器（任务 2.1，方案 §3 国内渠道接入）。
 * 真实接入：淘宝开放平台(TOP) 订单 API（trade.fullinfo.get / 增量订单）+ 物流回传 API（logistics.trace.push），
 * 需 appKey/appSecret + 卖家会话授权（§17 加密存储于 Shop.authConfig）。
 *
 * 本实现为「无状态演示适配器」：返回淘宝前缀的演示订单，回传/轨迹/查单返回成功桩，
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
export class TaobaoAdapter extends AbstractChannelAdapter {
  constructor(http: RetryableHttpService, logger: AppLogger) {
    // 注册平台代码：淘宝（TAOBAO）；真实部署时由工厂按店铺凭证构建实例
    super(ChannelPlatform.TAOBAO, http, logger)
  }

  /** 拉单：返回 1 条淘宝前缀演示订单（含原始响应 raw 用于落库溯源） */
  async pullOrders(_options: ChannelPullOptions): Promise<PulledChannelOrderResult[]> {
    return [
      {
        order: {
          platformOrderNo: 'TB-1001',
          status: ChannelOrderStatus.PAID,
          items: [{ skuCode: 'SKU-TB-RED', title: '淘宝演示商品-红', quantity: 1 }],
          recipient: {
            name: '淘宝买家',
            phone: '13900000000',
            country: 'CN',
            city: '杭州',
            address1: '淘宝演示地址 1 号',
            zip: '310000',
          },
          currency: 'CNY',
          placedAt: '2026-10-20T10:00:00.000Z',
        },
        // raw 模拟平台原始响应，用于落 Order.raw（JSONB 溯源，§3）
        raw: { id: '1001', note: 'taobao demo raw payload' },
      },
    ]
  }

  /** 拉单确认：淘宝无操作（真实实现应调用确认接口防重复拉取，§9.4） */
  async acknowledgeOrders(_orderNos: string[]): Promise<void> {
    this.logger.debug(`[Taobao] acknowledge ${_orderNos.length} orders (no-op demo)`)
  }

  /** 回传：淘宝直接返回成功，回写运单号 */
  async pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    return {
      platformOrderNo: fulfillment.platformOrderNo,
      success: true,
      trackingNo: fulfillment.trackingNo,
      message: 'taobao fulfilled (demo)',
    }
  }

  /** 查单：淘宝固定返回已支付 */
  async fetchOrderStatus(_platformOrderNo: string): Promise<ChannelOrderStatus> {
    return ChannelOrderStatus.PAID
  }

  /** 撤单：淘宝无操作 */
  async cancelOrder(_platformOrderNo: string): Promise<void> {
    this.logger.debug(`[Taobao] cancel ${_platformOrderNo} (no-op demo)`)
  }

  /** 轨迹：淘宝返回单条节点 */
  async getTracking(platformOrderNo: string): Promise<ChannelTrackingResult> {
    return {
      platformOrderNo,
      trackingNo: `TB-TRK-${platformOrderNo}`,
      status: ChannelOrderStatus.PAID,
      events: [
        {
          status: 'created',
          location: 'Taobao',
          occurredAt: '2026-10-20T12:00:00.000Z',
          description: 'order created (taobao demo)',
        },
      ],
    }
  }
}
