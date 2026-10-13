/**
 * 面单生成规格（任务 3.9，方案 §3 getLabel / §11 面单渲染）。
 * 前端「两段式运单」页按每段运单传入，后端渲染 PDF（pdf-lib）与 ZPL（热敏）两种格式。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { LegType } from '../dto/rate.dto'

/** 面单生成入参 */
export interface LabelSpec {
  carrierCode: string // 承运商代码
  carrierName?: string // 承运商展示名
  waybillNo: string // 运单号（必填，作文件名与条码内容）
  trackingNo?: string // 轨迹号（条码优先用此）
  recipient?: {
    name?: string
    country?: string
    city?: string
    address1?: string
  }
  origin?: string // 始发地
  destCountry?: string // 目的国
  weightKg?: number // 重量
  legType?: LegType // 物流段（§14）
  transitHub?: string // 转运节点
}

/** 面单生成结果（PDF + ZPL 双格式） */
export interface LabelResult {
  waybillNo: string
  fileName: string // 下载文件名（label-{waybillNo}.pdf）
  pdfBase64: string // PDF 字节 base64（前端 data:application/pdf 直接预览/打印）
  zpl: string // ZPL II 文本（热敏打印机指令）
  generatedAt: string
}
