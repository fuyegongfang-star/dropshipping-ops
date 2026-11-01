/**
 * 物流回传与轨迹服务（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常 / §21 供应商代发协同）。
 *
 * 职责：
 *  1. book   —— 为订单向承运商建单（复用 carriers 层 createShipment），落库 Shipment + ShipmentLeg + 首条轨迹事件。
 *  2. fulfill—— 将运单号回写销售渠道（pushFulfillment，§3 推单回传），并推进订单状态机至 pushed。
 *  3. recordTracking —— 写入轨迹节点（Webhook/轮询入口），按映射推进订单状态（§6）。
 *  4. listTracking / list —— 轨迹时间线查询与运单列表。
 *
 * 设计要点：
 *  - 复用 CarriersService.ship（统一承运商建单）与 ChannelRegistryService（店铺→渠道适配器）与
 *    OrderStateMachineService（订单状态机），不重复造轮子（§3/§13）。
 *  - 数据模型为标量外键（无 Prisma 关系字段），关联行均按外键手动查询（§7 约定）。
 *  - 订单状态推进一律「best-effort」：渠道回传或轨迹推进失败不阻断主流程，仅记录日志（看门狗，§0/§31）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-22
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import { PrismaService } from '../../database/prisma.service'
import { CarriersService } from '../carriers/carriers.service'
import { CarrierCode } from '../carriers/carrier.constants'
import { LegType, CargoType, ParcelDto } from '../carriers/dto/rate.dto'
import { CreateShipmentRequest, CustomsDto, CarrierRecipientDto } from '../carriers/dto/shipment.dto'
import { ChannelRegistryService, ShopCredentialContext } from '../channels/channel-registry.service'
import { ChannelFulfillmentDto } from '../channels/dto/channel-fulfillment.dto'
import { OrderStateMachineService } from '../orders/order-state-machine.service'
import { OrderStatus } from '../orders/order.constants'
import { BookShipmentDto, RecordTrackingDto, ShipmentVo, LegVo, TrackingVo } from './shipment.types'

/** 轨迹节点状态 → 订单状态映射（§6 基础轨迹驱动订单状态机） */
const TRACKING_TO_ORDER_STATUS: Record<string, OrderStatus> = {
  picked_up: OrderStatus.PICKED_UP,
  in_transit: OrderStatus.IN_TRANSIT,
  customs_clearing: OrderStatus.CUSTOMS_CLEARING,
  out_for_delivery: OrderStatus.OUT_FOR_DELIVERY,
  delivered: OrderStatus.DELIVERED,
  exception: OrderStatus.EXCEPTION,
}

/** 承运商建单结果中单段运单的归一化结构（含两段式） */
interface CarrierLegLite {
  legType: string
  carrierCode?: string
  carrierName?: string
  waybillNo?: string
  trackingNo?: string
  carrierCost?: number | null // 建单成本可能为 null（成本待回传，§9 C1）
  currency?: string
}

/** 订单投影（用于建单请求构造） */
interface OrderProjection {
  id: string
  platformOrderNo: string
  recipient?: unknown
}

