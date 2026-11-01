/**
 * 云途 YunExpress 适配器（任务 3.2，方案 §1.1 / §3）。
 * 实现 CarrierAdapter 六能力：比价(pricing trial) / 建单 / 面单 / 轨迹 / 取消 / 订阅。
 * 鉴权：OAuth2（client_credentials 换取 accessToken，按租户缓存）+ HMAC-SHA256 请求签名（§1.1）。
 * 依赖：RetryableHttpService（超时/重试/指数退避 §2.1）、AppLogger、CarrierRegistry 工厂注册（§2.2）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { HttpStatus } from '@nestjs/common'
import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableRequestOptions,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import { BusinessException } from '../../../../common/response/business.exception'
import { AbstractCarrierAdapter } from '../../abstract-carrier.adapter'
import { CarrierCode } from '../../carrier.constants'
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
  YUNEXPRESS_BASE_URL,
  YUNEXPRESS_DEFAULT_VOLUMETRIC_DIVISOR,
  YUNEXPRESS_ENDPOINTS,
  YUNEXPRESS_REQUEST_TIMEOUT_MS,
  YunExpressAuthConfig,
} from './yunexpress-auth.config'
import { signYunExpressRequest } from './yunexpress-sign.service'
import { YunExpressTokenService } from './yunexpress-token.service'
import {
  YunExpressCreateData,
  YunExpressCreateRequest,
  YunExpressEnvelope,
  YunExpressLabelData,
  YunExpressPricingData,
  YunExpressProduct,
  YunExpressTrackingData,
} from './yunexpress.types'

/**
 * 云途适配器：六能力映射 + 鉴权 + 重试（继承 AbstractCarrierAdapter，复用 §2.1 网络层）。
 * 构造期不校验凭证（探针/健康检查需无凭证构建），真实调用前 assertConfig 校验（§2.2）。
 */
export class YunExpressAdapter extends AbstractCarrierAdapter {
  private readonly config: YunExpressAuthConfig
  private readonly token: YunExpressTokenService

