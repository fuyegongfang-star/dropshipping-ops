/**
 * DHL 内部映射 DTO（任务 3.3，方案 §1.1）。
 * 承载「归一化 DTO ↔ DHL MyDHL API 原生报文」转换中间结构；字段命名以联调 DHL 官网文档为准（§1.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** 比价响应中的单个产品（MyDHL Rating products[]） */
export interface DhlRateProduct {
  productName: string // 产品名（如 DHL Express Worldwide）
  productCode?: string // 服务代码（如 'P'）
  totalPrice?: { type?: string; price: number; currency: string }[] // 价格明细（取首个为本币成本）
}

/** 比价响应（GET /v1/rates） */
export interface DhlRateResponse {
  products: DhlRateProduct[]
}

/** 建单响应（POST /v1/shipments，§1.1 Shipment） */
export interface DhlShipmentResponse {
  shipmentTrackingNumber?: string // 轨迹号（DHL 主追踪号）
  shipmentId?: string // 运单内部 ID
  labels?: { binaryData?: string; type?: string }[] // 面单（base64 PDF/ZPL）
}

/** 轨迹响应（GET /v1/shipments/{id}/tracking，轮询，§6） */
export interface DhlTrackingResponse {
  shipments?: {
    trackingEvents?: {
      dateTime: string // 发生时间（UTC ISO）
      status: string // DHL 原生状态
      description?: string // 节点描述
      location?: { address?: { cityName?: string; countryName?: string } } // 地点（嵌套）
    }[]
  }[]
}
