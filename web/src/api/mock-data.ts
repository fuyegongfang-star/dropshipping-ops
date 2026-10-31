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
import type { WalletSummary, LedgerType, LedgerItem } from './finance'
import type { BillItem, ReconciliationItem, ProfitSummary, GenerateResult, ProfitBreakdown, TenantProfit, CarrierCost } from './billing'
import type { ReportDashboard } from './reports'
import type { ClaimOut, ClaimType, ClaimStatus, ClaimResponsibleParty, CreateClaimDto, UpdateClaimStatusDto } from './claims'
import type { PackCheckRow, PackCheckSummary, PackQueueItem, PackQueue, PackTaskDto, PackTaskCheck, ChannelOption, ShippingLabelDto, PackLabelResult, OutboundTransferDto, OutboundTrackingVo, OutboundResult } from './transfer'
import type { BinDto } from './wms'
import type { RiskRule, RiskOrderEvaluation, BlacklistEntry, RiskSummary, CreateRiskRuleDto, UpdateRiskRuleDto, CreateBlacklistDto, ReviewDecisionDto } from './risk'
import type {
  AmazonHealth,
  AmazonInboundItemInput,
  AmazonInboundShipmentPlan,
  AmazonInboundShipment,
  AmazonPrepInstruction,
  AmazonShippingLabel,
  AmazonReport,
  AmazonSettlementSummary,
} from './amazon'
import type { BarcodeLookupResult } from './catalog'

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
  authConfig: Record<string, unknown> | null
  createdAt: string
}
export interface MockPurchaseOrderItem {
  id: string
  purchaseOrderId: string
  skuId: string | null
  productName: string
  quantity: number
  imageUrl: string | null
  unitPrice: number | null
  createdAt: string
}
export interface MockPurchaseOrder {
  id: string
  tenantId: string
  shopId: string | null
  orderId: string | null
  trackingNo: string
  /** 业务采购单号（人类可读、可印成条码供扫码枪识别，6.12） */
  purchaseNo: string | null
  carrier: string
  platformOrderNo: string | null
  recipientName: string | null
  purchaseUrl: string | null
  productImages: string[]
  remark: string | null
  /** 收货标签箱数（7.2 供应商贴箱 → 中转仓一枪到货） */
  boxCount: number
  status: string
  createdAt: string
  updatedAt: string
  items: MockPurchaseOrderItem[]
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
/** SKU 多码（阶段7，任务 7.1）：主码之外的供应商码/内部码/EAN-13/其它 */
export interface MockSkuBarcode {
  id: string
  tenantId: string
  skuId: string
  code: string
  kind: string // supplier | internal | ean13 | other
  createdAt: string
}
export interface MockOrderItem {
  sku: { code: string; platformSku: string | null; supplierSku: string | null } | null
  quantity: number
  /** 平台商品主图（采购单关联订单后自动拉取；演示态为内联 SVG，可直接渲染） */
  imageUrl?: string | null
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

// ===== 采购单（阶段6 中转仓作业流，任务 6.2/6.3，方案 §21 衍生）=====
const purchaseOrders: MockPurchaseOrder[] = [
  {
    id: 'po_demo_1', tenantId: TENANT_ID, shopId: 's_shopify', orderId: null, trackingNo: 'SF1234567890', purchaseNo: 'CG20261023-0001',
    carrier: '顺丰速运', platformOrderNo: 'SO-10001', recipientName: 'John Doe', purchaseUrl: 'https://item.demo.com/p/earbud',
    productImages: ['https://img.demo.com/earbud.jpg'], remark: '首批蓝牙耳机采购（与 SO-10001 自动命中）', boxCount: 2, status: 'pending',
    createdAt: '2026-10-23T09:00:00.000Z', updatedAt: '2026-10-23T09:00:00.000Z',
    items: [
      { id: 'poi_1', purchaseOrderId: 'po_demo_1', skuId: 'sk1', productName: '无线蓝牙耳机 Pro', quantity: 30, imageUrl: 'https://img.demo.com/earbud.jpg', unitPrice: 68, createdAt: '2026-10-23T09:00:00.000Z' },
    ],
  },
  {
    id: 'po_demo_2', tenantId: TENANT_ID, shopId: 's_amazon', orderId: null, trackingNo: 'YT9876543210', purchaseNo: 'CG20261023-0002',
    carrier: '圆通速递', platformOrderNo: null, recipientName: null, purchaseUrl: 'https://item.demo.com/p/case',
    productImages: ['https://img.demo.com/case.jpg'], remark: null, boxCount: 1, status: 'arrived',
    createdAt: '2026-10-23T10:30:00.000Z', updatedAt: '2026-10-24T08:00:00.000Z',
    items: [
      { id: 'poi_2', purchaseOrderId: 'po_demo_2', skuId: null, productName: '手机壳', quantity: 100, imageUrl: 'https://img.demo.com/case.jpg', unitPrice: 5, createdAt: '2026-10-23T10:30:00.000Z' },
    ],
  },
  // 阶段6 演示：已到仓并匹配订单的采购单（6.7 待打包队列演示数据）
  {
    id: 'po_pack_1', tenantId: TENANT_ID, shopId: 's_shopify', orderId: 'o1', trackingNo: 'PACK-SF001', purchaseNo: 'CG20261025-0001',
    carrier: '顺丰速运', platformOrderNo: 'SO-10001', recipientName: 'John Doe', purchaseUrl: 'https://item.demo.com/p/earbud',
    productImages: ['https://img.demo.com/earbud.jpg'], remark: '蓝牙耳机到仓，已匹配 SO-10001', boxCount: 1, status: 'matched',
    createdAt: '2026-10-25T09:00:00.000Z', updatedAt: '2026-10-25T09:00:00.000Z',
    items: [
      { id: 'poi_p1', purchaseOrderId: 'po_pack_1', skuId: 'sk1', productName: '无线蓝牙耳机 Pro', quantity: 2, imageUrl: 'https://img.demo.com/earbud.jpg', unitPrice: 68, createdAt: '2026-10-25T09:00:00.000Z' },
    ],
  },
  {
    id: 'po_pack_2', tenantId: TENANT_ID, shopId: 's_shopify', orderId: 'o2', trackingNo: 'PACK-YT002', purchaseNo: 'CG20261025-0002',
    carrier: '圆通速递', platformOrderNo: 'SO-10002', recipientName: 'Jane Smith', purchaseUrl: 'https://item.demo.com/p/power',
    productImages: ['https://img.demo.com/power.jpg'], remark: '充电宝到仓，已匹配 SO-10002（数量不符演示）', boxCount: 3, status: 'matched',
    createdAt: '2026-10-25T10:00:00.000Z', updatedAt: '2026-10-25T10:00:00.000Z',
    items: [
      { id: 'poi_p2', purchaseOrderId: 'po_pack_2', skuId: 'sk2', productName: '便携充电宝 20000mAh', quantity: 3, imageUrl: 'https://img.demo.com/power.jpg', unitPrice: 99, createdAt: '2026-10-25T10:00:00.000Z' },
    ],
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

// ===== SKU 多码（阶段7，任务 7.1）=====
// 演示态内存状态，变更（新增/删除/设主码）持久化到 localStorage 覆盖层，
// 否则演示模式刷新后条码全部丢失（与主码 skus 不同，多码不在种子里重建）。
const SKU_BARCODES_KEY = 'dso.sku-barcodes-v1'
let skuBarcodes: MockSkuBarcode[] = (() => {
  try {
    const raw = localStorage.getItem(SKU_BARCODES_KEY)
    if (raw) return JSON.parse(raw) as MockSkuBarcode[]
  } catch {
    /* 忽略损坏的本地缓存 */
  }
  // 种子：给部分 SKU 预置多码，演示「+N」徽章与多码表
  return [
    { id: 'sb1', tenantId: TENANT_ID, skuId: 'sk1', code: '6901111111116', kind: 'ean13', createdAt: '2026-09-02T08:30:00.000Z' },
    { id: 'sb2', tenantId: TENANT_ID, skuId: 'sk1', code: 'SUP-ES-BLK-A', kind: 'supplier', createdAt: '2026-09-03T09:10:00.000Z' },
    { id: 'sb3', tenantId: TENANT_ID, skuId: 'sk2', code: '6902222222215', kind: 'ean13', createdAt: '2026-09-04T10:00:00.000Z' },
    { id: 'sb4', tenantId: TENANT_ID, skuId: 'sk3', code: '8801111199990', kind: 'ean13', createdAt: '2026-09-05T11:20:00.000Z' },
  ]
})()

function persistSkuBarcodes(): void {
  try {
    localStorage.setItem(SKU_BARCODES_KEY, JSON.stringify(skuBarcodes))
  } catch {
    /* 存储不可用时静默降级，不影响内存态 */
  }
}

// 演示商品主图：内联 SVG（data URL），无外网也能渲染，便于验证「关联订单自动拉取主图」。
function demoImg(text: string, bg: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">` +
    `<rect width="240" height="240" fill="${bg}"/>` +
    `<text x="120" y="120" font-family="sans-serif" font-size="26" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${text}</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** SKU → 商品主图（与 skus 种子一一对应） */
const SKU_IMAGES: Record<string, string> = {
  sk1: demoImg('耳机 Pro', '#4f7cff'),
  sk2: demoImg('充电宝 20K', '#0ea5e9'),
  sk3: demoImg('智能手环', '#8b5cf6'),
  sk4: demoImg('折叠支架', '#f59e0b'),
  sk5: demoImg('耳机 白', '#7c5cff'),
  sk6: demoImg('充电宝 10K', '#10b981'),
}

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

// ===== 物流回传 + 轨迹基础（任务 1.6，方案 §3 推单回传 / §6 轨迹）=====
// 演示态：与后端 ShipmentsModule 同口径，建单 / 回传 / 上报均真实改写内存，
// 使「订单 → 建单 → 回传平台 → 轨迹上报」基础闭环可在纯前端交互验证。

/** 运单分段（§14 头程/尾程/全程） */
export interface MockShipmentLeg {
  legType: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  status: string
}
/** 运单（镜像后端 ShipmentVo） */
export interface MockShipment {
  id: string
  orderId: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  waybillNo?: string
  status: string
  legType: string
  carrierCost?: number
  sellPrice?: number
  currency?: string
  labelUrl?: string
  legs: MockShipmentLeg[]
  createdAt: string
}
/** 轨迹节点（镜像后端 TrackingEvent） */
export interface MockTrackingEvent {
  id: string
  shipmentId: string
  legType?: string
  status: string
  location?: string
  description?: string
  occurredAt: string
}

let shippingSeq = 100
let trackingSeq = 100
/** 种子运单：绑定既有订单，刷新即见基础闭环数据（建单 + 回传 + 揽收 + 在途） */
const shipments: MockShipment[] = [
  {
    id: 'sh_seed1',
    orderId: 'o3',
    carrierCode: 'yunexpress',
    carrierName: '云途物流',
    trackingNo: 'TRK-YUNEXPRESS-SEED1',
    waybillNo: 'WB-YUNEXPRESS-SEED1',
    status: 'pushed',
    legType: 'direct',
    carrierCost: 46.62,
    sellPrice: 53.61,
    currency: 'USD',
    createdAt: '2026-10-03T10:00:00.000Z',
    legs: [{ legType: 'direct', carrierCode: 'yunexpress', carrierName: '云途物流', trackingNo: 'TRK-YUNEXPRESS-SEED1', status: 'pushed' }],
  },
  {
    id: 'sh_seed2',
    orderId: 'o5',
    carrierCode: 'fourpx',
    carrierName: '4PX 递四方',
    trackingNo: 'TRK-4PX-SEED2',
    waybillNo: 'WB-4PX-SEED2',
    status: 'in_transit',
    legType: 'direct',
    carrierCost: 57.24,
    sellPrice: 65.83,
    currency: 'USD',
    createdAt: '2026-10-05T11:00:00.000Z',
    legs: [{ legType: 'direct', carrierCode: 'fourpx', carrierName: '4PX 递四方', trackingNo: 'TRK-4PX-SEED2', status: 'in_transit' }],
  },
]
const trackingEvents: MockTrackingEvent[] = [
  { id: 'te_s1_1', shipmentId: 'sh_seed1', legType: 'direct', status: 'booked', location: '系统', description: '已为订单 o3 向 云途物流 建单', occurredAt: '2026-10-03T10:00:00.000Z' },
  { id: 'te_s1_2', shipmentId: 'sh_seed1', legType: 'direct', status: 'pushed', location: '渠道回传', description: '已回传运单号 WB-YUNEXPRESS-SEED1 至销售渠道', occurredAt: '2026-10-03T12:00:00.000Z' },
  { id: 'te_s1_3', shipmentId: 'sh_seed1', legType: 'direct', status: 'picked_up', location: '深圳', description: '已揽收', occurredAt: '2026-10-04T09:00:00.000Z' },
  { id: 'te_s2_1', shipmentId: 'sh_seed2', legType: 'direct', status: 'booked', location: '系统', description: '已为订单 o5 向 4PX 递四方 建单', occurredAt: '2026-10-05T11:00:00.000Z' },
  { id: 'te_s2_2', shipmentId: 'sh_seed2', legType: 'direct', status: 'pushed', location: '渠道回传', description: '已回传运单号 WB-4PX-SEED2 至销售渠道', occurredAt: '2026-10-05T13:00:00.000Z' },
  { id: 'te_s2_3', shipmentId: 'sh_seed2', legType: 'direct', status: 'picked_up', location: '上海', description: '已揽收', occurredAt: '2026-10-06T09:00:00.000Z' },
  { id: 'te_s2_4', shipmentId: 'sh_seed2', legType: 'direct', status: 'in_transit', location: '上海转运中心', description: '运输中', occurredAt: '2026-10-07T09:00:00.000Z' },
]

/** 运单列表（可按订单过滤），返回副本避免视图直接改写内存 */
function doListShipments(orderId?: string): MockShipment[] {
  const list = orderId ? shipments.filter((s) => s.orderId === orderId) : shipments
  return list.map((s) => ({ ...s }))
}

/** 为订单建单：向承运商下单并落库运单 + 首条「已建单」轨迹 */
function doBookShipment(body: unknown): MockShipment {
  const req = body as {
    orderId?: string
    carrierCode?: string
    legType?: string
    cargoType?: string
    declaredValue?: number
    currency?: string
  }
  if (!req.orderId) throw new Error('orderId 必填')
  const order = orders.find((o) => o.id === req.orderId)
  if (!order) throw new Error('订单不存在')
  const code = req.carrierCode || 'yunexpress'
  const name = carriers.find((c) => c.code === code)?.name || code
  const id = 'sh_' + shippingSeq++
  const waybillNo = `WB-${code.toUpperCase()}-${shippingSeq++}`
  const trackingNo = `TRK-${code.toUpperCase()}-${shippingSeq++}`
  // 演示口径：运费≈货值 18%，售价含 15% 毛利
  const carrierCost = Number((order.totalAmount * 0.18).toFixed(2))
  const legType = req.legType || 'direct'
  const shipment: MockShipment = {
    id,
    orderId: req.orderId,
    carrierCode: code,
    carrierName: name,
    trackingNo,
    waybillNo,
    status: 'booked',
    legType,
    carrierCost,
    sellPrice: Number((carrierCost * 1.15).toFixed(2)),
    currency: 'USD',
    legs: [{ legType, carrierCode: code, carrierName: name, trackingNo, status: 'booked' }],
    createdAt: NOW(),
  }
  shipments.push(shipment)
  trackingEvents.push({
    id: 'te_' + trackingSeq++,
    shipmentId: id,
    legType,
    status: 'booked',
    location: '系统',
    description: `已为订单 ${req.orderId} 向 ${name} 建单`,
    occurredAt: NOW(),
  })
  return { ...shipment }
}

/** 推单回传：将运单号回写销售渠道，推进运单与订单至 pushed */
function doFulfillShipment(id: string): { success: boolean; message: string } {
  const s = shipments.find((x) => x.id === id)
  if (!s) return { success: false, message: '运单不存在' }
  s.status = 'pushed'
  if (s.legs[0]) s.legs[0].status = 'pushed'
  trackingEvents.push({
    id: 'te_' + trackingSeq++,
    shipmentId: id,
    legType: s.legType,
    status: 'pushed',
    location: '渠道回传',
    description: `已回传运单号 ${s.waybillNo} 至销售渠道`,
    occurredAt: NOW(),
  })
  return { success: true, message: '已回传平台，订单推进至 pushed' }
}

/** 上报轨迹节点（Webhook / 轮询入口），并同步更新运单当前状态 */
function doRecordTracking(id: string, body: unknown): MockTrackingEvent {
  const s = shipments.find((x) => x.id === id)
  if (!s) throw new Error('运单不存在')
  const req = body as {
    status?: string
    location?: string
    description?: string
    occurredAt?: string
  }
  const status = req.status || 'in_transit'
  const ev: MockTrackingEvent = {
    id: 'te_' + trackingSeq++,
    shipmentId: id,
    legType: s.legType,
    status,
    location: req.location,
    description: req.description || `轨迹更新：${status}`,
    occurredAt: req.occurredAt || NOW(),
  }
  trackingEvents.push(ev)
  s.status = status
  if (s.legs[0]) s.legs[0].status = status
  return { ...ev }
}

/** 查询运单轨迹时间线（按发生时间升序） */
function doListTracking(id: string): MockTrackingEvent[] {
  return trackingEvents
    .filter((e) => e.shipmentId === id)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => ({ ...e }))
}

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
    // 行项带上商品主图：采购单关联该订单时可一键拉取（任务 6.11）。
    items: items.map((it) => ({ ...it, imageUrl: itemImage(it) })),
    events,
  }
}

/** 取订单行项的商品主图：行项自带优先，否则按 SKU ID 查演示主图 */
function itemImage(it: MockOrderItem): string | null {
  if (it.imageUrl) return it.imageUrl
  const skuId = (it.sku as unknown as { id?: string } | null)?.id
  return skuId ? SKU_IMAGES[skuId] ?? null : null
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

// ===== 条码 / 多码管理（阶段7，任务 7.1）=====
// 演示态与后端 catalog 模块同口径：主码 Sku.barcode + 多码表 SkuBarcode，互斥去重，
// 变更持久化到 localStorage（dso.sku-barcodes-v1），刷新不丢。
function skuProductTitle(skuId: string): string {
  const sku = skus.find((s) => s.id === skuId && s.tenantId === TENANT_ID)
  if (!sku) return ''
  const p = products.find((x) => x.id === sku.productId)
  return p?.title ?? ''
}

export function doBarcodeLookup(code: string): BarcodeLookupResult | null {
  const normalized = (code ?? '').trim()
  if (!normalized) return null
  const main = skus.find((s) => s.tenantId === TENANT_ID && s.barcode === normalized)
  if (main) {
    return { skuId: main.id, code: normalized, productName: skuProductTitle(main.id), matchedBy: 'main', kind: null }
  }
  const alt = skuBarcodes.find((b) => b.tenantId === TENANT_ID && b.code === normalized)
  if (alt) {
    return { skuId: alt.skuId, code: normalized, productName: skuProductTitle(alt.skuId), matchedBy: 'alt', kind: alt.kind }
  }
  return null
}

export function doListBarcodes(skuId: string): MockSkuBarcode[] {
  return skuBarcodes.filter((b) => b.tenantId === TENANT_ID && b.skuId === skuId).map((b) => ({ ...b }))
}

let barcodeSeq = 5000
export function doAddBarcode(skuId: string, body: { code?: string; kind?: string }): MockSkuBarcode {
  const sku = skus.find((s) => s.id === skuId && s.tenantId === TENANT_ID)
  if (!sku) throw new Error('SKU 不存在或越权')
  const code = (body.code ?? '').trim()
  if (!code) throw new Error('条码不能为空')
  // 互斥去重：主码 + 多码任一存在即冲突（与后端 SKU_BARCODE_DUPLICATE 同口径）
  if (skus.some((s) => s.tenantId === TENANT_ID && s.barcode === code)) {
    throw new Error(`条码 ${code} 已作为主码存在于 SKU ${sku.code}`)
  }
  const hit = skuBarcodes.find((b) => b.tenantId === TENANT_ID && b.code === code)
  if (hit) {
    const owner = skus.find((s) => s.id === hit.skuId)
    throw new Error(`条码 ${code} 已作为多码存在于 SKU ${owner?.code ?? hit.skuId}`)
  }
  const created: MockSkuBarcode = {
    id: `sb_${++barcodeSeq}`,
    tenantId: TENANT_ID,
    skuId,
    code,
    kind: body.kind && body.kind.length ? body.kind : 'other',
    createdAt: new Date().toISOString(),
  }
  skuBarcodes.push(created)
  persistSkuBarcodes()
  return { ...created }
}

export function doDeleteBarcode(id: string): void {
  const idx = skuBarcodes.findIndex((b) => b.id === id && b.tenantId === TENANT_ID)
  if (idx < 0) throw new Error('多码不存在或越权')
  skuBarcodes.splice(idx, 1)
  persistSkuBarcodes()
}

export function doSetMainBarcode(skuId: string, barcodeId: string): MockSku {
  const sku = skus.find((s) => s.id === skuId && s.tenantId === TENANT_ID)
  if (!sku) throw new Error('SKU 不存在或越权')
  const target = skuBarcodes.find((b) => b.id === barcodeId && b.tenantId === TENANT_ID && b.skuId === skuId)
  if (!target) throw new Error('多码不存在或越权')
  if (sku.barcode === target.code) return { ...sku }
  // 原主码降级为多码（非 null 且未被占用时），新码写入 Sku.barcode，移除该多码
  if (sku.barcode && !skuBarcodes.some((b) => b.code === sku.barcode)) {
    skuBarcodes.push({
      id: `sb_${++barcodeSeq}`,
      tenantId: TENANT_ID,
      skuId,
      code: sku.barcode,
      kind: 'internal',
      createdAt: new Date().toISOString(),
    })
  }
  sku.barcode = target.code
  skuBarcodes = skuBarcodes.filter((b) => b.id !== barcodeId)
  persistSkuBarcodes()
  return { ...sku }
}

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

// ===== 收款账务（任务 4.1，方案 §16）=====
/** 与后端 WalletService 同口径的内存演示实现（复式记账 / 预充值 / 信用账期）。
 *  walletState 为模块级可变状态，充值/冻结/扣费/退款/结算 会真实改写它，GET 立即反映变更。 */
const walletState: WalletSummary = {
  tenantId: TENANT_ID,
  currency: 'CNY',
  balance: 12800,
  frozen: 0,
  creditLimit: 5000,
  available: 17800,
  status: 'active',
}

const walletLedger: LedgerItem[] = [
  { id: 'l_seed1', type: 'recharge', amount: 12800, balanceAfter: 12800, refType: 'manual', refId: null, remark: '初始充值', createdAt: '2026-10-08T09:00:00.000Z' },
  { id: 'l_seed2', type: 'settle', amount: -3200, balanceAfter: 9600, refType: 'settle', refId: 'C-202609', remark: '9 月承运商结算', createdAt: '2026-10-10T09:00:00.000Z' },
  { id: 'l_seed3', type: 'recharge', amount: 3200, balanceAfter: 12800, refType: 'manual', refId: null, remark: '补缴充值', createdAt: '2026-10-12T09:00:00.000Z' },
]

let ledgerSeq = 100
function recomputeWallet(): void {
  walletState.available = walletState.balance - walletState.frozen + walletState.creditLimit
}
function pushLedger(type: LedgerType, amount: number, refType?: string, refId?: string, remark?: string): void {
  walletLedger.unshift({
    id: `l_${ledgerSeq++}`,
    type,
    amount,
    balanceAfter: walletState.balance,
    refType: refType ?? null,
    refId: refId ?? null,
    remark: remark ?? null,
    createdAt: NOW(),
  })
}

function doGetWallet(): WalletSummary {
  return { ...walletState }
}

function doGetLedger(): LedgerItem[] {
  return walletLedger.map((l) => ({ ...l }))
}

function doRecharge(body: unknown): WalletSummary {
  const { amount, remark } = body as { amount: number; remark?: string }
  walletState.balance += amount
  recomputeWallet()
  pushLedger('recharge', amount, 'manual', undefined, remark || '演示充值')
  return { ...walletState }
}

function doSetCreditLimit(body: unknown): WalletSummary {
  const { creditLimit } = body as { creditLimit: number }
  walletState.creditLimit = creditLimit
  recomputeWallet()
  return { ...walletState }
}

function doFreeze(body: unknown): WalletSummary {
  const { amount, refId, refType } = body as { amount: number; refId?: string; refType?: string }
  const available = walletState.balance - walletState.frozen + walletState.creditLimit
  if (available < amount) {
    throw new Error(`可用额度不足：需 ${amount}，当前可用 ${available}`)
  }
  walletState.frozen += amount
  pushLedger('freeze', 0, refType || 'order', refId, `冻结订单 ${refId ?? ''}`)
  return { ...walletState }
}

function doUnfreeze(body: unknown): WalletSummary {
  const { amount, refId, refType } = body as { amount: number; refId?: string; refType?: string }
  walletState.frozen = Math.max(0, walletState.frozen - amount)
  pushLedger('unfreeze', 0, refType || 'order', refId, `解冻订单 ${refId ?? ''}`)
  return { ...walletState }
}

function doCharge(body: unknown): WalletSummary {
  const { amount, refId, refType } = body as { amount: number; refId?: string; refType?: string }
  const available = walletState.balance - walletState.frozen + walletState.creditLimit
  if (available < amount) {
    throw new Error(`可用额度不足：需扣费 ${amount}，当前可用 ${available}`)
  }
  const fromFrozen = Math.min(walletState.frozen, amount)
  walletState.frozen -= fromFrozen
  walletState.balance -= amount
  recomputeWallet()
  pushLedger('charge', -amount, refType || 'order', refId, `订单扣费 ${refId ?? ''}`)
  return { ...walletState }
}

function doRefund(body: unknown): WalletSummary {
  const { amount, refId, refType } = body as { amount: number; refId?: string; refType?: string }
  walletState.balance += amount
  recomputeWallet()
  pushLedger('refund', amount, refType || 'refund', refId, `退款 ${refId ?? ''}`)
  return { ...walletState }
}

function doSettle(body: unknown): WalletSummary {
  const { amount, refId, refType } = body as { amount: number; refId?: string; refType?: string }
  const available = walletState.balance - walletState.frozen + walletState.creditLimit
  if (available < amount) {
    throw new Error(`可用额度不足：需结算 ${amount}，当前可用 ${available}`)
  }
  walletState.balance -= amount
  recomputeWallet()
  pushLedger('settle', -amount, refType || 'settle', refId, `结算 ${refId ?? ''}`)
  return { ...walletState }
}

// ===== 商户账单与承运商对账（任务 4.2，方案 §9/§10）=====
/** 与后端 BillingService 同口径的内存演示实现：按账期聚合 sell_price / carrier_cost。
 *  billingBills / billingRecons 为模块级可变状态，生成/出账/结清/匹配/关闭会真实改写它。 */
const billingShipments: {
  id: string
  tenantId: string
  carrierCode: string
  sellPrice: number
  carrierCost: number
  createdAt: string
}[] = [
  { id: 'bs1', tenantId: TENANT_ID, carrierCode: 'yunexpress', sellPrice: 128.5, carrierCost: 78.0, createdAt: '2026-10-03T10:00:00.000Z' },
  { id: 'bs2', tenantId: TENANT_ID, carrierCode: 'dhl', sellPrice: 210.0, carrierCost: 150.0, createdAt: '2026-10-12T10:00:00.000Z' },
  { id: 'bs3', tenantId: 't_demo2', carrierCode: 'yunexpress', sellPrice: 96.4, carrierCost: 60.0, createdAt: '2026-10-20T10:00:00.000Z' },
  { id: 'bs4', tenantId: TENANT_ID, carrierCode: '4px', sellPrice: 64.0, carrierCost: 42.0, createdAt: '2026-10-25T10:00:00.000Z' },
  { id: 'bs5', tenantId: TENANT_ID, carrierCode: 'dhl', sellPrice: 320.0, carrierCost: 240.0, createdAt: '2026-09-08T10:00:00.000Z' },
]

let billSeq = 1
let reconSeq = 1
const billingBills: BillItem[] = []
const billingRecons: ReconciliationItem[] = []

function periodOf(iso: string): string {
  return iso.slice(0, 7)
}

function parseQ(url: string): Record<string, string> {
  const i = url.indexOf('?')
  if (i < 0) return {}
  const sp = new URLSearchParams(url.slice(i + 1))
  const o: Record<string, string> = {}
  sp.forEach((v, k) => {
    o[k] = v
  })
  return o
}

/** 按账期聚合各租户 sell_price → 商户账单（tenant + period 唯一） */
function aggBills(period: string, tenantId?: string): GenerateResult {
  const rows = billingShipments.filter(
    (s) => periodOf(s.createdAt) === period && (!tenantId || s.tenantId === tenantId),
  )
  const byTenant = new Map<string, { totalSell: number; count: number }>()
  for (const s of rows) {
    const t = byTenant.get(s.tenantId) || { totalSell: 0, count: 0 }
    t.totalSell += s.sellPrice
    t.count++
    byTenant.set(s.tenantId, t)
  }
  let generated = 0
  let updated = 0
  for (const [tid, v] of byTenant) {
    const idx = billingBills.findIndex((b) => b.tenantId === tid && b.period === period)
    if (idx >= 0) {
      billingBills[idx].totalSell = v.totalSell
      billingBills[idx].itemCount = v.count
      updated++
    } else {
      billingBills.push({
        id: `b_${billSeq++}`,
        tenantId: tid,
        period,
        currency: 'CNY',
        totalSell: v.totalSell,
        itemCount: v.count,
        status: 'draft',
        createdAt: NOW(),
      })
      generated++
    }
  }
  return { period, generated, updated }
}

/** 按账期聚合各承运商 carrier_cost → 承运商对账（carrierCode + period 唯一） */
function aggRecons(period: string): GenerateResult {
  const rows = billingShipments.filter((s) => periodOf(s.createdAt) === period && s.carrierCode)
  const byCarrier = new Map<string, { totalCost: number; count: number }>()
  for (const s of rows) {
    const c = byCarrier.get(s.carrierCode) || { totalCost: 0, count: 0 }
    c.totalCost += s.carrierCost
    c.count++
    byCarrier.set(s.carrierCode, c)
  }
  let generated = 0
  let updated = 0
  for (const [code, v] of byCarrier) {
    const idx = billingRecons.findIndex((r) => r.carrierCode === code && r.period === period)
    if (idx >= 0) {
      billingRecons[idx].totalCost = v.totalCost
      billingRecons[idx].itemCount = v.count
      updated++
    } else {
      billingRecons.push({
        id: `r_${reconSeq++}`,
        carrierCode: code,
        period,
        currency: 'CNY',
        totalCost: v.totalCost,
        itemCount: v.count,
        status: 'open',
        createdAt: NOW(),
      })
      generated++
    }
  }
  return { period, generated, updated }
}

// 预生成最近账期，避免页面首屏空白
aggBills('2026-10')
aggRecons('2026-10')
aggBills('2026-09')
aggRecons('2026-09')

function doListBills(url: string): BillItem[] {
  const q = parseQ(url)
  let res = billingBills.slice()
  res = res.filter((b) => (q.tenantId ? b.tenantId === q.tenantId : b.tenantId === TENANT_ID))
  if (q.status) res = res.filter((b) => b.status === q.status)
  return res
    .sort((a, b) => (a.period < b.period ? 1 : -1))
    .map((b) => ({ ...b }))
}

function doListRecons(url: string): ReconciliationItem[] {
  const q = parseQ(url)
  let res = billingRecons.slice()
  if (q.status) res = res.filter((r) => r.status === q.status)
  return res
    .sort((a, b) =>
      a.period !== b.period ? (a.period < b.period ? 1 : -1) : a.carrierCode < b.carrierCode ? -1 : 1,
    )
    .map((r) => ({ ...r }))
}

function doGetProfit(url: string): ProfitSummary {
  const q = parseQ(url)
  const period = q.period || '2026-10'
  let totalSell = 0
  let billCount = 0
  for (const b of billingBills) {
    if (b.period === period) {
      totalSell += b.totalSell
      billCount++
    }
  }
  let totalCost = 0
  let reconCount = 0
  for (const r of billingRecons) {
    if (r.period === period) {
      totalCost += r.totalCost
      reconCount++
    }
  }
  const profit = totalSell - totalCost
  const marginRate = totalSell === 0 ? 0 : profit / totalSell
  return { period, currency: 'CNY', totalSell, totalCost, profit, marginRate, billCount, reconciliationCount: reconCount }
}

function doIssueBill(id: string): BillItem {
  const b = billingBills.find((x) => x.id === id)
  if (!b) throw new Error('账单不存在')
  if (b.status !== 'draft') throw new Error(`仅草稿可出账，当前：${b.status}`)
  b.status = 'issued'
  return { ...b }
}
function doSettleBill(id: string): BillItem {
  const b = billingBills.find((x) => x.id === id)
  if (!b) throw new Error('账单不存在')
  if (b.status !== 'issued') throw new Error(`仅已出账可结清，当前：${b.status}`)
  b.status = 'settled'
  return { ...b }
}
function doMatchRecon(id: string): ReconciliationItem {
  const r = billingRecons.find((x) => x.id === id)
  if (!r) throw new Error('对账单不存在')
  if (r.status !== 'open') throw new Error(`仅未对账可匹配，当前：${r.status}`)
  r.status = 'matched'
  return { ...r }
}
function doCloseRecon(id: string): ReconciliationItem {
  const r = billingRecons.find((x) => x.id === id)
  if (!r) throw new Error('对账单不存在')
  r.status = 'closed'
  return { ...r }
}

/** 利润核算明细：总览 + 按租户 / 承运商拆解（§9 spread 报表化），与后端同口径。 */
function doGetProfitBreakdown(url: string): ProfitBreakdown {
  const q = parseQ(url)
  const period = q.period || '2026-10'
  const summary = doGetProfit(`?period=${period}`)
  const tenantAgg = new Map<string, { sell: number; cost: number }>()
  const carrierAgg = new Map<string, number>()
  for (const s of billingShipments) {
    if (periodOf(s.createdAt) !== period) continue
    const t = tenantAgg.get(s.tenantId) || { sell: 0, cost: 0 }
    t.sell += s.sellPrice
    t.cost += s.carrierCost
    tenantAgg.set(s.tenantId, t)
    carrierAgg.set(s.carrierCode, (carrierAgg.get(s.carrierCode) || 0) + s.carrierCost)
  }
  const byTenant: TenantProfit[] = [...tenantAgg.entries()].map(([tenantId, v]) => {
    const profit = v.sell - v.cost
    return { tenantId, totalSell: v.sell, totalCost: v.cost, profit, marginRate: v.sell === 0 ? 0 : profit / v.sell }
  })
  const byCarrier: CarrierCost[] = [...carrierAgg.entries()].map(([carrierCode, totalCost]) => ({ carrierCode, totalCost }))
  return { summary, byTenant, byCarrier }
}

/** 利润趋势：以已生成账期为终点往前推 N 个月，逐月复用利润核算口径。 */
/** 系统安全态势（§17）：演示态静态镜像后端 /system/security 诊断（隔离/加密/越权防护）。 */
function doGetSecurity(): Record<string, unknown> {
  return {
    isolationMode: '共享库 + tenant_id 行级隔离（§0/§17） + Prisma 中间件 IDOR 纵深防御',
    tenantScopedModelCount: 39,
    tenantScopedModels: [
      'Asn', 'Bill', 'Bin', 'CarrierAccount', 'Claim', 'ComplianceRule', 'CycleCount', 'Inventory',
      'LedgerEntry', 'LogisticsProduct', 'MarkupRule', 'Order', 'OrderEvent', 'OrderHold', 'OrderItem',
      'PickTask', 'Product', 'Quote', 'RateQuote', 'ReverseOrder', 'Role', 'Shipment', 'ShipmentLeg',
      'Shop', 'Sku', 'Supplier', 'SupplierOrder', 'SupplierSettlement', 'SupplierSku', 'SurchargeRule',
      'TrackingEvent', 'User', 'UserRole', 'Wallet', 'Warehouse', 'WebhookEvent', 'ZoneMap',
    ],
    secretEncryption: 'AES-256-GCM（§17.2 凭据加密存储 / 运行时解密 / 不落明文库）',
    rlsEnabled: false,
    piiMasking: '规划中（§17.3：买家 PII 加密/脱敏 + 数据主体权利接口）',
    idorGuard: 'context-bound tenantId 冲突拦截（§17.4 防 IDOR / 防客户端覆盖）',
    transportAudit: 'TLS 全链路 + 操作审计日志（§17.5，WAF/限流见 §26）',
  }
}

/** 容量与灾备诊断（§30）：演示态静态镜像后端 /system/capacity（含限流实时统计占位）。 */
function doGetCapacity(): Record<string, unknown> {
  return {
    config: {
      maxConcurrentPullsPerTenant: 8,
      pullInflightTtlMs: 30000,
      pricingConcurrencyLimit: 12,
      rtoObjectiveMs: 3600000,
      rpoObjectiveMs: 300000,
      dbBackupRetentionDays: 30,
      objectBackupRetentionDays: 90,
      dbBackupCron: '10 3 * * *',
      objectsBackupCron: '0 */6 * * *',
    },
    throttle: {
      inflightShopCount: 0,
      perTenantActive: {},
      maxConcurrentPullsPerTenant: 8,
      pullInflightTtlMs: 30000,
    },
    notes: [
      '拉单限流：同店铺在途锁（TTL 兜底防死锁）+ 单租户并发上限，超限返回 PULL_THROTTLED（HTTP 429）。',
      '比价并发：L3 有界并行实时池（pricingConcurrencyLimit 上限，§5/§30）。',
      '面单异步：BullMQ 队列异步购标（§30，待消息队列接线）。',
      '灾备：每日全量 PG 备份 + 每 6h 对象存储增量，RPO 5min（WAL 归档），RTO 1h。',
      '压测：限流守卫与比价池单测覆盖（§30 测试强化），端到端压测待 CI 环境。',
    ],
  }
}

// ===== RBAC 演示数据（任务 4.5，§22）=====
// 系统内置角色蓝图（与后端 ROLE_PERMISSIONS 同口径）
const RBAC_BLUEPRINTS: Record<string, string[]> = {
  super_admin: [
    'dashboard:view', 'order:view', 'order:review', 'order:push', 'catalog:view', 'catalog:manage',
    'channel:view', 'channel:manage', 'carrier:view', 'carrier:manage', 'pricing:view', 'pricing:manage',
    'shipment:view', 'shipment:manage', 'finance:view', 'finance:manage', 'report:view', 'rbac:manage',
    'tenant:manage', 'settings:manage',
  ],
  operator: [
    'dashboard:view', 'order:view', 'order:review', 'order:push', 'catalog:view', 'catalog:manage',
    'channel:view', 'channel:manage', 'carrier:view', 'carrier:manage', 'pricing:view',
    'shipment:view', 'shipment:manage', 'report:view',
  ],
  finance: ['dashboard:view', 'order:view', 'finance:view', 'finance:manage', 'report:view'],
  warehouse: ['dashboard:view', 'order:view', 'catalog:view', 'shipment:view', 'shipment:manage'],
  cs: ['dashboard:view', 'order:view', 'shipment:view'],
}

const RBAC_SCOPES = [
  { code: 'all', label: '全部数据' },
  { code: 'shop', label: '指定店铺' },
  { code: 'warehouse', label: '指定仓库' },
  { code: 'region', label: '指定地区' },
]

const RBAC_RESOURCES = [
  { group: 'dashboard', groupLabel: '概览', items: [{ code: 'dashboard:view', label: '查看仪表盘' }] },
  { group: 'order', groupLabel: '订单', items: [
    { code: 'order:view', label: '查看订单' }, { code: 'order:review', label: '审单' }, { code: 'order:push', label: '推单/履约' }] },
  { group: 'catalog', groupLabel: '商品/SKU', items: [
    { code: 'catalog:view', label: '查看商品' }, { code: 'catalog:manage', label: '管理商品/SKU' }] },
  { group: 'channel', groupLabel: '渠道', items: [
    { code: 'channel:view', label: '查看渠道' }, { code: 'channel:manage', label: '管理渠道/拉单' }] },
  { group: 'carrier', groupLabel: '承运商', items: [
    { code: 'carrier:view', label: '查看承运商' }, { code: 'carrier:manage', label: '管理承运商/试算' }] },
  { group: 'pricing', groupLabel: '运费/比价', items: [
    { code: 'pricing:view', label: '查看运费/比价' }, { code: 'pricing:manage', label: '运营配置(加价/费率卡)' }] },
  { group: 'shipment', groupLabel: '物流履约', items: [
    { code: 'shipment:view', label: '查看运单/轨迹' }, { code: 'shipment:manage', label: '建单/面单/轨迹' }] },
  { group: 'finance', groupLabel: '财务', items: [
    { code: 'finance:view', label: '查看账务/账单/利润' }, { code: 'finance:manage', label: '充值/扣款/结算' }] },
  { group: 'report', groupLabel: '报表', items: [{ code: 'report:view', label: '查看报表指标' }] },
  { group: 'rbac', groupLabel: '权限', items: [{ code: 'rbac:manage', label: '管理角色与权限' }] },
  { group: 'tenant', groupLabel: '平台', items: [{ code: 'tenant:manage', label: '租户管理(平台运营方)' }] },
  { group: 'settings', groupLabel: '系统', items: [{ code: 'settings:manage', label: '站点/系统设置' }] },
]

// 租户角色（演示态种子；super_admin 为系统内置，其余可复制蓝图建角色）
const rbacRoles: {
  id: string
  name: string
  scope: string | null
  permissions: string[]
  system: boolean
  createdAt: string
}[] = Object.keys(RBAC_BLUEPRINTS).map((name, i) => ({
  id: 'role-' + name,
  name,
  scope: 'all',
  permissions: RBAC_BLUEPRINTS[name],
  system: true,
  createdAt: new Date(Date.UTC(2026, 9, 1) + i * 86400000).toISOString(),
}))

function doGetCatalog(): { resources: typeof RBAC_RESOURCES; scopes: typeof RBAC_SCOPES } {
  return { resources: RBAC_RESOURCES, scopes: RBAC_SCOPES }
}
function doGetBlueprints(): Record<string, string[]> {
  return RBAC_BLUEPRINTS
}
function doGetRoles(): unknown[] {
  return rbacRoles.map((r) => ({ ...r }))
}
function doCreateRole(body: { name?: string; permissions?: string[]; scope?: string }): unknown {
  const name = (body.name || '').trim()
  if (!name) return reject('角色名不能为空')
  const role = {
    id: 'role-' + Date.now(),
    name,
    scope: body.scope ?? 'all',
    permissions: body.permissions ?? [],
    system: false,
    createdAt: new Date().toISOString(),
  }
  rbacRoles.push(role)
  return role
}

/** 为用户分配角色（§22）：演示态仅校验入参并返回分配数量（真实后端落 UserRole 并触发权限刷新）。 */
function doAssignRoles(userId: string, body: { roleIds?: unknown[] }): { userId: string; assigned: number } {
  const roleIds = Array.isArray(body.roleIds) ? body.roleIds.filter((r) => typeof r === 'string') : []
  return { userId, assigned: roleIds.length }
}

/** 利润趋势：以已生成账期为终点往前推 N 个月，逐月复用利润核算口径。 */
function doGetProfitTrend(months: number): ProfitSummary[] {
  const n = Math.max(1, Math.min(months || 6, 12))
  const periods = billingBills.map((b) => b.period)
  const end = periods.length ? periods.reduce((a, b) => (a < b ? b : a)) : '2026-10'
  const [ey, em] = end.split('-').map(Number)
  const out: ProfitSummary[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ey, em - 1 - i, 1))
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    out.push(doGetProfit(`?period=${period}`))
  }
  return out
}

// ===== 理赔 / 保险演示数据（任务 4.8，方案 §20）=====
// 模块级可变状态：新建 / 推进状态会真实改写，后续 GET 立即反映变更，使演示具备可操作性。
// 字段形状严格对齐 claims.ts 的 ClaimOut / DTO，保证视图无需改造即可消费。
const claims: ClaimOut[] = [
  {
    id: 'cl_seed_1', tenantId: TENANT_ID, shipmentId: 'sh_seed_1001', type: 'lost',
    cause: '承运商分拣丢失', status: 'paid', amount: 320.0, responsibleParty: 'carrier',
    refCarrierClaimId: 'DHL-CLM-7781', note: '承运商已赔付并冲减对账',
    createdAt: '2026-10-02T09:00:00.000Z', updatedAt: '2026-10-09T09:00:00.000Z',
  },
  {
    id: 'cl_seed_2', tenantId: TENANT_ID, shipmentId: 'sh_seed_1002', type: 'damage',
    cause: '运输途中挤压破损', status: 'approved', amount: 150.0, responsibleParty: 'carrier',
    refCarrierClaimId: null, note: '已审核通过，待赔付',
    createdAt: '2026-10-08T09:00:00.000Z', updatedAt: '2026-10-12T09:00:00.000Z',
  },
  {
    id: 'cl_seed_3', tenantId: TENANT_ID, shipmentId: 'sh_seed_1003', type: 'delay',
    cause: '清关延误导致超 SLA', status: 'processing', amount: 60.0, responsibleParty: 'carrier',
    refCarrierClaimId: null, note: '承运商核实中',
    createdAt: '2026-10-13T09:00:00.000Z', updatedAt: '2026-10-14T09:00:00.000Z',
  },
  {
    id: 'cl_seed_4', tenantId: TENANT_ID, shipmentId: 'sh_seed_1004', type: 'customs_fail',
    cause: '申报品类与实际不符被退运', status: 'open', amount: null, responsibleParty: 'platform',
    refCarrierClaimId: null, note: '待平台责任判定',
    createdAt: '2026-10-16T09:00:00.000Z', updatedAt: '2026-10-16T09:00:00.000Z',
  },
]

/** 理赔列表：按租户隔离，支持状态 / 类型筛选（与后端同口径）。 */
function doListClaims(url: string): ClaimOut[] {
  const q = parseQ(url)
  return claims
    .filter((c) => c.tenantId === TENANT_ID)
    .filter((c) => (q.status ? c.status === q.status : true))
    .filter((c) => (q.type ? c.type === q.type : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((c) => ({ ...c }))
}

/** 理赔详情。 */
function doGetClaim(id: string): ClaimOut {
  const c = claims.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!c) return reject('理赔单不存在') as unknown as ClaimOut
  return { ...c }
}

/** 新建理赔（运单 + 类型必填；金额 / 责任方 / 承运商理赔号可选）。 */
function doCreateClaim(body: unknown): ClaimOut {
  const b = (body ?? {}) as Partial<CreateClaimDto>
  if (!b.shipmentId) return reject('运单号不能为空') as unknown as ClaimOut
  if (!b.type) return reject('理赔类型必选') as unknown as ClaimOut
  const now = NOW()
  const claim: ClaimOut = {
    id: 'cl_' + Date.now().toString(36) + '_' + seq++,
    tenantId: TENANT_ID,
    shipmentId: b.shipmentId,
    type: b.type as ClaimType,
    cause: b.cause ?? null,
    status: 'open',
    amount: b.amount != null ? Number(b.amount) : null,
    responsibleParty: (b.responsibleParty as ClaimResponsibleParty) ?? null,
    refCarrierClaimId: b.refCarrierClaimId ?? null,
    note: null,
    createdAt: now,
    updatedAt: now,
  }
  claims.unshift(claim)
  return { ...claim }
}

/** 推进理赔状态（§20：open→processing→approved/rejected→paid）。 */
function doUpdateClaimStatus(id: string, body: unknown): ClaimOut {
  const c = claims.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!c) return reject('理赔单不存在') as unknown as ClaimOut
  const b = (body ?? {}) as Partial<UpdateClaimStatusDto>
  if (!b.status) return reject('目标状态必选') as unknown as ClaimOut
  c.status = b.status as ClaimStatus
  if (b.note) c.note = b.note
  c.updatedAt = NOW()
  return { ...c }
}

// ===== 风控体系演示数据（任务 5.1，方案 §26）=====
// 模块级可变状态：规则启停 / 黑名单增删 / 人工审核 会真实改写，GET 立即反映变更。
// 字段形状严格对齐 risk.ts 的 RiskRule / RiskOrderEvaluation / BlacklistEntry，保证视图无需改造即可消费。
const riskRules: RiskRule[] = [
  mkRule('rr_seed_1', '高频下单异常', 'fraud', '近窗口同买家下单频次过高，疑似刷单', 40, 'high'),
  mkRule('rr_seed_2', '大额订单异常', 'fraud', '单笔金额远超常规客单，疑似欺诈/洗钱', 25, 'medium'),
  mkRule('rr_seed_3', '同地址多单', 'fraud', '同一收货地址短期内多笔订单，疑似拆单/刷单', 30, 'medium'),
  mkRule('rr_seed_4', '虚假轨迹', 'fraud', '轨迹异常（无揽收/伪造节点），疑似虚假发货', 50, 'high'),
  mkRule('rr_seed_5', '黑名单命中', 'blacklist', '命中地址/买家/支付黑名单，直接判高风险', 60, 'high'),
  mkRule('rr_seed_6', '敏感货瞒报', 'misdeclaration', '申报品类与实际品类不符，疑似敏感货瞒报', 35, 'high'),
]

const riskBlacklist: BlacklistEntry[] = [
  { id: 'bl_seed_1', tenantId: TENANT_ID, type: 'address', value: 'US|90001|123 MAIN ST|JOHN DOE', reason: '该地址历史多起丢件与拒收', createdAt: '2026-10-10T09:00:00.000Z' },
  { id: 'bl_seed_2', tenantId: TENANT_ID, type: 'buyer', value: 'fraud-buyer@risk.test', reason: '买家账户关联多起退款欺诈', createdAt: '2026-10-10T09:00:00.000Z' },
  { id: 'bl_seed_3', tenantId: TENANT_ID, type: 'payment', value: 'CARD-****6621', reason: '支付卡命中盗刷黑名单', createdAt: '2026-10-10T09:00:00.000Z' },
]

// 风险订单种子：评分结果与后端 evaluateRisk 同口径（阈值 高>=60 / 中>=30），覆盖低/中/高与人工审核。
const riskOrders: RiskOrderEvaluation[] = [
  mkRisk('rk_seed_1', 'o_risk_1', 'SO-30001', 'Alice Wang', 'US', 199.0, 'USD', 0, 'low', [], false, 'auto', '2026-10-11T09:00:00.000Z'),
  mkRisk('rk_seed_2', 'o_risk_2', 'SO-30002', 'Bob Li', 'US', 268.0, 'USD', 70, 'high',
    [hit('rr_seed_3', '同地址多单', 'fraud', 30, '同地址订单 3 笔（阈值 2）'), hit('rr_seed_1', '高频下单异常', 'fraud', 40, '近窗口同买家下单 3 笔（阈值 3）')], false, 'pending', '2026-10-12T10:00:00.000Z'),
  mkRisk('rk_seed_3', 'o_risk_3', 'AMZ-30003', 'Carol Chen', 'DE', 320.0, 'EUR', 50, 'medium',
    [hit('rr_seed_4', '虚假轨迹', 'fraud', 50, '轨迹检出虚假节点/无揽收')], false, 'auto', '2026-10-13T11:00:00.000Z'),
  mkRisk('rk_seed_4', 'o_risk_4', 'SO-30004', 'John Doe', 'US', 159.0, 'USD', 60, 'high',
    [hit('rr_seed_5', '黑名单命中', 'blacklist', 60, 'address:US|90001|123 MAIN ST|JOHN DOE')], true, 'pending', '2026-10-14T12:00:00.000Z'),
  mkRisk('rk_seed_5', 'o_risk_5', 'SO-30005', 'David Zhao', 'GB', 420.0, 'GBP', 65, 'high',
    [hit('rr_seed_6', '敏感货瞒报', 'misdeclaration', 35, '申报「normal」实际为「battery」'), hit('rr_seed_3', '同地址多单', 'fraud', 30, '同地址订单 2 笔（阈值 2）')], false, 'pending', '2026-10-15T13:00:00.000Z'),
  mkRisk('rk_seed_6', 'o_risk_6', 'AMZ-30006', 'Eva Sun', 'US', 980.0, 'USD', 55, 'medium',
    [hit('rr_seed_2', '大额订单异常', 'fraud', 25, '单笔金额 USD 980 超阈值 5000 CNY'), hit('rr_seed_3', '同地址多单', 'fraud', 30, '同地址订单 2 笔（阈值 2）')], false, 'auto', '2026-10-16T14:00:00.000Z'),
  mkRisk('rk_seed_7', 'o_risk_7', 'SO-30007', 'Frank Wu', 'FR', 540.0, 'EUR', 60, 'high',
    [hit('rr_seed_5', '黑名单命中', 'blacklist', 60, 'payment:CARD-****6621')], true, 'pending', '2026-10-17T15:00:00.000Z'),
  mkRisk('rk_seed_8', 'o_risk_8', 'SO-30008', 'Grace Liu', 'CA', 88.0, 'USD', 30, 'medium',
    [hit('rr_seed_3', '同地址多单', 'fraud', 30, '同地址订单 2 笔（阈值 2）')], false, 'auto', '2026-10-18T16:00:00.000Z'),
]

function mkRule(id: string, name: string, category: RiskRule['category'], description: string, score: number, severity: RiskRule['severity']): RiskRule {
  const now = '2026-10-10T09:00:00.000Z'
  return { id, tenantId: TENANT_ID, name, category, description, enabled: true, score, severity, createdAt: now, updatedAt: now }
}
function hit(ruleId: string, ruleName: string, category: RiskOrderEvaluation['hits'][number]['category'], scoreDelta: number, detail: string): RiskOrderEvaluation['hits'][number] {
  return { ruleId, ruleName, category, scoreDelta, detail }
}
function mkRisk(
  id: string, orderId: string, platformOrderNo: string, recipientName: string, country: string,
  amount: number, currency: string, score: number, level: RiskOrderEvaluation['level'],
  hits: RiskOrderEvaluation['hits'], blacklisted: boolean, reviewStatus: RiskOrderEvaluation['reviewStatus'], createdAt: string,
): RiskOrderEvaluation {
  return {
    id, tenantId: TENANT_ID, orderId, platformOrderNo, recipientName, country, amount, currency,
    score, level, hits, blacklisted, reviewStatus, reviewedAt: null, reviewedBy: null, reviewNote: null, createdAt,
  }
}

/** 风控总览（四卡）。 */
function doGetRiskSummary(): RiskSummary {
  return {
    scanned: riskOrders.length,
    highRisk: riskOrders.filter((o) => o.level === 'high').length,
    pendingReview: riskOrders.filter((o) => o.reviewStatus === 'pending').length,
    blacklistCount: riskBlacklist.length,
    ruleCount: riskRules.filter((r) => r.enabled).length,
  }
}

/** 规则引擎列表（副本）。 */
function doListRiskRules(): RiskRule[] {
  return riskRules.map((r) => ({ ...r }))
}

/** 新建规则（名称/类别必填）。 */
function doCreateRiskRule(body: unknown): RiskRule {
  const b = (body ?? {}) as Partial<CreateRiskRuleDto>
  if (!b.name) return reject('规则名称不能为空') as unknown as RiskRule
  if (!b.category) return reject('规则类别必选') as unknown as RiskRule
  const now = NOW()
  const rule: RiskRule = {
    id: 'rr_' + Date.now().toString(36) + '_' + seq++,
    tenantId: TENANT_ID,
    name: b.name,
    category: b.category,
    description: b.description ?? '',
    enabled: b.enabled ?? true,
    score: Number.isFinite(b.score) ? Math.max(0, Math.min(100, Math.trunc(b.score as number))) : 30,
    severity: b.severity ?? 'medium',
    createdAt: now,
    updatedAt: now,
  }
  riskRules.push(rule)
  return { ...rule }
}

/** 更新规则（启停开关等）。 */
function doUpdateRiskRule(id: string, body: unknown): RiskRule {
  const idx = riskRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('风控规则不存在') as unknown as RiskRule
  const b = (body ?? {}) as Partial<UpdateRiskRuleDto>
  const cur = riskRules[idx]
  riskRules[idx] = {
    ...cur,
    ...(b.name !== undefined ? { name: b.name } : {}),
    ...(b.category !== undefined ? { category: b.category } : {}),
    ...(b.description !== undefined ? { description: b.description } : {}),
    ...(b.enabled !== undefined ? { enabled: Boolean(b.enabled) } : {}),
    ...(b.score !== undefined && Number.isFinite(b.score) ? { score: Math.max(0, Math.min(100, Math.trunc(b.score))) } : {}),
    ...(b.severity !== undefined ? { severity: b.severity } : {}),
    updatedAt: NOW(),
  }
  return { ...riskRules[idx] }
}

/** 删除规则。 */
function doDeleteRiskRule(id: string): { deleted: boolean } {
  const idx = riskRules.findIndex((r) => r.id === id)
  if (idx < 0) return reject('风控规则不存在') as unknown as { deleted: boolean }
  riskRules.splice(idx, 1)
  return { deleted: true }
}

/** 黑名单列表（副本）。 */
function doListBlacklist(): BlacklistEntry[] {
  return riskBlacklist.map((b) => ({ ...b }))
}

/** 新增黑名单（类型/值必填）。 */
function doAddBlacklist(body: unknown): BlacklistEntry {
  const b = (body ?? {}) as Partial<CreateBlacklistDto>
  if (!b.type) return reject('黑名单类型必选') as unknown as BlacklistEntry
  if (!b.value) return reject('黑名单值不能为空') as unknown as BlacklistEntry
  const entry: BlacklistEntry = {
    id: 'bl_' + Date.now().toString(36) + '_' + seq++,
    tenantId: TENANT_ID,
    type: b.type,
    value: b.value,
    reason: b.reason ?? '',
    createdAt: NOW(),
  }
  riskBlacklist.push(entry)
  return { ...entry }
}

/** 移除黑名单。 */
function doRemoveBlacklist(id: string): { deleted: boolean } {
  const idx = riskBlacklist.findIndex((b) => b.id === id)
  if (idx < 0) return reject('黑名单条目不存在') as unknown as { deleted: boolean }
  riskBlacklist.splice(idx, 1)
  return { deleted: true }
}

/** 风险订单列表（副本）。 */
function doListRiskOrders(): RiskOrderEvaluation[] {
  return riskOrders.map((o) => ({ ...o, hits: o.hits.map((h) => ({ ...h })) }))
}

/** 风险订单详情（副本）。 */
function doGetRiskOrder(id: string): RiskOrderEvaluation {
  const o = riskOrders.find((x) => x.id === id)
  if (!o) return reject('风险订单不存在') as unknown as RiskOrderEvaluation
  return { ...o, hits: o.hits.map((h) => ({ ...h })) }
}

/** 人工审核（§26 高风险转人工，结合 §13 待审）。 */
function doReviewRiskOrder(id: string, body: unknown): RiskOrderEvaluation {
  const o = riskOrders.find((x) => x.id === id)
  if (!o) return reject('风险订单不存在') as unknown as RiskOrderEvaluation
  const b = (body ?? {}) as Partial<ReviewDecisionDto>
  if (!b.decision) return reject('审核结论必选') as unknown as RiskOrderEvaluation
  o.reviewStatus = b.decision
  o.reviewedBy = 'risk_operator'
  o.reviewNote = b.note ?? null
  o.reviewedAt = NOW()
  return { ...o, hits: o.hits.map((h) => ({ ...h })) }
}

// ===== 开放平台（§28）：OAuth2 客户端 + Webhook 订阅（演示态同口径）=====
import type {
  ApiClient,
  WebhookSubscription,
  OpenApiSummary,
  CreateApiClientDto,
  CreateWebhookDto,
} from './openapi'

const openClients: ApiClient[] = [
  {
    id: 'oc_seed_1', tenantId: TENANT_ID, name: 'ERP 全量集成', clientId: 'cli_demo_full',
    clientSecret: 'secret_demo_full_2026', scopes: ['orders', 'quotes', 'tracking', 'bills', 'erp'],
    rateLimitPerMin: 120, status: 'enabled', createdAt: '2026-10-10T09:00:00.000Z', updatedAt: '2026-10-10T09:00:00.000Z',
  },
  {
    id: 'oc_seed_2', tenantId: TENANT_ID, name: '查价机器人', clientId: 'cli_demo_quote',
    clientSecret: 'secret_demo_quote_2026', scopes: ['quotes'],
    rateLimitPerMin: 60, status: 'enabled', createdAt: '2026-10-10T09:00:00.000Z', updatedAt: '2026-10-10T09:00:00.000Z',
  },
]
const openWebhooks: WebhookSubscription[] = [
  { id: 'wh_seed_1', tenantId: TENANT_ID, event: 'order.shipped', url: 'https://erp.demo/hooks/ship', status: 'active', createdAt: '2026-10-12T09:00:00.000Z' },
]

function doGetOpenSummary(): OpenApiSummary {
  return {
    clientCount: openClients.filter((c) => c.tenantId === TENANT_ID).length,
    webhookCount: openWebhooks.filter((w) => w.tenantId === TENANT_ID).length,
    rateLimitTotal: openClients.filter((c) => c.tenantId === TENANT_ID).reduce((s, c) => s + c.rateLimitPerMin, 0),
    endpointCount: 8,
  }
}
function doListOpenClients(): ApiClient[] {
  return openClients.filter((c) => c.tenantId === TENANT_ID).map((c) => ({ ...c }))
}
function doCreateOpenClient(body: unknown): ApiClient {
  const b = (body ?? {}) as Partial<CreateApiClientDto>
  if (!b.name) return reject('客户端名称不能为空') as unknown as ApiClient
  if (!b.scopes || b.scopes.length === 0) return reject('至少选择一个作用域') as unknown as ApiClient
  const now = NOW()
  const c: ApiClient = {
    id: 'oc_' + Date.now().toString(36) + '_' + seq++, tenantId: TENANT_ID, name: b.name,
    clientId: 'cli_' + randStr(12), clientSecret: randStr(32), scopes: b.scopes,
    rateLimitPerMin: b.rateLimitPerMin ?? 60, status: 'enabled', createdAt: now, updatedAt: now,
  }
  openClients.push(c)
  return { ...c }
}
function doDeleteOpenClient(id: string): { deleted: boolean } {
  const idx = openClients.findIndex((c) => c.id === id && c.tenantId === TENANT_ID)
  if (idx < 0) return reject('开放客户端不存在') as unknown as { deleted: boolean }
  openClients.splice(idx, 1)
  return { deleted: true }
}
function doRotateOpenSecret(id: string): ApiClient {
  const c = openClients.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!c) return reject('开放客户端不存在') as unknown as ApiClient
  c.clientSecret = randStr(32)
  c.updatedAt = NOW()
  return { ...c }
}
function doListOpenWebhooks(): WebhookSubscription[] {
  return openWebhooks.filter((w) => w.tenantId === TENANT_ID).map((w) => ({ ...w }))
}
function doCreateOpenWebhook(body: unknown): WebhookSubscription {
  const b = (body ?? {}) as Partial<CreateWebhookDto>
  if (!b.event) return reject('事件不能为空') as unknown as WebhookSubscription
  if (!b.url) return reject('回调地址不能为空') as unknown as WebhookSubscription
  const sub: WebhookSubscription = {
    id: 'wh_' + Date.now().toString(36) + '_' + seq++, tenantId: TENANT_ID,
    event: b.event, url: b.url, status: 'active', createdAt: NOW(),
  }
  openWebhooks.push(sub)
  return { ...sub }
}
function randStr(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// ===== 平台凭证管理（§17.2 凭证工厂化接入，任务 8.2）：演示态同口径内存实现 =====
// 与后端 platform-credentials 模块同口径：列表脱敏、查看解密、保存加密（演示态仅内存，不落明文）、删除。
// 真实联调（经承运商/渠道注册表桥接适配器）为 TODO，绑定描述符返回 scaffold-todo。
import type {
  CredentialListItem,
  CredentialDetail,
  CredentialSaveResult,
  PlatformCode,
} from './platform-credentials'
import { PLATFORM_DEFINITIONS, getPlatformDef } from './platform-credentials'

/** 演示态内存凭证库：platform → { 字段明文（仅驻留内存）, 更新时间 }。真实后端为加密落库。 */
const platformCredentials: Record<string, { fields: Record<string, string>; updatedAt: string }> = {
  // 预置一个示例（云途），便于演示「已配置」态与查看/删除操作；真实场景凭据由用户录入。
  yunexpress: {
    fields: { appId: 'demo_app_2026', appKey: 'demo_key_2026', secret: 'demo_secret_2026' },
    updatedAt: '2026-10-29T10:00:00.000Z',
  },
}

/** 列表：遍历全部平台，返回脱敏项（不泄露明文，仅给配置状态/更新时间）。 */
function doListPlatformCredentials(): CredentialListItem[] {
  return PLATFORM_DEFINITIONS.map((def) => {
    const stored = platformCredentials[def.code]
    return {
      platform: def.code,
      label: def.label,
      authType: def.authType,
      carrierSide: def.carrierSide,
      capabilities: def.capabilities,
      status: stored ? 'configured' : 'empty',
      updatedAt: stored?.updatedAt,
    }
  })
}

/** 查看明文：返回某平台已存字段（演示态直读内存；正式态由后端解密返回）。 */
function doGetPlatformCredential(platform: string): CredentialDetail {
  const stored = platformCredentials[platform]
  if (!stored) return reject('平台凭证不存在') as unknown as CredentialDetail
  return { platform: platform as PlatformCode, fields: { ...stored.fields } }
}

/** 保存：校验必填后写入内存，返回含桥接描述符的回执（真实适配器经注册表桥接为 TODO）。 */
function doSavePlatformCredential(body: {
  platform: string
  fields: Record<string, string>
}): CredentialSaveResult {
  const def = getPlatformDef(body.platform)
  if (!def) return reject('未知平台：' + body.platform) as unknown as CredentialSaveResult
  const missing = def.required.filter((f) => !body.fields?.[f.key]?.trim())
  if (missing.length) return reject('缺少必填字段：' + missing.map((f) => f.label).join('、')) as unknown as CredentialSaveResult
  platformCredentials[body.platform] = {
    fields: { ...body.fields },
    updatedAt: NOW(),
  }
  return {
    platform: body.platform as PlatformCode,
    status: 'configured',
    binding: {
      platform: body.platform as PlatformCode,
      label: def.label,
      carrierSide: def.carrierSide,
      capabilities: def.capabilities,
      status: 'scaffold-todo',
      note:
        '凭证已就绪；真实适配器经' +
        (def.carrierSide ? '承运商' : '渠道') +
        '注册表桥接（TODO 联调）',
    },
  }
}

/** 删除：从内存移除该平台凭证。 */
function doDeletePlatformCredential(platform: string): { deleted: boolean } {
  if (!platformCredentials[platform]) return reject('平台凭证不存在') as unknown as { deleted: boolean }
  delete platformCredentials[platform]
  return { deleted: true }
}

// ===== 路由分发 =====
/** mock 模式下 http.ts 的唯一入口：按 method + url 返回对应数据或执行状态变更。
 *  body 仅在 POST/PUT 时由 http.ts 透传（用于比价试算等带参请求）。 */
// ===== 供应商代发（§21，演示态内存实现，与后端 SuppliersService 同口径）=====
// 演示态：供应商档案与代发单（推单）均在内存维护，创建/推进会真实改写状态。
export interface MockSupplier {
  id: string
  tenantId: string
  name: string
  createdAt: string
}
export interface MockSupplierOrder {
  id: string
  tenantId: string
  supplierId: string
  orderId: string | null
  status: 'pushed' | 'accepted' | 'shipped' | 'done'
  createdAt: string
}
const SUPPLIER_STATUS_FLOW = ['pushed', 'accepted', 'shipped', 'done'] as const
let supplierSeq = 0
let supplierOrderSeq = 0

const suppliers: MockSupplier[] = [
  { id: 'sup_1', tenantId: TENANT_ID, name: '深圳华强北数码供货商', createdAt: '2026-09-12T08:00:00.000Z' },
  { id: 'sup_2', tenantId: TENANT_ID, name: '义乌小商品代发仓', createdAt: '2026-09-20T08:00:00.000Z' },
]
const supplierOrders: MockSupplierOrder[] = [
  {
    id: 'so_1',
    tenantId: TENANT_ID,
    supplierId: 'sup_1',
    orderId: 'ORD-1001',
    status: 'shipped',
    createdAt: '2026-10-15T08:00:00.000Z',
  },
  {
    id: 'so_2',
    tenantId: TENANT_ID,
    supplierId: 'sup_2',
    orderId: null,
    status: 'pushed',
    createdAt: '2026-10-20T08:00:00.000Z',
  },
]

/** 供应商档案列表（演示态，租户隔离） */
export function doListSuppliers(): MockSupplier[] {
  return suppliers.filter((s) => s.tenantId === TENANT_ID).map((s) => ({ ...s }))
}
/** 新建供应商档案（演示态） */
export function doCreateSupplier(name: string): MockSupplier {
  const row: MockSupplier = {
    id: `sup_demo_${++supplierSeq}`,
    tenantId: TENANT_ID,
    name,
    createdAt: NOW(),
  }
  suppliers.push(row)
  return { ...row }
}
/** 代发单列表（演示态，租户隔离） */
export function doListSupplierOrders(): MockSupplierOrder[] {
  return supplierOrders.filter((o) => o.tenantId === TENANT_ID).map((o) => ({ ...o }))
}
/** 新建代发单（推单，演示态） */
export function doCreateSupplierOrder(body: { supplierId?: string; orderId?: string }): MockSupplierOrder {
  const row: MockSupplierOrder = {
    id: `so_demo_${++supplierOrderSeq}`,
    tenantId: TENANT_ID,
    supplierId: body.supplierId ?? 'sup_1',
    orderId: body.orderId ?? null,
    status: 'pushed',
    createdAt: NOW(),
  }
  supplierOrders.push(row)
  return { ...row }
}
/** 推进代发单状态（演示态，与后端状态机同口径） */
export function doAdvanceSupplierOrder(
  id: string,
  to: 'accepted' | 'shipped' | 'done',
): MockSupplierOrder {
  const o = supplierOrders.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!o) throw new Error('代发单不存在或无权限')
  if (o.status === 'done') throw new Error('代发单已处于终态 done，不可变更')
  const fromIdx = SUPPLIER_STATUS_FLOW.indexOf(o.status)
  const toIdx = SUPPLIER_STATUS_FLOW.indexOf(to)
  if (toIdx <= fromIdx) throw new Error(`非法状态推进：${o.status} → ${to}（仅允许向前一步或直达 done）`)
  o.status = to
  return { ...o }
}

// ===== 仓储 / 海外仓（§15，演示态内存实现，与后端 WmsService 同口径）=====
// 演示态：仓库(国内/海外)、入库预报(ASN)、上架、库存调整、拣货波次均在内存维护，
// 创建/收货/上架/调整/波次会真实改写状态（与 WmsService 同口径）。
export interface MockWarehouse {
  id: string
  tenantId: string
  name: string
  type: 'domestic' | 'overseas' | 'transfer'
  region: string | null
  createdAt: string
}
export interface MockAsn {
  id: string
  tenantId: string
  warehouseId: string
  status: 'pending' | 'received' | 'closed'
  purchaseOrderId?: string | null // 6.6 中转仓扫码到货关联采购单
  /** 扫码来源：实际判定的语义类型（6.12 支持 auto 解析，取值含 unknown） */
  scanSource?: string | null
  receivedItems?: { id: string; productName: string; quantity: number; skuId: string | null; imageUrl: string | null }[] | null
  createdAt: string
}
export interface MockInventory {
  id: string
  tenantId: string
  warehouseId: string
  skuId: string
  binId: string | null
  /** 库位编码（人类可读货架编号，如 A-01）；仅列表返回时回填 */
  binCode?: string | null
  qty: number
  lockedQty: number
}
/** 库位（货架编号）：阶段6 货架管理 6.11 */
export interface MockBin {
  id: string
  tenantId: string
  warehouseId: string
  code: string
  zone: string | null
  createdAt: string
}
export interface MockPickTask {
  id: string
  tenantId: string
  warehouseId: string
  orderId: string | null
  status: 'pending' | 'picking' | 'done'
  createdAt: string
}
let whSeq = 0
let asnSeq = 0
let invSeq = 0
let pickSeq = 0

const warehouses: MockWarehouse[] = [
  { id: 'wh_dom_1', tenantId: TENANT_ID, name: '深圳前海国内仓', type: 'domestic', region: null, createdAt: '2026-08-01T08:00:00.000Z' },
  { id: 'wh_ovs_1', tenantId: TENANT_ID, name: 'US-West 洛杉矶海外仓', type: 'overseas', region: 'US', createdAt: '2026-08-10T08:00:00.000Z' },
  // 阶段6 中转仓（货代侧作业枢纽）：采购单到货后在此打包、出跨境面单、出库（6.5–6.9）
  { id: 'wh_transfer_1', tenantId: TENANT_ID, name: '深圳福永中转仓', type: 'transfer', region: 'CN', createdAt: '2026-09-12T08:00:00.000Z' },
]
const asns: MockAsn[] = [
  { id: 'asn_1', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', status: 'received', createdAt: '2026-10-18T08:00:00.000Z' },
]
const inventory: MockInventory[] = [
  { id: 'inv_1', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', skuId: 'SKU-A100', binId: 'bin_A01', qty: 120, lockedQty: 0 },
  { id: 'inv_2', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', skuId: 'SKU-B200', binId: 'bin_A02', qty: 60, lockedQty: 0 },
  { id: 'inv_3', tenantId: TENANT_ID, warehouseId: 'wh_ovs_1', skuId: 'SKU-A100', binId: 'bin_US01', qty: 300, lockedQty: 0 },
]
const pickTasks: MockPickTask[] = [
  { id: 'pick_1', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', orderId: 'ORD-2001', status: 'pending', createdAt: '2026-10-22T08:00:00.000Z' },
]
// 货架/库位种子（编号遵循「区-架-层」惯例；inventory.binId 指向这里）
const bins: MockBin[] = [
  { id: 'bin_A01', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', code: 'A-01-01', zone: 'A 区', createdAt: '2026-08-02T08:00:00.000Z' },
  { id: 'bin_A02', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', code: 'A-01-02', zone: 'A 区', createdAt: '2026-08-02T08:00:00.000Z' },
  { id: 'bin_A03', tenantId: TENANT_ID, warehouseId: 'wh_dom_1', code: 'A-02-01', zone: 'A 区', createdAt: '2026-08-02T08:00:00.000Z' },
  { id: 'bin_US01', tenantId: TENANT_ID, warehouseId: 'wh_ovs_1', code: 'US-A-01', zone: 'A 区', createdAt: '2026-08-11T08:00:00.000Z' },
  { id: 'bin_TF01', tenantId: TENANT_ID, warehouseId: 'wh_transfer_1', code: 'T-01', zone: '收货暂存区', createdAt: '2026-09-13T08:00:00.000Z' },
  { id: 'bin_TF02', tenantId: TENANT_ID, warehouseId: 'wh_transfer_1', code: 'T-02', zone: '打包区', createdAt: '2026-09-13T08:00:00.000Z' },
]

/** 仓库列表（演示态，租户隔离） */
export function doListWarehouses(): MockWarehouse[] {
  return warehouses.filter((w) => w.tenantId === TENANT_ID).map((w) => ({ ...w }))
}
/** 新建仓库（演示态，海外仓必填区域；支持国内仓 / 海外仓 / 货代中转仓） */
export function doCreateWarehouse(body: {
  name?: string
  type?: 'domestic' | 'overseas' | 'transfer'
  region?: string
}): MockWarehouse {
  const name = (body.name ?? '').trim()
  if (!name) throw new Error('仓库名称必填')
  if (body.type === 'overseas' && !(body.region ?? '').trim()) throw new Error('海外仓必须填写所在国家/区域')
  const row: MockWarehouse = {
    id: `wh_demo_${++whSeq}`,
    tenantId: TENANT_ID,
    name,
    type: body.type ?? 'domestic',
    region: (body.region ?? '').trim() || null,
    createdAt: NOW(),
  }
  warehouses.push(row)
  return { ...row }
}

// ===== 库位 / 货架管理（阶段6 6.11）=====

/** 库位列表（可按仓库过滤），带占用统计（SKU 种类 + 库存总量） */
export function doListBins(warehouseId?: string): BinDto[] {
  return bins
    .filter((b) => b.tenantId === TENANT_ID && (!warehouseId || b.warehouseId === warehouseId))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((b) => {
      const inv = inventory.filter((i) => i.tenantId === TENANT_ID && i.binId === b.id)
      const wh = warehouses.find((w) => w.id === b.warehouseId)
      return {
        id: b.id,
        tenantId: b.tenantId,
        warehouseId: b.warehouseId,
        warehouseName: wh?.name ?? b.warehouseId,
        code: b.code,
        zone: b.zone,
        skuKinds: inv.length,
        totalQty: inv.reduce((s, i) => s + i.qty, 0),
        createdAt: b.createdAt,
      }
    })
}

/** 新建库位（货架编号）：校验仓库归属 + 同仓编码唯一 */
export function doCreateBin(body: { warehouseId?: string; code?: string; zone?: string }): BinDto {
  const code = (body.code ?? '').trim()
  if (!code) throw new Error('库位编码必填')
  const wh = warehouses.find((w) => w.id === body.warehouseId && w.tenantId === TENANT_ID)
  if (!wh) throw new Error('仓库不存在或无权限')
  if (bins.some((b) => b.tenantId === TENANT_ID && b.warehouseId === wh.id && b.code === code)) {
    throw new Error(`仓库内已存在库位编码 ${code}`)
  }
  const row: MockBin = {
    id: `bin_demo_${bins.length + 1}`,
    tenantId: TENANT_ID,
    warehouseId: wh.id,
    code,
    zone: (body.zone ?? '').trim() || null,
    createdAt: NOW(),
  }
  bins.push(row)
  return {
    id: row.id,
    tenantId: row.tenantId,
    warehouseId: row.warehouseId,
    warehouseName: wh.name,
    code: row.code,
    zone: row.zone,
    skuKinds: 0,
    totalQty: 0,
    createdAt: row.createdAt,
  }
}

/** 删除库位：仅当该库位上无任何库存占用时允许 */
export function doDeleteBin(id: string): { deleted: boolean } {
  const idx = bins.findIndex((b) => b.id === id && b.tenantId === TENANT_ID)
  if (idx < 0) throw new Error('库位不存在或无权限')
  const occupied = inventory
    .filter((i) => i.tenantId === TENANT_ID && i.binId === id)
    .reduce((s, i) => s + i.qty, 0)
  if (occupied > 0) throw new Error(`库位 ${bins[idx].code} 仍有 ${occupied} 件库存，请先移库 / 清零后再删除`)
  bins.splice(idx, 1)
  return { deleted: true }
}
/** 入库单(ASN)列表（演示态，租户隔离，可按仓库过滤） */
export function doListAsns(warehouseId?: string): MockAsn[] {
  return asns.filter((a) => a.tenantId === TENANT_ID && (!warehouseId || a.warehouseId === warehouseId)).map((a) => ({ ...a }))
}
/** 新建入库预报(ASN)（演示态，校验仓库归属） */
export function doCreateAsn(body: { warehouseId?: string }): MockAsn {
  const wh = warehouses.find((w) => w.id === body.warehouseId && w.tenantId === TENANT_ID)
  if (!wh) throw new Error('仓库不存在或无权限')
  const row: MockAsn = { id: `asn_demo_${++asnSeq}`, tenantId: TENANT_ID, warehouseId: wh.id, status: 'pending', createdAt: NOW() }
  asns.push(row)
  return { ...row }
}
/** 收货质检：ASN pending → received（演示态） */
export function doReceiveAsn(id: string): MockAsn {
  const a = asns.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!a) throw new Error('入库单不存在或无权限')
  if (a.status !== 'pending') throw new Error('仅 pending 状态的 ASN 可收货')
  a.status = 'received'
  return { ...a }
}
/** 上架：收货实物入到库位并增加库存；上架后关闭 ASN（演示态，与后端同口径） */
export function doPutaway(id: string, body: { skuId?: string; qty?: number; binCode?: string }): MockInventory {
  const a = asns.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!a) throw new Error('入库单不存在或无权限')
  if (a.status === 'closed') throw new Error('ASN 已关闭，不可再次上架')
  const skuId = (body.skuId ?? '').trim()
  const qty = Number(body.qty ?? 0)
  const binCode = (body.binCode ?? '').trim()
  if (!skuId || qty < 1 || !binCode) throw new Error('上架需填写 SKU / 数量≥1 / 库位编码')
  const binId = 'bin_' + binCode
  const existing = inventory.find(
    (i) => i.tenantId === TENANT_ID && i.warehouseId === a.warehouseId && i.skuId === skuId && (i.binId ?? null) === (binId ?? null),
  )
  if (existing) {
    existing.qty += qty
  } else {
    inventory.push({ id: `inv_demo_${++invSeq}`, tenantId: TENANT_ID, warehouseId: a.warehouseId, skuId, binId, qty, lockedQty: 0 })
  }
  a.status = 'closed'
  return { ...(existing ?? inventory[inventory.length - 1]) }
}
/** 库存列表（演示态，租户隔离，可按仓库过滤） */
export function doListInventory(warehouseId?: string): MockInventory[] {
  return inventory
    .filter((i) => i.tenantId === TENANT_ID && (!warehouseId || i.warehouseId === warehouseId))
    .map((i) => ({ ...i, binCode: bins.find((b) => b.id === i.binId)?.code ?? null }))
}
/** 库存调整（入库 / 出库 / 盘点损益；出库不得使库存为负，演示态） */
export function doAdjustInventory(body: { warehouseId?: string; skuId?: string; delta?: number; binId?: string }): MockInventory {
  const warehouseId = body.warehouseId ?? ''
  const skuId = (body.skuId ?? '').trim()
  const delta = Number(body.delta ?? 0)
  const binId = body.binId ?? null
  if (!warehouseId || !skuId) throw new Error('库存调整需填写仓库与 SKU')
  const existing = inventory.find(
    (i) => i.tenantId === TENANT_ID && i.warehouseId === warehouseId && i.skuId === skuId && (i.binId ?? null) === (binId ?? null),
  )
  const currentQty = existing?.qty ?? 0
  const nextQty = currentQty + delta
  if (nextQty < 0) throw new Error(`库存不足：当前 ${currentQty}，出库 ${Math.abs(delta)} 将使库存为负`)
  const row =
    existing ?? { id: `inv_demo_${++invSeq}`, tenantId: TENANT_ID, warehouseId, skuId, binId, qty: 0, lockedQty: 0 }
  row.qty = nextQty
  if (!existing) inventory.push(row)
  return { ...row }
}
/** 拣货任务列表（演示态，租户隔离，可按仓库过滤） */
export function doListPicks(warehouseId?: string): MockPickTask[] {
  return pickTasks.filter((p) => p.tenantId === TENANT_ID && (!warehouseId || p.warehouseId === warehouseId)).map((p) => ({ ...p }))
}
/** 创建拣货波次（演示态，按订单生成拣货任务） */
export function doCreateWave(body: { warehouseId?: string; orderIds?: string[] }): MockPickTask[] {
  const warehouseId = body.warehouseId ?? ''
  const wh = warehouses.find((w) => w.id === warehouseId && w.tenantId === TENANT_ID)
  if (!wh) throw new Error('仓库不存在或无权限')
  const orderIds = (body.orderIds ?? []).filter((x) => x && x.trim())
  const tasks: MockPickTask[] = orderIds.map((orderId) => {
    const row: MockPickTask = { id: `pick_demo_${++pickSeq}`, tenantId: TENANT_ID, warehouseId, orderId, status: 'pending', createdAt: NOW() }
    pickTasks.push(row)
    return { ...row }
  })
  return tasks
}
/** 完成拣货任务（演示态，pending → done） */
export function doCompletePick(id: string): MockPickTask {
  const p = pickTasks.find((x) => x.id === id && x.tenantId === TENANT_ID)
  if (!p) throw new Error('拣货任务不存在或无权限')
  p.status = 'done'
  return { ...p }
}

// ===== 店铺（渠道）增删（任务 6.1，方案 §3）=====
// 演示态：新增归入 demo 租户、解绑从内存数组移除，与后端 ShopsService 同口径。
/** 新增店铺：演示态默认归入 demo 租户，authConfig 留空（真实后端见 §17 加密存储）。 */
export function doCreateShop(body: {
  platform: string
  name: string
  authConfig?: Record<string, unknown> | null
}): MockShop {
  const shop: MockShop = {
    id: 's_' + Date.now().toString(36),
    tenantId: TENANT_ID,
    platform: body.platform,
    name: body.name,
    authConfig: body.authConfig ?? null,
    createdAt: NOW(),
  }
  shops.unshift(shop) // 新建置顶，列表即时可见
  return { ...shop }
}

/** 解绑店铺：从内存数组移除；不存在抛错（与后端 SHOP_NOT_FOUND 一致）。 */
export function doDeleteShop(id: string): { id: string } {
  const idx = shops.findIndex((s) => s.id === id)
  if (idx < 0) throw new Error('店铺不存在')
  shops.splice(idx, 1)
  return { id }
}

// ===== 采购单（阶段6，任务 6.2/6.3，方案 §21 衍生）=====
// 演示态：新增归入 demo 租户、状态机推进（pending→arrived→matched→packed→outbound），
// 与后端 PurchaseOrderService 同口径；productImages 为外部供应商图 URL 数组。
/** 采购单列表（演示态：demo 租户，支持 status/shopId 过滤）。 */
export function doListPurchaseOrders(filters: { status?: string; shopId?: string } = {}): MockPurchaseOrder[] {
  return purchaseOrders
    .filter((p) => p.tenantId === TENANT_ID)
    .filter((p) => !filters.status || p.status === filters.status)
    .filter((p) => !filters.shopId || p.shopId === filters.shopId)
    .map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) }))
}

/** 新增采购单（演示态：租户隔离 + 至少 1 行项）。 */
/** 生成业务采购单号：CG + 年月日 + 当日 4 位流水（与后端 nextPurchaseNo 保持一致） */
function nextPurchaseNo(): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const prefix = `CG${ymd}-`
  const used = purchaseOrders.filter((p) => p.purchaseNo?.startsWith(prefix)).length
  return `${prefix}${String(used + 1).padStart(4, '0')}`
}

export function doCreatePurchaseOrder(body: {
  trackingNo: string
  purchaseNo?: string
  carrier: string
  platformOrderNo?: string
  recipientName?: string
  purchaseUrl?: string
  productImages?: string[]
  remark?: string
  shopId?: string
  orderId?: string
  items: { productName: string; quantity: number; skuId?: string; imageUrl?: string; unitPrice?: number }[]
}): MockPurchaseOrder {
  if (!body.items || body.items.length === 0) throw new Error('采购单至少需要 1 个行项')
  const now = NOW()
  // 任务 6.10：录入时已带 orderId → 自动回填店铺/平台单号/收件人（对齐后端 create 派生逻辑）
  const linkedOrder = body.orderId ? orders.find((o) => o.id === body.orderId) : undefined
  if (body.orderId && !linkedOrder) throw new Error('关联的店铺订单不存在或无权限')
  const po: MockPurchaseOrder = {
    id: 'po_' + Date.now().toString(36),
    tenantId: TENANT_ID,
    shopId: body.shopId ?? linkedOrder?.shopId ?? null,
    orderId: body.orderId ?? null,
    trackingNo: body.trackingNo,
    // 6.12：与后端一致，按当日流水生成可扫码的业务采购单号
    purchaseNo: body.purchaseNo ?? nextPurchaseNo(),
    carrier: body.carrier,
    platformOrderNo: body.platformOrderNo ?? linkedOrder?.platformOrderNo ?? null,
    recipientName: body.recipientName ?? linkedOrder?.recipient?.name ?? null,
    purchaseUrl: body.purchaseUrl ?? null,
    productImages: body.productImages ?? [],
    remark: body.remark ?? null,
    boxCount: 1, // 7.2 收货标签默认 1 箱，打印前可在标签对话框调整
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    items: body.items.map((it, i) => ({
      id: `poi_${Date.now().toString(36)}_${i}`,
      purchaseOrderId: '',
      skuId: it.skuId ?? null,
      productName: it.productName,
      quantity: it.quantity,
      imageUrl: it.imageUrl ?? null,
      unitPrice: it.unitPrice ?? null,
      createdAt: now,
    })),
  }
  po.items.forEach((it) => (it.purchaseOrderId = po.id))
  purchaseOrders.unshift(po)
  return { ...po, items: po.items.map((i) => ({ ...i })) }
}

/** 推进采购单状态（演示态：校验状态机合法转移，§6）。 */
const PO_TRANSITIONS: Record<string, string[]> = {
  pending: ['arrived'],
  arrived: ['matched'],
  matched: ['packed'],
  packed: ['outbound'],
  outbound: [],
}
export function doUpdatePurchaseStatus(id: string, status: string): MockPurchaseOrder {
  const po = purchaseOrders.find((p) => p.id === id && p.tenantId === TENANT_ID)
  if (!po) throw new Error('采购单不存在')
  const allowed = PO_TRANSITIONS[po.status] ?? []
  if (!allowed.includes(status)) throw new Error(`状态不可从 ${po.status} 直接转为 ${status}`)
  po.status = status
  po.updatedAt = NOW()
  return { ...po, items: po.items.map((i) => ({ ...i })) }
}

/** 取采购单（演示态：demo 租户，不存在返回 null）。 */
function getPo(id: string): MockPurchaseOrder | undefined {
  return purchaseOrders.find((p) => p.id === id && p.tenantId === TENANT_ID)
}

/** 候选店铺订单 + 命中理由（阶段6，任务 6.4）：平台订单号 / 收件人 / SKU 重叠，按强度降序。 */
export function doCandidates(id: string): { orderId: string; platformOrderNo: string; status: string; reasons: string[] }[] {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  const poSkuIds = po.items.map((i) => i.skuId).filter(Boolean) as string[]
  const cands = orders
    .map((order) => {
      const reasons: string[] = []
      if (po.platformOrderNo && order.platformOrderNo === po.platformOrderNo) reasons.push('平台订单号一致')
      if (po.recipientName && order.recipient?.name && order.recipient.name === po.recipientName)
        reasons.push('收件人一致')
      const orderSkuIds = (order.items || [])
        .map((i) => (i.sku as { id?: string } | null)?.id)
        .filter(Boolean) as string[]
      const shared = poSkuIds.filter((s) => orderSkuIds.includes(s))
      if (shared.length) reasons.push(`SKU 重叠 ${shared.length} 个`)
      const weight =
        (reasons.includes('平台订单号一致') ? 100 : 0) +
        (reasons.includes('收件人一致') ? 50 : 0) +
        reasons.filter((r) => r.startsWith('SKU')).length
      return { orderId: order.id, platformOrderNo: order.platformOrderNo, status: order.status, reasons, weight }
    })
    .filter((c) => c.reasons.length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(({ orderId, platformOrderNo, status, reasons }) => ({ orderId, platformOrderNo, status, reasons }))
  return cands
}

/** 自动匹配：取最强候选并关联（演示态同口径改写内存 orderId）。 */
export function doAutoMatch(id: string): { linked: boolean; orderId: string | null; reasons: string[]; message: string } {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  if (po.orderId) return { linked: true, orderId: po.orderId, reasons: [], message: '采购单已关联店铺订单' }
  const cands = doCandidates(id)
  if (!cands.length) return { linked: false, orderId: null, reasons: [], message: '未找到可匹配的店铺订单' }
  const best = cands[0]
  po.orderId = best.orderId
  po.updatedAt = NOW()
  return {
    linked: true,
    orderId: best.orderId,
    reasons: best.reasons,
    message: `已自动关联店铺订单 ${best.platformOrderNo}`,
  }
}

/** 手动关联店铺订单（演示态：校验订单存在）。 */
export function doLink(id: string, orderId: string): MockPurchaseOrder {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  const order = orders.find((o) => o.id === orderId)
  if (!order) throw new Error('目标店铺订单不存在')
  po.orderId = orderId
  po.updatedAt = NOW()
  return { ...po, items: po.items.map((i) => ({ ...i })) }
}

/** 解除关联（演示态：清空 orderId）。 */
export function doUnlink(id: string): MockPurchaseOrder {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  po.orderId = null
  po.updatedAt = NOW()
  return { ...po, items: po.items.map((i) => ({ ...i })) }
}

// ===== 7.2 收货标签打印 =====

/** 收货标签数据（演示态：与后端 getLabelData 同口径）。 */
export function doGetLabelData(id: string): {
  purchaseNo: string
  carrier?: string
  trackingNo?: string
  supplier?: string | null
  items: { skuCode: string; productName: string; quantity: number }[]
  remark?: string | null
  boxCount: number
  printedAt: string
} {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  // 行项 skuCode 优先取内部 SKU 编码（skus.code），缺 skuId 时回退内部 id，再回退 '-'
  const skuMap = new Map(skus.filter((s) => po.items.some((i) => i.skuId === s.id)).map((s) => [s.id, s.code]))
  const items = po.items.map((it) => ({
    skuCode: (it.skuId && skuMap.get(it.skuId)) || it.skuId || '-',
    productName: it.productName,
    quantity: it.quantity,
  }))
  return {
    purchaseNo: po.purchaseNo ?? '',
    carrier: po.carrier,
    trackingNo: po.trackingNo,
    supplier: po.purchaseUrl ?? null,
    items,
    remark: po.remark ?? null,
    boxCount: po.boxCount,
    printedAt: NOW(),
  }
}

/** 更新收货标签箱数（演示态：落内存，A4/热敏拼版用）。 */
export function doUpdateBoxCount(id: string, boxCount: number): MockPurchaseOrder {
  const po = getPo(id)
  if (!po) throw new Error('采购单不存在')
  po.boxCount = boxCount
  po.updatedAt = NOW()
  return { ...po, items: po.items.map((i) => ({ ...i })) }
}

// ===== 阶段6 中转仓看板（任务 6.5）=====
export interface MockTransferBoardPo {
  id: string
  tenantId: string
  shopId: string | null
  orderId: string | null
  trackingNo: string
  carrier: string
  platformOrderNo: string | null
  recipientName: string | null
  remark: string | null
  status: string
  items: { id: string; productName: string; quantity: number; skuId: string | null }[]
  order: { id: string; platformOrderNo: string | null; status: string; recipientName: string | null } | null
}
export interface MockTransferBoard {
  warehouses: MockWarehouse[]
  purchaseOrders: MockTransferBoardPo[]
  stats: { transferWarehouseCount: number; pendingPoCount: number; byStatus: Record<string, number> }
}

/** 中转仓看板（演示态）：本租户中转仓 + 待作业采购单（已到仓/已匹配/已打包，未出库）+ 关联订单概览。 */
export function doGetTransferBoard(): MockTransferBoard {
  const whs = warehouses.filter((w) => w.tenantId === TENANT_ID && w.type === 'transfer').map((w) => ({ ...w }))
  const pos = purchaseOrders.filter(
    (p) => p.tenantId === TENANT_ID && ['arrived', 'matched', 'packed'].includes(p.status),
  )
  const orderIds = Array.from(new Set(pos.map((p) => p.orderId).filter(Boolean) as string[]))
  const orderMap = new Map(
    orders.filter((o) => orderIds.includes(o.id)).map((o) => [o.id, o]),
  )
  const purchaseOrdersOut: MockTransferBoardPo[] = pos.map((po) => {
    const linked = po.orderId ? orderMap.get(po.orderId) : undefined
    return {
      id: po.id,
      tenantId: po.tenantId,
      shopId: po.shopId,
      orderId: po.orderId,
      trackingNo: po.trackingNo,
      carrier: po.carrier,
      platformOrderNo: po.platformOrderNo,
      recipientName: po.recipientName,
      remark: po.remark ?? null,
      status: po.status,
      items: po.items.map((it) => ({
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        skuId: it.skuId,
      })),
      order: linked
        ? {
            id: linked.id,
            platformOrderNo: linked.platformOrderNo,
            status: linked.status,
            recipientName: (linked.recipient as { name?: string } | null)?.name ?? null,
          }
        : null,
    }
  })
  const byStatus: Record<string, number> = {}
  purchaseOrdersOut.forEach((p) => (byStatus[p.status] = (byStatus[p.status] ?? 0) + 1))
  return {
    warehouses: whs,
    purchaseOrders: purchaseOrdersOut,
    stats: {
      transferWarehouseCount: whs.length,
      pendingPoCount: purchaseOrdersOut.length,
      byStatus,
    },
  }
}

/** 扫码到货入库（任务 6.6，演示态与后端 TransferService.scan 同口径）。
 * 流程：校验中转仓归属 → 按扫码类型解析采购单 → 生成收货单 ASN（received + 行项快照）
 * → 推进采购单 pending→arrived → 复用 6.4 自动匹配关联店铺订单。 */
/**
 * 演示态扫码值号段猜测（6.12 轻量版；权威实现见 server/src/modules/transfer/scan-rules.ts）。
 * 仅用于 mock 回传识别文案，真正判定以查库命中为准。
 */
function guessScanKindLite(v: string): { kind: string; label: string } {
  if (/^po[_-]/i.test(v) || /^CG\d{6,}$/i.test(v)) return { kind: 'purchaseNo', label: '采购单号' }
  if (/^(SF|YT|ZTO|STO|YD|EMS|JD|DBL|ZT)[A-Z0-9]{8,}$/i.test(v)) return { kind: 'trackingNo', label: '快递单号' }
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(v)) return { kind: 'trackingNo', label: '国际邮政单号' }
  if (/^\d{13}$/.test(v)) return { kind: 'barcode', label: 'EAN-13 商品条码' }
  if (/^\d{8}$|^\d{12}$|^\d{14}$/.test(v)) return { kind: 'barcode', label: '商品条码' }
  if (/^\d{10,30}$/.test(v)) return { kind: 'trackingNo', label: '纯数字快递单号' }
  return { kind: 'unknown', label: '未识别号段' }
}

export function doScanTransfer(body: {
  warehouseId: string
  scanValue: string
  scanType: 'auto' | 'trackingNo' | 'barcode' | 'purchaseNo'
}): {
  asn: { id: string; warehouseId: string; purchaseOrderId: string | null; scanSource: string; status: string; receivedItemCount: number; createdAt: string }
  purchaseOrder: {
    id: string
    trackingNo: string
    carrier: string
    status: string
    orderId: string | null
    remark: string | null
  }
  matched: boolean
  advanced: boolean
  resolvedType: string
  resolvedLabel: string
  message: string
} {
  const wh = warehouses.find((w) => w.id === body.warehouseId && w.tenantId === TENANT_ID)
  if (!wh) throw new Error('中转仓不存在或无权限')

  // 6.12 解析层：查询优先（快递单号 → 商品条码 → 采购单号），号段仅用于未命中提示
  const value = body.scanValue.replace(/\s+/g, '')
  const byTracking = () => purchaseOrders.find((p) => p.tenantId === TENANT_ID && p.trackingNo === value)
  const byPurchaseNo = () =>
    purchaseOrders.find((p) => p.tenantId === TENANT_ID && (p.id === value || p.purchaseNo === value))
  const byBarcode = () => {
    const sku = skus.find((s) => s.tenantId === TENANT_ID && s.barcode === value)
    if (!sku) return undefined
    return purchaseOrders.find((p) => p.tenantId === TENANT_ID && p.items.some((it) => it.skuId === sku.id))
  }

  let po: MockPurchaseOrder | undefined
  let kind = 'unknown'
  let label = '未识别号段'
  if (body.scanType === 'auto') {
    po = byTracking()
    if (po) {
      kind = 'trackingNo'
      label = '快递单号'
    } else {
      po = byBarcode()
      if (po) {
        kind = 'barcode'
        label = '商品条码'
      } else {
        po = byPurchaseNo()
        if (po) {
          kind = 'purchaseNo'
          label = '采购单号'
        } else {
          const g = guessScanKindLite(value)
          kind = g.kind
          label = g.label
        }
      }
    }
  } else if (body.scanType === 'trackingNo') {
    po = byTracking()
    kind = 'trackingNo'
    label = '快递单号'
  } else if (body.scanType === 'purchaseNo') {
    po = byPurchaseNo()
    kind = 'purchaseNo'
    label = '采购单号'
  } else {
    po = byBarcode()
    kind = 'barcode'
    label = '商品条码'
  }
  if (!po)
    throw new Error(
      kind === 'unknown'
        ? '未能识别该扫码值的号段，且未匹配到采购单，请核对快递单号 / 商品条码 / 采购单号'
        : `已识别为${label}，但未匹配到采购单，请核对快递单号 / 商品条码 / 采购单号`,
    )

  const receivedItems = po.items.map((it) => ({
    id: it.id,
    productName: it.productName,
    quantity: it.quantity,
    skuId: it.skuId,
    imageUrl: it.imageUrl,
  }))
  const asnId = `asn_demo_${++asnSeq}`
  const asn: MockAsn = {
    id: asnId,
    tenantId: TENANT_ID,
    warehouseId: wh.id,
    status: 'received',
    purchaseOrderId: po.id,
    scanSource: kind, // 记录实际判定类型（auto 模式下由解析得出）
    receivedItems,
    createdAt: NOW(),
  }
  asns.push(asn)

  // 推进采购单状态：pending → arrived（状态机首跳）
  let advanced = false
  if (po.status === 'pending') {
    po.status = 'arrived'
    po.updatedAt = NOW()
    advanced = true
  }

  // 复用 6.4 自动匹配关联店铺订单
  let matched = false
  if (!po.orderId) {
    matched = doAutoMatch(po.id).linked
  } else {
    matched = true
  }

  return {
    asn: {
      id: asn.id,
      warehouseId: asn.warehouseId,
      purchaseOrderId: asn.purchaseOrderId ?? null,
      scanSource: asn.scanSource ?? body.scanType,
      status: asn.status,
      receivedItemCount: receivedItems.length,
      createdAt: asn.createdAt,
    },
    purchaseOrder: {
      id: po.id,
      trackingNo: po.trackingNo,
      carrier: po.carrier,
      status: po.status,
      orderId: po.orderId,
      remark: po.remark ?? null,
    },
    matched,
    advanced,
    resolvedType: kind,
    resolvedLabel: label,
    message: advanced
      ? `到货登记成功，采购单 ${po.trackingNo} 已转为 arrived`
      : `到货登记成功（采购单当前状态 ${po.status}）`,
  }
}

// ===== 6.7 中转仓打包任务 + 核对（演示态，与后端 TransferService 同口径）=====

/** 打包任务（演示态内存模型）：聚合一组已匹配采购单为一个出单/打包单元。 */
interface MockPackTask {
  id: string
  tenantId: string
  warehouseId: string | null
  orderId: string | null
  purchaseOrderIds: string[]
  status: string
  channelCode: string | null
  labelId: string | null
  shipmentId: string | null
  packedAt: string | null
  createdAt: string
}
let packTasks: MockPackTask[] = []
let packTaskSeq = 0

/** 按 (skuId 优先，否则 产品名) 归一聚合采购行项，与店铺订单行项逐一核对差异。 */
function computePackCheck(
  poItems: { skuId: string | null; productName: string; quantity: number }[],
  orderItems: { skuId: string | null; quantity: number }[],
): { diffs: PackCheckRow[]; summary: PackCheckSummary } {
  const poAgg = new Map<string, { name: string; qty: number }>()
  for (const it of poItems) {
    const key = it.skuId ?? it.productName
    if (!key) continue
    const cur = poAgg.get(key) ?? { name: it.productName, qty: 0 }
    cur.qty += it.quantity
    poAgg.set(key, cur)
  }
  const diffs: PackCheckRow[] = []
  let matched = 0
  let qtyMismatch = 0
  let missing = 0
  let extra = 0
  let unverified = 0
  const consumedPoKeys = new Set<string>()
  for (const oi of orderItems) {
    if (!oi.skuId) {
      unverified++
      diffs.push({
        skuId: null,
        name: '（订单行项缺 SKU）',
        orderQty: oi.quantity,
        poQty: 0,
        diff: -oi.quantity,
        status: 'unverified',
        message: '店铺订单行项缺少 SKU，无法与采购单核对，请人工确认',
      })
      continue
    }
    const po = poAgg.get(oi.skuId)
    if (!po) {
      missing++
      diffs.push({
        skuId: oi.skuId,
        name: oi.skuId,
        orderQty: oi.quantity,
        poQty: 0,
        diff: -oi.quantity,
        status: 'missing_in_po',
        message: '店铺订单需求该 SKU，但采购单未覆盖（需补采）',
      })
      continue
    }
    consumedPoKeys.add(oi.skuId)
    const d = po.qty - oi.quantity
    if (d === 0) matched++
    else qtyMismatch++
    diffs.push({
      skuId: oi.skuId,
      name: po.name,
      orderQty: oi.quantity,
      poQty: po.qty,
      diff: d,
      status: d === 0 ? 'matched' : 'qty_mismatch',
      message: d === 0 ? '采购数量与订单一致' : `采购与订单数量不符（差 ${d > 0 ? '+' : ''}${d}）`,
    })
  }
  for (const [key, po] of poAgg) {
    if (consumedPoKeys.has(key)) continue
    extra++
    diffs.push({
      skuId: key,
      name: po.name,
      orderQty: 0,
      poQty: po.qty,
      diff: po.qty,
      status: 'extra_in_po',
      message: '采购到货但店铺订单无对应需求（多采 / 需复核）',
    })
  }
  const total = diffs.length
  const hasDifference = qtyMismatch + missing + extra + unverified > 0
  return { diffs, summary: { total, matched, qtyMismatch, missing, extra, unverified, hasDifference } }
}

/** 待打包队列（演示态）：已匹配且已关联订单的采购单按订单聚合 + 核对差异预览。 */
export function doGetPackQueue(): PackQueue {
  const pos = purchaseOrders.filter(
    (p) => p.tenantId === TENANT_ID && p.status === 'matched' && p.orderId,
  )
  const groups = new Map<string, typeof pos>()
  for (const p of pos) {
    const oid = p.orderId as string
    if (!groups.has(oid)) groups.set(oid, [])
    groups.get(oid)!.push(p)
  }
  const orderIds = Array.from(groups.keys())
  const orderMap = new Map(orders.filter((o) => orderIds.includes(o.id)).map((o) => [o.id, o]))
  const taskByOrder = new Map(packTasks.map((t) => [t.orderId as string, t]))

  const items: PackQueueItem[] = []
  for (const [oid, groupPos] of groups) {
    const order = orderMap.get(oid)
    const orderItems = (order?.items ?? []).map((it) => ({
      skuId: (it.sku as { id?: string } | null)?.id ?? null,
      quantity: it.quantity,
    }))
    const poItems = groupPos.flatMap((p) =>
      p.items.map((it) => ({ skuId: it.skuId, productName: it.productName, quantity: it.quantity })),
    )
    const { diffs, summary } = computePackCheck(poItems, orderItems)
    const t = taskByOrder.get(oid)
    items.push({
      orderId: oid,
      order: order
        ? {
            id: order.id,
            platformOrderNo: order.platformOrderNo,
            status: order.status,
            recipientName: order.recipient?.name ?? null,
          }
        : null,
      purchaseOrders: groupPos.map((p) => ({
        id: p.id,
        trackingNo: p.trackingNo,
        carrier: p.carrier,
        status: p.status,
        remark: p.remark ?? null,
      })),
      purchaseOrderIds: groupPos.map((p) => p.id),
      task: t ? { id: t.id, status: t.status } : null,
      diffs,
      summary,
    })
  }

  const taskCount = packTasks.length
  return {
    items,
    stats: {
      matchedPoCount: pos.length,
      taskCount,
      pendingTaskCount: packTasks.filter((t) => t.status === 'pending').length,
      packedTaskCount: packTasks.filter((t) => t.status === 'packed').length,
    },
  }
}

/** 生成打包任务（演示态）：对每一个已匹配聚合组创建待打包任务，幂等（已存在则跳过）。 */
export function doGeneratePackTasks(): { created: number; tasks: PackTaskDto[] } {
  const pos = purchaseOrders.filter(
    (p) => p.tenantId === TENANT_ID && p.status === 'matched' && p.orderId,
  )
  const groups = new Map<string, string[]>()
  for (const p of pos) {
    const oid = p.orderId as string
    if (!groups.has(oid)) groups.set(oid, [])
    groups.get(oid)!.push(p.id)
  }
  const wh = warehouses.find((w) => w.tenantId === TENANT_ID && w.type === 'transfer')
  const existingOrders = new Set(packTasks.map((t) => t.orderId))
  let created = 0
  for (const [oid, poIds] of groups) {
    if (existingOrders.has(oid)) continue
    packTasks.push({
      id: `pack_demo_${++packTaskSeq}`,
      tenantId: TENANT_ID,
      warehouseId: wh?.id ?? null,
      orderId: oid,
      purchaseOrderIds: poIds,
      status: 'pending',
      channelCode: null,
      labelId: null,
      shipmentId: null,
      packedAt: null,
      createdAt: NOW(),
    })
    created++
  }
  return { created, tasks: doListPackTasks() }
}

/** 打包任务列表（演示态，含关联订单与采购单摘要）。 */
export function doListPackTasks(): PackTaskDto[] {
  const orderIds = packTasks.map((t) => t.orderId).filter(Boolean) as string[]
  const orderMap = new Map(orders.filter((o) => orderIds.includes(o.id)).map((o) => [o.id, o]))
  const poIds = packTasks.flatMap((t) => t.purchaseOrderIds)
  const poMap = new Map(purchaseOrders.filter((p) => poIds.includes(p.id)).map((p) => [p.id, p]))
  return packTasks.map((t) => {
    const order = t.orderId ? orderMap.get(t.orderId) : undefined
    return {
      id: t.id,
      tenantId: t.tenantId,
      warehouseId: t.warehouseId,
      orderId: t.orderId,
      purchaseOrderIds: t.purchaseOrderIds,
      status: t.status,
      channelCode: t.channelCode,
      labelId: t.labelId,
      shipmentId: t.shipmentId,
      packedAt: t.packedAt,
      createdAt: t.createdAt,
      order: order
        ? {
            id: order.id,
            platformOrderNo: order.platformOrderNo,
            status: order.status,
            recipientName: order.recipient?.name ?? null,
          }
        : null,
      purchaseOrders: t.purchaseOrderIds
        .map((id) => poMap.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p!.id, trackingNo: p!.trackingNo, carrier: p!.carrier, status: p!.status, remark: p!.remark ?? null })),
    }
  })
}

/** 打包任务核对（演示态）：采购行项 vs 店铺订单行项差异明细。 */
export function doGetPackCheck(packTaskId: string): PackTaskCheck {
  const task = packTasks.find((t) => t.id === packTaskId)
  if (!task) throw new Error('PACK_TASK_NOT_FOUND')
  const order = task.orderId
    ? orders.find((o) => o.id === task.orderId)
    : undefined
  const orderItems = (order?.items ?? []).map((it) => ({
    skuId: (it.sku as { id?: string } | null)?.id ?? null,
    quantity: it.quantity,
  }))
  const poItems = task.purchaseOrderIds
    .map((id) => purchaseOrders.find((p) => p.id === id))
    .filter(Boolean)
    .flatMap((p) => p!.items.map((it) => ({ skuId: it.skuId, productName: it.productName, quantity: it.quantity })))
  const { diffs, summary } = computePackCheck(poItems, orderItems)
  return {
    packTaskId: task.id,
    order: order
      ? {
          id: order.id,
          platformOrderNo: order.platformOrderNo,
          status: order.status,
          recipientName: order.recipient?.name ?? null,
        }
      : null,
    purchaseOrders: task.purchaseOrderIds
      .map((id) => purchaseOrders.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, trackingNo: p!.trackingNo, carrier: p!.carrier, status: p!.status, remark: p!.remark ?? null })),
    diffs,
    summary,
  }
}

/** 标记打包（演示态）：幂等推进聚合采购单 matched/arrived → packed，并置任务为 packed。 */
export function doPack(packTaskId: string): PackTaskDto {
  const task = packTasks.find((t) => t.id === packTaskId)
  if (!task) throw new Error('PACK_TASK_NOT_FOUND')
  if (task.status === 'packed') return doListPackTasks().find((t) => t.id === packTaskId)!
  task.status = 'packed'
  task.packedAt = NOW()
  for (const id of task.purchaseOrderIds) {
    const po = purchaseOrders.find((p) => p.id === id && p.tenantId === TENANT_ID)
    if (po && ['arrived', 'matched'].includes(po.status)) {
      po.status = 'packed'
      po.updatedAt = NOW()
    }
  }
  return doListPackTasks().find((t) => t.id === packTaskId)!
}

// ===== 6.8 跨境面单生成（演示态，与后端 TransferService 同口径）=====

/** 可选跨境渠道（演示态）。 */
const CHANNELS: ChannelOption[] = [
  { code: 'yunexpress', name: '云途物流', currency: 'CNY', baseFee: 18, perKgRate: 42 },
  { code: 'dhl', name: 'DHL', currency: 'CNY', baseFee: 35, perKgRate: 68 },
  { code: '4px', name: '递四方 4PX', currency: 'CNY', baseFee: 16, perKgRate: 38 },
  { code: 'yanwen', name: '燕文物流', currency: 'CNY', baseFee: 14, perKgRate: 35 },
]
/** 已生成的跨境面单（演示态内存）。 */
let packLabels: ShippingLabelDto[] = []
let packLabelSeq = 0

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string))
}
/** 演示运费估算（CNY），与后端 estimateCost 同口径。 */
function estimateMockCost(channel: ChannelOption, weightG: number): { carrierCost: number; sellPrice: number } {
  const weightKg = Math.max(weightG / 1000, 0.5)
  const carrierCost = Number((channel.baseFee + channel.perKgRate * weightKg).toFixed(2))
  const sellPrice = Number((carrierCost * 1.15 + 5).toFixed(2))
  return { carrierCost, sellPrice }
}
/** 生成 ZPL 标签源文。 */
function buildMockZpl(channel: ChannelOption, trackingNo: string, order: MockOrder | undefined, pos: MockPurchaseOrder[], weightG: number): string {
  const rec = (order?.recipient as unknown as Record<string, unknown>) ?? {}
  const name = (rec.name as string) ?? ''
  const country = (rec.country as string) ?? ''
  const city = (rec.city as string) ?? ''
  const items = pos.flatMap((p) => p.items.map((i) => `${i.productName} x${i.quantity}`)).join(' / ')
  return [
    '^XA',
    '^FO20,20^ADN,18,10^FD跨境物流面单^FS',
    `^FO20,55^ADN,12,8^FD渠道: ${channel.name} (${channel.code})^FS`,
    `^FO20,80^ADN,12,8^FD运单号: ${trackingNo}^FS`,
    `^FO20,105^ADN,12,8^FD收件人: ${name} / ${country} ${city}^FS`,
    `^FO20,130^ADN,10,7^FD商品: ${items}^FS`,
    `^FO20,155^ADN,10,7^FD实重: ${(weightG / 1000).toFixed(2)} kg^FS`,
    '^BY3,2,60',
    `^FO20,185^BCN,60,Y,N,N^FD${trackingNo}^FS`,
    `^FO20,260^ADN,10,7^FD${channel.name} CROSS-BORDER LABEL^FS`,
    '^XZ',
  ].join('\n')
}
/** 生成 SVG 预览面单，返回 data URI（演示预览）。 */
function buildMockLabelSvg(channel: ChannelOption, trackingNo: string, order: MockOrder | undefined, pos: MockPurchaseOrder[], weightG: number): string {
  const rec = (order?.recipient as unknown as Record<string, unknown>) ?? {}
  const name = escapeHtml((rec.name as string) ?? '')
  const country = escapeHtml((rec.country as string) ?? '')
  const city = escapeHtml((rec.city as string) ?? '')
  const addr = escapeHtml((rec.address1 as string) ?? '')
  const zip = escapeHtml((rec.zip as string) ?? '')
  const itemsStr = escapeHtml(pos.flatMap((p) => p.items.map((i) => `${i.productName} x${i.quantity}`)).join(' / ') || '—')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#fff" stroke="#111" stroke-width="2"/>
  <rect x="0" y="0" width="400" height="54" fill="#1e293b"/>
  <text x="16" y="34" fill="#fff" font-size="20" font-family="sans-serif">跨境物流面单 · ${escapeHtml(channel.name)}</text>
  <text x="16" y="86" fill="#0f172a" font-size="15" font-family="sans-serif">运单号: ${escapeHtml(trackingNo)}</text>
  <text x="16" y="116" fill="#0f172a" font-size="14" font-family="sans-serif">渠道: ${escapeHtml(channel.code)}</text>
  <line x1="16" y1="132" x2="384" y2="132" stroke="#cbd5e1"/>
  <text x="16" y="160" fill="#0f172a" font-size="15" font-family="sans-serif">收件人: ${name}</text>
  <text x="16" y="186" fill="#334155" font-size="12" font-family="sans-serif">${country} ${city} ${addr} ${zip}</text>
  <text x="16" y="218" fill="#0f172a" font-size="14" font-family="sans-serif">商品明细:</text>
  <text x="16" y="242" fill="#334155" font-size="12" font-family="sans-serif">${itemsStr}</text>
  <line x1="16" y1="520" x2="384" y2="520" stroke="#cbd5e1"/>
  <text x="16" y="546" fill="#0f172a" font-size="14" font-family="sans-serif">实重: ${(weightG / 1000).toFixed(2)} kg</text>
  <rect x="16" y="556" width="368" height="32" fill="#f1f5f9"/>
  <text x="24" y="578" fill="#475569" font-size="12" font-family="monospace">${escapeHtml(trackingNo)}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 可选跨境渠道（演示态）。 */
export function doListChannels(): ChannelOption[] {
  return CHANNELS
}
/** 生成跨境面单（演示态）：仅已打包任务可出单；建单 + 生成 ZPL/SVG，回填打包任务。 */
export function doGenerateLabel(packTaskId: string, dto: { channelCode: string }): PackLabelResult {
  const task = packTasks.find((t) => t.id === packTaskId)
  if (!task) throw new Error('PACK_TASK_NOT_FOUND')
  if (task.labelId) {
    const existing = packLabels.find((l) => l.id === task.labelId)
    if (existing) {
      return { packTask: doListPackTasks().find((t) => t.id === packTaskId)!, label: existing }
    }
  }
  if (task.status !== 'packed') throw new Error('PACK_TASK_NOT_PACKED')
  const channel = CHANNELS.find((c) => c.code === dto.channelCode)
  if (!channel) throw new Error('CHANNEL_NOT_SUPPORTED')
  const order = task.orderId ? orders.find((o) => o.id === task.orderId) : undefined
  const pos = task.purchaseOrderIds.map((id) => purchaseOrders.find((p) => p.id === id)).filter(Boolean) as MockPurchaseOrder[]
  let weightG = 0
  for (const p of pos) {
    for (const it of p.items) {
      if (it.skuId) {
        const sku = skus.find((s) => s.id === it.skuId)
        if (sku) weightG += (sku.weightG ?? 0) * it.quantity
      }
    }
  }
  estimateMockCost(channel, weightG)
  const trackingNo = `${channel.code.toUpperCase()}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  const shipmentId = `sh_demo_${++packLabelSeq}`
  const recipient = (order?.recipient as unknown as Record<string, unknown>) ?? {}
  const zpl = buildMockZpl(channel, trackingNo, order, pos, weightG)
  const pdfUrl = buildMockLabelSvg(channel, trackingNo, order, pos, weightG)
  const label: ShippingLabelDto = {
    id: `lb_demo_${++packLabelSeq}`,
    tenantId: TENANT_ID,
    packTaskId: task.id,
    shipmentId,
    channelCode: channel.code,
    trackingNo,
    recipient,
    zpl,
    pdfUrl,
    status: 'created',
    createdAt: NOW(),
  }
  packLabels.push(label)
  // 同步建立跨境运单实体（镜像后端 Shipment），便于出库时 fulfill 回写平台 + 轨迹联动订单
  const cost = estimateMockCost(channel, weightG)
  shipments.push({
    id: shipmentId,
    orderId: task.orderId ?? '',
    carrierCode: channel.code,
    carrierName: channel.name,
    trackingNo,
    waybillNo: trackingNo,
    status: 'booked',
    legType: 'direct',
    carrierCost: cost.carrierCost,
    sellPrice: cost.sellPrice,
    currency: 'CNY',
    legs: [{ legType: 'direct', carrierCode: channel.code, carrierName: channel.name, trackingNo, status: 'booked' }],
    createdAt: NOW(),
  })
  task.channelCode = channel.code
  task.labelId = label.id
  task.shipmentId = shipmentId
  return { packTask: doListPackTasks().find((t) => t.id === packTaskId)!, label }
}
/** 查看跨境面单（演示态）。 */
export function doGetLabel(packTaskId: string): ShippingLabelDto {
  const task = packTasks.find((t) => t.id === packTaskId)
  if (!task) throw new Error('PACK_TASK_NOT_FOUND')
  if (!task.labelId) throw new Error('LABEL_NOT_FOUND')
  const label = packLabels.find((l) => l.id === task.labelId)
  if (!label) throw new Error('LABEL_NOT_FOUND')
  return label
}

// ===== 6.9 出库闭环 + 物流同步（演示态，与后端 TransferService.outbound 同口径）=====
// 出库扫码 → Shipment.fulfill 回写平台 + TrackingEvent 出库节点 → 流转正式跨境物流；
// 状态机贯通采购单（packed → outbound）与店铺订单（approved → pushed → picked_up）。

/**
 * 出库（演示态）：
 * - 通过 packTaskId 解析 shipmentId（要求该任务已生成面单，含 labelId + shipmentId；否则 OUTBOUND_NO_LABEL）；
 * - 或直接传 shipmentId（否则 OUTBOUND_TARGET_REQUIRED）；
 * - 调用 doFulfillShipment（回写平台 + 推进运单至 pushed）与 doRecordTracking（出库揽收节点 picked_up）；
 * - 推进关联采购单 packed → outbound；联动店铺订单 pushed → picked_up；
 * - 汇总 shipment + tracking（doListTracking）+ order + purchaseOrder 返回 OutboundResult。
 */
export function doOutbound(body: unknown): OutboundResult {
  const dto = (body ?? {}) as OutboundTransferDto
  let shipmentId: string | undefined
  let targetTask: MockPackTask | null = null

  if (dto.packTaskId) {
    const task = packTasks.find((t) => t.id === dto.packTaskId)
    if (!task) throw new Error('PACK_TASK_NOT_FOUND')
    if (!task.labelId || !task.shipmentId) throw new Error('OUTBOUND_NO_LABEL')
    shipmentId = task.shipmentId
    targetTask = task
  } else if (dto.shipmentId) {
    shipmentId = dto.shipmentId
  } else {
    throw new Error('OUTBOUND_TARGET_REQUIRED')
  }

  // 回写平台：运单 → pushed（含轨迹节点）
  doFulfillShipment(shipmentId)
  // 出库揽收节点：运单 → picked_up（含轨迹节点）
  doRecordTracking(shipmentId, {
    status: 'picked_up',
    location: '中转仓',
    description: '已出库揽收，离港进入正式跨境物流',
  })

  // 关联订单：pushed → picked_up（演示态直接置终态便于看板可视化）
  const shipment = shipments.find((s) => s.id === shipmentId)
  let orderSnap: { id: string; status: string } | null = null
  if (shipment?.orderId) {
    const order = orders.find((o) => o.id === shipment.orderId)
    if (order) {
      order.status = 'picked_up'
      orderSnap = { id: order.id, status: order.status }
    }
  }

  // 关联采购单：packed → outbound（仅按任务聚合的采购单推进；按 shipmentId 出库时需回查任务）
  const poSnaps: { id: string; status: string }[] = []
  const poIds = targetTask ? targetTask.purchaseOrderIds : []
  for (const id of poIds) {
    const po = purchaseOrders.find((p) => p.id === id && p.tenantId === TENANT_ID)
    if (po && po.status === 'packed') {
      po.status = 'outbound'
      po.updatedAt = NOW()
    }
    if (po) poSnaps.push({ id: po.id, status: po.status })
  }

  // 汇总运单与轨迹
  const shipSnap = shipment
    ? {
        id: shipment.id,
        trackingNo: shipment.trackingNo ?? null,
        status: shipment.status,
        channelCode: shipment.carrierCode ?? null,
      }
    : { id: shipmentId, trackingNo: null, status: 'picked_up', channelCode: null }

  const tracking: OutboundTrackingVo[] = doListTracking(shipmentId).map((e) => ({
    id: e.id,
    shipmentId: e.shipmentId,
    status: e.status,
    location: e.location,
    description: e.description,
    occurredAt: e.occurredAt,
    legType: e.legType,
  }))

  const packTaskSnap = targetTask ? doListPackTasks().find((t) => t.id === targetTask!.id) ?? null : null

  return {
    packTask: packTaskSnap,
    shipment: shipSnap,
    tracking,
    purchaseOrder: poSnaps,
    order: orderSnap,
    message: targetTask
      ? `出库完成：打包任务 ${targetTask.id} 关联运单 ${shipSnap.trackingNo ?? shipmentId} 已回写平台并进入正式跨境物流`
      : `出库完成：运单 ${shipSnap.trackingNo ?? shipmentId} 已回写平台并进入正式跨境物流`,
  }
}

// ===== 模拟路由分发（演示模式核心）：按 method+url 匹配 doXxx 实现，返回数据体 =====
// 与真实后端 /api 路由同口径；无匹配时 reject 提示演示模式不支持该请求。
export function mockRouter(method: string, url: string, body?: unknown): Promise<unknown> {
  // GET 集合
  if (method === 'GET') {
    if (url === '/tenants') return delay().then(() => tenants)
    if (url === '/shops') return delay().then(() => shops)
    // 采购单列表（阶段6，任务 6.2/6.3）：demo 租户隔离 + status/shopId 过滤。
    if (url === '/purchase-orders' || url.startsWith('/purchase-orders?'))
      return delay().then(() => doListPurchaseOrders(parseQ(url)))
    // 采购单匹配候选（阶段6，任务 6.4）：按平台单号 / 收件人 / SKU 推断可关联店铺订单
    const poCand = url.match(/^\/purchase-orders\/([^/]+)\/candidates$/)
    if (poCand) return delay(140).then(() => doCandidates(poCand[1]))
    // 中转仓看板（阶段6，任务 6.5）：中转仓列表 + 待作业采购单 + 关联订单概览
    if (url === '/transfer/board') return delay(160).then(() => doGetTransferBoard())
    // 待打包队列（阶段6，任务 6.7）：已匹配订单聚合 + 核对差异预览
    if (url === '/transfer/pack-queue') return delay(160).then(() => doGetPackQueue())
    // 打包任务列表（阶段6，任务 6.7）：含关联订单与采购单摘要
    if (url === '/transfer/pack-tasks') return delay(160).then(() => doListPackTasks())
    // 打包任务核对（阶段6，任务 6.7）：采购行项 vs 订单行项差异
    const packCheck = url.match(/^\/transfer\/pack-tasks\/([^/]+)\/check$/)
    if (packCheck) return delay(160).then(() => doGetPackCheck(packCheck[1]))
    // 可选跨境渠道（阶段6，任务 6.8）：中转仓出单渠道列表
    if (url === '/transfer/channels') return delay(120).then(() => doListChannels())
    // 查看跨境面单（阶段6，任务 6.8）：已生成面单（ZPL + 预览）
    const packLabel = url.match(/^\/transfer\/pack-tasks\/([^/]+)\/label$/)
    if (packLabel) return delay(160).then(() => doGetLabel(packLabel[1]))
    // 供应商代发（§21）：档案列表 + 代发单列表（演示态内存）
    if (url === '/suppliers') return delay().then(() => doListSuppliers())
    if (url === '/suppliers/orders') return delay().then(() => doListSupplierOrders())
    // 仓储 / 海外仓（§15）：仓库 / 入库单 / 库存 / 拣货任务（演示态内存）
    if (url === '/wms/warehouses') return delay().then(() => doListWarehouses())
    if (url === '/wms/bins' || url.startsWith('/wms/bins?')) return delay().then(() => doListBins(parseQ(url).warehouseId))
    if (url === '/wms/asns' || url.startsWith('/wms/asns?')) return delay().then(() => doListAsns(parseQ(url).warehouseId))
    if (url === '/wms/inventory' || url.startsWith('/wms/inventory?')) return delay().then(() => doListInventory(parseQ(url).warehouseId))
    if (url === '/wms/picks' || url.startsWith('/wms/picks?')) return delay().then(() => doListPicks(parseQ(url).warehouseId))
    if (url === '/channels/platforms') return delay().then(() => ['shopify', 'amazon', 'taobao', 'douyin', 'mock'])
    if (url === '/catalog/products') return delay().then(() => products)
    if (url.startsWith('/catalog/skus')) return delay().then(() => filterSkus(url))
    // 条码 / 多码管理（阶段7，任务 7.1）
    if (url.startsWith('/catalog/sku/barcode-lookup')) {
      const code = (new URL(url, 'http://mock').searchParams.get('code') ?? '')
      return delay().then(() => doBarcodeLookup(code))
    }
    const barcodesList = url.match(/^\/catalog\/sku\/([^/]+)\/barcodes$/)
    if (barcodesList) return delay().then(() => doListBarcodes(barcodesList[1]))
    if (url === '/orders') return delay().then(() => orders)
    if (url.startsWith('/orders?')) return delay().then(() => filterOrders(url))
    if (url === '/carriers') return delay().then(() => carriers)
    // 收款账务（§16）：钱包概要 + 记账流水（返回副本，避免视图直接改写模块级状态）
    if (url === '/finance/wallet') return delay().then(() => doGetWallet())
    if (url === '/finance/ledger') return delay().then(() => doGetLedger())
    // 商户账单 / 承运商对账 / 利润核算（§9/§10）：按当前租户隔离与平台级聚合
    if (url === '/billing/bills' || url.startsWith('/billing/bills?')) return delay().then(() => doListBills(url))
    if (url === '/billing/reconciliations' || url.startsWith('/billing/reconciliations?'))
      return delay().then(() => doListRecons(url))
    if (url === '/billing/profit' || url.startsWith('/billing/profit?')) return delay().then(() => doGetProfit(url))
    if (url.startsWith('/billing/profit/breakdown')) return delay().then(() => doGetProfitBreakdown(url))
    if (url.startsWith('/billing/profit/trend')) {
      const q = parseQ(url)
      const months = q.months ? Number(q.months) : 6
      return delay().then(() => doGetProfitTrend(Number.isFinite(months) && months > 0 ? months : 6))
    }
    // 系统安全态势（§17）：隔离/加密/越权防护（演示态静态镜像后端诊断）
    if (url === '/system/security') return delay().then(() => doGetSecurity())
    // 容量与灾备诊断（§30）：限流实时统计 + RTO/RPO + 备份策略（演示态静态镜像）
    if (url === '/system/capacity') return delay().then(() => doGetCapacity())
    // RBAC 权限目录 / 角色（§22）
    if (url === '/rbac/permissions') return delay().then(() => doGetCatalog())
    if (url === '/rbac/role-blueprints') return delay().then(() => doGetBlueprints())
    if (url === '/rbac/roles') return delay().then(() => doGetRoles())
    // 运营报表总览（§25 五类指标）：演示态同口径聚合（前端无需后端即可看板）
    if (url === '/reports/overview') return delay().then(() => doGetReportDashboard())
    // 理赔列表 / 详情（§20）：按租户隔离 + 状态 / 类型筛选
    if (url === '/claims' || url.startsWith('/claims?')) return delay().then(() => doListClaims(url))
    const claimId = url.match(/^\/claims\/([^/]+)$/)
    if (claimId) return delay().then(() => doGetClaim(claimId[1]))
    // 风控总览 / 规则 / 黑名单 / 风险订单（§26）：演示态同口径聚合（与后端 RiskService）
    if (url === '/risk/summary') return delay().then(() => doGetRiskSummary())
    if (url === '/risk/rules') return delay().then(() => doListRiskRules())
    if (url === '/risk/blacklist') return delay().then(() => doListBlacklist())
    if (url === '/risk/orders' || url.startsWith('/risk/orders?')) return delay().then(() => doListRiskOrders())
    const riskOrderId = url.match(/^\/risk\/orders\/([^/]+)$/)
    if (riskOrderId) return delay().then(() => doGetRiskOrder(riskOrderId[1]))
    // 开放平台（§28）：总览 / 客户端 / Webhook（演示态同口径）
    if (url === '/openapi/summary') return delay().then(() => doGetOpenSummary())
    if (url === '/openapi/clients') return delay().then(() => doListOpenClients())
    if (url === '/openapi/webhooks') return delay().then(() => doListOpenWebhooks())
    // 平台凭证管理（§17.2，任务 8.2）：列表脱敏 / 查看明文（演示态同口径）
    if (url === '/platform-credentials') return delay().then(() => doListPlatformCredentials())
    const pcGet = url.match(/^\/platform-credentials\/([^/]+)$/)
    if (pcGet) return delay(120).then(() => doGetPlatformCredential(pcGet[1]))
    const billId = url.match(/^\/billing\/bills\/([^/]+)$/)
    if (billId) {
      const b = billingBills.find((x) => x.id === billId[1])
      return b ? delay().then(() => ({ ...b })) : delay().then(() => reject('账单不存在'))
    }
    const reconId = url.match(/^\/billing\/reconciliations\/([^/]+)$/)
    if (reconId) {
      const r = billingRecons.find((x) => x.id === reconId[1])
      return r ? delay().then(() => ({ ...r })) : delay().then(() => reject('对账单不存在'))
    }
    // 返回副本：避免视图 v-model 直接改写 mock 模块级状态，所有变更一律走下方 POST/PUT/DELETE。
    if (url === '/pricing/markup-rules')
      return delay().then(() => markupRules.map((r) => ({ ...r })))
    if (url === '/pricing/fx') return delay().then(() => fxRates.map((f) => ({ ...f })))
    if (url === '/pricing/products') return delay().then(() => doListProducts())
    const productRate = url.match(/^\/pricing\/products\/([^/]+)\/rate$/)
    if (productRate) {
      const u = new URL(url, 'http://mock')
      const w = Number(u.searchParams.get('weightKg') ?? '0')
      return delay().then(() => doProductRate(productRate[1], w))
    }
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
    // 物流回传 + 轨迹基础（任务 1.6，§3）：运单列表 + 轨迹时间线（演示态同口径改写内存）
    if (url === '/shipments' || url.startsWith('/shipments?')) {
      const q = parseQ(url)
      return delay().then(() => doListShipments(q.orderId))
    }
    const shipTrackGet = url.match(/^\/shipments\/([^/]+)\/tracking$/)
    if (shipTrackGet) return delay().then(() => doListTracking(shipTrackGet[1]))
    // Amazon SP-API 对接（§29）：FBA 头程入仓 / FBM 买运单 / 报表对账（演示态同口径）
    const amzHealth = url.match(/^\/amazon\/([^/]+)\/health$/)
    if (amzHealth) return delay(140).then(() => doAmazonHealth(amzHealth[1]))
    // 注意：fba-inbound/prep 必须排在 fba-inbound/:shipmentId 之前，否则 prep 会被当作 shipmentId
    const amzFbaPrep = url.match(/^\/amazon\/([^/]+)\/fba-inbound\/prep$/)
    if (amzFbaPrep) {
      const u = new URL(url, 'http://mock')
      const skus = u.searchParams.get('skus') ?? ''
      return delay(160).then(() => doAmazonFbaPrep(amzFbaPrep[1], skus))
    }
    const amzFbaGet = url.match(/^\/amazon\/([^/]+)\/fba-inbound\/([^/]+)$/)
    if (amzFbaGet) return delay(160).then(() => doAmazonFbaGet(amzFbaGet[1], amzFbaGet[2]))
    const amzReportGet = url.match(/^\/amazon\/([^/]+)\/reports\/([^/]+)$/)
    if (amzReportGet) return delay(160).then(() => doAmazonGetReport(amzReportGet[1], amzReportGet[2]))
    const amzSettle = url.match(/^\/amazon\/([^/]+)\/reports\/settlement\/([^/]+)$/)
    if (amzSettle) return delay(200).then(() => doAmazonSettlement(amzSettle[1], amzSettle[2]))
    return delay().then(() => reject('演示模式暂未实现该接口：' + url))
  }

  // 条码 / 多码管理（阶段7，任务 7.1）：新增 / 删除 / 设主码（非 GET，须在 GET 块外处理避免 method 收窄）
  const barcodeAdd = url.match(/^\/catalog\/sku\/([^/]+)\/barcodes$/)
  if (method === 'POST' && barcodeAdd) return delay().then(() => doAddBarcode(barcodeAdd[1], (body ?? {}) as { code?: string; kind?: string }))
  const barcodeDel = url.match(/^\/catalog\/sku\/barcodes\/([^/]+)$/)
  if (method === 'DELETE' && barcodeDel) return delay().then(() => { doDeleteBarcode(barcodeDel[1]); return null })
  const mainSet = url.match(/^\/catalog\/sku\/([^/]+)\/barcodes\/main$/)
  if (method === 'PATCH' && mainSet) return delay().then(() => doSetMainBarcode(mainSet[1], ((body ?? {}) as { barcodeId?: string }).barcodeId ?? ''))

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
    // 渠道店铺新增绑定（任务 6.1）：演示态归入 demo 租户（§3）。
    if (url === '/shops') return delay(120).then(() => doCreateShop((body ?? {}) as { platform: string; name: string; authConfig?: Record<string, unknown> | null }))
    // 采购单新增（阶段6，任务 6.2/6.3）：演示态归入 demo 租户（§21 衍生）。
    if (url === '/purchase-orders') return delay(160).then(() => doCreatePurchaseOrder((body ?? {}) as any))
    // 采购单匹配 / 关联（阶段6，任务 6.4）：自动匹配 / 手动关联 / 解除
    const poAuto = url.match(/^\/purchase-orders\/([^/]+)\/auto-match$/)
    if (poAuto) return delay(160).then(() => doAutoMatch(poAuto[1]))
    const poLink = url.match(/^\/purchase-orders\/([^/]+)\/link$/)
    if (poLink) return delay(160).then(() => doLink(poLink[1], (body as { orderId: string }).orderId))
    const poUnlink = url.match(/^\/purchase-orders\/([^/]+)\/unlink$/)
    if (poUnlink) return delay(160).then(() => doUnlink(poUnlink[1]))
    // 中转仓扫码到货入库（任务 6.6）：快递单号 / SKU 条码 / 采购单号 → 到货登记 + 状态推进 + 自动匹配
    if (url === '/transfer/scan')
      return delay(180).then(() =>
        doScanTransfer(
          (body ?? {}) as {
            warehouseId: string
            scanValue: string
            scanType: 'auto' | 'trackingNo' | 'barcode' | 'purchaseNo'
          },
        ),
      )
    // 生成打包任务（任务 6.7）：幂等，按订单聚合创建
    if (url === '/transfer/pack-tasks/generate') return delay(180).then(() => doGeneratePackTasks())
    // 标记打包（任务 6.7）：推进采购单状态 + 置任务为 packed
    const packDo = url.match(/^\/transfer\/pack-tasks\/([^/]+)\/pack$/)
    if (packDo) return delay(180).then(() => doPack(packDo[1]))
    // 生成跨境面单（任务 6.8）：选渠道 → 建单 + 出 ZPL/预览面单，回填打包任务
    const packLabelDo = url.match(/^\/transfer\/pack-tasks\/([^/]+)\/label$/)
    if (packLabelDo) return delay(200).then(() => doGenerateLabel(packLabelDo[1], (body ?? {}) as { channelCode: string }))
    // 出库闭环 + 物流同步（任务 6.9）：扫码/跨境运单 → fulfill 回写平台 + 出库轨迹节点 → 流转正式跨境物流
    if (url === '/transfer/outbound') return delay(220).then(() => doOutbound(body))
    if (url === '/pricing/compare') return delay(260).then(() => doCompare(body))
    // 履约路由（模式A 自动选渠道，§4/§5）：给定发货上下文 + 策略，自动挑最优渠道
    if (url === '/pricing/route') return delay(280).then(() => doRoute(body))
    // 物流回传 + 轨迹基础（任务 1.6，§3）：建单 / 回传平台 / 轨迹上报（演示态同口径）
    if (url === '/shipments') return delay(160).then(() => doBookShipment(body))
    const shipFulfill = url.match(/^\/shipments\/([^/]+)\/fulfill$/)
    if (shipFulfill) return delay(160).then(() => doFulfillShipment(shipFulfill[1]))
    const shipTrackPost = url.match(/^\/shipments\/([^/]+)\/tracking$/)
    if (shipTrackPost) return delay(160).then(() => doRecordTracking(shipTrackPost[1], body))
    if (url === '/carriers/shipments/compose') return delay(300).then(() => doCompose(body))
    if (url === '/carriers/labels') return delay(200).then(() => doCreateLabel(body))
    if (url === '/carriers/customs/validate') return delay(200).then(() => doValidateCustoms(body))
    if (url === '/carriers/tracking/query') return delay(200).then(() => doTrackQuery(body))
    if (url === '/carriers/address/validate') return delay(180).then(() => doValidateAddress(body))
    if (url === '/carriers/aggregator/track') return delay(200).then(() => doAggregateTrack(body))
    if (url === '/carriers/aggregator/catalog') return delay(120).then(() => doAggregatorCatalog())
    // 收款账务资金操作（§16）：充值 / 授信 / 冻结 / 解冻 / 扣费 / 退款 / 结算
    if (url === '/finance/wallet/recharge') return delay(160).then(() => doRecharge(body))
    if (url === '/finance/wallet/credit-limit') return delay(120).then(() => doSetCreditLimit(body))
    if (url === '/finance/wallet/freeze') return delay(160).then(() => doFreeze(body))
    if (url === '/finance/wallet/unfreeze') return delay(160).then(() => doUnfreeze(body))
    if (url === '/finance/wallet/charge') return delay(160).then(() => doCharge(body))
    if (url === '/finance/wallet/refund') return delay(160).then(() => doRefund(body))
    if (url === '/finance/wallet/settle') return delay(160).then(() => doSettle(body))
    // 商户账单 / 承运商对账（§9/§10）：生成 / 出账 / 结清 / 匹配 / 关闭
    if (url.startsWith('/billing/bills/generate'))
      return delay(160).then(() => { const q = parseQ(url); return aggBills(q.period, q.tenantId) })
    if (url.startsWith('/billing/reconciliations/generate'))
      return delay(160).then(() => { const q = parseQ(url); return aggRecons(q.period) })
    const issueBill = url.match(/^\/billing\/bills\/([^/]+)\/issue$/)
    if (issueBill) return delay(120).then(() => doIssueBill(issueBill[1]))
    const settleBill = url.match(/^\/billing\/bills\/([^/]+)\/settle$/)
    if (settleBill) return delay(120).then(() => doSettleBill(settleBill[1]))
    const matchRec = url.match(/^\/billing\/reconciliations\/([^/]+)\/match$/)
    if (matchRec) return delay(120).then(() => doMatchRecon(matchRec[1]))
    const closeRec = url.match(/^\/billing\/reconciliations\/([^/]+)\/close$/)
    if (closeRec) return delay(120).then(() => doCloseRecon(closeRec[1]))
    if (url === '/pricing/markup-rules') return delay().then(() => createMarkupRule(body))
    if (url === '/pricing/products') return delay().then(() => doCreateProduct(body))
    if (url === '/settings/tdk-rules') return delay().then(() => createTdkRule(body))
    // 品牌图片上传（LOGO / Favicon）：演示态直接回吐压缩后的 dataURL 地址。
    if (url === '/settings/assets') return delay(200).then(() => doUploadAsset(body))
    // 供应商代发（§21）：新建供应商档案 / 新建代发单（演示态内存）
    if (url === '/suppliers') return delay().then(() => doCreateSupplier((body as { name?: string })?.name ?? ''))
    if (url === '/suppliers/orders')
      return delay().then(() =>
        doCreateSupplierOrder((body as { supplierId?: string; orderId?: string }) ?? {}),
      )
    // 仓储 / 海外仓（§15）：仓库 / 入库单 / 上架 / 库存调整 / 拣货波次（演示态内存）
    if (url === '/wms/warehouses')
      return delay().then(() =>
        doCreateWarehouse((body ?? {}) as { name?: string; type?: 'domestic' | 'overseas' | 'transfer'; region?: string }),
      )
    if (url === '/wms/bins')
      return delay().then(() => doCreateBin((body ?? {}) as { warehouseId?: string; code?: string; zone?: string }))
    if (url === '/wms/asns') return delay().then(() => doCreateAsn((body ?? {}) as { warehouseId?: string }))
    const wmsReceive = url.match(/^\/wms\/asns\/([^/]+)\/receive$/)
    if (wmsReceive) return delay(140).then(() => doReceiveAsn(wmsReceive[1]))
    const wmsPutaway = url.match(/^\/wms\/asns\/([^/]+)\/putaway$/)
    if (wmsPutaway)
      return delay(160).then(() => doPutaway(wmsPutaway[1], (body ?? {}) as { skuId?: string; qty?: number; binCode?: string }))
    if (url === '/wms/inventory/adjust')
      return delay(160).then(() => doAdjustInventory((body ?? {}) as { warehouseId?: string; skuId?: string; delta?: number; binId?: string }))
    if (url === '/wms/pick/wave')
      return delay(160).then(() => doCreateWave((body ?? {}) as { warehouseId?: string; orderIds?: string[] }))
    const wmsComplete = url.match(/^\/wms\/picks\/([^/]+)\/complete$/)
    if (wmsComplete) return delay(140).then(() => doCompletePick(wmsComplete[1]))
    // 重置演示态站点设置：清空 localStorage 快照并回到种子数据。
    if (url === '/settings/site/reset') return delay().then(() => doResetSite())
    // RBAC 角色创建 / 用户授权（§22）：演示态内存改写（rbac:manage 权限由真实后端 PermissionsGuard 拦截）。
    if (url === '/rbac/roles')
      return delay(160).then(() =>
        doCreateRole(body as { name?: string; permissions?: string[]; scope?: string }),
      )
    const assignRoles = url.match(/^\/rbac\/users\/([^/]+)\/roles$/)
    if (assignRoles) return delay(160).then(() => doAssignRoles(assignRoles[1], body as { roleIds?: unknown[] }))
    // 理赔新建（§20）：运单 + 类型必填
    if (url === '/claims') return delay(160).then(() => doCreateClaim(body))
    // 风控规则 / 黑名单新建 + 风险订单人工审核（§26）
    if (url === '/risk/rules') return delay(160).then(() => doCreateRiskRule(body))
    if (url === '/risk/blacklist') return delay(160).then(() => doAddBlacklist(body))
    const riskReview = url.match(/^\/risk\/orders\/([^/]+)\/review$/)
    if (riskReview) return delay(160).then(() => doReviewRiskOrder(riskReview[1], body))
    // 开放平台（§28）：客户端 / Webhook 新建
    if (url === '/openapi/clients') return delay(160).then(() => doCreateOpenClient(body))
    if (url === '/openapi/webhooks') return delay(160).then(() => doCreateOpenWebhook(body))
    // 平台凭证管理（§17.2，任务 8.2）：保存（明文入参 → 演示态内存加密存储，不落明文）
    if (url === '/platform-credentials')
      return delay(160).then(() =>
        doSavePlatformCredential((body ?? {}) as { platform: string; fields: Record<string, string> }),
      )
    const openRotate = url.match(/^\/openapi\/clients\/([^/]+)\/rotate$/)
    if (openRotate) return delay(160).then(() => doRotateOpenSecret(openRotate[1]))
    // Amazon SP-API 对接（§29）：FBA 入库计划 / FBA 建仓 / FBM 买运单 / 报表请求（演示态同口径）
    const amzFbaPlan = url.match(/^\/amazon\/([^/]+)\/fba-inbound\/plan$/)
    if (amzFbaPlan) return delay(220).then(() => doAmazonFbaPlan(amzFbaPlan[1], (body ?? {}) as { items?: AmazonInboundItemInput[] }))
    const amzFbaCreate = url.match(/^\/amazon\/([^/]+)\/fba-inbound$/)
    if (amzFbaCreate) return delay(240).then(() => doAmazonFbaCreate(amzFbaCreate[1], (body ?? {}) as { shipmentName: string; plan: AmazonInboundShipmentPlan }))
    const amzShipping = url.match(/^\/amazon\/([^/]+)\/shipping\/label$/)
    if (amzShipping) return delay(240).then(() => doAmazonShippingLabel(amzShipping[1], (body ?? {}) as { amazonOrderId: string }))
    const amzReportReq = url.match(/^\/amazon\/([^/]+)\/reports$/)
    if (amzReportReq) return delay(220).then(() => doAmazonRequestReport(amzReportReq[1], (body ?? {}) as { reportType: string }))
    return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
  }

  // PATCH 集合：理赔状态推进（§20：open→processing→approved/rejected→paid）
  if (method === 'PATCH') {
    const claimStatus = url.match(/^\/claims\/([^/]+)\/status$/)
    if (claimStatus) return delay(140).then(() => doUpdateClaimStatus(claimStatus[1], body))
    // 风控规则更新（启停开关等，§26）
    const riskRule = url.match(/^\/risk\/rules\/([^/]+)$/)
    if (riskRule) return delay(140).then(() => doUpdateRiskRule(riskRule[1], body))
    // 供应商代发（§21）：推进代发单状态（演示态内存）
    const supAdv = url.match(/^\/suppliers\/orders\/([^/]+)\/advance$/)
    if (supAdv)
      return delay(140).then(() =>
        doAdvanceSupplierOrder(supAdv[1], (body as { to?: 'accepted' | 'shipped' | 'done' })?.to ?? 'done'),
      )
    // 采购单状态推进（阶段6，任务 6.2/6.3）：演示态校验状态机（§6）。
    const poStatus = url.match(/^\/purchase-orders\/([^/]+)\/status$/)
    if (poStatus) return delay(140).then(() => doUpdatePurchaseStatus(poStatus[1], (body as { status: string }).status))
    return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
  }

  // PUT 集合：加价规则整条更新（含启停开关）
  if (method === 'PUT') {
    const rule = url.match(/^\/pricing\/markup-rules\/([^/]+)$/)
    if (rule) return delay().then(() => updateMarkupRule(rule[1], body))
    const fx = url.match(/^\/pricing\/fx\/([^/]+)\/([^/]+)$/)
    if (fx) return delay().then(() => updateFxRate(fx[1], fx[2], body))
    const prodUpd = url.match(/^\/pricing\/products\/([^/]+)$/)
    if (prodUpd) return delay().then(() => doUpdateProduct(prodUpd[1], body))
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
    const prodDel = url.match(/^\/pricing\/products\/([^/]+)$/)
    if (prodDel) return delay().then(() => doRemoveProduct(prodDel[1]))
    // 库位（货架编号）删除：仅空库位可删
    const binDel = url.match(/^\/wms\/bins\/([^/]+)$/)
    if (binDel) return delay().then(() => doDeleteBin(binDel[1]))
    // 风控规则 / 黑名单移除（§26）
    const riskRuleDel = url.match(/^\/risk\/rules\/([^/]+)$/)
    if (riskRuleDel) return delay().then(() => doDeleteRiskRule(riskRuleDel[1]))
    const riskBlDel = url.match(/^\/risk\/blacklist\/([^/]+)$/)
    if (riskBlDel) return delay().then(() => doRemoveBlacklist(riskBlDel[1]))
    // 开放平台（§28）：客户端移除
    const openClientDel = url.match(/^\/openapi\/clients\/([^/]+)$/)
    if (openClientDel) return delay().then(() => doDeleteOpenClient(openClientDel[1]))
    // 平台凭证管理（§17.2，任务 8.2）：删除凭证
    const pcDel = url.match(/^\/platform-credentials\/([^/]+)$/)
    if (pcDel) return delay(140).then(() => doDeletePlatformCredential(pcDel[1]))
    // 渠道店铺解绑（任务 6.1）：演示态从内存数组移除（§3）。
    const shopDel = url.match(/^\/shops\/([^/]+)$/)
    if (shopDel) return delay(120).then(() => doDeleteShop(shopDel[1]))
  }

  return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
}

// ===== Amazon SP-API 对接（§29 完整对接：FBA 头程入仓 / FBM 买运单 / 报表对账）=====
// 演示态：与后端 AmazonController 同口径返回，无需真实 AWS 凭证即可体验完整链路。
// 真实对接需开发者账号/应用审核 + AWS SigV4（见后端 AmazonSigV4Signer）。

/** 报表状态跟踪：requestReport 落库为 IN_QUEUE，超过 1.5s 后轮询视为 DONE（模拟异步报表）。 */
const amazonReports = new Map<string, { reportType: string; status: string; createdAt: number }>()
/** 结算文档：报表 DONE 后可据此拉取结算汇总。 */
const amazonReportDocs = new Map<string, string>()

/** 连接健康：演示态直接判定 LWA 可达（真实后端会真正申请令牌）。 */
export function doAmazonHealth(_shopId: string): AmazonHealth {
  return { healthy: true, latencyMs: 118, message: 'LWA reachable (demo)' }
}

/** FBA 入库计划：按发货 SKU/数量，模拟 Amazon 分配目的 FBA 仓与 FNSKU（头程目的）。 */
export function doAmazonFbaPlan(_shopId: string, body: { items?: AmazonInboundItemInput[] }): AmazonInboundShipmentPlan[] {
  const items = body.items ?? []
  if (items.length === 0) return []
  return [
    {
      shipmentPlanId: `PLAN-${Date.now().toString().slice(-8)}`,
      destinationFulfillmentCenterId: 'IND9', // 示例：印第安纳 FBA 仓
      items: items.map((it) => ({
        sellerSku: it.sellerSku,
        quantity: it.quantity,
        fulfillmentNetworkSku: `X${it.sellerSku.slice(0, 6).toUpperCase()}`, // Amazon 分配的 FNSKU
      })),
    },
  ]
}

/** FBA 建仓：按入库计划创建实际货件（状态初始 WORKING）。 */
export function doAmazonFbaCreate(_shopId: string, body: { shipmentName: string; plan: AmazonInboundShipmentPlan }): AmazonInboundShipment {
  const plan = body.plan
  return {
    shipmentId: `FBA${Date.now().toString().slice(-9)}`,
    shipmentName: body.shipmentName || `入仓-${plan.destinationFulfillmentCenterId}`,
    destinationFulfillmentCenterId: plan.destinationFulfillmentCenterId,
    status: 'WORKING',
    items: plan.items.map((it) => ({ sellerSku: it.sellerSku, quantity: it.quantity })),
  }
}

/** FBA 货件查询：演示态以时间推移模拟 WORKING→IN_TRANSIT→DELIVERED（每 3s 升一级）。 */
export function doAmazonFbaGet(_shopId: string, shipmentId: string): AmazonInboundShipment {
  const seed = Number(shipmentId.replace(/\D/g, '').slice(-9) || '0')
  const elapsed = Date.now() - (seed || Date.now())
  const status = elapsed > 9000 ? 'DELIVERED' : elapsed > 3000 ? 'IN_TRANSIT' : 'WORKING'
  return {
    shipmentId,
    shipmentName: `入仓-${shipmentId}`,
    destinationFulfillmentCenterId: 'IND9',
    status,
    items: [{ sellerSku: 'SKU-A', quantity: 10 }],
  }
}

/** FBA 预处理指引：按 SKU 给出 Amazon 要求的预处理方式（演示态固定规则）。 */
export function doAmazonFbaPrep(_shopId: string, skus: string): AmazonPrepInstruction[] {
  return skus
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sku) => ({
      sellerSku: sku,
      prepGuidance: 'NO_PREP_NEEDED',
      prepOwner: 'SELLER',
    }))
}

/** FBM 买运单：经 MerchantFulfillment 购末程面单并取追踪号（FBM 推单用）。 */
export function doAmazonShippingLabel(_shopId: string, _body: { amazonOrderId: string }): AmazonShippingLabel {
  return {
    shipmentId: `SHIP-${Date.now().toString().slice(-8)}`,
    trackingId: `TZ${Date.now().toString().slice(-10)}`, // 追踪号：FBM 推单后回写 Amazon
    labelFileType: 'PDF',
    labelFileContents: 'JVBERi0xLjQKJ...（演示 base64 面单，真实后端返回可用 PDF）',
    downloadUrl: 'https://mock.amazon.com/label/demo',
  }
}

/** 报表请求：落入 IN_QUEUE，并登记文档（用于后续 DONE 与结算汇总）。 */
export function doAmazonRequestReport(_shopId: string, body: { reportType: string }): AmazonReport {
  const reportId = `RPT-${Date.now().toString().slice(-10)}`
  amazonReports.set(reportId, { reportType: body.reportType, status: 'IN_QUEUE', createdAt: Date.now() })
  amazonReportDocs.set(reportId, `DOC-${reportId.slice(4)}`)
  return {
    reportId,
    reportType: body.reportType,
    processingStatus: 'IN_QUEUE',
    createdTime: new Date().toISOString(),
  }
}

/** 报表状态查询：超过 1.5s 后由 IN_QUEUE → DONE（模拟异步报表处理）。 */
export function doAmazonGetReport(_shopId: string, reportId: string): AmazonReport {
  const rec = amazonReports.get(reportId)
  if (!rec) return { reportId, reportType: '', processingStatus: 'FATAL' }
  // 超过 1.5s 视为处理完成
  rec.status = Date.now() - rec.createdAt > 1500 ? 'DONE' : rec.status
  return {
    reportId,
    reportType: rec.reportType,
    processingStatus: rec.status,
    createdTime: new Date(rec.createdAt).toISOString(),
  }
}

/** 结算汇总：下载指定结算文档并解析（演示态生成一份结算平文件并实时聚合）。 */
export function doAmazonSettlement(_shopId: string, documentId: string): AmazonSettlementSummary {
  // 演示态：以文档 ID 派生确定性金额，呈现「总入账 / 总费用 / 净额」结构。
  const seed = Number(documentId.replace(/\D/g, '').slice(-6) || '0')
  const gross = 1280 + (seed % 500) // 总入账（订单收入，单位：商城币种最小展示单位→此处以元计）
  const fee = 96 + (seed % 40) // 总费用（平台佣金/履约费/运费）
  const byType = [
    { type: 'Order', amount: gross },
    { type: 'Commission', amount: -(fee * 0.6) },
    { type: 'FBA Fee', amount: -(fee * 0.4) },
    { type: 'Refund', amount: -(12 + (seed % 20)) },
  ]
  const totalAmount = byType.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0)
  const totalFee = byType.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0)
  return {
    currency: 'USD',
    totalAmount,
    totalFee,
    net: totalAmount - totalFee,
    transactionCount: 18 + (seed % 9),
    byType,
  }
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

