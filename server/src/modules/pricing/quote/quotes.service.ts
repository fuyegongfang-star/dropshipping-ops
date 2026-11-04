/**
 * 试算单服务（任务 3.7，方案 §4.6 试算→订单联动；任务 11.2 落库 quotes 表）。
 *
 * 职责：试算结果持久化到 PostgreSQL（`quotes` 表，租户隔离）、quote_id 生成、
 * 有效期校验、商户渠道自选（selectedProductCode）。试算价≈实收价的锁价契约由本表承载。
 *
 * 设计（11.2）：
 * - 原内存 Map 升级为 Prisma 持久化；所有读写显式带 tenantId（行级隔离，与 §0/§17 一致）；
 * - 完整报价结果(results) 存入 rateSnapshot JSON，回查时原样重建 RateQuote[]，保证前端/引擎可复现；
 * - 锁定价(carrierCost/sellPrice/margin) 取自「自选产品」或首条结果，落库便于后续对账与订单引用；
 * - 过期判定既看 status 也看 expiresAt，取单时若已过期则回写 EXPIRED 后抛错（诚实失败）。
 *
 * 负责人：夜间自动开发引擎 ｜ 新增 DB 持久化于 2026-11-04 夜间批次（11.2）
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { AppLogger } from '../../../common/logger/app.logger'
import { BusinessException } from '../../../common/response/business.exception'
import { PrismaService } from '../../../database/prisma.service'
import { CompareRequest } from '../pricing.types'
import { RateQuote } from '../../carriers/dto/rate.dto'
import { Quote, QuoteStatus, QUOTE_TTL_MS } from './quote.types'

@Injectable()
export class QuotesService {
  constructor(
    private readonly logger: AppLogger,
    private readonly prisma: PrismaService,
    private readonly ttlMs: number = QUOTE_TTL_MS,
  ) {}

  /** 创建试算单：试算结果（已加价）落库并生成 quote_id + 有效期（§4.6） */
  async create(tenantId: string, req: CompareRequest, results: RateQuote[], currency: string): Promise<Quote> {
    const now = Date.now()
    const selected = results[0]
    const row = await this.prisma.quote.create({
      data: {
        id: randomUUID(),
        tenantId,
        productId: selected?.productCode ?? '',
        inputSnapshot: req as unknown as Prisma.InputJsonValue,
        rateSnapshot: { results } as unknown as Prisma.InputJsonValue,
        carrierCost: new Prisma.Decimal(selected?.carrierCost ?? 0),
        sellPrice: new Prisma.Decimal(selected?.sellPrice ?? 0),
        margin: new Prisma.Decimal(selected?.margin ?? 0),
        currency,
        status: QuoteStatus.ACTIVE,
        selectedProductCode: null,
        expiresAt: new Date(now + this.ttlMs),
      },
    })
    this.logger.debug(`[Quote] 创建试算单 ${row.id} tenant=${tenantId} items=${results.length}`)
    return this.toQuote(row)
  }

  /** 取试算单：租户隔离 + 过期校验（§4.6）；过期则标记 EXPIRED 后抛错 */
  async get(tenantId: string, id: string): Promise<Quote> {
    const row = await this.prisma.quote.findUnique({ where: { id } })
    if (!row || row.tenantId !== tenantId) {
      throw new BusinessException('QUOTE_NOT_FOUND', `试算单不存在: ${id}`, HttpStatus.NOT_FOUND)
    }
    const quote = this.toQuote(row)
    if (this.isExpired(quote)) {
      // 过期则回写状态，便于后续审计与失效统计
      await this.prisma.quote.update({ where: { id }, data: { status: QuoteStatus.EXPIRED } }).catch(() => undefined)
      throw new BusinessException('QUOTE_EXPIRED', `试算单已过期: ${id}`, HttpStatus.GONE)
    }
    return quote
  }

  /** 商户渠道自选：标记 selectedProductCode（仅允许选试算列表内产品，§4.0 模式B） */
  async select(tenantId: string, id: string, productCode: string): Promise<Quote> {
    const quote = await this.get(tenantId, id) // 先做租户/过期校验
    const hit = quote.results.find((r) => r.productCode === productCode)
    if (!hit) {
      throw new BusinessException('QUOTE_ITEM_NOT_FOUND', `试算单不含该产品: ${productCode}`, HttpStatus.BAD_REQUEST)
    }
    // 锁定价随自选产品刷新（试算即所见、下单即所付，§4.6 / §10）
    await this.prisma.quote.update({
      where: { id },
      data: {
        selectedProductCode: productCode,
        productId: productCode,
        carrierCost: new Prisma.Decimal(hit.carrierCost ?? 0),
        sellPrice: new Prisma.Decimal(hit.sellPrice ?? 0),
        margin: new Prisma.Decimal(hit.margin ?? 0),
      },
    })
    this.logger.debug(`[Quote] 试算单 ${id} 选定产品 ${productCode}`)
    quote.selectedProductCode = productCode
    return quote
  }

  /** 是否过期（状态或有效期任一判过期） */
  isExpired(q: Quote): boolean {
    return q.status === QuoteStatus.EXPIRED || new Date(q.expiresAt).getTime() < Date.now()
  }

  /** DB 行 → 内存 Quote（results 由 rateSnapshot 完整重建，保证可复现） */
  private toQuote(row: {
    id: string
    tenantId: string
    inputSnapshot: Prisma.JsonValue
    rateSnapshot: Prisma.JsonValue
    currency: string
    status: string
    selectedProductCode: string | null
    expiresAt: Date
    createdAt: Date
    productId: string
    carrierCost: Prisma.Decimal
    sellPrice: Prisma.Decimal
    margin: Prisma.Decimal
  }): Quote {
    const snap = (row.rateSnapshot ?? {}) as { results?: RateQuote[] }
    return {
      id: row.id,
      tenantId: row.tenantId,
      inputSnapshot: (row.inputSnapshot ?? {}) as unknown as CompareRequest,
      results: snap.results ?? [],
      selectedProductCode: row.selectedProductCode ?? undefined,
      currency: row.currency,
      status: row.status as QuoteStatus,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  }
}
