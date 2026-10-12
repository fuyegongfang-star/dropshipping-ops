/**
 * 4PX 递四方适配器（任务 3.4，方案 §1.1 / §3）。
 * 实现能力：比价(物流产品列表) / 建单 / 面单 / 轨迹(轮询) / 取消(拦截) —— 4PX 走轮询（§1.2.2），
 * 故【不支持】订阅推送（subscribeTracking 抛清晰业务异常）。
 * 鉴权：MD5 签名（method+app_key+v+timestamp+format+param+secret，32 位小写，§1.1）。
 * 依赖：RetryableHttpService（超时/重试/指数退避 §2.1）、AppLogger、CarrierRegistry 工厂注册（§2.2）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { HttpStatus } from '@nestjs/common'
import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableRequestOptions,
} from '../../../../common/http/retryable-http.service'
import { BusinessException } from '../../../../common/response/business.exception'
import { AbstractCarrierAdapter } from '../../abstract-carrier.adapter'
import { CarrierCapability, CarrierCode } from '../../carrier.constants'
import { CarrierAccountContext } from '../../carrier-registry.service'
import { GetRatesRequest, RateQuote } from '../../dto/rate.dto'
import { CarrierLabel, CreateShipmentRequest, CreateShipmentResult } from '../../dto/shipment.dto'
import {
  CarrierTrackingEvent,
  CarrierTrackingResult,
  CarrierTrackingStatus,
} from '../../dto/tracking.dto'
import { computeChargeableWeight } from '../../weight'
import { md5Sign } from '../md5-sign.service'
import {
  FOURPX_API_VERSION,
  FOURPX_BASE_URL,
  FOURPX_DEFAULT_VOLUMETRIC_DIVISOR,
  FOURPX_REQUEST_TIMEOUT_MS,
  FourPxAuthConfig,
} from './fourpx-auth.config'

/** 4PX router 统一响应包（§1.1：errorCode='0' 成功） */
interface FourPxEnvelope<T> {
  errorCode?: string // 错误码（'0' 成功）
  errorMsg?: string // 错误信息
  data: T // 业务数据
}

/** 比价响应中的物流产品 */
interface FourPxProduct {
  productCode: string
  productName: string
  fee?: number
  currency?: string
  leadTime?: number // 时效（天）
}

/** 建单/面单响应 data */
interface FourPxOperateData {
  expressNo?: string // 4PX 运单号（轨迹号）
  trackingNo?: string
  labelUrl?: string // 面单链接
}

/** 轨迹响应 data */
interface FourPxTrackData {
  expressNo?: string
  status?: string // 4PX 原生状态
  trackingDetails?: { status: string; location?: string; time?: string; description?: string }[]
}

/**
 * 4PX 适配器：五能力映射（RATE/SHIP/LABEL/TRACK/CANCEL）+ MD5 鉴权 + 重试。
 * 构造期不校验凭证（探针/健康检查需无凭证构建），真实调用前 assertConfig 校验（§2.2）。
 */
export class FourPxAdapter extends AbstractCarrierAdapter {
  private readonly config: FourPxAuthConfig

  constructor(account: CarrierAccountContext, http: RetryableHttpService, logger: AppLogger) {
    super(CarrierCode.FOURPX, http, logger)
    this.config = normalizeAuthConfig(account.authConfig)
  }

  /** 4PX 能力声明：轮询型，不支持订阅（§1.2.2/§1.1 支持拦截取消） */
  protected capabilities(): CarrierCapability[] {
    return [
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
      CarrierCapability.CANCEL,
    ]
  }

