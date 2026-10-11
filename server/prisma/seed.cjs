/**
 * 演示数据种子（零依赖，运行：node prisma/seed.cjs 或 npm run seed）。
 * 目的：让前端「可视化闭环」有真实可看的数据。
 * 幂等：若 demo 租户已存在订单则跳过，避免重复写入（重置请先清理 demo 租户数据）。
 *
 * 说明：Prisma 的 `prisma db seed` 会自动加载 .env；此处额外做了兜底 .env 解析。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

// ---- 兜底加载 .env（prisma db seed 通常已注入 DATABASE_URL）----------------------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (process.env.DATABASE_URL || !fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()

const prisma = new PrismaClient()

/** 计费重（克）：实重 vs 体积重取大；体积重 = 长*宽*高 / 抛比系数(5000) */
function billableWeightG(weightG, l, w, h) {
  if (!l || !w || !h) return weightG
  const volWeight = (l * w * h) / 5000 // 得到公斤，*1000 转克
  return Math.max(weightG, Math.round(volWeight * 1000))
}

async function main() {
  let tenant = await prisma.tenant.findUnique({ where: { code: 'demo' } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: '演示租户（深圳货代示例）', code: 'demo' },
    })
  }
  const tid = tenant.id

  const existing = await prisma.order.count({ where: { tenantId: tid } })
  if (existing > 0) {
    console.log('[seed] demo 租户已有订单数据，跳过（如需重置请先清理 demo 租户订单/明细/事件）。')
    return
  }

  // ---- 店铺（渠道来源）：Shopify / Amazon / Mock（Mock 店可被「拉单」按钮实时生成订单）----
  const shopShopify = await prisma.shop.create({
    data: {
      tenantId: tid,
      platform: 'shopify',
      name: 'Shopify 美国店',
      authConfig: { apiKey: 'demo', accessToken: 'demo' },
    },
  })
  const shopAmazon = await prisma.shop.create({
    data: {
      tenantId: tid,
      platform: 'amazon',
      name: 'Amazon US 店',
      authConfig: { lwaClientId: 'demo', lwaClientSecret: 'demo' },
    },
  })
  await prisma.shop.create({
    data: {
      tenantId: tid,
      platform: 'mock',
      name: 'Mock 演示店（点「拉单」可实时生成订单）',
      authConfig: {},
    },
  })

  // ---- 商品（SPU）与内部 SKU（含平台↔内部↔供应商三段映射 + 重量/体积）----
  const p1 = await prisma.product.create({
    data: { tenantId: tid, title: '无线蓝牙耳机', spu: 'BT-EARPHONE' },
  })
  const p2 = await prisma.product.create({
    data: { tenantId: tid, title: '硅胶手机壳', spu: 'CASE-01' },
  })
  const p3 = await prisma.product.create({
    data: { tenantId: tid, title: '便携充电宝', spu: 'POWER-BANK' },
  })

  const s1 = await prisma.sku.create({
    data: {
      tenantId: tid,
      productId: p1.id,
      code: 'SKU-BT-001',
      platformSku: 'SHOPIFY-BT-001',
      supplierSku: 'SUP-BT-001',
      barcode: '123456000001',
      weightG: 120,
      lengthCm: 10,
      widthCm: 8,
      heightCm: 4,
    },
  })
  const s2 = await prisma.sku.create({
    data: {
      tenantId: tid,
      productId: p2.id,
      code: 'SKU-CASE-001',
      platformSku: 'SHOPIFY-CASE-001',
      supplierSku: 'SUP-CASE-001',
      barcode: '123456000002',
      weightG: 60,
      lengthCm: 18,
      widthCm: 9,
      heightCm: 2,
    },
  })
  const s3 = await prisma.sku.create({
    data: {
      tenantId: tid,
      productId: p3.id,
      code: 'SKU-PB-001',
      platformSku: 'SHOPIFY-PB-001',
      supplierSku: 'SUP-PB-001',
      barcode: '123456000003',
      weightG: 240,
      lengthCm: 12,
      widthCm: 7,
      heightCm: 3,
    },
  })

  console.log(
    `[seed] 计费重示例 SKU-BT-001: 实重 ${s1.weightG}g / 体积重 ${Math.round(((s1.lengthCm * s1.widthCm * s1.heightCm) / 5000) * 1000)}g → 取大 ${billableWeightG(s1.weightG, s1.lengthCm, s1.widthCm, s1.heightCm)}g`,
  )

  const now = Date.now()
  const day = 1000 * 60 * 60 * 24

  /**
   * 订单模板：覆盖状态机多个节点，便于演示「审单 → 转移 → 逆向」。
   * status 对齐 OrderStatus（见 order.constants.ts）。events 为审计轨迹。
   */
  const orderSeeds = [
    {
      platformOrderNo: 'SF-20261001-0001',
      shopId: shopShopify.id,
      status: 'pending_review',
      recipient: { name: '张三', phone: '13800000001', country: 'US', city: 'Los Angeles', address1: '123 Demo St', zip: '90001' },
      totalAmount: 39.9, currency: 'USD',
      createdAt: new Date(now - 5 * day),
      items: [{ skuId: s1.id, quantity: 1, price: 39.9 }],
      events: [{ type: 'created', from: null, to: 'pending_review', operator: 'system' }],
    },
    {
      platformOrderNo: 'SF-20261002-0002',
      shopId: shopShopify.id,
      status: 'pending_review',
      recipient: { name: '李四', phone: '13900000002', country: 'US', city: 'New York', address1: '456 Demo Ave', zip: '10001' },
      totalAmount: 79.8, currency: 'USD',
      createdAt: new Date(now - 4 * day),
      items: [
        { skuId: s2.id, quantity: 2, price: 19.9 },
        { skuId: s1.id, quantity: 1, price: 39.9 },
      ],
      events: [{ type: 'created', from: null, to: 'pending_review', operator: 'system' }],
    },
    {
      platformOrderNo: 'SF-20261003-0003',
      shopId: shopShopify.id,
      status: 'approved',
      recipient: { name: '王五', phone: '13700000003', country: 'GB', city: 'London', address1: '789 Demo Rd', zip: 'SW1A 1AA' },
      totalAmount: 19.9, currency: 'GBP',
      createdAt: new Date(now - 3 * day),
      items: [{ skuId: s2.id, quantity: 1, price: 19.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->approved', from: 'pending_review', to: 'approved', operator: 'op1' },
      ],
    },
    {
      platformOrderNo: 'AMZ-20261004-0004',
      shopId: shopAmazon.id,
      status: 'pushed',
      recipient: { name: 'Alice', phone: '12000000004', country: 'DE', city: 'Berlin', address1: '10 Demo Str', zip: '10115' },
      totalAmount: 59.9, currency: 'EUR',
      createdAt: new Date(now - 3 * day),
      items: [{ skuId: s3.id, quantity: 1, price: 59.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->approved', from: 'pending_review', to: 'approved', operator: 'op1' },
        { type: 'approved->pushed', from: 'approved', to: 'pushed', operator: 'op2' },
      ],
    },
    {
      platformOrderNo: 'AMZ-20261005-0005',
      shopId: shopAmazon.id,
      status: 'in_transit',
      recipient: { name: 'Bob', phone: '13000000005', country: 'FR', city: 'Paris', address1: '20 Demo Rue', zip: '75001' },
      totalAmount: 99.9, currency: 'EUR',
      createdAt: new Date(now - 6 * day),
      items: [
        { skuId: s1.id, quantity: 1, price: 39.9 },
        { skuId: s3.id, quantity: 1, price: 59.9 },
      ],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->approved', from: 'pending_review', to: 'approved', operator: 'op1' },
        { type: 'approved->pushed', from: 'approved', to: 'pushed', operator: 'op2' },
        { type: 'pushed->picked_up', from: 'pushed', to: 'picked_up', operator: 'wh1' },
        { type: 'picked_up->in_transit', from: 'picked_up', to: 'in_transit', operator: 'carrier' },
      ],
    },
    {
      platformOrderNo: 'SF-20261006-0006',
      shopId: shopShopify.id,
      status: 'delivered',
      recipient: { name: '陈六', phone: '13600000006', country: 'CA', city: 'Toronto', address1: '30 Demo Blvd', zip: 'M5H 2N2' },
      totalAmount: 119.9, currency: 'USD',
      createdAt: new Date(now - 8 * day),
      items: [{ skuId: s3.id, quantity: 2, price: 59.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->approved', from: 'pending_review', to: 'approved', operator: 'op1' },
        { type: 'approved->pushed', from: 'approved', to: 'pushed', operator: 'op2' },
        { type: 'pushed->picked_up', from: 'pushed', to: 'picked_up', operator: 'wh1' },
        { type: 'picked_up->in_transit', from: 'picked_up', to: 'in_transit', operator: 'carrier' },
        { type: 'in_transit->customs_clearing', from: 'in_transit', to: 'customs_clearing', operator: 'carrier' },
        { type: 'customs_clearing->out_for_delivery', from: 'customs_clearing', to: 'out_for_delivery', operator: 'carrier' },
        { type: 'out_for_delivery->delivered', from: 'out_for_delivery', to: 'delivered', operator: 'carrier' },
      ],
    },
    {
      platformOrderNo: 'SF-20261007-0007',
      shopId: shopShopify.id,
      status: 'completed',
      recipient: { name: '赵七', phone: '13500000007', country: 'AU', city: 'Sydney', address1: '40 Demo Ln', zip: '2000' },
      totalAmount: 159.9, currency: 'USD',
      createdAt: new Date(now - 10 * day),
      items: [{ skuId: s1.id, quantity: 3, price: 39.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->approved', from: 'pending_review', to: 'approved', operator: 'op1' },
        { type: 'approved->pushed', from: 'approved', to: 'pushed', operator: 'op2' },
        { type: 'pushed->picked_up', from: 'pushed', to: 'picked_up', operator: 'wh1' },
        { type: 'picked_up->in_transit', from: 'picked_up', to: 'in_transit', operator: 'carrier' },
        { type: 'in_transit->customs_clearing', from: 'in_transit', to: 'customs_clearing', operator: 'carrier' },
        { type: 'customs_clearing->out_for_delivery', from: 'customs_clearing', to: 'out_for_delivery', operator: 'carrier' },
        { type: 'out_for_delivery->delivered', from: 'out_for_delivery', to: 'delivered', operator: 'carrier' },
        { type: 'delivered->completed', from: 'delivered', to: 'completed', operator: 'system' },
      ],
    },
    {
      platformOrderNo: 'SF-20261008-0008',
      shopId: shopShopify.id,
      status: 'rejected',
      recipient: { name: '孙八', phone: '13800000008', country: 'US', city: 'Los Angeles', address1: '123 Demo St', zip: '90001' },
      totalAmount: 29.9, currency: 'USD',
      createdAt: new Date(now - 2 * day),
      items: [{ skuId: s2.id, quantity: 1, price: 29.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->rejected', from: 'pending_review', to: 'rejected', operator: 'op1' },
      ],
    },
    {
      platformOrderNo: 'AMZ-20261009-0009',
      shopId: shopAmazon.id,
      status: 'cancelled',
      recipient: { name: '周九', phone: '13000000009', country: 'JP', city: 'Tokyo', address1: '50 Demo Cho', zip: '100-0001' },
      totalAmount: 49.9, currency: 'JPY',
      createdAt: new Date(now - 1 * day),
      items: [{ skuId: s1.id, quantity: 1, price: 49.9 }],
      events: [
        { type: 'created', from: null, to: 'pending_review', operator: 'system' },
        { type: 'pending_review->cancelled', from: 'pending_review', to: 'cancelled', operator: 'op1' },
      ],
      reverse: { type: 'cancel', status: 'done', cause: '买家下单后取消' },
    },
  ]

  for (const o of orderSeeds) {
    const created = await prisma.order.create({
      data: {
        tenantId: tid,
        shopId: o.shopId,
        platformOrderNo: o.platformOrderNo,
        status: o.status,
        recipient: o.recipient,
        totalAmount: o.totalAmount,
        currency: o.currency,
        createdAt: o.createdAt,
      },
      select: { id: true },
    })

    await prisma.orderItem.createMany({
      data: o.items.map((it) => ({
        tenantId: tid,
        orderId: created.id,
        skuId: it.skuId,
        quantity: it.quantity,
        price: it.price,
      })),
    })

    await prisma.orderEvent.createMany({
      data: o.events.map((e) => ({
        tenantId: tid,
        orderId: created.id,
        type: e.type,
        from: e.from,
        to: e.to,
        operator: e.operator,
        createdAt: o.createdAt,
      })),
    })

    if (o.reverse) {
      await prisma.reverseOrder.create({
        data: {
          tenantId: tid,
          orderId: created.id,
          type: o.reverse.type,
          status: o.reverse.status,
          cause: o.reverse.cause,
        },
      })
    }
  }

  console.log(`[seed] 完成：租户 demo，店铺 3，商品 3，SKU 3，订单 ${orderSeeds.length}（覆盖 pending_review→completed / rejected / cancelled）。`)
}

main()
  .catch((e) => {
    console.error('[seed] 失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
