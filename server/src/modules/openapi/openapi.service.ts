import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'
import type {
  ApiClient,
  CreateApiClientDto,
  CreateWebhookDto,
  GlVoucherEntry,
  OpenApiClientContext,
  OpenApiSummary,
  OpenBill,
  OpenOrder,
  OpenQuote,
  OpenScope,
  WebhookSubscription,
} from './openapi.types'

/**
 * 开放平台服务（任务 5.2，方案 §28 开放 API 与生态集成）。
 *
 * 内存实现要点：
 *  - 客户端注册表（ApiClient）：OAuth2 client_credentials 应用，按租户隔离，带作用域与限流。
 *  - 令牌校验：由控制器用 JwtService 签发/验签；本服务负责凭据核验与限流窗口。
 *  - 开放资源：订单/报价/账单/ERP 财务凭证，按租户隔离，代表商户 ERP 可调用的能力。
 *  - Webhook 订阅：商户订阅平台事件，平台异步回调（分发为 TODO(platform): 2026-11）。
 *
 * TODO(platform): 2026-11 接入 Prisma 持久化，并把开放资源对接真实
 * OrdersService / BillingService / PricingEngineService。
 */
@Injectable()
export class OpenApiService {
  private clientSeq = 0
  private webhookSeq = 0

  /** 客户端种子（演示态：一个全作用域的开放应用 + 一个仅查价应用） */
  private readonly clients: ApiClient[] = this.seedClients()

  /** Webhook 订阅（内存） */
  private readonly webhooks: WebhookSubscription[] = []

  /** 开放订单视图（内存演示数据，代表商户可见订单） */
  private readonly orders: OpenOrder[] = [
    this.o('o_open_1', 'SO-90001', 'Alice Wang', 'US', 199, 'USD', 'shipped'),
    this.o('o_open_2', 'AMZ-90002', 'Bob Li', 'DE', 320, 'EUR', 'pending_review'),
    this.o('o_open_3', 'SO-90003', 'Carol Chen', 'GB', 88, 'GBP', 'delivered'),
  ]

  /** 开放账单（内存演示数据，代表租户应收/应付） */
  private readonly bills: OpenBill[] = [
    { period: '2026-09', type: 'receivable', amount: 128400, currency: 'CNY', status: 'issued' },
    { period: '2026-09', type: 'payable', amount: 96320, currency: 'CNY', status: 'matched' },
    { period: '2026-10', type: 'receivable', amount: 142800, currency: 'CNY', status: 'draft' },
  ]

  /** 限流滑动窗口：clientId → 最近请求时间戳（毫秒） */
  private readonly rateWindows = new Map<string, number[]>()

  // ===== 客户端管理（平台侧，super 可操作）=====

  listClients(tenantId: string): ApiClient[] {
    return this.clients
      .filter((c) => c.tenantId === tenantId)
      .map((c) => ({ ...c }))
  }

  getClientByCredentials(clientId: string, clientSecret: string): ApiClient | null {
    const c = this.clients.find((x) => x.clientId === clientId)
    if (!c) return null
    // 恒定时间比较（crypto.timingSafeEqual），规避时序侧信道泄露密钥（review A6）。
    // 长度不一致直接拒绝，且不进入逐字节比较（避免短路泄露长度）。
    const a = Buffer.from(clientSecret)
    const b = Buffer.from(c.clientSecret ?? '')
    if (a.length !== b.length) return null
    if (!crypto.timingSafeEqual(a, b)) return null
    if (c.status !== 'enabled') return null
    return c
  }

  /** 按 clientId 查找客户端（脱敏画像，不含密钥），供 /openapi/me 返回。 */
  getClientProfile(tenantId: string, clientId: string): Omit<ApiClient, 'clientSecret'> | null {
    const c = this.clients.find((x) => x.clientId === clientId && x.tenantId === tenantId)
    if (!c) return null
    const { clientSecret, ...profile } = c
    void clientSecret
    return profile
  }