  constructor(account: CarrierAccountContext, http: RetryableHttpService, logger: AppLogger) {
    super(CarrierCode.YUNEXPRESS, http, logger)
    this.config = normalizeAuthConfig(account.authConfig)
    this.token = new YunExpressTokenService(http, logger, this.config)
  }

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? YUNEXPRESS_BASE_URL.sandbox : YUNEXPRESS_BASE_URL.prod)
  }

  /** 真实调用前校验凭证完整性（缺失则清晰报错，§2.2） */
  private assertConfig(): void {
    if (!this.config.appId || !this.config.apiKey) {
      throw new BusinessException(
        'YUNEXPRESS_AUTH_MISSING',
        '云途账号未配置 appId/apiKey（请在租户 CarrierAccount 中配置，§2.2）',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /** 比价：pricing trial → RateQuote[]（§4/§5 输入） */
  async getRates(req: GetRatesRequest): Promise<RateQuote[]> {
    this.assertConfig()
    const first = firstParcel(req)
    const { totalChargeableKg, totalVolumetricKg, isVolumetric } = computeChargeableWeight(
      toParcelDimensions(req.parcels),
      YUNEXPRESS_DEFAULT_VOLUMETRIC_DIVISOR,
    )
    const body = {
      countryCode: req.destCountry,
      zip: req.destZip,
      weight: Number(totalChargeableKg.toFixed(3)),
      length: first.lengthCm,
      width: first.widthCm,
      height: first.heightCm,
      cargoType: req.cargoType ?? 'general',
      declaredValue: req.declaredValue,
      currency: req.currency,
    }
    const data = await this.post<YunExpressPricingData>(YUNEXPRESS_ENDPOINTS.pricing, body)
    const currency = req.currency ?? 'USD'
    return data.products.map((p) =>
      toRateQuote(p, totalChargeableKg, totalVolumetricKg, isVolumetric, currency),
    )
  }

  /** 建单：归一化请求 → 云途建单 → 结果 */
  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    this.assertConfig()
    const body = toCreateRequest(req)
    const data = await this.post<YunExpressCreateData>(YUNEXPRESS_ENDPOINTS.create, body)
    const currency = req.currency ?? 'USD'
    // 成本以建单后计费回传/对账为准（§9/§10），建单当下不可知 → 返回 null 标记为「成本待回传」。
    // 严禁占位 0：下游利润/对账以 carrierCost 为 null 过滤排除，避免系统性高估利润（review C1）。
    // TODO(ops): 2026-11 接入云途费用回传后填充真实 carrierCost（§9 对账）
    return {
      waybillNo: data.wayBillNo,
      trackingNo: data.trackingNo,
      labelUrl: data.labelUrl,
      carrierCost: null,
      currency,
    }
  }

  /** 面单：按运单号打印 → PDF/ZPL（§3 getLabel，落 MinIO，§2.1） */
  async getLabel(waybillNo: string): Promise<CarrierLabel> {
    this.assertConfig()
    const data = await this.post<YunExpressLabelData>(YUNEXPRESS_ENDPOINTS.print, { wayBillNo: waybillNo })
    return {
      waybillNo,
      format: 'pdf',
      content: data.labelBase64,
      url: data.labelUrl,
    }
  }

  /** 轨迹：查询并归一化状态与节点（§3/§6） */
  async getTracking(no: string): Promise<CarrierTrackingResult> {
    this.assertConfig()
    const data = await this.post<YunExpressTrackingData>(YUNEXPRESS_ENDPOINTS.tracking, { trackingNo: no })
    const events: CarrierTrackingEvent[] = (data.details ?? []).map((d) => ({
      status: mapYunExpressStatus(d.status),
      location: d.location,
      occurredAt: d.dateTime,
      description: d.description,
    }))
    return {
      trackingNo: data.trackingNo || no,
      carrierCode: CarrierCode.YUNEXPRESS,
      status: mapYunExpressStatus(data.status),
      events,
    }
  }

  /** 取消运单（逆向入口，§13.2） */
  async cancelShipment(no: string): Promise<void> {
    this.assertConfig()
    await this.post<Record<string, never>>(YUNEXPRESS_ENDPOINTS.cancel, { wayBillNo: no })
  }

  /** 轨迹订阅（云途类推送，§6 双通道） */
  async subscribeTracking(no: string): Promise<void> {
    this.assertConfig()
    await this.post<Record<string, never>>(YUNEXPRESS_ENDPOINTS.subscribe, { wayBillNo: no })
  }

  // —— 以下为云途调用基础设施 ——

  /** 带鉴权头与重试的 POST（统一包云途信封 code=0 校验，§2.1） */
  private async post<TData>(endpoint: string, bodyObj: unknown): Promise<TData> {
    const body = JSON.stringify(bodyObj)
    const headers = await this.buildHeaders(body)
    const options: RetryableRequestOptions = {
      method: 'POST',
      headers,
      body,
      timeoutMs: YUNEXPRESS_REQUEST_TIMEOUT_MS,
    }
    const resp = await this.http.request<YunExpressEnvelope<TData>>(`${this.baseUrl}${endpoint}`, options)
    assertEnvelope(resp)
    return resp.data.data
  }

  /** 构造云途请求头：Bearer 令牌 + 签名（§1.1） */
  private async buildHeaders(body: string): Promise<Record<string, string>> {
    const token = await this.token.getToken()
    const ts = Date.now()
    const signature = signYunExpressRequest(this.config.apiKey, this.config.appId, ts, body)
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'app-key': this.config.appId,
      timestamp: String(ts),
      signature,
    }
  }
}

// —— 模块级纯函数：归一化映射与状态转换（便于单测，§31） ——

