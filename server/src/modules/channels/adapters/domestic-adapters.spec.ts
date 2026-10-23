/**
 * 国内渠道适配器单测（任务 2.1，淘宝/抖音，方案 §3）。
 * 验证平台代码、拉单演示数据、回传/轨迹桩与后端同口径；无需真实平台凭证。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { TaobaoAdapter } from './taobao/taobao-adapter'
import { DouyinAdapter } from './douyin/douyin-adapter'
import { RetryableHttpService } from '../../../common/http/retryable-http.service'
import { AppLogger } from '../../../common/logger/app.logger'
import { ChannelPlatform } from '../channel.constants'

/* eslint-disable @typescript-eslint/no-explicit-any */
const fakeHttp: any = { requestJson: jest.fn() }
const fakeLogger: any = { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }

describe('国内渠道适配器（任务 2.1，淘宝/抖音）', () => {
  it('淘宝适配器：平台代码 TAOBAO，拉单返回淘宝前缀演示订单，回传成功回写运单号', async () => {
    const a = new TaobaoAdapter(fakeHttp as RetryableHttpService, fakeLogger as AppLogger)
    expect(a.getPlatform()).toBe(ChannelPlatform.TAOBAO)
    const orders = await a.pullOrders({})
    expect(orders).toHaveLength(1)
    expect(orders[0].order.platformOrderNo.startsWith('TB-')).toBe(true)
    expect(orders[0].order.currency).toBe('CNY')
    expect(orders[0].raw).toBeDefined()
    const f = await a.pushFulfillment({ platformOrderNo: 'TB-1', trackingNo: 'SF123' })
    expect(f.success).toBe(true)
    expect(f.trackingNo).toBe('SF123')
  })

  it('抖音适配器：平台代码 DOUYIN，拉单返回抖音前缀演示订单，轨迹桩带 TRK 前缀', async () => {
    const a = new DouyinAdapter(fakeHttp as RetryableHttpService, fakeLogger as AppLogger)
    expect(a.getPlatform()).toBe(ChannelPlatform.DOUYIN)
    const orders = await a.pullOrders({})
    expect(orders).toHaveLength(1)
    expect(orders[0].order.platformOrderNo.startsWith('DY-')).toBe(true)
    expect(orders[0].order.currency).toBe('CNY')
    const t = await a.getTracking('DY-1')
    expect(t.trackingNo).toContain('DY-TRK-')
    expect(t.events.length).toBeGreaterThan(0)
  })
})