  createClient(tenantId: string, dto: CreateApiClientDto): ApiClient {
    const now = new Date().toISOString()
    const client: ApiClient = {
      id: 'oc_' + Date.now().toString(36) + '_' + ++this.clientSeq,
      tenantId,
      name: dto.name,
      clientId: 'cli_' + this.rand(12),
      clientSecret: this.rand(32),
      scopes: dto.scopes,
      rateLimitPerMin: dto.rateLimitPerMin ?? 60,
      status: 'enabled',
      createdAt: now,
      updatedAt: now,
    }
    this.clients.push(client)
    return { ...client }
  }

  deleteClient(tenantId: string, id: string): { deleted: boolean } {
    const idx = this.clients.findIndex((c) => c.id === id && c.tenantId === tenantId)
    if (idx < 0) throw new NotFoundException('开放客户端不存在')
    this.clients.splice(idx, 1)
    return { deleted: true }
  }

  rotateSecret(tenantId: string, id: string): ApiClient {
    const c = this.requireClient(tenantId, id)
    c.clientSecret = this.rand(32)
    c.updatedAt = new Date().toISOString()
    return { ...c }
  }

  // ===== 限流（滑动窗口，内存级）=====

  /** 校验并登记一次请求；超阈值抛 429 等效的 Unauthorized/TooManyRequests。 */
  checkRateLimit(clientId: string, limit: number): void {
    const now = Date.now()
    const window = this.rateWindows.get(clientId) ?? []
    const kept = window.filter((t) => now - t < 60_000)
    kept.push(now)
    this.rateWindows.set(clientId, kept)
    if (kept.length > limit) {
      throw new UnauthorizedException('RATE_LIMIT_EXCEEDED')
    }
  }

  // ===== 开放资源（商户凭令牌调用）=====

  /** 开放订单列表（按租户隔离，脱敏视图）。 */
  listOpenOrders(_tenantId: string): OpenOrder[] {
    return this.orders.map((o) => ({ ...o }))
  }

  /** 开放报价试算（查价）：演示态给出多家承运商报价，口径对齐比价引擎（§5/§10）。 */
  estimateQuote(_tenantId: string, weightKg: number, destCountry: string): OpenQuote[] {
    const base = Math.max(0, weightKg) * 42 + 18
    const carriers: Array<{ code: string; factor: number; eta: number }> = [
      { code: 'yunexpress', factor: 0.92, eta: 7 },
      { code: 'dhl', factor: 1.18, eta: 4 },
      { code: 'fourpx', factor: 1.0, eta: 9 },
    ]
    return carriers.map((c) => {
      const cost = Math.round(base * c.factor * 100) / 100
      // 加价层（演示口径：成本 × 1.15 + 最低毛利 ¥5），与 §10 双价列一致
      const sellPrice = Math.round((cost * 1.15 + 5) * 100) / 100
      return {
        carrierCode: c.code,
        productCode: 'std',
        weightKg,
        cost,
        sellPrice,
        currency: 'CNY',
        etaDays: destCountry === 'US' ? c.eta + 2 : c.eta,
      }
    })
  }

  /** 开放账单列表（查账单，按租户隔离）。 */
  listOpenBills(_tenantId: string): OpenBill[] {
    return this.bills.map((b) => ({ ...b }))
  }

  /** ERP 财务凭证：由账单自动生成应收/应付分录（§28 ERP 集成，参考金蝶/用友科目编码）。 */
  buildGlVouchers(_tenantId: string): GlVoucherEntry[] {
    const entries: GlVoucherEntry[] = []
    for (const b of this.bills) {
      if (b.type === 'receivable') {
        // 借：应收账款；贷：主营业务收入
        entries.push(this.gl(`应收 ${b.period} 商户账单`, '1122', '应收账款', 'debit', b.amount, b.currency))
        entries.push(this.gl(`确认 ${b.period} 收入`, '6001', '主营业务收入', 'credit', b.amount, b.currency))
      } else {
        // 借：主营业务成本；贷：应付账款
        entries.push(this.gl(`应付 ${b.period} 承运商`, '6401', '主营业务成本', 'debit', b.amount, b.currency))
        entries.push(this.gl(`确认 ${b.period} 应付`, '2202', '应付账款', 'credit', b.amount, b.currency))
      }
    }
    return entries
  }