/** 云途原生状态 → 归一化轨迹状态（§6） */
function mapYunExpressStatus(raw: string): CarrierTrackingStatus {
  switch ((raw || '').toUpperCase()) {
    case 'CREATED':
      return CarrierTrackingStatus.CREATED
    case 'PICKUP':
    case 'PICKEDUP':
      return CarrierTrackingStatus.PICKED_UP
    case 'DEPARTURE':
    case 'INTRANSIT':
    case 'TRANSPORT':
      return CarrierTrackingStatus.IN_TRANSIT
    case 'ARRIVED':
    case 'CUSTOMS':
      return CarrierTrackingStatus.CUSTOMS
    case 'DELIVERY':
    case 'OUTFORDELIVERY':
      return CarrierTrackingStatus.OUT_FOR_DELIVERY
    case 'DELIVERED':
      return CarrierTrackingStatus.DELIVERED
    case 'EXCEPTION':
    case 'FAILED':
      return CarrierTrackingStatus.EXCEPTION
    case 'RETURNED':
    case 'CANCELLED':
      return CarrierTrackingStatus.CANCELLED
    default:
      return CarrierTrackingStatus.UNKNOWN
  }
}

/** 单产品 → 归一化报价（§5 比价输入） */
function toRateQuote(
  p: YunExpressProduct,
  chargeableKg: number,
  volumetricKg: number,
  isVolumetric: boolean,
  fallbackCurrency: string,
): RateQuote {
  const surcharges = p.fuelFee
    ? [{ type: 'fuel', name: '燃油附加费', amount: p.fuelFee, currency: p.currency || fallbackCurrency }]
    : undefined
  return {
    carrierCode: CarrierCode.YUNEXPRESS,
    productCode: p.productCode,
    productName: p.productName,
    chargeableWeightKg: Number(chargeableKg.toFixed(3)),
    volumetricWeightKg: Number(volumetricKg.toFixed(3)),
    isVolumetric,
    currency: p.currency || fallbackCurrency,
    carrierCost: p.fee,
    estimatedLeadDaysMin: p.leadTimeMin,
    estimatedLeadDaysMax: p.leadTimeMax,
    reachable: p.reachable ?? true,
    surcharges,
    remoteArea: p.remoteArea,
  }
}

/** 建单请求（归一化 → 云途） */
function toCreateRequest(req: CreateShipmentRequest): YunExpressCreateRequest {
  const p = req.parcels[0]
  const r = req.recipient
  return {
    orderNo: req.orderRef ?? `ORD-${Date.now()}`,
    cargoType: req.cargoType ?? 'general',
    declaredValue: req.declaredValue,
    currency: req.currency,
    recipient: {
      name: r?.name ?? 'Unknown',
      phone: r?.phone,
      email: r?.email,
      countryCode: r?.country ?? req.destCountry,
      state: r?.state,
      city: r?.city ?? '',
      address1: r?.address1 ?? '',
      address2: r?.address2,
      zip: r?.zip ?? req.destZip,
    },
    parcel: { weight: p.weightKg, length: p.lengthCm, width: p.widthCm, height: p.heightCm },
    customs: req.customs
      ? {
          hsCode: req.customs.hsCode,
          ioss: req.customs.ioss,
          eori: req.customs.eori,
          vat: req.customs.vat,
          dutyPrepaid: req.customs.dutyPrepaid,
        }
      : undefined,
  }
}

/** 取首箱尺寸（比价以首箱维度上报，多箱计费重已在上层 Σ，§4.2） */
function firstParcel(req: GetRatesRequest): { lengthCm: number; widthCm: number; heightCm: number } {
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
function normalizeAuthConfig(raw: unknown): YunExpressAuthConfig {
  const cfg = (raw ?? {}) as Partial<YunExpressAuthConfig>
  return {
    appId: cfg.appId ?? '',
    apiKey: cfg.apiKey ?? '',
    sandbox: cfg.sandbox ?? false,
    baseUrl: cfg.baseUrl,
  }
}

/** 校验云途统一响应包：code≠0 抛业务异常（§1.1） */
function assertEnvelope<T>(resp: RetryableResponse<YunExpressEnvelope<T>>): void {
  const env = resp.data as unknown as YunExpressEnvelope<T>
  if (!env || typeof env !== 'object' || env.code !== 0) {
    const code = (env as { code?: number } | null)?.code ?? 'n/a'
    throw new BusinessException(
      'YUNEXPRESS_API_ERROR',
      `云途接口返回非成功码：code=${code} message=${env?.message ?? ''} http=${resp.status}`,
      HttpStatus.BAD_GATEWAY,
    )
  }
}
