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
const reject = (msg: string) => Promise.reject(new Error(msg))
let seq = 100

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
    if (url === '/pricing/markup-rules') return delay().then(() => createMarkupRule(body))
    return delay().then(() => reject('演示模式不支持该请求：' + method + ' ' + url))
  }

  // PUT 集合：加价规则整条更新（含启停开关）
  if (method === 'PUT') {
    const rule = url.match(/^\/pricing\/markup-rules\/([^/]+)$/)
    if (rule) return delay().then(() => updateMarkupRule(rule[1], body))
    const fx = url.match(/^\/pricing\/fx\/([^/]+)\/([^/]+)$/)
    if (fx) return delay().then(() => updateFxRate(fx[1], fx[2], body))
  }

  // DELETE 集合：删除加价规则
  if (method === 'DELETE') {
    const rule = url.match(/^\/pricing\/markup-rules\/([^/]+)$/)
    if (rule) return delay().then(() => deleteMarkupRule(rule[1]))
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
