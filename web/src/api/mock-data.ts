/**
 * 纯前端演示数据（方案 §11/补充）。
 *
 * 用途：当 `VITE_USE_MOCK=true` 时，由 `http.ts` 接管所有请求并返回此处数据，
 * 无需后端 / 数据库即可渲染并交互全部业务页面（订单审单/转移/逆向、渠道拉单、
 * 商品 SKU、租户隔离、看板统计）。仅用于本地预览成果，生产环境由真实后端提供数据。
 *
 * 设计要点：
 * - 模块级可变状态，POST 类操作（审单/转移/逆向/拉单）会真实改写内存中的订单，
 *   后续 GET 立即反映变更，使演示具备「可操作」的真实感。
 * - 字段形状严格对齐各 `*Api` 模块的 DTO，保证视图无需任何改造即可消费。
 */

// ===== 类型（镜像后端 DTO 与前端 *Api 模块）=====
import type { ComposeLegsRequest, ComposeLegsResult, ShipmentLeg, LabelSpec, LabelResult, CustomsSpec, CustomsIssue, CustomsValidationResult, TrackingQuery, TrackingEnvelope, TrackingChannel, TrackingEvent, NdrReport, AddressValidateRequest, AddressValidationResult, AddressIssue, ZoneInfo, CarrierFeasibility, AggregatorQuery, AggregatorResult, AggregatorCatalogItem } from './carriers'

export interface MockTenant {
  id: string
  name: string
  code: string
  status: string
}
export interface MockShop {
  id: string
  tenantId: string
  platform: string
  name: string
  authConfig: null
  createdAt: string
}
export interface MockProduct {
  id: string
  tenantId: string
  title: string
  spu: string | null
  createdAt: string
}
export interface MockSku {
  id: string
  tenantId: string
  productId: string
  code: string
  platformSku: string | null
  supplierSku: string | null
  barcode: string | null
  weightG: number
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  createdAt: string
}
export interface MockOrderItem {
  sku: { code: string; platformSku: string | null; supplierSku: string | null } | null
  quantity: number
}
export interface MockOrderEvent {
  id: string
  type: string
  operator: string
  createdAt: string
}
export interface MockRecipient {
  name: string
  country: string
  city: string
  address1: string
  zip: string
}
export interface MockOrder {
  id: string
  platformOrderNo: string
  shopId: string
  shop: { id: string; name: string; platform: string } | null
  status: string
  totalAmount: number
  currency: string
  createdAt: string
  recipient: MockRecipient | null
  items: MockOrderItem[]
  events: MockOrderEvent[]
}

// ===== 种子数据 =====
const TENANT_ID = 't_demo'
const NOW = () => new Date().toISOString()

const tenants: MockTenant[] = [
  { id: TENANT_ID, name: 'Demo 演示租户', code: 'demo', status: 'active' },
  { id: 't_acme', name: 'Acme 跨境店', code: 'acme', status: 'active' },
]

const shops: MockShop[] = [
  {
    id: 's_shopify',
    tenantId: TENANT_ID,
    platform: 'shopify',
    name: 'Shopify 美国店',
    authConfig: null,
    createdAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 's_amazon',
    tenantId: TENANT_ID,
    platform: 'amazon',
    name: 'Amazon US 店铺',
    authConfig: null,
    createdAt: '2026-09-05T08:00:00.000Z',
  },
  {
    id: 's_mock',
    tenantId: TENANT_ID,
    platform: 'mock',
    name: 'Mock 演示店（可拉单）',
    authConfig: null,
    createdAt: '2026-09-10T08:00:00.000Z',
  },
]

const products: MockProduct[] = [
  {
    id: 'p1',
    tenantId: TENANT_ID,
    title: '无线蓝牙耳机 Pro',
    spu: 'SPU-EARBUD',
    createdAt: '2026-09-02T08:00:00.000Z',
  },
  {
    id: 'p2',
    tenantId: TENANT_ID,
    title: '便携充电宝 20000mAh',
    spu: 'SPU-POWER',
    createdAt: '2026-09-03T08:00:00.000Z',
  },
  {
    id: 'p3',
    tenantId: TENANT_ID,
    title: '智能手环 S2',
    spu: 'SPU-BAND',
    createdAt: '2026-09-04T08:00:00.000Z',
  },
  {
    id: 'p4',
    tenantId: TENANT_ID,
    title: '折叠手机支架',
    spu: 'SPU-STAND',
    createdAt: '2026-09-06T08:00:00.000Z',
  },
]

const skus: MockSku[] = [
  {
    id: 'sk1',
    tenantId: TENANT_ID,
    productId: 'p1',
    code: 'IN-SKU-EARBUD-BLK',
    platformSku: 'SH-ES-BLK',
    supplierSku: 'SUP-ES-BLK',
    barcode: '690000000001',
    weightG: 120,
    lengthCm: 10,
    widthCm: 8,
    heightCm: 4,
    createdAt: '2026-09-02T08:00:00.000Z',
  },
  {
    id: 'sk2',
    tenantId: TENANT_ID,
    productId: 'p2',
    code: 'IN-SKU-POWER-20K',
    platformSku: 'SH-PW-20K',
    supplierSku: 'SUP-PW-20K',
    barcode: '690000000002',
    weightG: 380,
    lengthCm: 15,
    widthCm: 8,
    heightCm: 4,
    createdAt: '2026-09-03T08:00:00.000Z',
  },
  {
    id: 'sk3',
    tenantId: TENANT_ID,
    productId: 'p3',
    code: 'IN-SKU-BAND-S2',
    platformSku: 'SH-BD-S2',
    supplierSku: 'SUP-BD-S2',
    barcode: '690000000003',
    weightG: 60,
    lengthCm: 12,
    widthCm: 6,
    heightCm: 3,
    createdAt: '2026-09-04T08:00:00.000Z',
  },
  {
    id: 'sk4',
    tenantId: TENANT_ID,
    productId: 'p4',
    code: 'IN-SKU-STAND-FD',
    platformSku: 'SH-ST-FD',
    supplierSku: 'SUP-ST-FD',
    barcode: '690000000004',
    weightG: 90,
    lengthCm: 18,
    widthCm: 10,
    heightCm: 2,
    createdAt: '2026-09-06T08:00:00.000Z',
  },
  {
    id: 'sk5',
    tenantId: TENANT_ID,
    productId: 'p1',
    code: 'IN-SKU-EARBUD-WHT',
    platformSku: 'SH-ES-WHT',
    supplierSku: 'SUP-ES-WHT',
    barcode: '690000000005',
    weightG: 120,
    lengthCm: 10,
    widthCm: 8,
    heightCm: 4,
    createdAt: '2026-09-07T08:00:00.000Z',
  },
  {
    id: 'sk6',
    tenantId: TENANT_ID,
    productId: 'p2',
    code: 'IN-SKU-POWER-10K',
    platformSku: 'SH-PW-10K',
    supplierSku: 'SUP-PW-10K',
    barcode: '690000000006',
    weightG: 220,
    lengthCm: 12,
    widthCm: 7,
    heightCm: 3,
    createdAt: '2026-09-08T08:00:00.000Z',
  },
]

// 订单种子（覆盖正向 12 态 + 逆向/异常），便于演示各状态与操作
const seedOrders: MockOrder[] = [
  mk('o1', 'SO-10001', 's_shopify', 'pending_review', 199.0, 'USD', '2026-10-01T09:00:00.000Z', [
    { sku: skus[0], quantity: 2 },
  ]),
  mk('o2', 'SO-10002', 's_shopify', 'approved', 99.0, 'USD', '2026-10-02T09:00:00.000Z', [
    { sku: skus[1], quantity: 1 },
  ]),
  mk('o3', 'AMZ-20001', 's_amazon', 'pushed', 259.0, 'USD', '2026-10-03T09:00:00.000Z', [
    { sku: skus[2], quantity: 1 },
  ]),
  mk('o4', 'AMZ-20002', 's_amazon', 'picked_up', 49.0, 'USD', '2026-10-04T09:00:00.000Z', [
    { sku: skus[3], quantity: 3 },
  ]),
  mk('o5', 'SO-10003', 's_shopify', 'in_transit', 318.0, 'USD', '2026-10-05T09:00:00.000Z', [
    { sku: skus[0], quantity: 1 },
    { sku: skus[4], quantity: 1 },
  ]),
  mk('o6', 'SO-10004', 's_shopify', 'customs_clearing', 129.0, 'USD', '2026-10-06T09:00:00.000Z', [
    { sku: skus[5], quantity: 2 },
  ]),
  mk('o7', 'AMZ-20003', 's_amazon', 'out_for_delivery', 75.0, 'USD', '2026-10-07T09:00:00.000Z', [
    { sku: skus[2], quantity: 1 },
  ]),
  mk('o8', 'SO-10005', 's_shopify', 'delivered', 159.0, 'USD', '2026-10-08T09:00:00.000Z', [
    { sku: skus[1], quantity: 1 },
  ]),
  mk('o9', 'AMZ-20004', 's_amazon', 'completed', 399.0, 'USD', '2026-10-09T09:00:00.000Z', [
    { sku: skus[0], quantity: 2 },
  ]),
  mk('o10', 'SO-10006', 's_shopify', 'rejected', 0.0, 'USD', '2026-10-09T10:00:00.000Z', [
    { sku: skus[3], quantity: 1 },
  ]),
  mk('o11', 'SO-10007', 's_shopify', 'cancelled', 0.0, 'USD', '2026-10-09T11:00:00.000Z', [
    { sku: skus[4], quantity: 1 },
  ]),
  mk('o12', 'AMZ-20005', 's_amazon', 'exception', 88.0, 'USD', '2026-10-10T09:00:00.000Z', [
    { sku: skus[5], quantity: 1 },
  ]),
]

