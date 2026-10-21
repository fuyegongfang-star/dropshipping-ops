import http from './http'

/**
 * Amazon SP-API 接口封装（方案 §29 完整对接）。
 * 与后端 AmazonController 的路由一一对应：FBA 头程入仓 / FBM 买运单 / 报表对账。
 * 演示模式（VITE_USE_MOCK=true）下由 mock-data.ts 同口径返回；正式模式走真实 /api 后端。
 */

/** 连接健康（LWA 令牌 + SP-API 区域可达性代理） */
export interface AmazonHealth {
  healthy: boolean
  latencyMs: number
  message: string
}

/** 入库计划输入项（卖家 SKU + 计划入仓数量） */
export interface AmazonInboundItemInput {
  sellerSku: string
  quantity: number
}

/** 入库计划项（含 Amazon 分配的 FNSKU） */
export interface AmazonInboundPlanItem {
  sellerSku: string
  quantity: number
  fulfillmentNetworkSku: string
}

/** FBA 入库计划（createInboundShipmentPlan 返回） */
export interface AmazonInboundShipmentPlan {
  shipmentPlanId: string
  destinationFulfillmentCenterId: string // 目的 FBA 仓（如 IND9）
  items: AmazonInboundPlanItem[]
}

/** FBA 货件（createInboundShipment / getInboundShipment 返回） */
export interface AmazonInboundShipment {
  shipmentId: string
  shipmentName: string
  destinationFulfillmentCenterId: string
  status: string // WORKING / IN_TRANSIT / DELIVERED
  items: Array<{ sellerSku: string; quantity: number }>
}

/** FBA 预处理指引 */
export interface AmazonPrepInstruction {
  sellerSku: string
  prepGuidance: string // NO_PREP_NEEDED / CONSULT_STYLE_GUIDE 等
  prepOwner?: string // AMAZON / SELLER
}

/** FBM 购买运单结果（含追踪号与面单文件） */
export interface AmazonShippingLabel {
  shipmentId: string
  trackingId: string
  labelFileType: string // PDF / PNG / ZPL203
  labelFileContents: string // base64 编码的面单文件
  downloadUrl?: string
}

/** Reports 报表（2021-06-30） */
export interface AmazonReport {
  reportId: string
  reportType: string
  processingStatus: string // IN_QUEUE / IN_PROGRESS / DONE / FATAL
  createdTime?: string
  dataStartTime?: string
  dataEndTime?: string
}

/** 结算汇总（解析结算报表得到） */
export interface AmazonSettlementSummary {
  currency: string
  totalAmount: number // 总入账（订单收入）
  totalFee: number // 总费用（绝对值）
  net: number // 净额 = 入账 − 费用
  transactionCount: number
  byType: Array<{ type: string; amount: number }>
}

/** 常用结算报表类型（演示下拉枚举） */
export const AMAZON_REPORT_TYPES = [
  '_GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2_',
  '_GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL_',
  '_GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA_',
]

export const amazonApi = {
  health: (shopId: string) => http.get<AmazonHealth>(`/amazon/${shopId}/health`),
  fbaPlan: (shopId: string, body: { items: AmazonInboundItemInput[]; shipFromAddress?: Record<string, string>; labelPrepPreference?: 'SELLER_LABEL' | 'AMAZON_LABEL' }) =>
    http.post<AmazonInboundShipmentPlan[]>(`/amazon/${shopId}/fba-inbound/plan`, body),
  fbaCreate: (
    shopId: string,
    body: {
      shipmentName: string
      plan: { shipmentPlanId: string; destinationFulfillmentCenterId: string; items: AmazonInboundPlanItem[] }
      shipFromAddress?: Record<string, string>
    },
  ) => http.post<AmazonInboundShipment>(`/amazon/${shopId}/fba-inbound`, body),
  fbaGet: (shopId: string, shipmentId: string) => http.get<AmazonInboundShipment>(`/amazon/${shopId}/fba-inbound/${shipmentId}`),
  fbaPrep: (shopId: string, skus: string) => http.get<AmazonPrepInstruction[]>(`/amazon/${shopId}/fba-inbound/prep?skus=${encodeURIComponent(skus)}`),
  shippingLabel: (
    shopId: string,
    body: { amazonOrderId: string; items: AmazonInboundItemInput[]; shipFromAddress?: Record<string, string> },
  ) => http.post<AmazonShippingLabel>(`/amazon/${shopId}/shipping/label`, body),
  requestReport: (shopId: string, body: { reportType: string; dataStartTime?: string; dataEndTime?: string }) =>
    http.post<AmazonReport>(`/amazon/${shopId}/reports`, body),
  getReport: (shopId: string, reportId: string) => http.get<AmazonReport>(`/amazon/${shopId}/reports/${reportId}`),
  settlement: (shopId: string, documentId: string) =>
    http.get<AmazonSettlementSummary>(`/amazon/${shopId}/reports/settlement/${documentId}`),
}
