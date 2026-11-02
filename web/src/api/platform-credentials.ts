/**
 * 平台凭证管理前端接口（任务 8.2，方案 §17.2 凭证工厂化接入）。
 * 类型与标签对齐后端 platform-credentials.constants.ts；对接 http.ts（演示/正式双路）。
 *
 * 后端已就绪：platform-credentials 模块（加密落库 + 平台→适配器工厂），本模块为其前端接入层。
 * 演示模式（VITE_USE_MOCK）下由 mock-data.ts 同口径内存实现，无需后端即可体验完整闭环。
 */
import http from './http'

/** 受凭证工厂管理的平台代码 */
export type PlatformCode =
  | 'taobao'
  | 'douyin'
  | 'yunexpress'
  | 'dhl'
  | 'fourpx'
  | 'yanwen'

/** 平台鉴权方式（驱动表单提示文案） */
export type PlatformAuthType =
  | 'top_session'
  | 'oauth2_client'
  | 'hmac_sha256'
  | 'md5'
  | 'app_key_secret'

/** 单字段定义（驱动动态表单渲染） */
export interface PlatformFieldDef {
  /** 字段 key（对齐后端 PLATFORM_META.requiredFields / 可选字段） */
  key: string
  label: string
  placeholder?: string
  /** 是否敏感（查看/编辑时掩码，需二次确认后明文显示，明文仅驻留内存） */
  secret?: boolean
}

/** 平台定义（前端表单渲染用，镜像后端 PLATFORM_META） */
export interface PlatformDefinition {
  code: PlatformCode
  label: string
  authType: PlatformAuthType
  authHint: string
  /** 必填字段 */
  required: PlatformFieldDef[]
  /** 可选字段 */
  optional: PlatformFieldDef[]
  /** 是否承运商侧平台（true→桥接承运商注册表，false→桥接渠道注册表） */
  carrierSide: boolean
  capabilities: string[]
  defaultGateway?: string
}

/** 凭证列表项（脱敏） */
export interface CredentialListItem {
  platform: PlatformCode
  label: string
  authType: string
  carrierSide: boolean
  capabilities: string[]
  status: 'configured' | 'empty'
  updatedAt?: string
}

/** 解密后的凭证明细（查看明文用） */
export interface CredentialDetail {
  platform: PlatformCode
  fields: Record<string, string>
}

/** 写入回执（含桥接状态） */
export interface CredentialSaveResult {
  platform: PlatformCode
  status: 'configured'
  binding: {
    platform: PlatformCode
    label: string
    carrierSide: boolean
    capabilities: string[]
    status: 'scaffold-todo'
    note: string
  }
}

/** 单平台桥接状态（任务 10.1，凭证工厂 ↔ 注册表 真实桥接快照） */
export interface IntegrationItem {
  platform: PlatformCode
  label: string
  carrierSide: boolean
  hasCredential: boolean
  /** 适配器已通过注册表桥接（凭证 → 实例） */
  wired: boolean
  /** 桥接目标端：carrier=承运商注册表 / channel=渠道注册表 / none=无桥接目标 */
  target: 'carrier' | 'channel' | 'none'
  adapterCode?: string
  reason: string
  /** 真实联网 API 调用是否仍待联调（诚实标注） */
  realApiTodo: boolean
}

