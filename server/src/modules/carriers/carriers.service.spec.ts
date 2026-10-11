/**
 * CarriersService 单测（任务 3.1，方案 §3）。
 * 用 Nest Testing 装配：重写 PrismaService（内存桩）+ 真实注册表 + Mock 适配器。
 * 覆盖：目录读取、健康探测、比价、建单、轨迹、取消、订阅。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Test } from '@nestjs/testing'
import { HttpStatus } from '@nestjs/common'
import { CarriersService } from './carriers.service'
import { CarrierRegistryService } from './carrier-registry.service'
import { MockCarrierAdapter } from './adapters/mock-carrier.adapter'
import { RetryableHttpService } from '../../common/http/retryable-http.service'
import { AppLogger } from '../../common/logger/app.logger'
import { PrismaService } from '../../database/prisma.service'
import { CarrierCode } from './carrier.constants'
import { GetRatesRequest } from './dto/rate.dto'
import { CreateShipmentRequest } from './dto/shipment.dto'

/** 内存桩 Prisma：carrier 表空 → 目录走枚举回退 */
const prismaStub = {
  carrier: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
  carrierAccount: { findFirst: jest.fn() },
}

describe('CarriersService', () => {
  let svc: CarriersService
  let registry: CarrierRegistryService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CarriersService,
        CarrierRegistryService,
        MockCarrierAdapter,
        RetryableHttpService,
        AppLogger,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile()

    svc = moduleRef.get(CarriersService)
    registry = moduleRef.get(CarrierRegistryService)
    registry.registerAdapter(moduleRef.get(MockCarrierAdapter)) // 模拟 onModuleInit 注册
  })

  it('目录：无 Carrier 记录时回退内置枚举（含 MOCK）', async () => {
    const catalog = await svc.listCatalog()
    expect(catalog.some((c) => c.code === CarrierCode.MOCK)).toBe(true)
  })

  it('健康探测：MOCK 实例就绪', async () => {
    const health = await svc.health(CarrierCode.MOCK)
    expect(health.healthy).toBe(true)
  })

  it('健康探测：未注册承运商软失败（不抛异常）', async () => {
    const health = await svc.health(CarrierCode.YUNEXPRESS)
    expect(health.healthy).toBe(false)
  })

  it('比价：经注册表分发到 Mock 适配器', async () => {
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }],
    }
    const quotes = await svc.quote('t1', CarrierCode.MOCK, req)
    expect(quotes[0].carrierCost).toBe(120)
  })

  it('建单：经注册表分发到 Mock 适配器', async () => {
    const req: CreateShipmentRequest = {
      orderRef: 'O9',
      origin: 'SZ',
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    const res = await svc.ship('t1', CarrierCode.MOCK, req)
    expect(res.waybillNo).toBe('MOCK-WB-O9')
  })

  it('轨迹/取消/订阅：实例型适配器正常返回', async () => {
    const t = await svc.track(CarrierCode.MOCK, 'MOCK-TRK-O9')
    expect(t.status).toBe('picked_up')
    await expect(svc.cancel(CarrierCode.MOCK, 'MOCK-WB-O9')).resolves.toBeUndefined()
    await expect(svc.subscribe(CarrierCode.MOCK, 'MOCK-TRK-O9')).resolves.toBeUndefined()
  })

  it('工厂型（未注册）比价抛业务异常', async () => {
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(svc.quote('t1', CarrierCode.YUNEXPRESS, req)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    })
  })
})
