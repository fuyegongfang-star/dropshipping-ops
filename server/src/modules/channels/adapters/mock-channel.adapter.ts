/**
 * Mock 渠道适配器（仅用于开发与测试，无真实平台）。
 * 提供固定测试订单与回传/轨迹桩实现，使 ChannelAdapter 框架（任务 1.1）可在
 * 无真实 API 凭证情况下被单元测试与本地联调验证；真实平台适配器在 1.2+ 实现后注册。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { RetryableHttpService } from '../../../common/http/retryable-http.service'
import { AbstractChannelAdapter } from '../abstract-channel.adapter'
import { ChannelHealth, ChannelPlatform, ChannelPullOptions, ChannelOrderStatus } from '../channel.constants'
import { PulledChannelOrderResult } from '../dto/pulled-order.dto'
import {
  ChannelFulfillmentDto,
  ChannelFulfillmentResult,
  ChannelTrackingResult,
} from '../dto/channel-fulfillment.dto'

@Injectable()
export class MockChannelAdapter extends AbstractChannelAdapter {
  constructor(http: RetryableHttpService, logger: AppLogger) {
    // 注册平台代码固定为 MOCK，仅用于测试；不对应任何真实平台
    super(ChannelPlatform.MOCK, http, logger)
  }

  /** 拉单：返回 2 条固定测试订单（含原始响应 raw 用于落库溯源） */
  async pullOrders(_options: ChannelPullOptions): Promise<PulledChannelOrderResult[]> {
    return [
      {
        order: {
          platformOrderNo: 'MOCK-1001',
          status: ChannelOrderStatus.PAID,
          items: [
            { skuCode: 'SKU-RED-TEE', title: '红色 T 恤', quantity: 2 },
            { skuCode: 'SKU-BLUE-HAT', title: '蓝色帽子', quantity: 1 },
          ],
          recipient: {
            name: 'Test Buyer',
            phone: '13800000000',
            country: 'US',
            city: 'Los Angeles',
            address1: '123 Mock St',
            zip: '90001',
          },
          currency: 'USD',
          placedAt: '2026-10-10T10:00:00.000Z',
        },
        // raw 模拟平台原始响应，用于落 Order.raw（JSONB 溯源，§3）
        raw: { id: '1001', note: 'mock raw payload' },
      },
      {
        order: {
          platformOrderNo: 'MOCK-1002',
          status: ChannelOrderStatus.PAID,
          items: [{ skuCode: 'SKU-GREEN-BAG', title: '绿色包', quantity: 1 }],
          recipient: {
            name: 'Test Buyer2',
            country: 'GB',
            city: 'London',
            address1: '456 Mock Ave',
            zip: 'SW1A 1AA',
          },
          currency: 'GBP',
          placedAt: '2026-10-10T11:00:00.000Z',
        },
        raw: { id: '1002', note: 'mock raw payload' },
      },
    ]
  }

  /** 拉单确认：Mock 无操作（真实平台实现应调用确认接口防重复拉取） */
  async acknowledgeOrders(_orderNos: string[]): Promise<void> {
    this.logger.debug(`[Mock] acknowledge ${_orderNos.length} orders (no-op)`)
  }

  /** 回传：Mock 直接返回成功，回写运单号 */
  async pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    return {
      platformOrderNo: fulfillment.platformOrderNo,
      success: true,
      trackingNo: fulfillment.trackingNo,
      message: 'mock fulfilled',
    }
  }

  /** 查单：Mock 固定返回已支付 */
  async fetchOrderStatus(_platformOrderNo: string): Promise<ChannelOrderStatus> {
    return ChannelOrderStatus.PAID
  }

  /** 撤单：Mock 无操作 */
  async cancelOrder(_platformOrderNo: string): Promise<void> {
    this.logger.debug(`[Mock] cancel ${_platformOrderNo} (no-op)`)
  }

  /** 轨迹：Mock 返回单条节点 */
  async getTracking(platformOrderNo: string): Promise<ChannelTrackingResult> {
    return {
      platformOrderNo,
      trackingNo: `MOCK-TRK-${platformOrderNo}`,
      status: ChannelOrderStatus.PAID,
      events: [
        {
          status: 'created',
          location: 'Mock Warehouse',
          occurredAt: '2026-10-10T12:00:00.000Z',
          description: 'order created (mock)',
        },
      ],
    }
  }

  /** 健康检查：Mock 就绪 */
  async healthCheck(): Promise<ChannelHealth> {
    return { healthy: true, message: 'mock adapter ready' }
  }
}
