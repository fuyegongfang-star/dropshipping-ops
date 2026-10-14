/**
 * 轨迹双通道 + NDR 单测（任务 3.11，方案 §3/§6/§20）。
 * 用桩 CarriersService 验证：推送/轮询通道判定、NDR 异常识别。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { TrackingService } from './tracking.service'
import { CarrierCode, CarrierCapability } from '../carrier.constants'
import { CarrierTrackingStatus } from '../dto/tracking.dto'

/** 桩 CarriersService：按 carrierCode 返回带能力的适配器与固定轨迹 */
function makeCarriers(canSubscribe: boolean) {
  const adapter = {
    getCapabilities: () => (canSubscribe ? [CarrierCapability.SUBSCRIBE, CarrierCapability.TRACK] : [CarrierCapability.TRACK]),
    subscribeTracking: jest.fn().mockResolvedValue(undefined),
    getTracking: jest.fn((no: string) => ({
      trackingNo: no,
      carrierCode: CarrierCode.MOCK,
      status: /ndr/i.test(no) ? CarrierTrackingStatus.EXCEPTION : CarrierTrackingStatus.PICKED_UP,
      events: [
        { status: CarrierTrackingStatus.PICKED_UP, description: 'picked up' },
        ...(/ndr/i.test(no)
          ? [{ status: CarrierTrackingStatus.EXCEPTION, description: '清关失败' }]
          : []),
      ],
    })),
  }
  return {
    resolveAdapter: jest.fn().mockResolvedValue(adapter),
    track: jest.fn((_c: string, no: string) => Promise.resolve(adapter.getTracking(no))),
    _adapter: adapter,
  }
}

describe('TrackingService (§3/§6/§20)', () => {
  it('支持订阅的承运商走推送通道并注册订阅', async () => {
    const carriers = makeCarriers(true) as never
    const svc = new TrackingService(carriers)
    const env = await svc.track('t1', CarrierCode.MOCK, 'TRK-1')
    expect(env.channel).toBe('push')
    expect(env.subscribed).toBe(true)
    expect(env.ndr.detected).toBe(false)
  })

  it('不支持订阅的承运商走轮询通道', async () => {
    const carriers = makeCarriers(false) as never
    const svc = new TrackingService(carriers)
    const env = await svc.track('t1', CarrierCode.MOCK, 'TRK-2')
    expect(env.channel).toBe('poll')
    expect(env.subscribed).toBe(false)
  })

  it('轨迹号含 NDR 哨兵时识别异常并给出理赔建议', async () => {
    const carriers = makeCarriers(true) as never
    const svc = new TrackingService(carriers)
    const env = await svc.track('t1', CarrierCode.MOCK, 'TRK-NDR-3')
    expect(env.ndr.detected).toBe(true)
    expect(env.ndr.severity).toBe('critical')
    expect(env.ndr.recommendedAction).toContain('理赔工单')
  })
})
