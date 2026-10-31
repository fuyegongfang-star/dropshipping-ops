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
import { YunExpressAdapter } from './adapters/yunexpress/yunexpress.adapter'
import { DhlAdapter } from './adapters/dhl/dhl.adapter'
import { FourPxAdapter } from './adapters/fourpx/fourpx.adapter'
import { YanwenAdapter } from './adapters/yanwen/yanwen.adapter'
import { RetryableHttpService } from '../../common/http/retryable-http.service'
import { AppLogger } from '../../common/logger/app.logger'
import { PrismaService } from '../../database/prisma.service'
import { TENANT_PRISMA } from '../../common/tenant/tenant-prisma.service'
import { CarrierCode, CarrierCapability } from './carrier.constants'
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
        { provide: TENANT_PRISMA, useValue: prismaStub },
      ],
    }).compile()

    svc = moduleRef.get(CarriersService)
    registry = moduleRef.get(CarrierRegistryService)
    registry.registerAdapter(moduleRef.get(MockCarrierAdapter)) // 模拟 onModuleInit 注册
    // 模拟运行时 CarriersModule.onModuleInit 注册云途工厂（按租户账号构建，§2.2/3.2）
    registry.registerFactory(CarrierCode.YUNEXPRESS, (account) =>
      new YunExpressAdapter(account, moduleRef.get(RetryableHttpService), moduleRef.get(AppLogger)),
    )
    // 模拟运行时注册 DHL 工厂（§2.2/3.3）
    registry.registerFactory(CarrierCode.DHL, (account) =>
      new DhlAdapter(account, moduleRef.get(RetryableHttpService), moduleRef.get(AppLogger)),
    )
    // 模拟运行时注册 4PX / 燕文 工厂（§2.2/3.4，MD5 签名）
    registry.registerFactory(CarrierCode.FOURPX, (account) =>
      new FourPxAdapter(account, moduleRef.get(RetryableHttpService), moduleRef.get(AppLogger)),
    )
    registry.registerFactory(CarrierCode.YANWEN, (account) =>
      new YanwenAdapter(account, moduleRef.get(RetryableHttpService), moduleRef.get(AppLogger)),
    )
  })

  it('目录：无 Carrier 记录时回退内置枚举（含 MOCK）', async () => {
    const catalog = await svc.listCatalog()
    expect(catalog.some((c) => c.code === CarrierCode.MOCK)).toBe(true)
  })

  it('健康探测：MOCK 实例就绪', async () => {
    const health = await svc.health(CarrierCode.MOCK)
    expect(health.healthy).toBe(true)
  })

  it('健康探测：工厂型（云途）构建探针返回就绪（能力声明，未做真实探测）', async () => {
    const health = await svc.health(CarrierCode.YUNEXPRESS)
    expect(health.healthy).toBe(true)
    expect(health.capabilities).toEqual(Object.values(CarrierCapability))
  })

  it('健康探测：工厂型（DHL）能力为 RATE/SHIP/LABEL/TRACK（无 cancel/subscribe，§1.2.2）', async () => {
    const health = await svc.health(CarrierCode.DHL)
    expect(health.healthy).toBe(true)
    expect(health.capabilities).toEqual([
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
    ])
  })

  it('健康探测：工厂型（4PX）能力为 RATE/SHIP/LABEL/TRACK/CANCEL（无 subscribe，§1.2.2）', async () => {
    const health = await svc.health(CarrierCode.FOURPX)
    expect(health.healthy).toBe(true)
    expect(health.capabilities).toEqual([
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
      CarrierCapability.CANCEL,
    ])
  })

  it('健康探测：工厂型（燕文）能力为 SHIP/LABEL/TRACK（无比价/取消/订阅，§1.1/§1.2.2）', async () => {
    const health = await svc.health(CarrierCode.YANWEN)
    expect(health.healthy).toBe(true)
    expect(health.capabilities).toEqual([
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
    ])
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