let orders: MockOrder[] = seedOrders.map((o) => ({
  ...o,
  items: o.items.map((i) => ({ ...i })),
  events: [...o.events],
}))

// 订单工厂：补齐 shop 引用与轨迹事件
function mk(
  id: string,
  platformOrderNo: string,
  shopId: string,
  status: string,
  totalAmount: number,
  currency: string,
  createdAt: string,
  items: MockOrderItem[],
): MockOrder {
  const shop = shops.find((s) => s.id === shopId) ?? null
  const recipient: MockRecipient = {
    name: 'John Doe',
    country: 'US',
    city: 'Los Angeles',
    address1: '123 Main St',
    zip: '90001',
  }
  const events: MockOrderEvent[] = [
    { id: id + '-e1', type: '创建订单', operator: 'platform', createdAt },
    { id: id + '-e2', type: '拉单入库', operator: 'system', createdAt },
  ]
  return {
    id,
    platformOrderNo,
    shopId,
    shop: shop ? { id: shop.id, name: shop.name, platform: shop.platform } : null,
    status,
    totalAmount,
    currency,
    createdAt,
    recipient,
    items,
    events,
  }
}

// ===== 工具 =====
const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms))

// ===== 两段式运单编排（任务 3.8，方案 §14）=====
/** 计费重：取实重与体积重(长×宽×高/5000)较大者，多箱求和 */
function computeChargeableG(parcels: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }[]): number {
  const total = parcels.reduce((s, p) => {
    const volumetric = (p.lengthCm * p.widthCm * p.heightCm) / 5000
    return s + Math.max(p.weightKg, volumetric)
  }, 0)
  return Number(total.toFixed(2))
}

/** 两段式建单编排：拆分头程/尾程两段，分别生成运单号与成本（演示口径，非真实价） */
function doCompose(body: unknown): ComposeLegsResult {
  const req = body as ComposeLegsRequest
  const ship = req.shipment
  const hub = req.transitHub ?? `OVERSEAS-${ship.destCountry}`
  const chargeable = computeChargeableG(ship.parcels)

  // 头程单价 $/kg（空运头程较贵），尾程单价（末端派送）
  const FIRST_PRICE = 38
  const LAST_PRICE = 22
  const nameOf = (code: string) => carriers.find((c) => c.code === code)?.name ?? code

  const first: ShipmentLeg = {
    legType: 'first',
    carrierCode: req.firstCarrierCode,
    carrierName: nameOf(req.firstCarrierCode),
    waybillNo: `WB-${req.firstCarrierCode.toUpperCase()}-${seq++}`,
    trackingNo: `TRK-${req.firstCarrierCode.toUpperCase()}-${seq++}`,
    carrierCost: Number((chargeable * FIRST_PRICE).toFixed(2)),
    currency: 'USD',
    estimatedLeadDays: 4,
    transitHub: hub,
  }

  const legs: ShipmentLeg[] = [first]
  if (req.lastCarrierCode) {
    const last: ShipmentLeg = {
      legType: 'last',
      carrierCode: req.lastCarrierCode,
      carrierName: nameOf(req.lastCarrierCode),
      waybillNo: `WB-${req.lastCarrierCode.toUpperCase()}-${seq++}`,
      trackingNo: `TRK-${req.lastCarrierCode.toUpperCase()}-${seq++}`,
      carrierCost: Number((chargeable * LAST_PRICE).toFixed(2)),
      currency: 'USD',
      estimatedLeadDays: 3,
      transitHub: hub,
    }
    legs.push(last)
  }

  const totalCarrierCost = Number(legs.reduce((s, l) => s + l.carrierCost, 0).toFixed(2))
  return { orderRef: ship.orderRef, legs, totalCarrierCost, currency: 'USD', composedAt: NOW() }
}

const reject = (msg: string) => Promise.reject(new Error(msg))
let seq = 100

// ===== 面单渲染（任务 3.9，方案 §3/§11）=====
// 演示态 PDF 占位（最小可用 PDF，由 pdf-lib 生成后 base64，仅作展示，非真实承运商面单）。
const DEMO_LABEL_PDF =
  'JVBERi0xLjcKJYGBgYEKCjYgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL0xlbmd0aCAyMTIKPj4Kc3RyZWFtCnicrdBLiwIxDADge35Fz4KYpmnawiI40xEPXoTeZA/i+kQPiujfN6MgorvgYQnkUQpf2gNUBdC0cVxBb7TYnRenzXzWDZgiRwwxGcumLIE0j8HerlrjNAmasocv7yRKCihZvDSBCbkWK6RTTUiRWbssQ0p9U7ZQOtAUmMDhExl/l52/y0FsSColqaV2A5WZPWceUva6CGWHGvbfXBvvLgfSFzqpVG4kvMjsias/7AdszQWm39r/PAv6pfP946DN72Nb2uzE7HTHpwa1rqFS6ApoUWRACmVuZHN0cmVhbQplbmRvYmoKCjcgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA1Ci9GaXJzdCAyNgovTGVuZ3RoIDM2MAo+PgpzdHJlYW0KeJzVUk1Lw0AQve+vmKMeZD/yLaXQNomCFKUVFMXDNllKpOxKspX6751JUksP4lnCY3dm3uy+zTwJAhSEIQSQpBBCFCiIIJESJhPGH78+DPAHvTUd43dN3cErcgSs4I3xhdtbD5JNp+zEXWivd27LhiaQRD4yHlpX7yvTwqQsylKIRAgRh4hYCJXjukBkCIUx1lSKe0QSjsBcEggRzLBWDoiToYfqPTca+wtckRsTJx+4YTrEP/fSXcVwhvpLTzZlfOnqXHsDF/m1EiqWQgYykpmKXy7xd7RGe/d/H9frb5z99YVnc6bx0pBbQx7op8xXpnP7tsKxE690WKHNrdl9Gt9U+ioRWYo6kzRDj43G4M/3m3dT9VQKi4O/WXvSMCQotzR1o+fugO4T+OHLAVWTB2fWOk+u7P1oPaqhKB49eiaZBDG+3m98H1JSMj7XnemlnnSiCFu5urFb4E+NndmuOSboxG8YFsXYCmVuZHN0cmVhbQplbmRvYmoKCjggMCBvYmoKPDwKL1NpemUgOQovUm9vdCAyIDAgUgovSW5mbyAzIDAgUgovRmlsdGVyIC9GbGF0ZURlY29kZQovVHlwZSAvWFJlZgovTGVuZ3RoIDQxCi9XIFsgMSAyIDIgXQovSW5kZXggWyAwIDkgXQo+PgpzdHJlYW0KeJwVxLERACAMA7G3wx0ti7D/cBQJViGg22xISk6Vljgg3Z8fDF4EA3QKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjc2MwolJUVPRg=='

/** 面单渲染：演示态返回占位 PDF + ZPL 文本（真实实现见后端 LabelService，§3/§11） */
function doCreateLabel(body: unknown): LabelResult {
  const spec = body as LabelSpec
  const carrier = spec.carrierName ?? spec.carrierCode
  const barcode = spec.trackingNo ?? spec.waybillNo
  const r = spec.recipient
  const shipTo = [r?.name, r?.country, r?.city, r?.address1].filter(Boolean).join('\\&')
  const route = [spec.origin, spec.transitHub, spec.destCountry].filter(Boolean).join(' > ')
  const weight = spec.weightKg != null ? `Weight: ${spec.weightKg} kg` : ''
  const zpl = [
    '^XA',
    '^CF0,30',
    `^FO20,20^FH^FD${carrier}^FS`,
    '^CF0,20',
    `^FO20,60^FH^FDWAYBILL: ${spec.waybillNo}^FS`,
    `^FO20,90^BCN,60,Y,N,N^FD${barcode}^FS`,
    `^FO20,170^FH^FDSHIP TO: ${shipTo}^FS`,
    `^FO20,200^FH^FDRoute: ${route}^FS`,
    weight ? `^FO20,225^FH^FD${weight}^FS` : '',
    '^XZ',
  ]
    .filter(Boolean)
    .join('\n')
  return {
    waybillNo: spec.waybillNo,
    fileName: `label-${spec.waybillNo}.pdf`,
    pdfBase64: DEMO_LABEL_PDF,
    zpl,
    generatedAt: NOW(),
  }
}

