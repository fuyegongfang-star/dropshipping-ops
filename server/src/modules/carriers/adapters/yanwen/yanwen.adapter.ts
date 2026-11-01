/**
 * 燕文 Yanwen 适配器（任务 3.4，方案 §1.1 / §3）。
 * 实现能力：建单 / 面单(运单详情) / 轨迹(轮询) —— 燕文无公开自助比价与取消 API，且走轮询（§1.2.2），
 * 故 getRates / cancelShipment / subscribeTracking 抛清晰业务异常（诚实优于静默成功）。
 * 鉴权：MD5 签名（apitoken+user_id+data+format+method+timestamp+version+apitoken，32 位小写，§1.1）。
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
import { md5Sign } from '../md5-sign.service'
import {
  YANWEN_API_VERSION,
  YANWEN_BASE_URL,
  YANWEN_REQUEST_TIMEOUT_MS,
  YanwenAuthConfig,
} from './yanwen-auth.config'

/** 建单/面单/轨迹响应 data（§1.1；字段命名以联调官网为准） */
interface YanwenOperateData {
  waybillNumber?: string // 燕文运单号（轨迹号）
  trackingNo?: string
  labelUrl?: string // 面单链接
  status?: string // 原生状态
  trackDetails?: { status: string; location?: string; time?: string; description?: string }[]
}

/**
 * 燕文适配器：三能力映射（SHIP/LABEL/TRACK）+ MD5 鉴权 + 重试。
 * 构造期不校验凭证（探针/健康检查需无凭证构建），真实调用前 assertConfig 校验（§2.2）。
 */
export class YanwenAdapter extends AbstractCarrierAdapter {
  private readonly config: YanwenAuthConfig

  constructor(account: CarrierAccountContext, http: RetryableHttpService, logger: AppLogger) {
    super(CarrierCode.YANWEN, http, logger)
    this.config = normalizeAuthConfig(account.authConfig)
  }

  /** 燕文能力声明：仅 SHIP/LABEL/TRACK（无比价/取消/订阅，§1.1/§1.2.2） */
  protected capabilities(): CarrierCapability[] {
    return [CarrierCapability.SHIP, CarrierCapability.LABEL, CarrierCapability.TRACK]
  }

  /** 当前使用的基地址（自定义优先，否则默认生产，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? YANWEN_BASE_URL.prod
  }

  /** 真实调用前校验凭证完整性（§2.2） */
  private assertConfig(): void {
    if (!this.config.userId || !this.config.apiToken) {
      throw new BusinessException(
        'YANWEN_AUTH_MISSING',
        '燕文账号未配置 userId/apiToken（请在租户 CarrierAccount 中配置，§2.2）',
        HttpStatus.BAD_REQUEST,
      )
    }
  }

