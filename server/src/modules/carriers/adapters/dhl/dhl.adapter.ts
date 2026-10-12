/**
 * DHL Express（MyDHL API）适配器（任务 3.3，方案 §1.1 / §3）。
 * 实现能力：比价(Rating) / 建单(Shipment) / 面单 / 轨迹(轮询) —— DHL 走轮询（§1.2.2），
 * 故【不支持】订阅推送与自助取消（cancelShipment/subscribeTracking 抛清晰业务异常，诚实优于静默成功）。
 * 鉴权：OAuth2（clientId+clientSecret → Basic 头换取 accessToken）+ 业务头 `DHL-API-Key`（§1.1）。
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
import { computeChargeableWeight, ParcelDimension } from '../../weight'
import {
  DHL_BASE_URL,
  DHL_DEFAULT_VOLUMETRIC_DIVISOR,
  DHL_ENDPOINTS,
  DHL_REQUEST_TIMEOUT_MS,
  DhlAuthConfig,
} from './dhl-auth.config'
import { DhlTokenService } from './dhl-token.service'
import { DhlRateResponse, DhlShipmentResponse, DhlTrackingResponse } from './dhl.types'

/**
 * DHL 适配器：四能力映射（RATE/SHIP/LABEL/TRACK）+ OAuth2 鉴权 + 重试（继承 AbstractCarrierAdapter）。
 * 构造期不校验凭证（探针/健康检查需无凭证构建），真实调用前 assertConfig 校验（§2.2）。
 */
export class DhlAdapter extends AbstractCarrierAdapter {
  private readonly config: DhlAuthConfig
  private readonly token: DhlTokenService

  constructor(account: CarrierAccountContext, http: RetryableHttpService, logger: AppLogger) {
    super(CarrierCode.DHL, http, logger)
    this.config = normalizeAuthConfig(account.authConfig)
    this.token = new DhlTokenService(http, logger, this.config)
  }

