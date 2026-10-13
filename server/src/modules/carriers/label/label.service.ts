/**
 * 面单渲染服务（任务 3.9，方案 §3 getLabel / §11 面单渲染）。
 *
 * 职责：把一段运单（§14 头程/尾程）渲染为两种可打印格式：
 *  - PDF（pdf-lib，A6/4x6 标签尺寸，含承运商抬头、运单号、轨迹号、收件人、重量与仿条码）；
 *  - ZPL II（热敏打印机指令文本，含 ^BC Code128 条码与 ^FD 文本字段）。
 *
 * 说明：条码为「可见占位 + 打印机可读」双层——PDF 用竖向黑条仿条码（视觉），ZPL 用 ^BC 真条码字段
 *      （打印机渲染），均编码 waybillNo/trackingNo；正式对接时替换为承运商提供的真实条码规则（TODO 3.9 联调）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { Injectable } from '@nestjs/common'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { LabelSpec, LabelResult } from './label.types'

/** 4x6 英寸标签尺寸（点：72dpi） */
const LABEL_W = 288
const LABEL_H = 432
const INK = rgb(0.1, 0.12, 0.2)

/**
 * PDF 标准字体仅支持 WinAnsi（拉丁字符）。中文/特殊符号无法编码会抛错，
 * 故 PDF 文本统一降为 ASCII（中文承运商名回退为代码）；ZPL 文本保留原文（打印机自行处理编码）。
 */
const pdfText = (s?: string): string => (s ?? '').replace(/[^\x20-\x7E]/g, '')

@Injectable()
export class LabelService {
  /** 生成 PDF（buffer）与 ZPL（文本）双格式结果 */
  async build(spec: LabelSpec): Promise<LabelResult> {
    const [pdfBytes, zpl] = await Promise.all([this.generatePdf(spec), Promise.resolve(this.generateZpl(spec))])
    return {
      waybillNo: spec.waybillNo,
      fileName: `label-${spec.waybillNo}.pdf`,
      pdfBase64: Buffer.from(pdfBytes).toString('base64'),
      zpl,
      generatedAt: new Date().toISOString(),
    }
  }

  /** 渲染 PDF 面单（pdf-lib） */
  private async generatePdf(spec: LabelSpec): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    const page = doc.addPage([LABEL_W, LABEL_H])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

    const carrier = pdfText(spec.carrierName) || spec.carrierCode.toUpperCase()
    const barcodeData = spec.trackingNo ?? spec.waybillNo

    // 承运商抬头条
    page.drawRectangle({ x: 0, y: LABEL_H - 40, width: LABEL_W, height: 40, color: INK })
    page.drawText(carrier, { x: 14, y: LABEL_H - 28, size: 16, font: fontBold, color: rgb(1, 1, 1) })

    // 运单号（大字号）
    page.drawText('WAYBILL', { x: 14, y: LABEL_H - 64, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(pdfText(spec.waybillNo), { x: 14, y: LABEL_H - 80, size: 15, font: fontBold, color: INK })

    // 轨迹号
    page.drawText('TRACKING', { x: 14, y: LABEL_H - 104, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(pdfText(barcodeData), { x: 14, y: LABEL_H - 120, size: 11, font: fontBold, color: INK })

    // 收件人
    const r = spec.recipient
    if (r) {
      const lines = [
        pdfText(r.name),
        [r.country, r.city].filter(Boolean).join(', '),
        pdfText(r.address1),
      ]
        .map(pdfText)
        .filter(Boolean)
      page.drawText('SHIP TO', { x: 14, y: LABEL_H - 144, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      lines.forEach((ln, i) => {
        page.drawText(ln, { x: 14, y: LABEL_H - 160 - i * 14, size: 10, font, color: INK })
      })
    }

    // 路由与重量（PDF 标准字体仅支持 WinAnsi，分隔符用 ASCII `>` 而非箭头）
    const route = [spec.origin, spec.transitHub, spec.destCountry].filter(Boolean).join(' > ')
    page.drawText(pdfText(route) || '-', { x: 14, y: 70, size: 9, font, color: INK })
    if (spec.weightKg != null) {
      page.drawText(`Weight: ${spec.weightKg} kg`, { x: 14, y: 54, size: 9, font, color: INK })
    }

    // 仿条码（竖向黑条，视觉占位；真实条码由 ZPL ^BC 提供）
    this.drawFauxBarcode(page, barcodeData, 14, 14, LABEL_W - 28, 32)

    return doc.save()
  }

  /** 把字符串哈希为竖向黑条，模拟条码视觉（非可扫描，仅占位） */
  private drawFauxBarcode(
    page: ReturnType<PDFDocument['addPage']>,
    data: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    let seed = 0
    for (let i = 0; i < data.length; i++) seed = (seed * 31 + data.charCodeAt(i)) >>> 0
    const bars = 48
    const bw = w / bars
    for (let i = 0; i < bars; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      if (seed % 2 === 0) {
        page.drawRectangle({ x: x + i * bw, y, width: bw * 0.7, height: h, color: INK })
      }
    }
  }

  /** 生成 ZPL II 面单（热敏打印机指令；^BC 真条码 + ^FD 文本字段） */
  private generateZpl(spec: LabelSpec): string {
    const carrier = spec.carrierName ?? spec.carrierCode
    const barcodeData = spec.trackingNo ?? spec.waybillNo
    const r = spec.recipient
    const shipTo = [r?.name, r?.country, r?.city, r?.address1].filter(Boolean).join('\\&')
    const route = [spec.origin, spec.transitHub, spec.destCountry].filter(Boolean).join(' > ')
    const weight = spec.weightKg != null ? `Weight: ${spec.weightKg} kg` : ''
    return [
      '^XA',
      '^CF0,30',
      `^FO20,20^FH^FD${carrier}^FS`,
      '^CF0,20',
      `^FO20,60^FH^FDWAYBILL: ${spec.waybillNo}^FS`,
      `^FO20,90^BCN,60,Y,N,N^FD${barcodeData}^FS`,
      `^FO20,170^FH^FDSHIP TO: ${shipTo}^FS`,
      `^FO20,200^FH^FDRoute: ${route}^FS`,
      weight ? `^FO20,225^FH^FD${weight}^FS` : '',
      '^XZ',
    ]
      .filter(Boolean)
      .join('\n')
  }
}
