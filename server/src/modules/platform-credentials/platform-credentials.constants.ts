/**
 * 平台凭证常量与契约（任务 NEXT-1，方案 §2.2/§17.2）。
 *
 * 统一收敛「真实平台凭证」的接入面：淘宝 TOP / 抖音开放平台 / 云途 / DHL / 4PX / 燕文。
 * 本文件仅定义契约（平台枚举、鉴权方式、各平台凭证结构、平台元数据）；
 * 加密落库见 platform-credential.service.ts，真实 API 联调见 platform-adapter.factory.ts（TODO）。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次（主线收口后）
 */

/** 受统一凭证工厂管理的平台（与承运商/渠道代码对齐，便于后续桥接注册表） */
export enum PlatformKind {
  TAOBAO = 'taobao', // 淘宝 TOP（淘宝客/淘宝开放平台）
  DOUYIN = 'douyin', // 抖音开放平台
  YUNEXPRESS = 'yunexpress', // 云途 YunExpress
  DHL = 'dhl', // DHL Express
  FOURPX = 'fourpx', // 递四方 4PX
  YANWEN = 'yanwen', // 燕文 Yanwen
  MOCK = 'mock', // 仅本地/演示（无真实平台）
}

/** 平台鉴权方式（决定签名/令牌获取逻辑，真实联调时按平台实现） */
export enum PlatformAuthType {
  TOP_SESSION = 'top_session', // 淘宝 TOP：appKey+appSecret 换 session
  OAUTH2_CLIENT = 'oauth2_client', // 抖音/DHL：client_credentials 换 token
  HMAC_SHA256 = 'hmac_sha256', // 云途：HMAC-SHA256 签名
  MD5 = 'md5', // 4PX/燕文：MD5 签名
  APP_KEY_SECRET = 'app_key_secret', // 通用 appKey+secret
}

/** 各平台凭证结构（仅声明字段，运行期加密存储，不落明文） */

/** 淘宝 TOP 凭证 */
export interface TaobaoTopCredentials {
  appKey: string
  appSecret: string
  session?: string // 卖家 session（授权后回填）
  gateway?: string // 默认 https://gw.api.taobao.com/router/rest
}

/** 抖音开放平台凭证 */
export interface DouyinOpenCredentials {
  appKey: string
  appSecret: string
  accessToken?: string // 授权后回填
  shopId?: string
}

/** 云途 YunExpress 凭证 */
export interface YuntuCredentials {
  appId: string
  appKey: string
  secret: string // 用于 HMAC-SHA256 签名
  gateway?: string // 默认 https://open.yunexpress.com
}

/** DHL Express 凭证 */
export interface DhlCredentials {
  apiKey: string
  apiSecret: string
  accountNumber?: string
  gateway?: string // 默认 https://api.dhl.com
}

/** 4PX 凭证 */
export interface FourPxCredentials {
  customerCode: string
  customerKey: string
  gateway?: string // 默认 https://open.4px.com
}

/** 燕文 Yanwen 凭证 */
export interface YanwenCredentials {
  customerCode: string
  token: string
  gateway?: string // 默认 https://api.yanwen.com.cn
}

/** 平台元信息（驱动表单渲染 / 校验 / 默认网关 / 能力声明） */
export interface PlatformMeta {
  kind: PlatformKind
  label: string
  authType: PlatformAuthType
  /** 必填字段（前端表单与后端校验共用） */
  requiredFields: string[]
  /** 能力声明（与承运商/渠道适配器能力对齐，便于后续桥接） */
  capabilities: string[]
  defaultGateway?: string
  /** 是否承运商侧平台（true→桥接 CarrierRegistry；false→桥接 ChannelRegistry） */
  carrierSide: boolean
}

/** 平台元信息表（新增平台在此登记一处即可） */
export const PLATFORM_META: Record<PlatformKind, PlatformMeta> = {
  [PlatformKind.TAOBAO]: {
    kind: PlatformKind.TAOBAO,
    label: '淘宝 TOP',
    authType: PlatformAuthType.TOP_SESSION,
    requiredFields: ['appKey', 'appSecret'],
    capabilities: ['pull', 'fulfill'],
    carrierSide: false,
  },
  [PlatformKind.DOUYIN]: {
    kind: PlatformKind.DOUYIN,
    label: '抖音开放平台',
    authType: PlatformAuthType.OAUTH2_CLIENT,
    requiredFields: ['appKey', 'appSecret'],
    capabilities: ['pull', 'fulfill'],
    carrierSide: false,
  },
  [PlatformKind.YUNEXPRESS]: {
    kind: PlatformKind.YUNEXPRESS,
    label: '云途 YunExpress',
    authType: PlatformAuthType.HMAC_SHA256,
    requiredFields: ['appId', 'appKey', 'secret'],
    capabilities: ['rate', 'ship', 'label', 'track', 'subscribe'],
    defaultGateway: 'https://open.yunexpress.com',
    carrierSide: true,
  },
  [PlatformKind.DHL]: {
    kind: PlatformKind.DHL,
    label: 'DHL Express',
    authType: PlatformAuthType.OAUTH2_CLIENT,
    requiredFields: ['apiKey', 'apiSecret'],
    capabilities: ['rate', 'ship', 'label', 'track'],
    defaultGateway: 'https://api.dhl.com',
    carrierSide: true,
  },
  [PlatformKind.FOURPX]: {
    kind: PlatformKind.FOURPX,
    label: '递四方 4PX',
    authType: PlatformAuthType.MD5,
    requiredFields: ['customerCode', 'customerKey'],
    capabilities: ['rate', 'ship', 'label', 'track', 'cancel'],
    defaultGateway: 'https://open.4px.com',
    carrierSide: true,
  },
  [PlatformKind.YANWEN]: {
    kind: PlatformKind.YANWEN,
    label: '燕文 Yanwen',
    authType: PlatformAuthType.MD5,
    requiredFields: ['customerCode', 'token'],
    capabilities: ['rate', 'ship', 'track'],
    defaultGateway: 'https://api.yanwen.com.cn',
    carrierSide: true,
  },
  [PlatformKind.MOCK]: {
    kind: PlatformKind.MOCK,
    label: 'Mock 平台',
    authType: PlatformAuthType.APP_KEY_SECRET,
    requiredFields: [],
    capabilities: ['rate', 'ship', 'track'],
    carrierSide: true,
  },
}
