import { Test, TestingModule } from '@nestjs/testing'
import { ReportsService } from './reports.service'

describe('ReportsService（§25 报表指标）', () => {
  let service: ReportsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile()
    service = module.get<ReportsService>(ReportsService)
  })

  it('getDashboard 返回五类指标且字段完整', () => {
    const d = service.getDashboard()
    expect(d).toHaveProperty('fulfillmentSla')
    expect(d).toHaveProperty('logisticsSla')
    expect(d).toHaveProperty('profit')
    expect(d).toHaveProperty('channelDistribution')
    expect(d).toHaveProperty('exceptionRate')
    expect(typeof d.generatedAt).toBe('string')
  })

  it('履约时效：三段 + 整体达成率（几何均值）', () => {
    const { stages, overallAchievedRate } = service.getDashboard().fulfillmentSla
    expect(stages).toHaveLength(3)
    // 0.98 * 0.95 * 0.93 的立方根 ≈ 0.9527
    expect(overallAchievedRate).toBeGreaterThan(0.95)
    expect(overallAchievedRate).toBeLessThan(0.96)
  })

  it('物流时效：四渠道均含平均时效与异常率', () => {
    const channels = service.getDashboard().logisticsSla.channels
    expect(channels).toHaveLength(4)
    channels.forEach((c) => {
      expect(c.avgTransitDays).toBeGreaterThan(0)
      expect(c.exceptionRate).toBeGreaterThanOrEqual(0)
    })
  })

  it('利润：近 6 账期趋势 + 租户/渠道拆解', () => {
    const profit = service.getDashboard().profit
    expect(profit.trend).toHaveLength(6)
    expect(profit.byTenant.length).toBeGreaterThan(0)
    expect(profit.byChannel).toHaveLength(4)
  })

  it('渠道分布：占比之和 ≈ 1', () => {
    const shareSum = service
      .getDashboard()
      .channelDistribution.items.reduce((acc, i) => acc + i.share, 0)
    expect(shareSum).toBeCloseTo(1, 5)
  })

  it('异常率：综合异常率 = 各构成占比之和', () => {
    const ex = service.getDashboard().exceptionRate
    const sum = ex.items.reduce((acc, i) => acc + i.rate, 0)
    expect(ex.overallRate).toBeCloseTo(sum, 5)
  })
})
