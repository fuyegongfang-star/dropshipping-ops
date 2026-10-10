/**
 * 渠道适配器统一接口（方案 §3 渠道接入：可插拔 ChannelAdapter）。
 * 所有销售平台（Shopify/Amazon/淘宝/抖音/独立站）实现本接口，对外暴露
 * 「拉单 / 审单 / 推单(回传) / 轨迹」能力，由 ChannelRegistryService 按平台注册与分发。
 *
 * 五大能力映射（任务 1.1）：
 *   - pullOrders        拉单：从平台拉取新订单并归一化为 PulledChannelOrderResult
 *   - acknowledgeOrders 拉单确认：告知平台已接收，防止重复拉取（幂等，§9.4）
 *   - pushFulfillment   推单/回传：将运单号回写平台，标记订单已发货
 *   - fetchOrderStatus  查单：查询平台订单/履约状态
 *   - cancelOrder       撤单：通知平台取消订单（逆向流程入口，§13.2）
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { ChannelHealth, ChannelPlatform, ChannelPullOptions, ChannelOrderStatus } from './channel.constants'
import { PulledChannelOrderResult } from './dto/pulled-order.dto'
import {
  ChannelFulfillmentDto,
  ChannelFulfillmentResult,
  ChannelTrackingResult,
} from './dto/channel-fulfillment.dto'

export interface ChannelAdapter {
  /** 渠道平台代码（用于注册表分发） */
  getPlatform(): ChannelPlatform

  /** 健康检查：探测适配器/平台连通性 */
  healthCheck(): Promise<ChannelHealth>

  /** 拉单：从平台拉取订单并归一化（§3 拉单） */
  pullOrders(options: ChannelPullOptions): Promise<PulledChannelOrderResult[]>

  /** 拉单确认：标记已接收，避免重复拉取（幂等，§9.4） */
  acknowledgeOrders(orderNos: string[]): Promise<void>

  /** 推单/回传：将运单号回写平台（§3 推单回传） */
  pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult>

  /** 查单：查询平台订单状态 */
  fetchOrderStatus(platformOrderNo: string): Promise<ChannelOrderStatus>

  /** 撤单：通知平台取消（逆向流程入口，§13.2） */
  cancelOrder(platformOrderNo: string): Promise<void>

  /** 轨迹：查询平台侧订单/物流轨迹（§3 轨迹） */
  getTracking(platformOrderNo: string): Promise<ChannelTrackingResult>
}