// ===== 物流产品 / 费率卡（演示态内存改写，方案 §4 / §23 运营配置后台）=====

let productSeq = 0

/** 列出物流产品（返回副本）。 */
export function doListProducts(): MockLogisticsProduct[] {
  return logisticsProducts.map((p) => ({ ...p }))
}

/** 新建物流产品（承运商与产品名必填）。 */
export function doCreateProduct(body: unknown): MockLogisticsProduct {
  const b = (body ?? {}) as Partial<MockLogisticsProduct> & { carrierCode?: string; name?: string }
  if (!b.carrierCode || !String(b.name ?? '').trim()) {
    return reject('承运商与产品名必填') as unknown as MockLogisticsProduct
  }
  const now = NOW()
  const p: MockLogisticsProduct = {
    id: 'lp_' + Date.now().toString(36) + '_' + ++productSeq,
    tenantId: TENANT_ID,
    carrierCode: b.carrierCode,
    name: String(b.name).trim(),
    legType: b.legType ?? 'direct',
    destZone: b.destZone ?? 'ALL',
    transitDaysMin: Number(b.transitDaysMin ?? 3),
    transitDaysMax: Number(b.transitDaysMax ?? 7),
    volumetricDivisor: Number(b.volumetricDivisor ?? 5000),
    cargoTypeAllowed: b.cargoTypeAllowed ?? 'normal',
    reachableCountries: b.reachableCountries ?? '',
    firstWeightPrice: Number(b.firstWeightPrice ?? 0),
    additionalWeightPrice: Number(b.additionalWeightPrice ?? 0),
    currency: b.currency ?? 'CNY',
    enabled: b.enabled ?? true,
    isDefault: b.isDefault ?? false,
    visible: b.visible ?? true,
    createdAt: now,
    updatedAt: now,
  }
  logisticsProducts.push(p)
  return { ...p }
}