  /** 当前使用的 router 入口（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? FOURPX_BASE_URL.sandbox : FOURPX_BASE_URL.prod)
  }

  /** 真实调用前校验凭证完整性（§2.2） */
  private assertConfig(): void {
    if (!this.config.appKey || !this.config.appSecret) {
      throw new BusinessException(
        'FOURPX_AUTH_MISSING',
        '4PX 账号未配置 appKey/appSecret（请在租户 CarrierAccount 中配置，§2.2）',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /** 比价：物流产品列表 → RateQuote[]（§4/§5 输入） */
  async getRates(req: GetRatesRequest): Promise<RateQuote[]> {
    this.assertConfig()
    const first = firstDimension(req)
    const { totalChargeableKg, totalVolumetricKg, isVolumetric } = computeChargeableWeight(
      toParcelDimensions(req.parcels),
      FOURPX_DEFAULT_VOLUMETRIC_DIVISOR,
    )
    const param = {
      countryCode: req.destCountry,
      weight: Number(totalChargeableKg.toFixed(3)),
      length: first.lengthCm,
      width: first.widthCm,
      height: first.heightCm,
      cargoType: req.cargoType ?? 'general',
    }
    const data = await this.call4px<FourPxProduct[]>('getLogisticsProductList', param)
    const currency = req.currency ?? 'USD'
    return (data ?? []).map((p) =>
      toRateQuote(p, totalChargeableKg, totalVolumetricKg, isVolumetric, currency),
    )
  }

  /** 建单：归一化请求 → 4PX 建单 → 结果 */
  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    this.assertConfig()
    const param = {
      orderNo: req.orderRef ?? `ORD-${Date.now()}`,
      cargoType: req.cargoType ?? 'general',
      declaredValue: req.declaredValue,
      currency: req.currency,
      recipient: toRecipientParam(req),
      parcel: toParcelParam(req.parcels[0]),
      customs: req.customs
        ? { hsCode: req.customs.hsCode, ioss: req.customs.ioss, eori: req.customs.eori, vat: req.customs.vat }
        : undefined,
    }
    const data = await this.call4px<FourPxOperateData>('createOrder', param)
    const currency = req.currency ?? 'USD'
    // 成本以建单后计费回传/对账为准（§9/§10），此处占位 0 并标记
    // TODO(ops): 2026-11 接入 4PX 费用回传后填充真实 carrierCost（§9 对账）
    return {
      waybillNo: data.expressNo ?? '',
      trackingNo: data.trackingNo ?? data.expressNo,
      labelUrl: data.labelUrl,
      carrierCost: 0,
      currency,
    }
  }

  /** 面单：按运单号查询面单链接（§3 getLabel，落 MinIO，§2.1） */
  async getLabel(waybillNo: string): Promise<CarrierLabel> {
    this.assertConfig()
    const data = await this.call4px<FourPxOperateData>('getLabelList', { expressNos: [waybillNo] })
    return { waybillNo, format: 'pdf', content: undefined, url: data.labelUrl }
  }

  /** 轨迹：查询并归一化（轮询，§3/§6） */
  async getTracking(no: string): Promise<CarrierTrackingResult> {
    this.assertConfig()
    const data = await this.call4px<FourPxTrackData>('qureyTrack', { expressNos: [no] })
    const events: CarrierTrackingEvent[] = (data.trackingDetails ?? []).map((e) => ({
      status: mapFourPxStatus(e.status),
      location: e.location,
      occurredAt: e.time ?? '',
      description: e.description,
    }))
    const current = events.length > 0 ? events[events.length - 1].status : CarrierTrackingStatus.UNKNOWN
    return { trackingNo: data.expressNo ?? no, carrierCode: CarrierCode.FOURPX, status: current, events }
  }

  /** 取消运单（逆向入口，§13.2；4PX 支持拦截取消） */
  async cancelShipment(no: string): Promise<void> {
    this.assertConfig()
    await this.call4px<Record<string, never>>('cancelOrder', { expressNos: [no] })
  }

  /** 4PX 走轮询不支持推送订阅（§1.2.2）→ 诚实报错 */
  async subscribeTracking(_no: string): Promise<void> {
    throw new BusinessException(
      'FOURPX_SUBSCRIBE_UNSUPPORTED',
      '4PX 轨迹走轮询（§1.2.2），不支持推送订阅；请用定时轮询兜底（§6）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  // —— 以下为 4PX router 调用基础设施 ——

  /** 带 MD5 签名的 router POST（§1.1 鉴权矩阵） */
  private async call4px<TData>(method: string, param: unknown): Promise<TData> {
    const ts = Date.now()
    const v = FOURPX_API_VERSION
    const format = 'json'
    const paramStr = JSON.stringify(param)
    // 规范化串：method+app_key+v+timestamp+format+param+secret（§1.1），32 位小写 MD5
    const canonical = `${method}${this.config.appKey}${v}${ts}${format}${paramStr}${this.config.appSecret}`
    const sign = md5Sign(canonical)
    const body = new URLSearchParams({
      app_key: this.config.appKey,
      method,
      v,
      timestamp: String(ts),
      format,
      sign,
      param: paramStr,
    }).toString()
    const options: RetryableRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      timeoutMs: FOURPX_REQUEST_TIMEOUT_MS,
    }
    const resp = await this.http.request<FourPxEnvelope<TData>>(this.baseUrl, options)
    const env = resp.data as FourPxEnvelope<TData>
    if (env.errorCode && env.errorCode !== '0') {
      throw new BusinessException(
        'FOURPX_API_ERROR',
        `4PX 接口错误：code=${env.errorCode} msg=${env.errorMsg ?? ''}`,
        HttpStatus.BAD_GATEWAY,
      )
    }
    return env.data
  }
}

// —— 模块级纯函数：归一化映射与状态转换（便于单测，§31） ——

/** 4PX 原生状态 → 归一化轨迹状态（§6） */
function mapFourPxStatus(raw: string): CarrierTrackingStatus {
  switch ((raw || '').toLowerCase()) {
    case 'created':
      return CarrierTrackingStatus.CREATED
    case 'picked':
    case 'pickup':
      return CarrierTrackingStatus.PICKED_UP
    case 'transit':
    case 'in_transit':
      return CarrierTrackingStatus.IN_TRANSIT
    case 'customs':
      return CarrierTrackingStatus.CUSTOMS
    case 'delivery':
    case 'out_for_delivery':
      return CarrierTrackingStatus.OUT_FOR_DELIVERY
    case 'delivered':
      return CarrierTrackingStatus.DELIVERED
    case 'exception':
    case 'error':
      return CarrierTrackingStatus.EXCEPTION
    case 'cancelled':
    case 'returned':
      return CarrierTrackingStatus.CANCELLED
    default:
      return CarrierTrackingStatus.UNKNOWN
  }
}

/** 单产品 → 归一化报价（§5 比价输入） */
function toRateQuote(
  p: FourPxProduct,
  chargeableKg: number,
  volumetricKg: number,
  isVolumetric: boolean,
  fallbackCurrency: string,
): RateQuote {
  return {
    carrierCode: CarrierCode.FOURPX,
    productCode: p.productCode,
    productName: p.productName,
    chargeableWeightKg: Number(chargeableKg.toFixed(3)),
    volumetricWeightKg: Number(volumetricKg.toFixed(3)),
    isVolumetric,
    currency: p.currency || fallbackCurrency,
    carrierCost: p.fee ?? 0,
    estimatedLeadDaysMax: p.leadTime,
    reachable: true,
    remoteArea: false,
  }
}

/** 收件人参数（4PX 结构，§1.1；最佳适配，字段以联调官网为准） */
function toRecipientParam(req: CreateShipmentRequest): Record<string, unknown> {
  const r = req.recipient
  return {
    name: r?.name ?? 'Unknown',
    email: r?.email,
    phone: r?.phone,
    countryCode: r?.country ?? req.destCountry,
    state: r?.state,
    city: r?.city ?? '',
    address1: r?.address1 ?? '',
    address2: r?.address2,
    zip: r?.zip ?? req.destZip,
  }
}

/** 单箱参数（重量 kg / 尺寸 cm） */
function toParcelParam(p: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }): Record<string, number> {
  return { weight: p.weightKg, length: p.lengthCm, width: p.widthCm, height: p.heightCm }
}

/** 取首箱尺寸（比价以首箱维度上报，多箱计费重已在上层 Σ，§4.2） */
function firstDimension(req: GetRatesRequest): { lengthCm: number; widthCm: number; heightCm: number } {
  const p = req.parcels[0]
  return { lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm }
}

/** 归一化报文 ParcelDto[] → 计费重维度（§4.2） */
function toParcelDimensions(parcels: GetRatesRequest['parcels']): { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }[] {
  return parcels.map((p) => ({
    weightKg: p.weightKg,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
  }))
}

/** 容错解析鉴权配置（构造期不抛，缺凭证在真实调用前拦截，§2.2） */
function normalizeAuthConfig(raw: unknown): FourPxAuthConfig {
  const cfg = (raw ?? {}) as Partial<FourPxAuthConfig>
  return {
    appKey: cfg.appKey ?? '',
    appSecret: cfg.appSecret ?? '',
    sandbox: cfg.sandbox ?? false,
    baseUrl: cfg.baseUrl,
  }
}