// ===== 报关/合规校验（任务 3.10，方案 §19）=====
const EU_SET = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PL', 'SE', 'AT', 'IE', 'PT'])
const SECTION321_LIMIT = 800

/** 报关/合规校验（§19 守卫）：与后端 CustomsService 同口径的演示实现 */
function doValidateCustoms(body: unknown): CustomsValidationResult {
  const spec = body as CustomsSpec
  const issues: CustomsIssue[] = []
  const dest = (spec.destCountry || '').toUpperCase()
  const value = spec.declaredValue ?? NaN
  const isEu = EU_SET.has(dest)
  const isGb = dest === 'GB'
  const isUs = dest === 'US'

  if (!Number.isFinite(value) || value <= 0) {
    issues.push({ level: 'error', code: 'DECLARED_VALUE_MISSING', message: '申报价值必填且必须大于 0' })
  }
  if (!spec.hsCode) {
    issues.push({ level: 'warning', code: 'HS_MISSING', message: '建议填写 HS 编码以便快速清关' })
  } else if (!/^\d{6,12}$/.test(spec.hsCode)) {
    issues.push({ level: 'error', code: 'HS_FORMAT', message: 'HS 编码应为 6-12 位数字' })
  }
  if (isEu) {
    if (!spec.ioss && !spec.eori) {
      issues.push({ level: 'error', code: 'EU_TAX_ID_MISSING', message: '欧盟进口需提供 IOSS 或 EORI' })
    } else {
      if (spec.ioss && !/^IM\d{10}$/.test(spec.ioss)) issues.push({ level: 'warning', code: 'IOSS_FORMAT', message: 'IOSS 格式应为 IM + 10 位数字' })
      if (spec.eori && !/^[A-Z]{2}[A-Za-z0-9]+$/.test(spec.eori)) issues.push({ level: 'warning', code: 'EORI_FORMAT', message: 'EORI 格式应为 2 位国别 + 字母数字' })
    }
  }
  if (isGb && !spec.eori) issues.push({ level: 'error', code: 'GB_EORI_MISSING', message: '英国进口需提供 EORI' })

  let eligibleSection321 = false
  let recommendedDuty: CustomsValidationResult['recommendedDuty'] = 'UNKNOWN'
  if (isUs) {
    const within = Number.isFinite(value) && value <= SECTION321_LIMIT
    eligibleSection321 = within
    if (spec.section321 && !within) {
      issues.push({ level: 'error', code: 'SECTION321_OVER_LIMIT', message: `Section 321 仅适用 ≤ $${SECTION321_LIMIT}，当前申报 $${value} 超限，需走正式申报` })
    } else if (within) {
      issues.push({ level: 'info', code: 'SECTION321_OK', message: `符合 Section 321（≤$${SECTION321_LIMIT}）T86 免税申报` })
      recommendedDuty = 'T86'
    } else {
      issues.push({ level: 'info', code: 'FORMAL_ENTRY', message: '申报价值 > $800，建议走正式申报（T01）' })
      recommendedDuty = 'T01'
    }
  } else if (isEu) {
    recommendedDuty = spec.ioss ? 'DDP' : 'UNKNOWN'
  }
  if (spec.cargoType === 'battery' || spec.cargoType === 'liquid' || spec.cargoType === 'sensitive') {
    issues.push({ level: 'warning', code: 'SENSITIVE_CARGO', message: '敏感货物（带电/液体/敏感货）部分渠道禁运，需确认承运商可达性' })
  }
  return { valid: !issues.some((i) => i.level === 'error'), issues, eligibleSection321, recommendedDuty }
}

// ===== 轨迹双通道 + NDR（任务 3.11，方案 §3/§6/§20）=====
/**
 * 轨迹查询：演示态实现，与后端 TrackingService 同口径。
 * - 通道：承运商能力含 subscribe → 推送（push），并标记已订阅；否则轮询（poll）兜底。
 * - NDR：轨迹号含「ndr」哨兵 → 返回 exception 状态 + 清关扣留异常事件，触发 NDR 报告。
 */
function doTrackQuery(body: unknown): TrackingEnvelope {
  const q = body as TrackingQuery
  const carrier = carriers.find((c) => c.code === q.carrierCode)
  const canPush = !!carrier?.capabilities.subscribe
  const channel: TrackingChannel = canPush ? 'push' : 'poll'
  const subscribed = canPush // 演示态：支持订阅即订阅成功

  const isNdr = /ndr/i.test(q.trackingNo)
  const status = isNdr ? 'exception' : 'out_for_delivery'
  const events: TrackingEvent[] = isNdr
    ? [
        { status: 'picked_up', location: 'CN SZ', occurredAt: NOW(), description: '已揽收' },
        { status: 'in_transit', location: 'CN SZ', occurredAt: NOW(), description: '干线运输中' },
        {
          status: 'exception',
          location: 'US LAX',
          occurredAt: NOW(),
          description: '清关失败：申报信息不符，包裹被海关扣留',
        },
      ]
    : [
        { status: 'picked_up', location: 'CN SZ', occurredAt: NOW(), description: '已揽收' },
        { status: 'in_transit', location: 'CN SZ', occurredAt: NOW(), description: '干线运输中' },
        { status: 'customs', location: 'US LAX', occurredAt: NOW(), description: '清关中' },
        { status: 'out_for_delivery', location: 'US LAX', occurredAt: NOW(), description: '派送中' },
      ]

  const ndr: NdrReport = isNdr
    ? {
        detected: true,
        severity: 'critical',
        events: ['清关失败：申报信息不符，包裹被海关扣留'],
        recommendedAction: '建议转人工并建理赔工单（§20 claims）',
      }
    : { detected: false, severity: 'info', events: [], recommendedAction: '轨迹正常，无需处理' }

  return {
    tracking: { trackingNo: q.trackingNo, carrierCode: q.carrierCode, status, events },
    channel,
    subscribed,
    ndr,
    queriedAt: NOW(),
  }
}

// ===== 地址校验与分区（任务 3.12，方案 §18）=====
/** 与后端 AddressService / ZoneMapService 同口径的演示实现。 */
const ADDR_POSTAL_FORMAT: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  DE: /^\d{5}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  FR: /^\d{5}$/,
  CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
  AU: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
}
const ADDR_REMOTE_PREFIX: Record<string, string[]> = {
  US: ['99', '96', '969', '995', '997', '998'],
  CA: ['Y', 'X0'],
  AU: ['08', '087'],
}
const ADDR_UNREACHABLE: Record<string, Record<string, string[]>> = {
  yunexpress: {},
  dhl: {},
  fourpx: { US: ['ZONE_5'] },
  yanwen: { CA: ['ZONE_4', 'ZONE_5'] },
  mock: {},
  aggregator: {},
}
const ADDR_REGION: Record<string, string> = {
  US: '北美·本土',
  CA: '北美·加拿大',
  DE: '欧洲·西欧',
  FR: '欧洲·西欧',
  GB: '欧洲·英国',
  ES: '欧洲·南欧',
  IT: '欧洲·南欧',
  NL: '欧洲·西欧',
  AU: '大洋洲·澳洲',
  JP: '亚洲·东亚',
  CN: '亚洲·东亚',
}
const ADDR_CARRIER_NAMES: Record<string, string> = {
  yunexpress: '云途',
  dhl: 'DHL Express',
  fourpx: '递四方',
  yanwen: '燕文',
  mock: '演示承运商',
  aggregator: '聚合平台',
}
const ADDR_ALL_CARRIERS = ['yunexpress', 'dhl', 'fourpx', 'yanwen', 'mock']

