/**
 * 面单渲染服务单测（任务 3.9，方案 §3 getLabel / §11）。
 * 验证 PDF 字节头与 ZPL 指令结构，无需打印机。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { LabelService } from './label.service'
import { LabelSpec } from './label.types'

const svc = new LabelService()

const spec: LabelSpec = {
  carrierCode: 'yunexpress',
  carrierName: '云途物流',
  waybillNo: 'WB-YUN-123',
  trackingNo: 'TRK-YUN-456',
  recipient: { name: 'John Doe', country: 'US', city: 'Los Angeles', address1: '1 Main St' },
  origin: 'CN-SZ',
  destCountry: 'US',
  weightKg: 1.2,
  legType: 'first' as never,
  transitHub: 'OVERSEAS-US-WEST',
}

describe('LabelService (§3/§11)', () => {
  it('生成 PDF 且以 %PDF 头、ZPL 以 ^XA 开头', async () => {
    const res = await svc.build(spec)
    const pdf = Buffer.from(res.pdfBase64, 'base64')
    expect(pdf.slice(0, 5).toString('latin1')).toBe('%PDF-')
    expect(res.fileName).toBe('label-WB-YUN-123.pdf')
    expect(res.zpl.startsWith('^XA')).toBe(true)
    expect(res.zpl.trim().endsWith('^XZ')).toBe(true)
  })

  it('ZPL 含真实条码字段 ^BC 与运单号文本', async () => {
    const res = await svc.build(spec)
    expect(res.zpl).toContain('^BC') // Code128 条码字段
    expect(res.zpl).toContain('WB-YUN-123') // 运单号
    expect(res.zpl).toContain('TRK-YUN-456') // 条码内容（tracking 优先）
  })

  it('缺收件人 / tracking 时仍能渲染（tracking 回退为 waybillNo）', async () => {
    const res = await svc.build({ carrierCode: 'mock', waybillNo: 'WB-MOCK-9' })
    expect(res.zpl).toContain('WB-MOCK-9')
    expect(res.zpl).toContain('^BC') // 仍含条码，编码 waybillNo
    expect(Buffer.from(res.pdfBase64, 'base64').slice(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