  /** DHL 能力声明：轮询型，不支持订阅与自助取消（§1.1/§1.2.2/§13.2） */
  protected capabilities(): CarrierCapability[] {
    return [
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
    ]
  }

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? DHL_BASE_URL.sandbox : DHL_BASE_URL.prod)
  }

  /** 真实调用前校验 OAuth 凭证完整性（§2.2） */
  private assertConfig(): void {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.apiKey) {
      throw new BusinessException(
        'DHL_AUTH_MISSING',
        'DHL 账号未配置 clientId/clientSecret/apiKey（请在租户 CarrierAccount 中配置，§2.2）',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /** 比价：MyDHL Rating → RateQuote[]（§4/§5 输入） */
  async getRates(req: GetRatesRequest): Promise<RateQuote[]> {
    this.assertConfig()
    if (!this.config.accountNumber) {
      throw new BusinessException('DHL_ACCOUNT_MISSING', 'DHL 账号未配置 accountNumber（比价/建单必填，§1.1）', HttpStatus.BAD_REQUEST)
    }
    const { totalChargeableKg, totalVolumetricKg, isVolumetric } = computeChargeableWeight(
      toParcelDimensions(req.parcels),
      DHL_DEFAULT_VOLUMETRIC_DIVISOR,
    )
    const query: Record<string, string> = {
      accountNumber: this.config.accountNumber,
      originCountryCode: toOriginCountry(req.origin),
      destinationCountryCode: req.destCountry,
      weight: String(totalChargeableKg.toFixed(3)),
      length: String(firstDimension(req).lengthCm),
      width: String(firstDimension(req).widthCm),
      height: String(firstDimension(req).heightCm),
      plannedShippingDate: new Date().toISOString().slice(0, 10),
      isCustomsDeclarable: 'true',
      unitOfMeasurement: 'metric',
    }
    const data = await this.invoke<DhlRateResponse>('GET', DHL_ENDPOINTS.rates, undefined, query)
    const currency = req.currency ?? 'USD'
    return (data.products ?? []).map((p) => toRateQuote(p, req.destCountry, totalChargeableKg, totalVolumetricKg, isVolumetric, currency))
  }

  /** 建单：归一化请求 → DHL Shipment → 结果 */
  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    this.assertConfig()
    if (!this.config.accountNumber) {
      throw new BusinessException('DHL_ACCOUNT_MISSING', 'DHL 账号未配置 accountNumber（比价/建单必填，§1.1）', HttpStatus.BAD_REQUEST)
    }
    const body = toShipmentRequest(req, this.config.accountNumber)
    const data = await this.invoke<DhlShipmentResponse>('POST', DHL_ENDPOINTS.shipments, body)
    const currency = req.currency ?? 'USD'
    const waybillNo = data.shipmentTrackingNumber ?? data.shipmentId ?? ''
    // 成本以建单后计费回传/对账为准（§9/§10），此处占位 0 并标记
    // TODO(ops): 2026-11 接入 DHL 费用回传后填充真实 carrierCost（§9 对账）
    return {
      waybillNo,
      trackingNo: data.shipmentTrackingNumber,
      labelUrl: undefined,
      labelZpl: data.labels?.[0]?.binaryData,
      carrierCost: 0,
      currency,
    }
  }

  /** 面单：按运单号查询面单（base64，§3 getLabel，落 MinIO，§2.1） */
  async getLabel(waybillNo: string): Promise<CarrierLabel> {
    this.assertConfig()
    // TODO(ops): 2026-11 以 DHL 官网「面单获取」接口为准校正路径与 labelType 参数（§1.1/§3）
    const data = await this.invoke<DhlShipmentResponse>('GET', `${DHL_ENDPOINTS.shipments}/${encodeURIComponent(waybillNo)}`)
    const base64 = data.labels?.[0]?.binaryData
    return {
      waybillNo,
      format: (data.labels?.[0]?.type?.toUpperCase() === 'ZPL' ? 'zpl' : 'pdf') as 'pdf' | 'zpl',
      content: base64,
      url: undefined,
    }
  }

  /** 轨迹：查询并归一化（轮询，§3/§6） */
  async getTracking(no: string): Promise<CarrierTrackingResult> {
    this.assertConfig()
    const data = await this.invoke<DhlTrackingResponse>('GET', `${DHL_ENDPOINTS.tracking}/${encodeURIComponent(no)}/tracking`)
    const events: CarrierTrackingEvent[] = (data.shipments?.[0]?.trackingEvents ?? []).map((e) => ({
      status: mapDhlStatus(e.status),
      location: locationText(e.location),
      occurredAt: e.dateTime,
      description: e.description,
    }))
    const current = events.length > 0 ? events[events.length - 1].status : CarrierTrackingStatus.UNKNOWN
    return {
      trackingNo: no,
      carrierCode: CarrierCode.DHL,
      status: current,
      events,
    }
  }

  /** DHL 无公开自助取消 API（§1.1/§13.2）→ 诚实报错，待阶段5 接入承运商门户/工单 */
  async cancelShipment(_no: string): Promise<void> {
    throw new BusinessException(
      'DHL_CANCEL_UNSUPPORTED',
      'DHL 无公开自助取消 API；取消请走承运商门户/工单（阶段5 接入，§1.1/§13.2）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  /** DHL 走轮询不支持推送订阅（§1.2.2）→ 诚实报错 */
  async subscribeTracking(_no: string): Promise<void> {
    throw new BusinessException(
      'DHL_SUBSCRIBE_UNSUPPORTED',
      'DHL 轨迹走轮询（§1.2.2），不支持推送订阅；请用定时轮询兜底（§6）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  // —— 以下为 DHL 调用基础设施 ——

  /** 带鉴权头的 GET/POST 调用（§2.1 重试；DHL 无 code 信封，直接返回 data） */
  private async invoke<TData>(
    method: 'GET' | 'POST',
    endpoint: string,
    bodyObj?: unknown,
    query?: Record<string, string>,
  ): Promise<TData> {
    let url = `${this.baseUrl}${endpoint}`
    if (query && method === 'GET') {
      const qs = new URLSearchParams(query).toString()
      url += `?${qs}`
    }
    const headers = await this.buildHeaders()
    const options: RetryableRequestOptions = { method, headers, timeoutMs: DHL_REQUEST_TIMEOUT_MS }
    if (bodyObj !== undefined) options.body = JSON.stringify(bodyObj)
    const resp = await this.http.request<TData>(url, options)
    return resp.data
  }

  /** 构造 DHL 请求头：Bearer 令牌 + DHL-API-Key（§1.1，无 HMAC 签名） */
  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.token.getToken()
    return {
      Authorization: `Bearer ${token}`,
      'DHL-API-Key': this.config.apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
  }
}

// —— 模块级纯函数：归一化映射与状态转换（便于单测，§31） ——

/** DHL 原生状态 → 归一化轨迹状态（§6） */
function mapDhlStatus(raw: string): CarrierTrackingStatus {
  switch ((raw || '').toLowerCase()) {
    case 'created':
    case 'booked':
      return CarrierTrackingStatus.CREATED
    case 'pickup':
    case 'pickedup':
      return CarrierTrackingStatus.PICKED_UP
    case 'transit':
    case 'in transit':
    case 'departed':
      return CarrierTrackingStatus.IN_TRANSIT
    case 'customs':
    case 'customs clearance':
      return CarrierTrackingStatus.CUSTOMS
    case 'delivery':
    case 'out for delivery':
      return CarrierTrackingStatus.OUT_FOR_DELIVERY
    case 'delivered':
      return CarrierTrackingStatus.DELIVERED
    case 'exception':
    case 'failed':
      return CarrierTrackingStatus.EXCEPTION
    case 'cancelled':
    case 'returned':
      return CarrierTrackingStatus.CANCELLED
    default:
      return CarrierTrackingStatus.UNKNOWN
  }
}

/** 归一化地点文本（DHL 地点嵌套在 address 下） */
function locationText(loc?: { address?: { cityName?: string; countryName?: string } }): string | undefined {
  if (!loc?.address) return undefined
  return [loc.address.cityName, loc.address.countryName].filter(Boolean).join(', ')
}

/** 单产品 → 归一化报价（§5 比价输入） */
function toRateQuote(
  p: DhlRateResponse['products'][number],
  destCountry: string,
  chargeableKg: number,
  volumetricKg: number,
  isVolumetric: boolean,
  fallbackCurrency: string,
): RateQuote {
  const price = p.totalPrice?.[0]
  return {
    carrierCode: CarrierCode.DHL,
    productCode: p.productCode ?? 'dhl-express',
    productName: p.productName,
    chargeableWeightKg: Number(chargeableKg.toFixed(3)),
    volumetricWeightKg: Number(volumetricKg.toFixed(3)),
    isVolumetric,
    currency: price?.currency || fallbackCurrency,
    carrierCost: price?.price ?? 0,
    reachable: true,
    remoteArea: false,
    note: `目的国 ${destCountry}`,
  }
}

/** 建单请求（归一化 → DHL Shipment，§1.1；最佳适配，字段以联调官网为准） */
function toShipmentRequest(req: CreateShipmentRequest, accountNumber: string): Record<string, unknown> {
  const r = req.recipient
  return {
    accounts: [{ type: 'shipper', number: accountNumber }],
    plannedShippingDate: new Date().toISOString().slice(0, 10),
    ship: {
      shipper: { name: 'Shipper', address: { countryCode: req.origin } },
      recipient: {
        name: r?.name ?? 'Unknown',
        email: r?.email,
        phone: r?.phone,
        address: {
          countryCode: r?.country ?? req.destCountry,
          cityName: r?.city ?? '',
          postalCode: r?.zip ?? req.destZip,
          addressLine1: r?.address1 ?? '',
          addressLine2: r?.address2,
        },
      },
    },
    packages: req.parcels.map((pk) => ({
      weight: pk.weightKg,
      dimensions: { length: pk.lengthCm, width: pk.widthCm, height: pk.heightCm },
      type: 'BOX',
    })),
    customs: req.customs
      ? {
          description: 'goods',
          declaredValue: req.declaredValue,
          invoice: { currencyCode: req.currency ?? 'USD' },
          // HS/IOSS/EORI/VAT 等映射（§19）
          // TODO(ops): 2026-11 补全 customs 字段到 DHL customs 结构（§19）
        }
      : undefined,
  }
}

/** 始发国推导：origin 为 2 位大写则视为 ISO2，否则默认 CN（云途/DHL 多自中国发货） */
function toOriginCountry(origin?: string): string {
  if (origin && /^[A-Z]{2}$/.test(origin)) return origin
  // TODO(ops): 2026-11 在 GetRatesRequest 增加 originCountryCode（ISO2）以精准比价（§4）
  return 'CN'
}

/** 取首箱尺寸（比价以首箱维度上报，多箱计费重已在上层 Σ，§4.2） */
function firstDimension(req: GetRatesRequest): { lengthCm: number; widthCm: number; heightCm: number } {
  const p = req.parcels[0]
  return { lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm }
}

/** 归一化报文 ParcelDto[] → 计费重维度（§4.2） */
function toParcelDimensions(parcels: GetRatesRequest['parcels']): ParcelDimension[] {
  return parcels.map((p) => ({
    weightKg: p.weightKg,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
  }))
}

/** 容错解析鉴权配置（构造期不抛，缺凭证在真实调用前拦截，§2.2） */
function normalizeAuthConfig(raw: unknown): DhlAuthConfig {
  const cfg = (raw ?? {}) as Partial<DhlAuthConfig>
  return {
    clientId: cfg.clientId ?? '',
    clientSecret: cfg.clientSecret ?? '',
    apiKey: cfg.apiKey ?? '',
    accountNumber: cfg.accountNumber,
    sandbox: cfg.sandbox ?? false,
    baseUrl: cfg.baseUrl,
  }
}
