/**
 * 云途内部映射 DTO（任务 3.2，方案 §1.1）。
 * 承载「归一化 DTO ↔ 云途原生报文」转换过程中的中间结构；字段命名以联调云途开放平台
 * 官网文档为准（§1.1），联调阶段仅校正本文件与 yunexpress.adapter.ts 的映射函数。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** 收件人（PII，落库需脱敏/加密，§17） */
export interface YunExpressRecipient {
  name: string // 收件人姓名
  phone?: string // 联系电话
  email?: string // 邮箱
  countryCode: string // 国家代码（ISO2，如 US/GB/DE）
  state?: string // 州/省
  city: string // 城市
  address1: string // 地址行 1
  address2?: string // 地址行 2
  zip?: string // 邮编
}

/** 单箱（重量 kg / 尺寸 cm） */
export interface YunExpressParcel {
  weight: number // 实重（kg）
  length: number // 长（cm）
  width: number // 宽（cm）
  height: number // 高（cm）
}

/** 报关/合规字段（挂在 shipment，§19） */
export interface YunExpressCustoms {
  hsCode?: string // HS 编码
  ioss?: string // IOSS（欧盟 VAT 简化）
  eori?: string // EORI
  vat?: string // VAT 号
  dutyPrepaid?: string // 关税预付方式 DDP/DDU
}

/** 建单请求体 */
export interface YunExpressCreateRequest {
  orderNo: string // 商户/平台单号（关联 orderRef）
  cargoType?: string // 货物类型（general/battery/...，§4.3）
  declaredValue?: number // 申报价值
  currency?: string // 申报币种（ISO 4217）
  recipient: YunExpressRecipient
  parcel: YunExpressParcel
  customs?: YunExpressCustoms
}

/** 建单响应 data */
export interface YunExpressCreateData {
  wayBillNo: string // 云途运单号
  trackingNo?: string // 轨迹号（部分渠道与运单号不同）
  labelUrl?: string // 面单下载链接
}

/** 比价响应中的单个产品 */
export interface YunExpressProduct {
  productCode: string // 物流产品代码
  productName: string // 产品名（如「云途-标准专线」）
  fee: number // 运费（承运商成本，本币）
  currency: string // 币种
  leadTimeMin?: number // 预计时效下限（工作日）
  leadTimeMax?: number // 预计时效上限（工作日）
  reachable?: boolean // 是否可达
  remoteArea?: boolean // 是否偏远地区
  fuelFee?: number // 燃油附加费（本币）
}

/** 比价响应 data */
export interface YunExpressPricingData {
  products: YunExpressProduct[] // 多产品报价（§4/§5 比价输入）
}

/** 轨迹节点 */
export interface YunExpressTrackingDetail {
  status: string // 云途原生状态（需归一化）
  location?: string // 地点
  dateTime: string // 发生时间（UTC ISO）
  description?: string // 节点描述
}

/** 轨迹响应 data */
export interface YunExpressTrackingData {
  trackingNo: string // 轨迹号
  status: string // 云途原生当前状态
  details: YunExpressTrackingDetail[] // 轨迹节点列表
}

/** 面单打印响应 data */
export interface YunExpressLabelData {
  labelUrl?: string // 面单下载链接（落 MinIO，§2.1）
  labelBase64?: string // 面单 base64（直传 PDF）
}

/** 云途统一响应包（code=0 成功，其余为业务错误码，§1.1） */
export interface YunExpressEnvelope<T> {
  code: number // 业务码（0=成功）
  message?: string // 错误信息（失败时）
  data: T // 业务数据
}
