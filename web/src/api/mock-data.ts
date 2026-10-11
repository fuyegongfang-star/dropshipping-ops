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
  { id: 'p1', tenantId: TENANT_ID, title: '无线蓝牙耳机 Pro', spu: 'SPU-EARBUD', createdAt: '2026-09-02T08:00:00.000Z' },
  { id: 'p2', tenantId: TENANT_ID, title: '便携充电宝 20000mAh', spu: 'SPU-POWER', createdAt: '2026-09-03T08:00:00.000Z' },
  { id: 'p3', tenantId: TENANT_ID, title: '智能手环 S2', spu: 'SPU-BAND', createdAt: '2026-09-04T08:00:00.000Z' },
  { id: 'p4', tenantId: TENANT_ID, title: '折叠手机支架', spu: 'SPU-STAND', createdAt: '2026-09-06T08:00:00.000Z' },
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

let orders: MockOrder[] = seedOrders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })), events: [...o.events] }))

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
const reject = (msg: string) => Promise.reject(new Error(msg))
let seq = 100

// ===== 路由分发 =====
/** mock 模式下 http.ts 的唯一入口：按 method + url 返回对应数据或执行状态变更。 */
export function mockRouter(method: string, url: string): Promise<unknown> {
  // GET 集合
  if (method === 'GET') {
    if (url === '/tenants') return delay().then(() => tenants)
    if (url === '/shops') return delay().then(() => shops)
    if (url === '/channels/platforms') return delay().then(() => ['shopify', 'amazon', 'mock'])
    if (url === '/catalog/products') return delay().then(() => products)
    if (url.startsWith('/catalog/skus')) return delay().then(() => filterSkus(url))
    if (url === '/orders') return delay().then(() => orders)
    if (url.startsWith('/orders?')) return delay().then(() => filterOrders(url))
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
    if (url === '/tenants') return delay().then(() => reject('演示模式不支持新建租户'))
  }

  return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
}

// ===== 过滤 =====
function filterSkus(url: string): MockSku[] {
  const u = new URL(url, 'http://mock')
  const ps = u.searchParams.get('platformSku')
  const ss = u.searchParams.get('supplierSku')
  return skus.filter(
    (s) => (!ps || s.platformSku === ps) && (!ss || s.supplierSku === ss),
  )
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
  o.events.push({ id: id + '-rv' + seq++, type: passed ? '审单通过' : '审单驳回', operator: 'demo', createdAt: NOW() })
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
    o.events.push({ id: id + '-tr' + seq++, type: '状态转移 → ' + to, operator: 'demo', createdAt: NOW() })
    o.status = to
  }
  return { changed }
}

function doReverse(id: string): unknown {
  const o = orders.find((x) => x.id === id)
  if (!o) return reject('订单不存在')
  const reverseId = 'rev' + seq++
  o.events.push({ id: id + '-rs' + seq++, type: '发起逆向流程', operator: 'demo', createdAt: NOW() })
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