/** 更新物流产品（部分字段覆盖）。 */
export function doUpdateProduct(id: string, body: unknown): MockLogisticsProduct {
  const idx = logisticsProducts.findIndex((p) => p.id === id)
  if (idx < 0) return reject('物流产品不存在') as unknown as MockLogisticsProduct
  const b = (body ?? {}) as Partial<MockLogisticsProduct>
  const cur = logisticsProducts[idx]
  logisticsProducts[idx] = {
    ...cur,
    ...(b.carrierCode !== undefined ? { carrierCode: b.carrierCode } : {}),
    ...(b.name !== undefined ? { name: String(b.name).trim() } : {}),
    ...(b.legType !== undefined ? { legType: b.legType } : {}),
    ...(b.destZone !== undefined ? { destZone: b.destZone } : {}),
    ...(b.transitDaysMin !== undefined ? { transitDaysMin: Number(b.transitDaysMin) } : {}),
    ...(b.transitDaysMax !== undefined ? { transitDaysMax: Number(b.transitDaysMax) } : {}),
    ...(b.volumetricDivisor !== undefined ? { volumetricDivisor: Number(b.volumetricDivisor) } : {}),
    ...(b.cargoTypeAllowed !== undefined ? { cargoTypeAllowed: b.cargoTypeAllowed } : {}),
    ...(b.reachableCountries !== undefined ? { reachableCountries: b.reachableCountries } : {}),
    ...(b.firstWeightPrice !== undefined ? { firstWeightPrice: Number(b.firstWeightPrice) } : {}),
    ...(b.additionalWeightPrice !== undefined ? { additionalWeightPrice: Number(b.additionalWeightPrice) } : {}),
    ...(b.currency !== undefined ? { currency: b.currency } : {}),
    ...(b.enabled !== undefined ? { enabled: Boolean(b.enabled) } : {}),
    ...(b.isDefault !== undefined ? { isDefault: Boolean(b.isDefault) } : {}),
    ...(b.visible !== undefined ? { visible: Boolean(b.visible) } : {}),
    updatedAt: NOW(),
  }
  return { ...logisticsProducts[idx] }
}

