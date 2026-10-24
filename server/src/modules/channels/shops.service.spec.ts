/**
 * 店铺服务单测（任务 6.1，方案 §3 渠道接入）。
 * 用内存 fake Prisma 验证：列表租户隔离 + 新增 + 解绑（归属校验 / 越权 / 不存在）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import { ShopsService } from './shops.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeFakePrisma() {
  const shop: any[] = [
    { id: 's_1', tenantId: 't_demo', platform: 'shopify', name: 'Shopify 美国店', authConfig: null, createdAt: new Date('2026-09-01T08:00:00Z') },
    { id: 's_2', tenantId: 't_acme', platform: 'amazon', name: 'Acme Amazon', authConfig: null, createdAt: new Date('2026-09-05T08:00:00Z') },
  ]
  let seq = 10
  const id = () => `s_${++seq}`

  return {
    shop: {
      findMany: jest.fn(({ where }: any) => shop.filter((s) => !where?.tenantId || s.tenantId === where.tenantId)),
      findUnique: jest.fn(({ where }: any) => shop.find((s) => s.id === where.id) ?? null),
      create: jest.fn(({ data }: any) => {
        const row = { id: id(), createdAt: new Date('2026-10-24T00:00:00Z'), ...data }
        shop.push(row)
        return row
      }),
      delete: jest.fn(({ where }: any) => {
        const i = shop.findIndex((s) => s.id === where.id)
        const [removed] = shop.splice(i, 1)
        return removed
      }),
    },
  }
}

describe('ShopsService (6.1)', () => {
  let svc: ShopsService

  beforeEach(() => {
    svc = new ShopsService(makeFakePrisma() as any)
  })

  it('list 仅返回本租户店铺（隔离）', async () => {
    const rows = await svc.list('t_demo')
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe('s_1')
  })

  it('create 写入 tenantId 并落库', async () => {
    const created = await svc.create('t_demo', { platform: 'mock', name: 'Mock 新店' })
    expect(created.id).toBeDefined()
    expect(created.tenantId).toBe('t_demo')
    expect(created.platform).toBe('mock')
    expect(created.authConfig ?? null).toBeNull()
  })

  it('remove 成功删除本租户店铺', async () => {
    const res = await svc.remove('t_demo', 's_1')
    expect(res.id).toBe('s_1')
  })

  it('remove 店铺不存在 → 404', async () => {
    await expect(svc.remove('t_demo', 's_missing')).rejects.toThrow(BusinessException)
    try {
      await svc.remove('t_demo', 's_missing')
    } catch (e) {
      expect((e as BusinessException).getStatus()).toBe(HttpStatus.NOT_FOUND)
    }
  })

  it('remove 跨租户店铺 → 403 越权', async () => {
    await expect(svc.remove('t_demo', 's_2')).rejects.toThrow(BusinessException)
    try {
      await svc.remove('t_demo', 's_2')
    } catch (e) {
      expect((e as BusinessException).getStatus()).toBe(HttpStatus.FORBIDDEN)
    }
  })
})