/** 平台定义表（新增平台：后端 PLATFORM_META 登记一处，前端此处登记一处） */
export const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  {
    code: 'taobao',
    label: '淘宝 TOP',
    authType: 'top_session',
    authHint: 'appKey + appSecret 换取卖家 session；授权后回填 session 字段。',
    required: [
      { key: 'appKey', label: 'App Key' },
      { key: 'appSecret', label: 'App Secret', secret: true },
    ],
    optional: [
      { key: 'session', label: 'Session', secret: true, placeholder: '授权后回填' },
      { key: 'gateway', label: '网关地址', placeholder: '默认 gw.api.taobao.com/router/rest' },
    ],
    carrierSide: false,
    capabilities: ['pull', 'fulfill'],
  },
  {
    code: 'douyin',
    label: '抖音开放平台',
    authType: 'oauth2_client',
    authHint: 'appKey + appSecret 经 OAuth2 client_credentials 换取 access_token。',
    required: [
      { key: 'appKey', label: 'App Key' },
      { key: 'appSecret', label: 'App Secret', secret: true },
    ],
    optional: [
      { key: 'accessToken', label: 'Access Token', secret: true, placeholder: '授权后回填' },
      { key: 'shopId', label: '店铺 ID' },
    ],
    carrierSide: false,
    capabilities: ['pull', 'fulfill'],
  },
  {
    code: 'yunexpress',
    label: '云途 YunExpress',
    authType: 'hmac_sha256',
    authHint: 'HMAC-SHA256 签名（canonical = appId.timestamp.body）；appId + appKey + secret。',
    required: [
      { key: 'appId', label: 'App ID' },
      { key: 'appKey', label: 'App Key' },
      { key: 'secret', label: 'Secret', secret: true },
    ],
    optional: [{ key: 'gateway', label: '网关地址', placeholder: '默认 open.yunexpress.com' }],
    carrierSide: true,
    capabilities: ['rate', 'ship', 'label', 'track', 'subscribe'],
    defaultGateway: 'https://open.yunexpress.com',
  },
  {
    code: 'dhl',
    label: 'DHL Express',
    authType: 'oauth2_client',
    authHint: 'OAuth2 Basic（clientId:clientSecret base64）+ DHL-API-Key 头换取 token。',
    required: [
      { key: 'apiKey', label: 'API Key', secret: true },
      { key: 'apiSecret', label: 'API Secret', secret: true },
    ],
    optional: [
      { key: 'accountNumber', label: '账户号' },
      { key: 'gateway', label: '网关地址', placeholder: '默认 api.dhl.com' },
    ],
    carrierSide: true,
    capabilities: ['rate', 'ship', 'label', 'track'],
    defaultGateway: 'https://api.dhl.com',
  },
  {
    code: 'fourpx',
    label: '递四方 4PX',
    authType: 'md5',
    authHint: 'MD5 签名（32 位小写）；客户号 + 密钥。',
    required: [
      { key: 'customerCode', label: '客户号' },
      { key: 'customerKey', label: '密钥', secret: true },
    ],
    optional: [{ key: 'gateway', label: '网关地址', placeholder: '默认 open.4px.com' }],
    carrierSide: true,
    capabilities: ['rate', 'ship', 'label', 'track', 'cancel'],
    defaultGateway: 'https://open.4px.com',
  },
  {
    code: 'yanwen',
    label: '燕文 Yanwen',
    authType: 'md5',
    authHint: 'MD5 签名；商户号 + token。',
    required: [
      { key: 'customerCode', label: '商户号' },
      { key: 'token', label: 'Token', secret: true },
    ],
    optional: [{ key: 'gateway', label: '网关地址', placeholder: '默认 api.yanwen.com.cn' }],
    carrierSide: true,
    capabilities: ['rate', 'ship', 'track'],
    defaultGateway: 'https://api.yanwen.com.cn',
  },
]

const PLATFORM_MAP: Record<string, PlatformDefinition> = Object.fromEntries(
  PLATFORM_DEFINITIONS.map((p) => [p.code, p]),
)

/** 按平台代码取定义（未知则返回 undefined） */
export function getPlatformDef(code: string): PlatformDefinition | undefined {
  return PLATFORM_MAP[code]
}

/** 平台鉴权方式中文标签 */
export const AUTH_TYPE_LABELS: Record<PlatformAuthType, string> = {
  top_session: 'TOP Session',
  oauth2_client: 'OAuth2 Client',
  hmac_sha256: 'HMAC-SHA256',
  md5: 'MD5 签名',
  app_key_secret: 'AppKey/Secret',
}

/** 能力中文标签（与承运商/渠道能力对齐展示） */
export const CAPABILITY_LABELS: Record<string, string> = {
  pull: '拉单',
  fulfill: '推单回传',
  rate: '查价',
  ship: '建单',
  label: '面单',
  track: '轨迹',
  cancel: '取消',
  subscribe: '订阅',
}

/** 平台凭证管理接口封装（演示/正式双路，统一经 http.ts） */
export const platformCredentialsApi = {
  /** 凭证列表（脱敏，含各平台配置状态） */
  list: () => http.get<CredentialListItem[]>('/platform-credentials'),
  /** 查看某平台凭证明文（需前端二次确认后调用，明文仅驻留内存） */
  get: (platform: string) =>
    http.get<CredentialDetail>(`/platform-credentials/${platform}`),
  /** 写入/更新凭证（明文入参，后端加密落库） */
  save: (platform: string, fields: Record<string, string>) =>
    http.post<CredentialSaveResult>('/platform-credentials', { platform, fields }),
  /** 删除凭证 */
  remove: (platform: string) =>
    http.delete<{ deleted: boolean }>(`/platform-credentials/${platform}`),
  /** 集成桥接状态快照（任务 10.1：凭证 → 适配器注册表 桥接就绪情况） */
  integration: () => http.get<IntegrationItem[]>('/platform-credentials/integration'),
}

export default platformCredentialsApi