/** 删除物流产品。 */
export function doRemoveProduct(id: string): { deleted: boolean } {
  const idx = logisticsProducts.findIndex((p) => p.id === id)
  if (idx < 0) return reject('物流产品不存在') as unknown as { deleted: boolean }
  logisticsProducts.splice(idx, 1)
  return { deleted: true }
}

/** 费率卡成本试算：首重价 + 续重价 × max(0, 计费重kg − 1)（首重 1kg 内含，§4）。 */
export function doProductRate(id: string, weightKg: number): unknown {
  const p = logisticsProducts.find((x) => x.id === id)
  if (!p) return reject('物流产品不存在')
  const w = Math.max(0, weightKg)
  const extra = Math.max(0, w - 1)
  const carrierCost = Number(p.firstWeightPrice) + Number(p.additionalWeightPrice) * extra
  return {
    productId: p.id,
    productName: p.name,
    carrierCode: p.carrierCode,
    weightKg: Number(w.toFixed(3)),
    carrierCost: Number(carrierCost.toFixed(2)),
    currency: p.currency,
    transitDays: `${p.transitDaysMin}-${p.transitDaysMax}天`,
  }
}

/**
 * 运营报表总览（§25 五类指标）：演示态同口径聚合，形状对齐后端 ReportsService。
 * 真实口径（TODO(platform): 2026-11）由 §10 双价列 + §16 ledger + 订单/运单事件聚合。
 */
