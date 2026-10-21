/**
 * AmazonController 单测（方案 §29 控制器 REST 入口 + 租户隔离）。
 * 覆盖：店铺解析、租户隔离（越权 403）、非 Amazon 店铺（400）、各端点透传适配器结果。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-20
 */

import { Test, TestingModule } from '@nestjs/testing'
import { HttpStatus } from '@nestjs/common'
import { AmazonController } from './amazon.controller'
import { AmazonAdapterFactory } from './adapters/amazon/amazon-adapter'
import { PrismaService } from '../../database/prisma.service'

const fakeAdapter = {
  healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 1, message: 'ok' }),
  createInboundShipmentPlan: jest.fn().mockResolvedValue([{ shipmentPlanId: 'P1', destinationFulfillmentCenterId: 'IND9', items: [] }]),
  getSettlementSummary: jest.fn().mockResolvedValue({
    currency: 'USD',
    totalAmount: 100,
    totalFee: 20,
    net: 80,
    transactionCount: 3,
    byType: [],
  }),
}

const factoryMock = { build: jest.fn().mockReturnValue(fakeAdapter) }
const prismaMock = { shop: { findUnique: jest.fn() } }

function shopRow(over: Record<string, unknown> = {}) {
  return { id: 's1', tenantId: 't1', platform: 'amazon', authConfig: {}, ...over }
}

describe('AmazonController（§29 入口 + 租户隔离）', () => {
  let controller: AmazonController

  beforeEach(async () => {
    jest.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AmazonController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: AmazonAdapterFactory, useValue: factoryMock },
      ],
    }).compile()
    controller = module.get(AmazonController)
  })

  it('health：Amazon 店铺且租户匹配 → 返回 ok 健康状态', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(shopRow())
    const res = await controller.health('s1', 't1')
    expect(res.data.healthy).toBe(true)
    expect(factoryMock.build).toHaveBeenCalledTimes(1)
  })

  it('health：租户不匹配 → 403 TENANT_MISMATCH', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(shopRow())
    await expect(controller.health('s1', 'other-tenant')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    })
  })

  it('health：店铺不存在 → 404', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(null)
    await expect(controller.health('x', 't1')).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
  })

  it('health：非 Amazon 店铺 → 400', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(shopRow({ platform: 'shopify' }))
    await expect(controller.health('s1', 't1')).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })

  it('fbaPlan：透传适配器入库计划结果', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(shopRow())
    const res = await controller.fbaPlan('s1', 't1', { items: [{ sellerSku: 'A', quantity: 1 }] })
    expect(res.data[0].shipmentPlanId).toBe('P1')
    expect(fakeAdapter.createInboundShipmentPlan).toHaveBeenCalled()
  })

  it('settlement：透传适配器结算汇总', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(shopRow())
    const res = await controller.settlement('s1', 'D1', 't1')
    expect(res.data.net).toBe(80)
  })
})
