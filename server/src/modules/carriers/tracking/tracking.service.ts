/**
 * 轨迹双通道 + NDR 服务（任务 3.11，方案 §3/§6/§20）。
 *
 * 双通道（§6）：优先用承运商「推送订阅」能力（如云途 webhook）；不支持推送的承运商（DHL/4PX/燕文）
 * 走「轮询」兜底。两者并存时推送为实时、轮询为兜底刷新。
 *
 * NDR（§20）：对归一化轨迹状态做异常识别（exception / cancelled / 长时间停留），产出 NDR 报告，
 * 供上层自动建理赔工单草稿（§20 claims，待阶段4 落地，此处仅产出报告）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { Injectable } from '@nestjs/common'
import { CarriersService } from '../carriers.service'
import { CarrierCapability, CarrierCode } from '../carrier.constants'
import { CarrierTrackingStatus } from '../dto/tracking.dto'
import { TrackingEnvelope, NdrReport, TrackingChannel } from './tracking.types'

/** 视为异常的归一化状态 */
const EXCEPTION_STATUSES = new Set<CarrierTrackingStatus>([
  CarrierTrackingStatus.EXCEPTION,
  CarrierTrackingStatus.CANCELLED,
])

@Injectable()
export class TrackingService {
  constructor(private readonly carriers: CarriersService) {}

  /** 查询轨迹（双通道）+ NDR 识别 */
  async track(tenantId: string, code: CarrierCode, trackingNo: string): Promise<TrackingEnvelope> {
    // 解析适配器以判定通道（推送/轮询）
    const adapter = await this.carriers.resolveAdapter(tenantId, code)
    const caps = adapter.getCapabilities()
    const canPush = caps.includes(CarrierCapability.SUBSCRIBE)
    const channel: TrackingChannel = canPush ? 'push' : 'poll'

    // 双通道：支持推送则尝试注册订阅（实时），轮询始终兜底取最新
    let subscribed = false
    if (canPush) {
      try {
        await adapter.subscribeTracking(trackingNo)
        subscribed = true
      } catch {
        subscribed = false // 订阅失败不阻断，轮询兜底
      }
    }

    const tracking = await this.carriers.track(code, trackingNo)
    const ndr = this.detectNdr(tracking.status, tracking.events)

    return {
      tracking,
      channel,
      subscribed,
      ndr,
      queriedAt: new Date().toISOString(),
    }
  }

  /** NDR 异常识别（§20） */
  private detectNdr(
    status: CarrierTrackingStatus,
    events: { status: CarrierTrackingStatus; description?: string }[],
  ): NdrReport {
    const isException = EXCEPTION_STATUSES.has(status)
    const exceptionEvents = events.filter((e) => EXCEPTION_STATUSES.has(e.status))
    if (!isException && exceptionEvents.length === 0) {
      return {
        detected: false,
        severity: 'info',
        events: [],
        recommendedAction: '轨迹正常，无需处理',
      }
    }
    const descriptions = exceptionEvents.map((e) => e.description ?? e.status)
    const severity = status === CarrierTrackingStatus.CANCELLED ? 'warning' : 'critical'
    return {
      detected: true,
      severity,
      events: descriptions,
      recommendedAction:
        severity === 'critical'
          ? '建议转人工并建理赔工单（§20 claims）'
          : '订单已取消，确认是否需重投或退款',
    }
  }
}
