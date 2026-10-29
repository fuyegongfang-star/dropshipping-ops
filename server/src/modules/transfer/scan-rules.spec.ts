/**
 * 条码规则引擎单测（任务 7.2 · 修复 CG 号段正则）。
 * 验证采购单号实际生成格式 CG + 年月日(8) + 连字符 + 流水(3-6) 能被正确识别，
 * 旧号段 CG\d{6,} 规则保留作为兜底。
 */

import { guessScanKind, normalizeScanValue, SCAN_KIND_LABELS } from './scan-rules'

describe('scan-rules (7.2 CG 号段修复)', () => {
  it('新格式采购单号 CGyyyymmdd-nnnn 识别为 purchaseNo', () => {
    const g = guessScanKind('CG20261028-0001')
    expect(g.kind).toBe('purchaseNo')
    expect(g.label).toContain('采购单号')
  })

  it('5 位流水 CGyyyymmdd-nnnnn 仍识别为 purchaseNo', () => {
    const g = guessScanKind('CG20261028-00012')
    expect(g.kind).toBe('purchaseNo')
  })

  it('旧号段 CG\\d{6,} 兜底仍识别', () => {
    const g = guessScanKind('CG123456')
    expect(g.kind).toBe('purchaseNo')
  })

  it('含首尾空白/包裹符的 CG 号段归一化后识别', () => {
    const g = guessScanKind('  <CG20261028-0001> ')
    expect(g.kind).toBe('purchaseNo')
  })

  it('带字母前缀的快递单号识别为 trackingNo', () => {
    expect(guessScanKind('SF12345678').kind).toBe('trackingNo')
    expect(guessScanKind('YT9999888877').kind).toBe('trackingNo')
  })

  it('8 位定长数字识别为 EAN-8 商品条码', () => {
    // 注：13 位纯数字与「UPS/DHL 国际件」号段 \d{12,14} 文本上无法区分（规则引擎设计原则②：靠查库解决），
    // 故此处用无歧义的 EAN-8（8 位，不落入任何快递号段）验证 barcode 分支。
    expect(guessScanKind('69012345').kind).toBe('barcode')
  })

  it('无法识别的随机文本 → unknown', () => {
    const g = guessScanKind('hello-world-xyz')
    expect(g.kind).toBe('unknown')
    expect(g.label).toBe('未识别号段')
  })

  it('normalizeScanValue 去除空白与包裹符', () => {
    expect(normalizeScanValue('  CG20261028-0001 \n')).toBe('CG20261028-0001')
    expect(normalizeScanValue('[CG20261028-0001]')).toBe('CG20261028-0001')
  })

  it('SCAN_KIND_LABELS 覆盖全部语义类型', () => {
    expect(SCAN_KIND_LABELS.purchaseNo).toBe('采购单号')
    expect(SCAN_KIND_LABELS.trackingNo).toBe('快递单号')
    expect(SCAN_KIND_LABELS.barcode).toBe('商品条码')
    expect(SCAN_KIND_LABELS.unknown).toBe('未识别')
  })
})