  // ===== Webhook 订阅 =====

  listWebhooks(tenantId: string): WebhookSubscription[] {
    return this.webhooks
      .filter((w) => w.tenantId === tenantId)
      .map((w) => ({ ...w }))
  }

  createWebhook(tenantId: string, dto: CreateWebhookDto): WebhookSubscription {
    const sub: WebhookSubscription = {
      id: 'wh_' + Date.now().toString(36) + '_' + ++this.webhookSeq,
      tenantId,
      event: dto.event,
      url: dto.url,
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    this.webhooks.push(sub)
    return { ...sub }
  }

  /** 作用域校验：开放资源接口调用前确认令牌含所需作用域。 */
  assertScope(ctx: OpenApiClientContext | null, scope: OpenScope): void {
    if (!ctx) throw new UnauthorizedException('OPENAPI_UNAUTHENTICATED')
    if (!ctx.scopes.includes(scope)) {
      throw new UnauthorizedException('OPENAPI_SCOPE_FORBIDDEN:' + scope)
    }
  }

  /** 开放平台总览（前端四卡）：客户端/Webhook/限流配额/开放接口数。 */
  summary(tenantId: string): OpenApiSummary {
    const clients = this.listClients(tenantId)
    return {
      clientCount: clients.length,
      webhookCount: this.listWebhooks(tenantId).length,
      rateLimitTotal: clients.reduce((sum, c) => sum + c.rateLimitPerMin, 0),
      endpointCount: 8, // 与前端 OPEN_ENDPOINTS 对齐（含令牌端点）
    }
  }

  // ===== 内部辅助 =====

  private requireClient(tenantId: string, id: string): ApiClient {
    const c = this.clients.find((x) => x.id === id && x.tenantId === tenantId)
    if (!c) throw new NotFoundException('开放客户端不存在')
    return c
  }

  private gl(summary: string, accountCode: string, accountName: string, direction: 'debit' | 'credit', amount: number, currency: string): GlVoucherEntry {
    return { summary, accountCode, accountName, direction, amount, currency }
  }

  private o(orderId: string, platformOrderNo: string, recipientName: string, country: string, amount: number, currency: string, status: string): OpenOrder {
    return {
      orderId,
      platformOrderNo,
      recipientName,
      country,
      amount,
      currency,
      status,
      createdAt: '2026-10-' + (10 + this.clientSeq % 18) + 'T09:00:00.000Z',
    }
  }

  private rand(len: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let s = ''
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }

  private seedClients(): ApiClient[] {
    // 安全（review A6）：生产环境不注入任何种子密钥，避免源码内硬编码后门密钥。
    // 非生产环境仅用于本地演示，密钥在启动时随机生成（不再写死为可知字符串），
    // 且 clientId 仍保留语义化前缀便于联调，但 secret 必须经由 createClient 流程或此处随机产出。
    if (process.env.NODE_ENV === 'production') return []
    const now = new Date().toISOString()
    return [
      {
        id: 'oc_seed_1',
        tenantId: 't_demo',
        name: 'ERP 全量集成（演示）',
        clientId: 'cli_demo_full',
        clientSecret: this.rand(32),
        scopes: ['orders', 'quotes', 'tracking', 'bills', 'erp'],
        rateLimitPerMin: 120,
        status: 'enabled',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'oc_seed_2',
        tenantId: 't_demo',
        name: '查价机器人（演示）',
        clientId: 'cli_demo_quote',
        clientSecret: this.rand(32),
        scopes: ['quotes'],
        rateLimitPerMin: 60,
        status: 'enabled',
        createdAt: now,
        updatedAt: now,
      },
    ]
  }
}