function addrDeriveZone(country: string, postal: string): { zoneCode: string; region: string } {
  const cleaned = (postal || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const first = cleaned[0] ?? '0'
  const n = /[0-9]/.test(first) ? Number(first) : first.charCodeAt(0) % 5
  const zoneIndex = (n % 5) + 1
  return { zoneCode: `ZONE_${zoneIndex}`, region: `${country}·${ADDR_REGION[country] ?? '其他区域'}` }
}

function doValidateAddress(body: unknown): AddressValidationResult {
  const req = body as AddressValidateRequest
  const issues: AddressIssue[] = []
  const country = (req.country || '').toUpperCase()
  const postalRaw = (req.postalCode || '').trim()

  if (!country) issues.push({ level: 'error', code: 'COUNTRY_MISSING', message: '目的国必填（ISO2，如 US/DE/GB）', field: 'country' })
  if (!postalRaw) issues.push({ level: 'error', code: 'POSTAL_MISSING', message: '邮政编码必填', field: 'postalCode' })
  if (!req.city) issues.push({ level: 'warning', code: 'CITY_MISSING', message: '建议补充城市', field: 'city' })
  if (!req.addressLine1) issues.push({ level: 'warning', code: 'ADDRESS1_MISSING', message: '建议补充街道门牌', field: 'addressLine1' })
  if (!req.name) issues.push({ level: 'warning', code: 'NAME_MISSING', message: '建议补充收件人姓名', field: 'name' })
  if (!req.phone) issues.push({ level: 'warning', code: 'PHONE_MISSING', message: '建议补充联系电话', field: 'phone' })

  const postalFormatOk = country ? addrIsPostalValid(country, postalRaw) : false
  if (country && postalRaw && !postalFormatOk) {
    issues.push({ level: 'error', code: 'POSTAL_FORMAT', message: `邮编格式不符合 ${country} 规范`, field: 'postalCode' })
  }

  let phoneFormatOk = true
  if (req.phone && !/^\+?[\d\s-]{6,20}$/.test(req.phone.trim())) {
    phoneFormatOk = false
    issues.push({ level: 'warning', code: 'PHONE_FORMAT', message: '电话格式可疑，建议含国际区号', field: 'phone' })
  }

  const normalized: AddressValidateRequest = {
    country,
    name: req.name?.trim() || undefined,
    phone: req.phone?.trim() || undefined,
    state: req.state?.trim() || undefined,
    city: req.city?.trim() || undefined,
    addressLine1: req.addressLine1?.trim() || undefined,
    addressLine2: req.addressLine2?.trim() || undefined,
    postalCode: postalRaw.toUpperCase(),
  }

  const required: (keyof AddressValidateRequest)[] = ['country', 'postalCode', 'city', 'addressLine1', 'name', 'phone']
  const filled = required.filter((f) => (req[f] as unknown as string)?.toString().trim()).length
  const completeness = filled / required.length
  const formatOk = postalFormatOk && phoneFormatOk
  const qualityScore = Math.round(completeness * 70 + (formatOk ? 30 : 0))

  const carrierCodes = req.carriers && req.carriers.length ? req.carriers : ADDR_ALL_CARRIERS
  const feasibility: CarrierFeasibility[] = carrierCodes.map((code) => {
    const hit = addrResolve(code, country, normalized.postalCode)
    return {
      carrierCode: code,
      carrierName: ADDR_CARRIER_NAMES[code] ?? code,
      zoneCode: hit.zoneCode,
      region: hit.region,
      isRemote: hit.isRemote,
      reachable: country ? hit.reachable : false,
      note: !country
        ? '目的国缺失，暂无法评估'
        : hit.reachable
          ? hit.isRemote
            ? '偏远区，将加收远程附加费（§4.4）'
            : '可达，费率正常'
          : '该承运商此分区不可达，建议转其他承运商 / 聚合兜底（§3e）',
    }
  })

  const primary = feasibility[0]
  const zone: ZoneInfo = {
    country,
    postalCode: normalized.postalCode ?? '',
    zoneCode: primary?.zoneCode ?? 'ZONE_1',
    region: primary?.region ?? `${country}·其他区域`,
    isRemote: primary?.isRemote ?? false,
    reachable: primary?.reachable ?? false,
  }

  return { valid: !issues.some((i) => i.level === 'error'), normalized, qualityScore, issues, zone, feasibility }
}

function addrIsPostalValid(country: string, postal?: string): boolean {
  if (!postal) return false
  const fmt = ADDR_POSTAL_FORMAT[country]
  return fmt ? fmt.test(postal.trim()) : true
}

function addrResolve(carrierCode: string, country: string, postal?: string): { zoneCode: string; region: string; isRemote: boolean; reachable: boolean } {
  const cc = (carrierCode || 'mock').toLowerCase()
  const c = (country || '').toUpperCase()
  const normalizedPostal = (postal || '').trim().toUpperCase()
  const { zoneCode, region } = addrDeriveZone(c, normalizedPostal)
  const remotePrefixes = ADDR_REMOTE_PREFIX[c] ?? []
  const isRemote = remotePrefixes.some((p) => normalizedPostal.startsWith(p))
  const blocked = ADDR_UNREACHABLE[cc]?.[c] ?? []
  const reachable = !blocked.includes(zoneCode)
  return { zoneCode, region, isRemote, reachable }
}

// ===== 聚合平台兜底追踪（任务 3.13，方案 §3e）=====
/** 与后端 AggregatorService 同口径的演示实现。 */
const AGGREGATOR_NAMES: Record<string, string> = { aftership: 'AfterShip', '17track': '17TRACK' }

function doAggregateTrack(body: unknown): AggregatorResult {
  const q = body as AggregatorQuery
  const code = (q.aggregatorCode || '').toLowerCase()
  const name = AGGREGATOR_NAMES[code]
  if (!name) {
    throw new Error(`未接入的聚合平台：${q.aggregatorCode}（当前仅支持 AfterShip / 17TRACK）`)
  }
  const now = NOW()
  if (/fail/i.test(q.trackingNo)) {
    return {
      trackingNo: q.trackingNo,
      carrierCode: q.carrierCode,
      aggregatorCode: code,
      aggregatorName: name,
      status: 'unknown',
      events: [{ status: 'exception', occurredAt: now, description: '聚合平台未能从承运商取回轨迹' }],
      fallback: true,
      note: '聚合平台未解析到轨迹，建议改用承运商直连追踪（§6）兜底',
    }
  }
  return {
    trackingNo: q.trackingNo,
    carrierCode: q.carrierCode,
    aggregatorCode: code,
    aggregatorName: name,
    status: 'out_for_delivery',
    events: [
      { status: 'picked_up', location: 'CN SZ', occurredAt: now, description: '已揽收（聚合平台归一化）' },
      { status: 'in_transit', location: 'CN SZ', occurredAt: now, description: '干线运输中' },
      { status: 'customs', location: 'US LAX', occurredAt: now, description: '清关中' },
      { status: 'out_for_delivery', location: 'US LAX', occurredAt: now, description: '派送中' },
      { status: 'delivered', location: 'US LAX', occurredAt: now, description: '已签收' },
    ],
    fallback: false,
    note: `经 ${name} 归一化尾程轨迹成功，可作为承运商直连的兜底通道（§3e）`,
  }
}

function doAggregatorCatalog(): AggregatorCatalogItem[] {
  return Object.entries(AGGREGATOR_NAMES).map(([code, name]) => ({ code, name, capability: 'track' }))
}

// ===== 路由分发 =====
/** mock 模式下 http.ts 的唯一入口：按 method + url 返回对应数据或执行状态变更。
 *  body 仅在 POST/PUT 时由 http.ts 透传（用于比价试算等带参请求）。 */
export function mockRouter(method: string, url: string, body?: unknown): Promise<unknown> {
  // GET 集合
  if (method === 'GET') {
    if (url === '/tenants') return delay().then(() => tenants)
    if (url === '/shops') return delay().then(() => shops)
    if (url === '/channels/platforms') return delay().then(() => ['shopify', 'amazon', 'mock'])
    if (url === '/catalog/products') return delay().then(() => products)
    if (url.startsWith('/catalog/skus')) return delay().then(() => filterSkus(url))
    if (url === '/orders') return delay().then(() => orders)
    if (url.startsWith('/orders?')) return delay().then(() => filterOrders(url))
    if (url === '/carriers') return delay().then(() => carriers)
    // 返回副本：避免视图 v-model 直接改写 mock 模块级状态，所有变更一律走下方 POST/PUT/DELETE。
    if (url === '/pricing/markup-rules')
      return delay().then(() => markupRules.map((r) => ({ ...r })))
    if (url === '/pricing/fx') return delay().then(() => fxRates.map((f) => ({ ...f })))
    // 站点设置：返回副本（含 TDK 规则数组副本），避免视图直接改写模块级状态。
    if (url === '/settings/site') return delay().then(() => cloneSite())
    const chealth = url.match(/^\/carriers\/([^/]+)\/health$/)
    if (chealth) {
      const c = carriers.find((x) => x.code === chealth[1])
      return c ? delay().then(() => c.health) : delay().then(() => reject('承运商不存在'))
    }
    const detail = url.match(/^\/orders\/([^/]+)$/)
    if (detail) {
      const o = orders.find((x) => x.id === detail[1])
      return o ? delay().then(() => o) : delay().then(() => reject('订单不存在'))
    }
    return delay().then(() => reject('演示模式暂未实现该接口：' + url))
  }

  // POST 集合
  if (method === 'POST') {
    const review = url.match(/^\/orders\/([^/]+)\/review$/)
    if (review) return delay().then(() => doReview(review[1]))
    const trans = url.match(/^\/orders\/([^/]+)\/transition$/)
    if (trans) return delay().then(() => doTransition(trans[1]))
    const rev = url.match(/^\/orders\/([^/]+)\/reverse$/)
    if (rev) return delay().then(() => doReverse(rev[1]))
    const pull = url.match(/^\/channels\/([^/]+)\/pull$/)
    if (pull) return delay().then(() => doPull(pull[1]))
    if (url === '/pricing/compare') return delay(260).then(() => doCompare(body))
    if (url === '/carriers/shipments/compose') return delay(300).then(() => doCompose(body))
    if (url === '/carriers/labels') return delay(200).then(() => doCreateLabel(body))
    if (url === '/carriers/customs/validate') return delay(200).then(() => doValidateCustoms(body))
    if (url === '/carriers/tracking/query') return delay(200).then(() => doTrackQuery(body))
    if (url === '/carriers/address/validate') return delay(180).then(() => doValidateAddress(body))
    if (url === '/carriers/aggregator/track') return delay(200).then(() => doAggregateTrack(body))
    if (url === '/carriers/aggregator/catalog') return delay(120).then(() => doAggregatorCatalog())
    if (url === '/pricing/markup-rules') return delay().then(() => createMarkupRule(body))
    if (url === '/settings/tdk-rules') return delay().then(() => createTdkRule(body))
    // 品牌图片上传（LOGO / Favicon）：演示态直接回吐压缩后的 dataURL 地址。
    if (url === '/settings/assets') return delay(200).then(() => doUploadAsset(body))
    // 重置演示态站点设置：清空 localStorage 快照并回到种子数据。
    if (url === '/settings/site/reset') return delay().then(() => doResetSite())
    return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
  }

  // PUT 集合：加价规则整条更新（含启停开关）
  if (method === 'PUT') {
    const rule = url.match(/^\/pricing\/markup-rules\/([^/]+)$/)
    if (rule) return delay().then(() => updateMarkupRule(rule[1], body))
    const fx = url.match(/^\/pricing\/fx\/([^/]+)\/([^/]+)$/)
    if (fx) return delay().then(() => updateFxRate(fx[1], fx[2], body))
    if (url === '/settings/site') return delay().then(() => updateSite(body))
    const tdk = url.match(/^\/settings\/tdk-rules\/([^/]+)$/)
    if (tdk) return delay().then(() => updateTdkRule(tdk[1], body))
  }

  // DELETE 集合：删除加价规则 / TDK 规则
  if (method === 'DELETE') {
    const rule = url.match(/^\/pricing\/markup-rules\/([^/]+)$/)
    if (rule) return delay().then(() => deleteMarkupRule(rule[1]))
    const tdk = url.match(/^\/settings\/tdk-rules\/([^/]+)$/)
    if (tdk) return delay().then(() => deleteTdkRule(tdk[1]))
  }

  return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
}

// ===== 加价规则 / 汇率 可写操作（演示态内存改写）=====

/** 入参校验：加价幅度必须为正数，百分比上限 500% 防止误填。 */
function normalizeRuleInput(input: Partial<MockMarkupRule>): Partial<MockMarkupRule> {
  const out: Partial<MockMarkupRule> = {}
  if (input.scope !== undefined) out.scope = input.scope
  if (input.target !== undefined) out.target = String(input.target).trim()
  if (input.mode !== undefined) out.mode = input.mode
  if (input.value !== undefined) {
    const v = Number(input.value)
    out.value = Number.isFinite(v) && v >= 0 ? v : 0
  }
  if (input.priority !== undefined) {
    const p = Number(input.priority)
    out.priority = Number.isFinite(p) ? Math.trunc(p) : 50
  }
  if (input.enabled !== undefined) out.enabled = Boolean(input.enabled)
  if (input.note !== undefined) out.note = String(input.note)
  return out
}

/** 新建加价规则：返回新规则；目标为空则拒绝。 */
function createMarkupRule(body: unknown): MockMarkupRule {
  const patch = normalizeRuleInput((body ?? {}) as Partial<MockMarkupRule>)
  if (!patch.target) return reject('目标不能为空') as unknown as MockMarkupRule
  const rule: MockMarkupRule = {
    id: 'mr_' + Date.now().toString(36) + '_' + seq++,
    scope: patch.scope ?? 'global',
    target: patch.target,
    mode: patch.mode ?? 'percent',
    value: patch.value ?? 10,
    priority: patch.priority ?? 50,
    enabled: patch.enabled ?? true,
    note: patch.note ?? '',
  }
  markupRules.push(rule)
  persistPricing()
  return { ...rule }
}

/** 更新加价规则（整条覆盖式更新，仅接受传入字段）。 */
function updateMarkupRule(id: string, body: unknown): MockMarkupRule {
  const idx = markupRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('加价规则不存在') as unknown as MockMarkupRule
  const patch = normalizeRuleInput((body ?? {}) as Partial<MockMarkupRule>)
  markupRules[idx] = { ...markupRules[idx], ...patch }
  persistPricing()
  return { ...markupRules[idx] }
}

/** 删除加价规则。 */
function deleteMarkupRule(id: string): { deleted: boolean } {
  const idx = markupRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('加价规则不存在') as unknown as { deleted: boolean }
  markupRules.splice(idx, 1)
  persistPricing()
  return { deleted: true }
}

/** 更新币种汇率（按 base + quote 定位）。 */
function updateFxRate(base: string, quote: string, body: unknown): MockFxRate {
  const idx = fxRates.findIndex((f) => f.base === base && f.quote === quote)
  if (idx < 0) return reject('汇率对不存在') as unknown as MockFxRate
  const rate = Number((body as { rate?: unknown } | undefined)?.rate)
  if (!Number.isFinite(rate) || rate <= 0) return reject('汇率必须为正数') as unknown as MockFxRate
  fxRates[idx] = { ...fxRates[idx], rate, updatedAt: NOW() }
  persistPricing()
  return { ...fxRates[idx] }
}

// ===== 过滤 =====
function filterSkus(url: string): MockSku[] {
  const u = new URL(url, 'http://mock')
  const ps = u.searchParams.get('platformSku')
  const ss = u.searchParams.get('supplierSku')
  return skus.filter((s) => (!ps || s.platformSku === ps) && (!ss || s.supplierSku === ss))
}
function filterOrders(url: string): MockOrder[] {
  const u = new URL(url, 'http://mock')
  const status = u.searchParams.get('status')
  return status ? orders.filter((o) => o.status === status) : orders
}

// ===== 状态变更操作 =====
function doReview(id: string): unknown {
  const o = orders.find((x) => x.id === id)
  if (!o) return reject('订单不存在')
  const passed = true // 演示默认审单通过（真实后端按各项校验结果判定）
  o.status = passed ? 'approved' : 'rejected'
  o.events.push({
    id: id + '-rv' + seq++,
    type: passed ? '审单通过' : '审单驳回',
    operator: 'demo',
    createdAt: NOW(),
  })
  return {
    orderId: id,
    approved: passed,
    results: [
      { checkName: '地址完整性', passed: true },
      { checkName: '黑名单', passed: true },
      { checkName: '库存', passed: true, skipped: true, note: '演示跳过' },
      { checkName: '合规', passed: true, skipped: true, note: '演示跳过' },
    ],
    reasons: [],
  }
}

function doTransition(id: string): unknown {
  const o = orders.find((x) => x.id === id)
  if (!o) return reject('订单不存在')
  // 演示：按合法转移表推进到下一个常见状态；真实后端以前端传入的 to 为准
  const nextMap: Record<string, string> = {
    pending_review: 'approved',
    approved: 'pushed',
    pushed: 'picked_up',
    picked_up: 'in_transit',
    in_transit: 'customs_clearing',
    customs_clearing: 'out_for_delivery',
    out_for_delivery: 'delivered',
    delivered: 'completed',
  }
  const to = nextMap[o.status] ?? o.status
  const changed = to !== o.status
  if (changed) {
    o.events.push({
      id: id + '-tr' + seq++,
      type: '状态转移 → ' + to,
      operator: 'demo',
      createdAt: NOW(),
    })
    o.status = to
  }
  return { changed }
}

function doReverse(id: string): unknown {
  const o = orders.find((x) => x.id === id)
  if (!o) return reject('订单不存在')
  const reverseId = 'rev' + seq++
  o.events.push({
    id: id + '-rs' + seq++,
    type: '发起逆向流程',
    operator: 'demo',
    createdAt: NOW(),
  })
  return { reverseId, status: o.status }
}

function doPull(shopId: string): unknown {
  const shop = shops.find((s) => s.id === shopId)
  if (!shop) return reject('店铺不存在')
  const created = 2
  for (let i = 0; i < created; i++) {
    seq++
    const nid = 'o_pull_' + seq
    orders.unshift(
      mk(nid, 'PULL-' + seq, shopId, 'pending_review', 0, 'USD', NOW(), [
        { sku: skus[seq % skus.length], quantity: 1 },
      ]),
    )
  }
  return {
    shopId,
    platform: shop.platform,
    created,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }
}

// ==========================================================================
// 阶段3 承运商适配器 + 比价 / 加价 / 币种（演示数据，镜像后端 carriers / pricing 模块）
// ==========================================================================

/** 承运商六能力矩阵（对齐后端 CarrierAdapter 能力声明） */
export interface MockCarrierCapability {
  rate: boolean
  ship: boolean
  label: boolean
  track: boolean
  cancel: boolean
  subscribe: boolean
}
export interface MockCarrierHealth {
  status: 'up' | 'degraded' | 'down'
  latencyMs: number
  uptime: number
  checkedAt: string
  note: string
}
export interface MockCarrier {
  code: string
  name: string
  enName: string
  authType: string
  sandbox: boolean
  region: string
  capabilities: MockCarrierCapability
  health: MockCarrierHealth
  note: string
}

const CHECKED_AT = '2026-10-13T00:55:00.000Z'

const carriers: MockCarrier[] = [
  {
    code: 'yunexpress',
    name: '云途物流',
    enName: 'YunExpress',
    authType: 'OAuth2 + HMAC-SHA256',
    sandbox: true,
    region: '全球 · 专线小包',
    capabilities: {
      rate: true,
      ship: true,
      label: true,
      track: true,
      cancel: true,
      subscribe: true,
    },
    health: {
      status: 'up',
      latencyMs: 168,
      uptime: 99.95,
      checkedAt: CHECKED_AT,
      note: 'token 内存缓存正常（提前 60s 刷新）',
    },
    note: '六能力全支持：比价 / 建单 / 面单 / 轨迹 / 取消 / 订阅。',
  },
  {
    code: 'dhl',
    name: 'DHL 快递',
    enName: 'DHL Express',
    authType: 'OAuth2 Basic + API-Key',
    sandbox: true,
    region: '全球 · 商业快递',
    capabilities: {
      rate: true,
      ship: true,
      label: true,
      track: true,
      cancel: false,
      subscribe: false,
    },
    health: {
      status: 'degraded',
      latencyMs: 436,
      uptime: 98.6,
      checkedAt: CHECKED_AT,
      note: '沙箱审批中，偶发 429 限流',
    },
    note: '不支持取消 / 订阅，相关能力诚实返回 NOT_IMPLEMENTED。',
  },
  {
    code: 'fourpx',
    name: '4PX 递四方',
    enName: '4PX',
    authType: 'MD5 签名（32 位小写）',
    sandbox: false,
    region: '全球 · 国际专线',
    capabilities: {
      rate: true,
      ship: true,
      label: true,
      track: true,
      cancel: true,
      subscribe: false,
    },
    health: {
      status: 'up',
      latencyMs: 212,
      uptime: 99.8,
      checkedAt: CHECKED_AT,
      note: 'MD5 签名校验通过',
    },
    note: '支持取消，不支持订阅（用轮询兜底）。',
  },
  {
    code: 'yanwen',
    name: '燕文物流',
    enName: 'Yanwen',
    authType: 'MD5 签名（32 位小写）',
    sandbox: false,
    region: '欧美 · 邮政小包',
    capabilities: {
      rate: false,
      ship: true,
      label: true,
      track: true,
      cancel: false,
      subscribe: false,
    },
    health: {
      status: 'up',
      latencyMs: 195,
      uptime: 99.7,
      checkedAt: CHECKED_AT,
      note: '不支持实时报价，走预置费率卡',
    },
    note: '仅支持建单 / 面单 / 轨迹；不支持实时比价。',
  },
]

/** 加价规则（对齐后端 MarkupRulesService：按作用域 + 优先级生效） */
export interface MockMarkupRule {
  id: string
  scope: 'global' | 'tenant' | 'carrier' | 'channel' | 'product'
  target: string
  mode: 'percent' | 'fixed'
  value: number
  priority: number
  enabled: boolean
  note: string
}

const markupRules: MockMarkupRule[] = [
  {
    id: 'mr_global',
    scope: 'global',
    target: '全部渠道',
    mode: 'percent',
    value: 12,
    priority: 100,
    enabled: true,
    note: '基础加价；未命中专属规则时生效',
  },
  {
    id: 'mr_tenant_acme',
    scope: 'tenant',
    target: 'Acme 跨境店',
    mode: 'percent',
    value: 5,
    priority: 80,
    enabled: true,
    note: '大客户专属低加价',
  },
  {
    id: 'mr_carrier_dhl',
    scope: 'carrier',
    target: 'DHL 快递',
    mode: 'percent',
    value: 8,
    priority: 60,
    enabled: true,
    note: '商业快递官方价高，加价率下调',
  },
  {
    id: 'mr_carrier_yun',
    scope: 'carrier',
    target: '云途物流',
    mode: 'percent',
    value: 15,
    priority: 60,
    enabled: true,
    note: '专线小包走量，略高加价',
  },
  {
    id: 'mr_product_battery',
    scope: 'product',
    target: '带电类目',
    mode: 'percent',
    value: 6,
    priority: 40,
    enabled: true,
    note: '带电附加成本转嫁',
  },
  {
    id: 'mr_channel_amz',
    scope: 'channel',
    target: 'Amazon US',
    mode: 'fixed',
    value: 2,
    priority: 50,
    enabled: false,
    note: '固定加价，已停用',
  },
]

/** 币种汇率（对齐后端 FxService 种子） */
export interface MockFxRate {
  base: string
  quote: string
  rate: number
  updatedAt: string
}

const fxRates: MockFxRate[] = [
  { base: 'USD', quote: 'CNY', rate: 7.242, updatedAt: '2026-10-13T00:00:00.000Z' },
  { base: 'EUR', quote: 'CNY', rate: 7.865, updatedAt: '2026-10-13T00:00:00.000Z' },
  { base: 'GBP', quote: 'CNY', rate: 9.184, updatedAt: '2026-10-13T00:00:00.000Z' },
  { base: 'USD', quote: 'EUR', rate: 0.921, updatedAt: '2026-10-13T00:00:00.000Z' },
]

// ===== 演示态持久化（仅加价规则与汇率）=====
// 目的：用户在「加价 / 币种」页自定义的加价幅度，刷新浏览器后依然保留（仅演示模式）。
// 真实后端由数据库落库，本地演示用 localStorage 近似，避免「改了刷新就没」的错觉。
const PRICING_LS_KEY = 'mock-pricing-v1'

/** 将当前加价规则与汇率写入 localStorage（失败时静默忽略，如隐私模式）。 */
export function persistPricing(): void {
  try {
    localStorage.setItem(PRICING_LS_KEY, JSON.stringify({ markupRules, fxRates }))
  } catch {
    /* 忽略：无 localStorage 环境 */
  }
}

/** 清空演示态定价数据（页面提供「重置演示数据」入口调用）。 */
export function resetPricingDemo(): void {
  try {
    localStorage.removeItem(PRICING_LS_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 启动时用 localStorage 快照覆盖种子数据（数据损坏则保持种子）。 */
function restorePricing(): void {
  try {
    const raw = localStorage.getItem(PRICING_LS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { markupRules?: MockMarkupRule[]; fxRates?: MockFxRate[] }
    if (Array.isArray(saved.markupRules) && saved.markupRules.length) {
      markupRules.length = 0
      markupRules.push(...saved.markupRules)
    }
    if (Array.isArray(saved.fxRates) && saved.fxRates.length) {
      fxRates.length = 0
      fxRates.push(...saved.fxRates)
    }
  } catch {
    /* 忽略：保持种子数据 */
  }
}

restorePricing()

/** 比价结果行（含成本价与加价后售价「双价列」） */
export interface MockQuoteLine {
  carrierCode: string
  carrierName: string
  productCode: string
  productName: string
  transitDays: string
  costPrice: number
  sellPrice: number
  markupRate: number
  currency: string
  reachable: boolean
  note: string
}
export interface MockCompareTrace {
  layer: string
  detail: string
}
export interface MockCompareResult {
  request: Record<string, unknown>
  chargeableG: number
  currency: string
  lines: MockQuoteLine[]
  trace: MockCompareTrace[]
  generatedAt: string
}

const BANNED_COUNTRIES = ['KP', 'IR', 'SY']
const USD_CNY = 7.242

/** 承运商实时费率卡（成本口径，CNY）：首重 baseCny + 续重 perKgCny */
const RATE_CARDS: {
  code: string
  carrierName: string
  productCode: string
  productName: string
  baseCny: number
  perKgCny: number
  transit: string
  allowSensitive: boolean
}[] = [
  {
    code: 'yunexpress',
    carrierName: '云途物流',
    productCode: 'YUN-STD',
    productName: '云途专线小包',
    baseCny: 18,
    perKgCny: 68,
    transit: '8-12',
    allowSensitive: true,
  },
  {
    code: 'fourpx',
    carrierName: '4PX 递四方',
    productCode: '4PX-GLB',
    productName: '4PX 国际专线',
    baseCny: 22,
    perKgCny: 82,
    transit: '6-10',
    allowSensitive: true,
  },
  {
    code: 'dhl',
    carrierName: 'DHL 快递',
    productCode: 'DHL-EXP',
    productName: 'DHL Express 商业快递',
    baseCny: 46,
    perKgCny: 168,
    transit: '3-5',
    allowSensitive: false,
  },
]

/** 有效加价率：承运商专属规则覆盖全局基础加价，带电类目叠加产品规则 */
function effectiveMarkup(carrierName: string, category: string): number {
  const carrierRule = markupRules.find(
    (r) => r.enabled && r.scope === 'carrier' && r.target === carrierName,
  )
  const base =
    carrierRule?.value ?? markupRules.find((r) => r.enabled && r.scope === 'global')?.value ?? 0
  const batteryExtra =
    category === 'battery'
      ? (markupRules.find((r) => r.enabled && r.scope === 'product')?.value ?? 0)
      : 0
  return base + batteryExtra
}

/** 运费试算：L1 费率卡 → L2 可达性 → L3 实时池 → L4 护栏（与后端 PricingEngineService 四层一致） */
function doCompare(body: unknown): unknown {
  const req = (body ?? {}) as {
    country?: string
    weightG?: number
    lengthCm?: number
    widthCm?: number
    heightCm?: number
    category?: string
    declaredValue?: number
  }
  const country = (req.country || 'US').toUpperCase()
  const weightG = Number(req.weightG) || 500
  const lengthCm = Number(req.lengthCm) || 20
  const widthCm = Number(req.widthCm) || 15
  const heightCm = Number(req.heightCm) || 10
  const category = req.category || 'normal'

  // 计费重：实重与体积重（长×宽×高/5000）取大
  const volumetricG = Math.round(((lengthCm * widthCm * heightCm) / 5000) * 1000)
  const chargeableG = Math.max(weightG, volumetricG)
  const chargeableKg = Math.round((chargeableG / 1000) * 100) / 100

  const trace: MockCompareTrace[] = []

  // L1 预热费率卡
  trace.push({
    layer: 'L1 预热费率卡',
    detail: `命中 ${RATE_CARDS.length} 条承运商费率卡（云途 / 4PX / DHL）`,
  })

  // L2 可达性地图
  const banned = BANNED_COUNTRIES.includes(country)
  const l2detail = banned
    ? `目的国 ${country} 命中禁运清单（KP / IR / SY），实时池整体剔除`
    : category === 'sensitive'
      ? `目的国 ${country} 可达；「敏感货」仅云途 / 4PX 可承运，DHL 剔除`
      : `目的国 ${country} 可达，禁运清单未命中`
  trace.push({ layer: 'L2 可达性地图', detail: l2detail })

  // L3 实时并行池（2s SLA）
  const lines: MockQuoteLine[] = []
  if (!banned) {
    for (const rc of RATE_CARDS) {
      if (category === 'sensitive' && !rc.allowSensitive) continue
      const costCny = rc.baseCny + rc.perKgCny * chargeableKg
      const costPrice = Math.round((costCny / USD_CNY) * 100) / 100
      const markupRate = effectiveMarkup(rc.carrierName, category)
      const sellPrice = Math.round(costPrice * (1 + markupRate / 100) * 100) / 100
      lines.push({
        carrierCode: rc.code,
        carrierName: rc.carrierName,
        productCode: rc.productCode,
        productName: rc.productName,
        transitDays: rc.transit,
        costPrice,
        sellPrice,
        markupRate,
        currency: 'USD',
        reachable: true,
        note: category === 'battery' && rc.code === 'dhl' ? '带电需走专用渠道，仅作参考' : '',
      })
    }
  }
  trace.push({
    layer: 'L3 实时并行池',
    detail: banned
      ? 'L2 已剔除，跳过实时询价'
      : `并发询价 ${RATE_CARDS.length} 家，2s SLA 内全部返回`,
  })

  // L4 结果护栏：去重 → 售价升序 → 截断 20
  lines.sort((a, b) => a.sellPrice - b.sellPrice)
  const seen = new Set<string>()
  const deduped = lines.filter((l) => {
    const k = l.carrierCode + ':' + l.productCode
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const truncated = deduped.slice(0, 20)
  trace.push({
    layer: 'L4 结果护栏',
    detail: `去重 ${deduped.length} 条 → 按售价升序 → 截断 ${truncated.length}/20`,
  })

  return {
    request: {
      country,
      weightG,
      lengthCm,
      widthCm,
      heightCm,
      category,
      declaredValue: Number(req.declaredValue) || 0,
    },
    chargeableG,
    currency: 'USD',
    lines: truncated,
    trace,
    generatedAt: NOW(),
  } as MockCompareResult
}

// ===== 站点设置（站点名称 / 品牌标识 / TDK·SEO / 统计代码）=====
/**
 * 演示态站点设置，镜像后端 `site_settings`（GET / PUT `/settings/site`）。
 * 站点名称会实时反映到后台侧栏 LOGO 与浏览器标签页标题（见 stores/site.ts），
 * 便于直观确认「改了确实生效」；TDK 规则用于生成前台各页面的 Title/Description/Keywords。
 */

/** TDK 规则适用的页面类型（与前台路由对应） */
export type MockTdkPage = 'home' | 'product' | 'category' | 'quote' | 'article' | 'custom'

/** 单条页面 TDK 规则：模板支持 {site} {name} {category} 等变量，渲染时按页面数据替换。 */
export interface MockTdkRule {
  id: string
  page: MockTdkPage
  path: string
  titleTpl: string
  descTpl: string
  keywords: string
  enabled: boolean
  note: string
}

export interface MockSiteSettings {
  // 站点基础信息
  siteName: string
  siteSlogan: string
  logoUrl: string
  faviconUrl: string
  domain: string
  icpNo: string
  copyright: string
  // 联系方式
  contactEmail: string
  contactPhone: string
  serviceTime: string
  // 国际化
  lang: string
  timezone: string
  // SEO 标题拼接规则
  titleSeparator: string
  titleSuffix: 'always' | 'home' | 'never'
  homeTitle: string
  homeDesc: string
  homeKeywords: string
  // 第三方代码
  headCode: string
  bodyCode: string
  verifyMeta: string
  robots: string
  sitemapEnabled: boolean
  // 页面 TDK 规则表
  tdkRules: MockTdkRule[]
  updatedAt: string
}

/** 站点设置种子数据（真实环境由后端库表提供）。 */
function defaultSiteSettings(): MockSiteSettings {
  return {
    siteName: '代发·货代运营中台',
    siteSlogan: '一件代发 · 跨境物流履约',
    logoUrl: '',
    faviconUrl: '',
    domain: 'https://ops.example.com',
    icpNo: '粤ICP备2026000000号',
    copyright: '© 2026 代发·货代运营中台 版权所有',
    contactEmail: 'support@example.com',
    contactPhone: '400-000-0000',
    serviceTime: '工作日 09:00–18:00',
    lang: 'zh-CN',
    timezone: 'Asia/Shanghai',
    titleSeparator: ' - ',
    titleSuffix: 'always',
    homeTitle: '代发·货代运营中台 | 一件代发与跨境物流履约平台',
    homeDesc:
      '为跨境卖家与货代运营方提供订单履约、承运商比价、运费试算与多店铺统一管理的一站式中台。',
    homeKeywords: '一件代发,货代运营,跨境物流,运费试算,订单履约,海外仓',
    headCode: '',
    bodyCode: '',
    verifyMeta: '',
    robots:
      'User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://ops.example.com/sitemap.xml',
    sitemapEnabled: true,
    tdkRules: [
      {
        id: 'tdk_home',
        page: 'home',
        path: '/',
        titleTpl: '{site} | 一件代发与跨境物流履约平台',
        descTpl: '{site} 为跨境卖家提供订单履约、承运商比价与运费试算的一站式中台。',
        keywords: '一件代发,货代运营,跨境物流,运费试算',
        enabled: true,
        note: '首页默认 TDK',
      },
      {
        id: 'tdk_product',
        page: 'product',
        path: '/product/{id}',
        titleTpl: '{name} - {site}',
        descTpl: '{name}：{category}类目，支持全球直发与海外仓一件代发，{site} 提供实时运费试算。',
        keywords: '{name},{category},一件代发',
        enabled: true,
        note: '商品详情页（变量：name / category）',
      },
      {
        id: 'tdk_category',
        page: 'category',
        path: '/category/{slug}',
        titleTpl: '{category} - {site}',
        descTpl: '精选 {category} 品类货源，支持一件代发与批量发货，{site} 提供全链路履约。',
        keywords: '{category},货源,一件代发',
        enabled: true,
        note: '品类聚合页（变量：category）',
      },
      {
        id: 'tdk_quote',
        page: 'quote',
        path: '/quote',
        titleTpl: '运费试算 - {site}',
        descTpl:
          '输入目的国、重量与体积即可比价云途、DHL、4PX、燕文等渠道，{site} 为你选出最优物流方案。',
        keywords: '运费试算,国际物流比价,跨境运费',
        enabled: true,
        note: '运费试算页（高 SEO 价值入口）',
      },
      {
        id: 'tdk_article',
        page: 'article',
        path: '/news/{id}',
        titleTpl: '{name} - {site}资讯',
        descTpl: '{name}｜{site} 跨境物流与一件代发实战干货。',
        keywords: '{name},跨境物流,干货',
        enabled: false,
        note: '资讯文章页（暂未启用）',
      },
    ],
    updatedAt: '2026-10-13T00:00:00.000Z',
  }
}

// ===== 演示态持久化（站点设置）=====
// 与加价规则同理：演示模式下改动写入 localStorage，刷新后仍在，避免「改了就没」的错觉。
const SITE_LS_KEY = 'mock-site-v1'

let siteSettings: MockSiteSettings = defaultSiteSettings()

/** 深拷贝站点设置（含 TDK 规则数组），避免视图 v-model 直接改写模块级状态。 */
function cloneSite(): MockSiteSettings {
  return { ...siteSettings, tdkRules: siteSettings.tdkRules.map((r) => ({ ...r })) }
}

function persistSite(): void {
  try {
    localStorage.setItem(SITE_LS_KEY, JSON.stringify(siteSettings))
  } catch {
    /* 忽略：无 localStorage 环境 */
  }
}

/** 清空演示态站点设置快照（页面「重置演示数据」入口调用）。 */
export function resetSiteDemo(): void {
  try {
    localStorage.removeItem(SITE_LS_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 启动时用 localStorage 快照覆盖种子数据（数据损坏则保持种子）。 */
function restoreSite(): void {
  try {
    const raw = localStorage.getItem(SITE_LS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<MockSiteSettings>
    if (saved && typeof saved === 'object' && saved.siteName) {
      const base = defaultSiteSettings()
      siteSettings = {
        ...base,
        ...saved,
        tdkRules: Array.isArray(saved.tdkRules) ? saved.tdkRules : base.tdkRules,
      }
    }
  } catch {
    /* 忽略：保持种子数据 */
  }
}

restoreSite()

/** 更新站点设置：逐字段白名单写入，站点名称去空白后不允许为空。 */
function updateSite(body: unknown): MockSiteSettings {
  const p = (body ?? {}) as Partial<MockSiteSettings>
  if (p.siteName !== undefined) {
    const name = String(p.siteName).trim()
    if (!name) return reject('站点名称不能为空') as unknown as MockSiteSettings
    siteSettings.siteName = name
  }
  // 文本类字段统一去空白，避免前台渲染出多余空格
  if (p.siteSlogan !== undefined) siteSettings.siteSlogan = String(p.siteSlogan).trim()
  if (p.logoUrl !== undefined) siteSettings.logoUrl = String(p.logoUrl).trim()
  if (p.faviconUrl !== undefined) siteSettings.faviconUrl = String(p.faviconUrl).trim()
  if (p.domain !== undefined) siteSettings.domain = String(p.domain).trim()
  if (p.icpNo !== undefined) siteSettings.icpNo = String(p.icpNo).trim()
  if (p.copyright !== undefined) siteSettings.copyright = String(p.copyright).trim()
  if (p.contactEmail !== undefined) siteSettings.contactEmail = String(p.contactEmail).trim()
  if (p.contactPhone !== undefined) siteSettings.contactPhone = String(p.contactPhone).trim()
  if (p.serviceTime !== undefined) siteSettings.serviceTime = String(p.serviceTime).trim()
  if (p.lang !== undefined) siteSettings.lang = String(p.lang).trim()
  if (p.timezone !== undefined) siteSettings.timezone = String(p.timezone).trim()
  if (p.titleSeparator !== undefined) siteSettings.titleSeparator = String(p.titleSeparator)
  if (p.titleSuffix !== undefined) {
    const v = String(p.titleSuffix)
    siteSettings.titleSuffix = v === 'home' || v === 'never' ? v : 'always'
  }
  if (p.homeTitle !== undefined) siteSettings.homeTitle = String(p.homeTitle)
  if (p.homeDesc !== undefined) siteSettings.homeDesc = String(p.homeDesc)
  if (p.homeKeywords !== undefined) siteSettings.homeKeywords = String(p.homeKeywords)
  if (p.headCode !== undefined) siteSettings.headCode = String(p.headCode)
  if (p.bodyCode !== undefined) siteSettings.bodyCode = String(p.bodyCode)
  if (p.verifyMeta !== undefined) siteSettings.verifyMeta = String(p.verifyMeta).trim()
  if (p.robots !== undefined) siteSettings.robots = String(p.robots)
  if (p.sitemapEnabled !== undefined) siteSettings.sitemapEnabled = Boolean(p.sitemapEnabled)
  if (p.tdkRules !== undefined && Array.isArray(p.tdkRules)) siteSettings.tdkRules = p.tdkRules
  siteSettings.updatedAt = NOW()
  persistSite()
  return cloneSite()
}

/** 演示态「上传」结果（镜像正式环境 POST /settings/assets 的返回结构）。 */
export interface MockUploadedAsset {
  url: string
  kind: 'logo' | 'favicon'
  name: string
  width: number
  height: number
  bytes: number
  mime: string
  /** demo-local：演示模式未落对象存储（正式环境为 minio / cdn） */
  storage: string
  uploadedAt: string
}

/** 解析 dataURL 体积（base64 段长度 × 3/4），用于回显文件大小。 */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}

/**
 * 演示态品牌图片上传：不落任何存储，直接把前端压缩后的 dataURL 当地址返回。
 * 与正式环境（POST /settings/assets → 对象存储 → 返回 CDN 地址）保持同一调用契约，
 * 使「站点设置」页在演示模式下也能完整走通上传 → 预览 → 保存链路。
 */
function doUploadAsset(body: unknown): MockUploadedAsset {
  const p = (body ?? {}) as {
    kind?: string
    dataUrl?: string
    name?: string
    width?: number
    height?: number
  }
  const dataUrl = typeof p.dataUrl === 'string' ? p.dataUrl : ''
  if (!dataUrl.startsWith('data:image/')) return reject('缺少图片数据') as unknown as MockUploadedAsset
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  return {
    url: dataUrl,
    kind: p.kind === 'favicon' ? 'favicon' : 'logo',
    name: p.name || 'asset',
    width: Math.max(0, Math.round(p.width ?? 0)),
    height: Math.max(0, Math.round(p.height ?? 0)),
    bytes: dataUrlBytes(dataUrl),
    mime,
    storage: 'demo-local',
    uploadedAt: NOW(),
  }
}

/** TDK 规则入参归一化：模板与关键词去空白，页面类型非法时回落自定义。 */
function normalizeTdkInput(input: Partial<MockTdkRule>): Partial<MockTdkRule> {
  const out: Partial<MockTdkRule> = {}
  const pages: MockTdkPage[] = ['home', 'product', 'category', 'quote', 'article', 'custom']
  if (input.page !== undefined) out.page = pages.includes(input.page) ? input.page : 'custom'
  if (input.path !== undefined) out.path = String(input.path).trim()
  if (input.titleTpl !== undefined) out.titleTpl = String(input.titleTpl).trim()
  if (input.descTpl !== undefined) out.descTpl = String(input.descTpl).trim()
  if (input.keywords !== undefined) out.keywords = String(input.keywords).trim()
  if (input.enabled !== undefined) out.enabled = Boolean(input.enabled)
  if (input.note !== undefined) out.note = String(input.note)
  return out
}

/** 新建 TDK 规则：模板为空则拒绝（空 TDK 对 SEO 有害）。 */
function createTdkRule(body: unknown): MockTdkRule {
  const patch = normalizeTdkInput((body ?? {}) as Partial<MockTdkRule>)
  if (!patch.titleTpl) return reject('标题模板不能为空') as unknown as MockTdkRule
  const rule: MockTdkRule = {
    id: 'tdk_' + Date.now().toString(36) + '_' + seq++,
    page: patch.page ?? 'custom',
    path: patch.path ?? '/',
    titleTpl: patch.titleTpl,
    descTpl: patch.descTpl ?? '',
    keywords: patch.keywords ?? '',
    enabled: patch.enabled ?? true,
    note: patch.note ?? '',
  }
  siteSettings.tdkRules.push(rule)
  siteSettings.updatedAt = NOW()
  persistSite()
  return { ...rule }
}

/** 更新 TDK 规则（整条覆盖式更新，仅接受传入字段）。 */
function updateTdkRule(id: string, body: unknown): MockTdkRule {
  const idx = siteSettings.tdkRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('TDK 规则不存在') as unknown as MockTdkRule
  const patch = normalizeTdkInput((body ?? {}) as Partial<MockTdkRule>)
  siteSettings.tdkRules[idx] = { ...siteSettings.tdkRules[idx], ...patch }
  siteSettings.updatedAt = NOW()
  persistSite()
  return { ...siteSettings.tdkRules[idx] }
}

/** 删除 TDK 规则。 */
function deleteTdkRule(id: string): { deleted: boolean } {
  const idx = siteSettings.tdkRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('TDK 规则不存在') as unknown as { deleted: boolean }
  siteSettings.tdkRules.splice(idx, 1)
  siteSettings.updatedAt = NOW()
  persistSite()
  return { deleted: true }
}

/** 重置站点设置：清空本地快照并回到种子数据（仅演示模式）。 */
function doResetSite(): MockSiteSettings {
  resetSiteDemo()
  siteSettings = defaultSiteSettings()
  return cloneSite()
}