/** 订单项（含已查询到的 SKU 信息） */
interface EnrichedItem {
  sku?: { weightG?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null } | null
}

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carriers: CarriersService,
    private readonly channels: ChannelRegistryService,
    private readonly orderSM: OrderStateMachineService,
    private readonly logger: AppLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. 建单：向承运商下单并落库
  // ---------------------------------------------------------------------------

  /** 为订单建单（§3 createShipment / §21 供应商代发前置） */
  async book(dto: BookShipmentDto, tenantId: string): Promise<ShipmentVo> {
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, tenantId } })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '订单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id, tenantId } })
    const enriched: EnrichedItem[] = await Promise.all(
      items.map(async (it) => ({
        sku: it.skuId ? await this.prisma.sku.findUnique({ where: { id: it.skuId } }) : null,
      })),
    )

    const carrierCode = (dto.carrierCode ?? CarrierCode.MOCK) as CarrierCode
    const legType = dto.legType ?? LegType.DIRECT

    const req = this.buildCarrierRequest(order as unknown as OrderProjection, enriched, dto, legType, carrierCode)
    const result = await this.carriers.ship(tenantId, carrierCode, req)

    const carrier = await this.prisma.carrier.findUnique({ where: { code: carrierCode } })
    const carrierId = carrier?.id

    // 落库运单（§7 Shipment 模型）
    const shipment = await this.prisma.shipment.create({
      data: {
        tenantId,
        orderId: order.id,
        carrierId: carrierId ?? null,
        selectedQuoteId: order.selectedQuoteId,
        trackingNo: result.trackingNo ?? result.waybillNo,
        status: 'booked',
        carrierCost: result.carrierCost != null ? new Prisma.Decimal(result.carrierCost) : null,
        customs: dto.customs ? (dto.customs as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    // 两段式建单（result.legs）优先；否则按入参单段落库（§14）
    const legs: CarrierLegLite[] = result.legs?.length
      ? result.legs.map((l) => ({
          legType: l.legType,
          carrierCode: l.carrierCode,
          carrierName: l.carrierName,
          waybillNo: l.waybillNo,
          trackingNo: l.trackingNo,
          carrierCost: l.carrierCost,
          currency: l.currency,
        }))
      : [
          {
            legType,
            carrierCode,
            carrierName: carrier?.name,
            waybillNo: result.waybillNo,
            trackingNo: result.trackingNo ?? result.waybillNo,
            carrierCost: result.carrierCost,
            currency: result.currency,
          },
        ]

    for (const leg of legs) {
      await this.prisma.shipmentLeg.create({
        data: {
          tenantId,
          shipmentId: shipment.id,
          legType: leg.legType,
          carrierId: carrierId ?? null,
          trackingNo: leg.trackingNo ?? leg.waybillNo ?? null,
          status: 'booked',
        },
      })
    }

    // 首条轨迹事件：已建单（§6 tracking_events）
    await this.appendTracking(shipment.id, tenantId, {
      status: 'booked',
      location: this.recipientCity(order),
      description: `已向 ${carrier?.name ?? carrierCode} 下单`,
      occurredAt: new Date().toISOString(),
      legType,
    })

    const savedLegs = await this.prisma.shipmentLeg.findMany({ where: { shipmentId: shipment.id } })
    return this.shipmentToVo(shipment, savedLegs, carrier ?? null)
  }

  // ---------------------------------------------------------------------------
  // 2. 回传：将运单号推回销售渠道并推进订单状态
  // ---------------------------------------------------------------------------

  /** 推单回传（§3 pushFulfillment）：将运单号回写平台，标记订单已发货 */
  async fulfill(shipmentId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, tenantId } })
    if (!shipment) {
      throw new BusinessException('SHIPMENT_NOT_FOUND', '运单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const order = await this.prisma.order.findUnique({ where: { id: shipment.orderId } })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '关联订单不存在', HttpStatus.NOT_FOUND)
    }
    const shop = await this.prisma.shop.findUnique({ where: { id: order.shopId } })
    const legs = await this.prisma.shipmentLeg.findMany({ where: { shipmentId: shipment.id } })
    const carrierName = await this.carrierName(shipment.carrierId ?? undefined)

    // 解析渠道适配器并向平台回传运单号（best-effort）
    let success = true
    let message = 'ok'
    try {
      const ctx: ShopCredentialContext = {
        id: shop!.id,
        tenantId: shop!.tenantId,
        platform: shop!.platform,
        authConfig: shop!.authConfig ?? undefined,
      }
      const adapter = this.channels.resolveForShop(ctx)
      const fulfillment: ChannelFulfillmentDto = {
        platformOrderNo: order.platformOrderNo,
        trackingNo: shipment.trackingNo ?? '',
        carrierName,
      }
      const res = await adapter.pushFulfillment(fulfillment)
      success = res.success
      message = res.message ?? 'ok'
    } catch (err) {
      // 渠道回传失败不阻断主流程，记录日志后继续（看门狗）
      this.logger.warn(`回传平台失败 shipment=${shipmentId}: ${(err as Error).message}`, 'Shipments')
      success = false
      message = `回传失败: ${(err as Error).message}`
    }

    // 推进订单状态机 approved → pushed（best-effort）
    try {
      await this.orderSM.transition(order.id, OrderStatus.PUSHED, 'shipments.fulfill')
    } catch (err) {
      this.logger.warn(`订单状态推进 pushed 失败 order=${order.id}: ${(err as Error).message}`, 'Shipments')
    }

    await this.appendTracking(shipment.id, tenantId, {
      status: 'pushed',
      location: carrierName,
      description: `已回传平台 ${shop!.platform}`,
      occurredAt: new Date().toISOString(),
      legType: legs[0]?.legType,
    })
    await this.prisma.shipment.update({ where: { id: shipment.id }, data: { status: 'pushed' } })

    return { success, message }
  }

  // ---------------------------------------------------------------------------
  // 3. 轨迹：写入节点并按映射推进订单状态
  // ---------------------------------------------------------------------------

  /** 写入一条轨迹节点（Webhook/轮询入口，§6 基础轨迹） */
  async recordTracking(dto: RecordTrackingDto, tenantId: string): Promise<TrackingVo> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: dto.shipmentId, tenantId } })
    if (!shipment) {
      throw new BusinessException('SHIPMENT_NOT_FOUND', '运单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const order = await this.prisma.order.findUnique({ where: { id: shipment.orderId } })
    const legs = await this.prisma.shipmentLeg.findMany({ where: { shipmentId: shipment.id } })

    const evt = await this.appendTracking(shipment.id, tenantId, {
      status: dto.status,
      location: dto.location,
      description: dto.description,
      occurredAt: dto.occurredAt ?? new Date().toISOString(),
      legType: legs[0]?.legType,
    })

    // 按映射推进订单状态（best-effort）
    const target = TRACKING_TO_ORDER_STATUS[dto.status]
    if (target && order) {
      try {
        await this.orderSM.transition(order.id, target, 'tracking')
      } catch (err) {
        this.logger.warn(`轨迹驱动订单状态失败 order=${order.id}: ${(err as Error).message}`, 'Shipments')
      }
    }
    await this.prisma.shipment.update({ where: { id: shipment.id }, data: { status: dto.status } })

    return this.trackingToVo(evt)
  }

  /** 查询运单轨迹时间线（按发生时间升序，§6） */
  async listTracking(shipmentId: string, tenantId: string): Promise<TrackingVo[]> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, tenantId } })
    if (!shipment) {
      throw new BusinessException('SHIPMENT_NOT_FOUND', '运单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const events = await this.prisma.trackingEvent.findMany({
      where: { shipmentId, tenantId },
      orderBy: { occurredAt: 'asc' },
    })
    return events.map((e) => this.trackingToVo(e))
  }

  /** 运单列表（可按订单过滤，§17 租户隔离） */
  async list(tenantId: string, orderId?: string): Promise<ShipmentVo[]> {
    const shipments = await this.prisma.shipment.findMany({
      where: orderId ? { tenantId, orderId } : { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    const carriers = await this.prisma.carrier.findMany()
    const carrierMap = new Map(carriers.map((c) => [c.id, c]))
    return Promise.all(
      shipments.map(async (s) => {
        const legs = await this.prisma.shipmentLeg.findMany({ where: { shipmentId: s.id } })
        return this.shipmentToVo(s, legs, carrierMap.get(s.carrierId ?? '') ?? null)
      }),
    )
  }

  // ---------------------------------------------------------------------------
  // 私有辅助
  // ---------------------------------------------------------------------------

  /** 构造承运商建单请求：收件人取订单 recipient，包裹由订单项 SKU 重量派生 */
  private buildCarrierRequest(
    order: OrderProjection,
    items: EnrichedItem[],
    dto: BookShipmentDto,
    legType: LegType,
    carrierCode: CarrierCode,
  ): CreateShipmentRequest {
    const r = (order.recipient ?? {}) as Record<string, string | undefined>
    const recipient: CarrierRecipientDto = {
      name: r.name ?? 'Recipient',
      phone: r.phone,
      email: r.email,
      country: r.country ?? 'US',
      state: r.state,
      city: r.city ?? 'City',
      address1: r.address1 ?? r.address ?? 'Address',
      address2: r.address2,
      zip: r.zip,
    }
    const parcels: ParcelDto[] = items.length
      ? items.map((it) => {
          const sku = it.sku
          const weightKg = sku?.weightG ? sku.weightG / 1000 : 1
          return {
            weightKg,
            lengthCm: sku?.lengthCm ?? 20,
            widthCm: sku?.widthCm ?? 15,
            heightCm: sku?.heightCm ?? 10,
          }
        })
      : [{ weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10 }]

    const req: CreateShipmentRequest = {
      orderRef: order.platformOrderNo,
      origin: 'CN',
      destCountry: recipient.country,
      destZip: recipient.zip,
      parcels,
      recipient,
      legType,
      cargoType: (dto.cargoType ?? CargoType.GENERAL) as CargoType,
      declaredValue: dto.declaredValue,
      currency: dto.currency,
      customs: dto.customs as CustomsDto | undefined,
      servicePreference: carrierCode,
    }
    return req
  }

  /** 收件人城市（首条轨迹节点地点用） */
  private recipientCity(order: { recipient?: unknown }): string | undefined {
    const r = (order.recipient ?? {}) as Record<string, string | undefined>
    return r.city
  }

  /** 写入轨迹事件（§6 tracking_events） */
  private async appendTracking(
    shipmentId: string,
    tenantId: string,
    e: { status: string; location?: string; description?: string; occurredAt: string; legType?: string },
  ) {
    return this.prisma.trackingEvent.create({
      data: {
        tenantId,
        shipmentId,
        legType: e.legType ?? null,
        status: e.status,
        location: e.location ?? null,
        description: e.description ?? null,
        occurredAt: new Date(e.occurredAt),
      },
    })
  }

  /** 查承运商展示名（回传平台展示用） */
  private async carrierName(carrierId?: string): Promise<string | undefined> {
    if (!carrierId) return undefined
    const c = await this.prisma.carrier.findUnique({ where: { id: carrierId } })
    return c?.name
  }

  private shipmentToVo(
    s: {
      id: string
      orderId: string
      trackingNo?: string | null
      status: string
      legs?: Array<{ legType: string; trackingNo?: string | null; status: string }>
      carrierCost?: Prisma.Decimal | null
      sellPrice?: Prisma.Decimal | null
      currency?: string | null
      createdAt: Date
    },
    legs: Array<{ legType: string; trackingNo?: string | null; status: string }>,
    carrier: { code: string; name: string } | null,
  ): ShipmentVo {
    const legVos: LegVo[] = legs.map((l) => ({
      legType: l.legType,
      carrierCode: carrier?.code,
      carrierName: carrier?.name,
      trackingNo: l.trackingNo ?? undefined,
      status: l.status,
    }))
    return {
      id: s.id,
      orderId: s.orderId,
      carrierCode: carrier?.code,
      carrierName: carrier?.name,
      trackingNo: s.trackingNo ?? undefined,
      status: s.status,
      legType: legs[0]?.legType ?? 'direct',
      carrierCost: s.carrierCost != null ? Number(s.carrierCost) : undefined,
      sellPrice: s.sellPrice != null ? Number(s.sellPrice) : undefined,
      currency: s.currency ?? undefined,
      legs: legVos,
      createdAt: s.createdAt.toISOString(),
    }
  }

  private trackingToVo(e: {
    id: string
    shipmentId: string
    legType?: string | null
    status: string
    location?: string | null
    description?: string | null
    occurredAt: Date
  }): TrackingVo {
    return {
      id: e.id,
      shipmentId: e.shipmentId,
      legType: e.legType ?? undefined,
      status: e.status,
      location: e.location ?? undefined,
      description: e.description ?? undefined,
      occurredAt: e.occurredAt.toISOString(),
    }
  }
}