  /** 燕文无公开比价 API → 诚实报错（能力未声明 RATE） */
  async getRates(_req: GetRatesRequest): Promise<RateQuote[]> {
    throw new BusinessException(
      'YANWEN_RATE_UNSUPPORTED',
      '燕文无公开自助比价 API；比价请走合约价卡（rate card，§4/§5），待阶段3 费率卡接入',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  /** 建单：归一化请求 → 燕文建单 → 结果 */
  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    this.assertConfig()
    const param = {
      orderNo: req.orderRef ?? `ORD-${Date.now()}`,
      cargoType: req.cargoType ?? 'general',
      declaredValue: req.declaredValue,
      currency: req.currency,
      recipient: {
        name: req.recipient?.name ?? 'Unknown',
        email: req.recipient?.email,
        phone: req.recipient?.phone,
        countryCode: req.recipient?.country ?? req.destCountry,
        city: req.recipient?.city ?? '',
        address1: req.recipient?.address1 ?? '',
        zip: req.recipient?.zip ?? req.destZip,
      },
      parcel: { weight: req.parcels[0].weightKg },
    }
    const data = await this.callYanwen<YanwenOperateData>('order.create', '/api/order/create', param)
    const currency = req.currency ?? 'USD'
    // 成本以建单后计费回传/对账为准（§9/§10），建单当下不可知 → 返回 null（「成本待回传」）。
    // 严禁占位 0：下游利润/对账以 carrierCost 为 null 过滤排除，避免系统性高估利润（review C1）。
    // TODO(ops): 2026-11 接入燕文费用回传后填充真实 carrierCost（§9 对账）
    return {
      waybillNo: data.waybillNumber ?? '',
      trackingNo: data.trackingNo ?? data.waybillNumber,
      labelUrl: data.labelUrl,
      carrierCost: null,
      currency,
    }
  }

  /** 面单：按运单号查询运单详情取面单（§3 getLabel，落 MinIO，§2.1） */
  async getLabel(waybillNo: string): Promise<CarrierLabel> {
    this.assertConfig()
    const data = await this.callYanwen<YanwenOperateData>('order.detail', '/api/order/detail', {
      waybillNumber: waybillNo,
    })
    return { waybillNo, format: 'pdf', content: undefined, url: data.labelUrl }
  }

  /** 轨迹：查询并归一化（轮询，§3/§6） */
  async getTracking(no: string): Promise<CarrierTrackingResult> {
    this.assertConfig()
    const data = await this.callYanwen<YanwenOperateData>('track.query', '/api/track/query', { trackingNo: no })
    const events: CarrierTrackingEvent[] = (data.trackDetails ?? []).map((e) => ({
      status: mapYanwenStatus(e.status),
      location: e.location,
      occurredAt: e.time ?? '',
      description: e.description,
    }))
    const current = events.length > 0 ? events[events.length - 1].status : CarrierTrackingStatus.UNKNOWN
    return { trackingNo: data.waybillNumber ?? no, carrierCode: CarrierCode.YANWEN, status: current, events }
  }

  /** 燕文无公开自助取消 API → 诚实报错（§1.1/§13.2） */
  async cancelShipment(_no: string): Promise<void> {
    throw new BusinessException(
      'YANWEN_CANCEL_UNSUPPORTED',
      '燕文无公开自助取消 API；取消请走承运商门户/工单（阶段5 接入，§1.1/§13.2）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  /** 燕文走轮询不支持推送订阅（§1.2.2）→ 诚实报错 */
  async subscribeTracking(_no: string): Promise<void> {
    throw new BusinessException(
      'YANWEN_SUBSCRIBE_UNSUPPORTED',
      '燕文轨迹走轮询（§1.2.2），不支持推送订阅；请用定时轮询兜底（§6）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  // —— 以下为 燕文调用基础设施 ——

  /** 带 MD5 签名的 GET 调用（§1.1 鉴权矩阵） */
  private async callYanwen<TData>(method: string, path: string, dataObj: unknown): Promise<TData> {
    const ts = Date.now()
    const version = YANWEN_API_VERSION
    const format = 'json'
    const dataStr = JSON.stringify(dataObj)
    // 规范化串：apitoken+user_id+data+format+method+timestamp+version+apitoken（§1.1），32 位小写 MD5
    const canonical = `${this.config.apiToken}${this.config.userId}${dataStr}${format}${method}${ts}${version}${this.config.apiToken}`
    const sign = md5Sign(canonical)
    const query = new URLSearchParams({
      user_id: this.config.userId,
      method,
      format,
      timestamp: String(ts),
      version,
      data: dataStr,
      sign,
    }).toString()
    const options: RetryableRequestOptions = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: YANWEN_REQUEST_TIMEOUT_MS,
    }
    const resp = await this.http.request<TData>(`${this.baseUrl}${path}?${query}`, options)
    return resp.data
  }
}

/** 燕文原生状态 → 归一化轨迹状态（§6） */
function mapYanwenStatus(raw: string): CarrierTrackingStatus {
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

/** 容错解析鉴权配置（构造期不抛，缺凭证在真实调用前拦截，§2.2） */
function normalizeAuthConfig(raw: unknown): YanwenAuthConfig {
  const cfg = (raw ?? {}) as Partial<YanwenAuthConfig>
  return {
    userId: cfg.userId ?? '',
    apiToken: cfg.apiToken ?? '',
    sandbox: cfg.sandbox ?? false,
    baseUrl: cfg.baseUrl,
  }
}
