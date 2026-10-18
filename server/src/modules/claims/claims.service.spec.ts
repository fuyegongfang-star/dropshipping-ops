import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ClaimsService } from './claims.service'

describe('ClaimsService（§20 理赔）', () => {
  let service: ClaimsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaimsService],
    }).compile()
    service = module.get<ClaimsService>(ClaimsService)
  })

  it('种子数据按租户隔离：t_demo 返回 4 条，其他租户返回 0', () => {
    expect(service.list('t_demo')).toHaveLength(4)
    expect(service.list('t_other')).toHaveLength(0)
  })

  it('列表支持状态筛选', () => {
    const open = service.list('t_demo', { status: 'open' })
    expect(open.length).toBeGreaterThan(0)
    open.forEach((c) => expect(c.status).toBe('open'))
  })

  it('新建理赔默认状态为 open 且归属当前租户', () => {
    const c = service.create('t_demo', { shipmentId: 'sh_x', type: 'lost', amount: '99.5' })
    expect(c.status).toBe('open')
    expect(c.tenantId).toBe('t_demo')
    expect(c.amount).toBe(99.5)
    expect(service.get('t_demo', c.id).id).toBe(c.id)
  })

  it('推进状态：open → approved', () => {
    const c = service.create('t_demo', { shipmentId: 'sh_y', type: 'damage' })
    const updated = service.updateStatus('t_demo', c.id, { status: 'approved', note: '通过' })
    expect(updated.status).toBe('approved')
    expect(updated.note).toBe('通过')
  })

  it('跨租户访问抛 NotFound', () => {
    const c = service.create('t_demo', { shipmentId: 'sh_z', type: 'delay' })
    expect(() => service.get('t_other', c.id)).toThrow(NotFoundException)
  })
})
