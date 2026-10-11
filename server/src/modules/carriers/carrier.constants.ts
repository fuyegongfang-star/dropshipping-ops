/**
 * 承运商适配器常量与枚举（方案 §3 承运商适配器架构 / §2.2 多租户×承运商账号）。
 * Carrier（承运商）= 物流服务商（云途/DHL/4PX/燕文/聚合平台）；与渠道（Channel）区分。
 * 枚举值对齐 Prisma `Carrier.code` 字段。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

/** 承运商代码（对齐 Carrier.code） */
export enum CarrierCode {
  YUNEXPRESS = 'yunexpress', // 云途（§1.1 官方 SDK 可复用）
  DHL = 'dhl', // DHL Express（MyDHL API，OAuth2）
  FOURPX = 'fourpx', // 递四方（MD5 签名 router API）
  YANWEN = 'yanwen', // 燕文（MD5 签名）
  AGGREGATOR = 'aggregator', // 聚合平台兜底（AfterShip/17track 尾程，§1.2.5）
  MOCK = 'mock', // 仅用于开发与测试（无真实承运商），框架自测
}

/** 承运商鉴权方式（对齐 Carrier.authType，§1.1） */
export enum CarrierAuthType {
  OAUTH2 = 'oauth2', // 云途/DHL
  HMAC = 'hmac', // 云途 HMAC-SHA256
  MD5 = 'md5', // 4PX/燕文 MD5 签名
}

/**
 * 适配器能力声明。各承运商能力不同（如聚合平台仅轨迹），
 * 注册表/服务可据此判可达性，避免调用不支持的接口。
 */
export enum CarrierCapability {
  RATE = 'rate', // 运费试算/比价（getRates）
  SHIP = 'ship', // 建单/推单（createShipment）
  LABEL = 'label', // 面单获取（getLabel）
  TRACK = 'track', // 轨迹查询（getTracking）
  CANCEL = 'cancel', // 取消运单（cancelShipment）
  SUBSCRIBE = 'subscribe', // 轨迹订阅推送（subscribeTracking，云途类）
}

/** 承运商健康状态 */
export interface CarrierHealth {
  healthy: boolean // 适配器是否可用
  latencyMs?: number // 探测耗时（毫秒）
  message?: string // 附加说明
  capabilities?: CarrierCapability[] // 该适配器支持的能力
}