export function doGetReportDashboard(): ReportDashboard {
  const stages = [
    { stage: 'order→push', label: '下单→推单', avgHours: 2.5, achievedRate: 0.98 },
    { stage: 'push→pickup', label: '推单→揽收', avgHours: 18, achievedRate: 0.95 },
    { stage: 'pickup→sign', label: '揽收→签收', avgHours: 120, achievedRate: 0.93 },
  ]
  const overallAchievedRate = Number(
    Math.pow(stages.reduce((acc, s) => acc * s.achievedRate, 1), 1 / stages.length).toFixed(4),
  )
  const channelName: Record<string, string> = {
    yunexpress: '云途物流',
    dhl: 'DHL 快递',
    '4px': '4PX 递四方',
    yanwen: '燕文物流',
  }
  const logisticsChannels = [
    { carrierCode: 'yunexpress', carrierName: channelName.yunexpress, avgTransitDays: 7.5, exceptionRate: 0.021 },
    { carrierCode: 'dhl', carrierName: channelName.dhl, avgTransitDays: 4.2, exceptionRate: 0.009 },
    { carrierCode: '4px', carrierName: channelName['4px'], avgTransitDays: 11.0, exceptionRate: 0.038 },
    { carrierCode: 'yanwen', carrierName: channelName.yanwen, avgTransitDays: 8.5, exceptionRate: 0.031 },
  ]
  const profitTrend = [
    { period: '2026-05', spread: 182000, totalSell: 1320000, totalCost: 1138000 },
    { period: '2026-06', spread: 205000, totalSell: 1450000, totalCost: 1245000 },
    { period: '2026-07', spread: 198000, totalSell: 1510000, totalCost: 1312000 },
    { period: '2026-08', spread: 231000, totalSell: 1680000, totalCost: 1449000 },
    { period: '2026-09', spread: 246000, totalSell: 1750000, totalCost: 1504000 },
    { period: '2026-10', spread: 268000, totalSell: 1890000, totalCost: 1622000 },
  ]
  const byTenant = [
    { tenantId: 't_demo', tenantName: '示例租户', margin: 142000, marginRate: 0.11 },
    { tenantId: 't_acme', tenantName: 'Acme 贸易', margin: 126000, marginRate: 0.12 },
  ]
  const byChannel = [
    { carrierCode: 'yunexpress', carrierName: channelName.yunexpress, margin: 142000 },
    { carrierCode: 'dhl', carrierName: channelName.dhl, margin: 98000 },
    { carrierCode: '4px', carrierName: channelName['4px'], margin: 18000 },
    { carrierCode: 'yanwen', carrierName: channelName.yanwen, margin: 10000 },
  ]
  const distItems = [
    { carrierCode: 'yunexpress', carrierName: channelName.yunexpress, orderCount: 4200, weightKg: 31000, revenue: 980000, share: 0.52 },
    { carrierCode: 'dhl', carrierName: channelName.dhl, orderCount: 1800, weightKg: 22000, revenue: 560000, share: 0.3 },
    { carrierCode: '4px', carrierName: channelName['4px'], orderCount: 2200, weightKg: 9000, revenue: 210000, share: 0.11 },
    { carrierCode: 'yanwen', carrierName: channelName.yanwen, orderCount: 1400, weightKg: 8000, revenue: 140000, share: 0.07 },
  ]
  const exceptionItems = [
    { type: 'delay', label: '延误', count: 320, rate: 0.032 },
    { type: 'reject', label: '拒收', count: 86, rate: 0.0086 },
    { type: 'lost', label: '丢件', count: 12, rate: 0.0012 },
  ]
  return {
    fulfillmentSla: { stages, overallAchievedRate },
    logisticsSla: { channels: logisticsChannels },
    profit: { trend: profitTrend, byTenant, byChannel },
    channelDistribution: { items: distItems },
    exceptionRate: { items: exceptionItems, overallRate: Number(exceptionItems.reduce((a, i) => a + i.rate, 0).toFixed(4)) },
    generatedAt: new Date().toISOString(),
  }
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
  // 选单关联用模糊搜索（任务 6.10）：平台订单号 / 收件人姓名
  const keyword = u.searchParams.get('keyword')?.trim().toLowerCase()
  const takeRaw = u.searchParams.get('take')
  const take = takeRaw ? Number.parseInt(takeRaw, 10) : 0
  let out = orders
  if (status) out = out.filter((o) => o.status === status)
  if (keyword) {
    out = out.filter(
      (o) =>
        o.platformOrderNo.toLowerCase().includes(keyword) ||
        (o.recipient?.name ?? '').toLowerCase().includes(keyword),
    )
  }
  return take > 0 ? out.slice(0, Math.min(take, 200)) : out
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

/** 物流产品 / 费率卡（对齐后端 LogisticsProductOut，方案 §4 / §23 运营配置后台）。 */
export interface MockLogisticsProduct {
  id: string
  tenantId: string
  carrierCode: string
  name: string
  legType: string
  destZone: string
  transitDaysMin: number
  transitDaysMax: number
  volumetricDivisor: number
  cargoTypeAllowed: string
  reachableCountries: string
  firstWeightPrice: number
  additionalWeightPrice: number
  currency: string
  enabled: boolean
  isDefault: boolean
  visible: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 物流产品种子（演示口径，对齐后端 seed 思路）。
 * 费率卡成本 = 首重价 + 续重价 × max(0, 计费重kg − 1)（首重 1kg 内含，§4）。
 */
const logisticsProducts: MockLogisticsProduct[] = [
  { id: 'lp_seed_1', tenantId: TENANT_ID, carrierCode: 'yunexpress', name: '云途-标准专线', legType: 'direct', destZone: 'ALL', transitDaysMin: 5, transitDaysMax: 9, volumetricDivisor: 5000, cargoTypeAllowed: 'normal', reachableCountries: 'US,GB,DE', firstWeightPrice: 18, additionalWeightPrice: 68, currency: 'CNY', enabled: true, isDefault: true, visible: true, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z' },
  { id: 'lp_seed_2', tenantId: TENANT_ID, carrierCode: 'dhl', name: 'DHL-Express 优先', legType: 'direct', destZone: 'ALL', transitDaysMin: 3, transitDaysMax: 6, volumetricDivisor: 5000, cargoTypeAllowed: 'normal', reachableCountries: '', firstWeightPrice: 65, additionalWeightPrice: 120, currency: 'CNY', enabled: true, isDefault: false, visible: true, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z' },
  { id: 'lp_seed_3', tenantId: TENANT_ID, carrierCode: '4px', name: '4PX-经济小包', legType: 'direct', destZone: 'ZONE_1', transitDaysMin: 7, transitDaysMax: 14, volumetricDivisor: 6000, cargoTypeAllowed: 'normal', reachableCountries: 'US', firstWeightPrice: 12, additionalWeightPrice: 42, currency: 'CNY', enabled: true, isDefault: false, visible: true, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z' },
  { id: 'lp_seed_4', tenantId: TENANT_ID, carrierCode: 'yanwen', name: '燕文-带电专线', legType: 'direct', destZone: 'ALL', transitDaysMin: 6, transitDaysMax: 11, volumetricDivisor: 5000, cargoTypeAllowed: 'battery', reachableCountries: '', firstWeightPrice: 22, additionalWeightPrice: 75, currency: 'CNY', enabled: false, isDefault: false, visible: true, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z' },
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

/** 履约路由（模式A 自动选渠道，§4/§5）：与 doCompare 同口径构建报价，再按策略挑最优。 */
function doRoute(body: unknown): unknown {
  const req = (body ?? {}) as {
    destCountry?: string
    parcels?: { weightKg?: number; lengthCm?: number; widthCm?: number; heightCm?: number }[]
    cargoType?: string
    strategy?: string
  }
  const country = (req.destCountry || 'US').toUpperCase()
  const cargo = req.cargoType || 'normal'
  const strategy = (req.strategy || 'cheapest') as 'cheapest' | 'fastest'

  // 计费重：各箱实重与体积重（长×宽×高/5000）取大后求和（§4.2）
  const parcels = req.parcels && req.parcels.length ? req.parcels : [{ weightKg: 0.5, lengthCm: 20, widthCm: 15, heightCm: 10 }]
  let chargeableKg = 0
  for (const p of parcels) {
    const w = Number(p.weightKg) || 0
    const v = Math.round(((Number(p.lengthCm) || 0) * (Number(p.widthCm) || 0) * (Number(p.heightCm) || 0)) / 5000 * 1000) / 1000
    chargeableKg += Math.max(w, v)
  }
  chargeableKg = Math.round(chargeableKg * 100) / 100

  const banned = BANNED_COUNTRIES.includes(country)
  const quotes: Record<string, unknown>[] = []
  if (!banned) {
    for (const rc of RATE_CARDS) {
      if (cargo === 'sensitive' && !rc.allowSensitive) continue
      const costCny = rc.baseCny + rc.perKgCny * chargeableKg
      const costPrice = Math.round((costCny / USD_CNY) * 100) / 100
      const sellPrice = Math.round(costPrice * (1 + effectiveMarkup(rc.carrierName, cargo) / 100) * 100) / 100
      const [minS, maxS] = rc.transit.split('-')
      quotes.push({
        carrierCode: rc.code,
        productCode: rc.productCode,
        productName: rc.productName,
        chargeableWeightKg: chargeableKg,
        currency: 'USD',
        carrierCost: costPrice,
        sellPrice,
        margin: Math.round((sellPrice - costPrice) * 100) / 100,
        estimatedLeadDaysMin: Number(minS),
        estimatedLeadDaysMax: Number(maxS),
        reachable: true,
        note: cargo === 'battery' && rc.code === 'dhl' ? '带电需走专用渠道，仅作参考' : '',
      })
    }
  }

  const ranked = [...quotes].sort((a, b) => {
    if (strategy === 'fastest') {
      return (a.estimatedLeadDaysMin as number) - (b.estimatedLeadDaysMin as number)
    }
    return (a.sellPrice as number) - (b.sellPrice as number)
  })
  const recommended = ranked[0]
  const alternatives = ranked.slice(1, 4)
  const rationale = recommended
    ? `基于「${strategy === 'fastest' ? '最快' : '最省钱'}」策略，自动推荐 ${recommended.productName}（$${recommended.sellPrice}，时效 ${recommended.estimatedLeadDaysMin}-${recommended.estimatedLeadDaysMax} 工作日），从 ${quotes.length} 条候选中胜出。`
    : `未找到可达渠道（候选经可达性/护栏过滤后无可用项），请检查目的国/货物类型或手动指定渠道。`

  return {
    strategy,
    recommended,
    alternatives,
    rationale,
    layers: {
      l1RateCardHits: RATE_CARDS.length,
      l2Reachable: banned ? [] : RATE_CARDS.map((r) => r.code),
      l3Queried: banned ? [] : RATE_CARDS.map((r) => r.code),
      l3Failed: [],
      l4Returned: quotes.length,
    },
    generatedAt: NOW(),
  }
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
