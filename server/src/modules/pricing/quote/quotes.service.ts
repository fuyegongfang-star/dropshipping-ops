/**
 * 试算单服务（任务 3.7，方案 §4.6 试算→订单联动）。
 * 负责：试算结果持久化（内存 Map，待 `quotes` 表 §7/§10.6）、quote_id 生成、
 * 有效期校验、租户隔离、商户渠道自选（selectedProductCode）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { BusinessException } from '../../../common/response/business.exception'
import { AppLogger } from '../../../common/logger/app.logger'
import { CompareRequest } from '../pricing.types'
import { RateQuote } from '../../carriers/dto/rate.dto'
import { Quote, QuoteStatus, QUOTE_TTL_MS } from './quote.types'

@Injectable()
export class QuotesService {
  /** 内存试算单表（待 §7/§10.6 持久化 quotes 表） */
  private readonly store = new Map<string, Quote>()

  constructor(private readonly logger: AppLogger, private readonly ttlMs: number = QUOTE_TTL_MS) {}

  /** 创建试算单：试算结果（已加价）落库并生成 quote_id + 有效期（§4.6） */
  create(tenantId: string, req: CompareRequest, results: RateQuote[], currency: string): Quote {
    const now = Date.now()
    const quote: Quote = {
      id: randomUUID(),
      tenantId,
      inputSnapshot: req,
      results,
      currency,
      status: QuoteStatus.ACTIVE,
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      createdAt: new Date(now).toISOString(),
    }
    this.store.set(quote.id, quote)
    this.logger.debug(`[Quote] 创建试算单 ${quote.id} tenant=${tenantId} items=${results.length}`)
    return quote
  }

  /** 取试算单：租户隔离 + 过期校验（§4.6）；过期则标记 EXPIRED 后抛错 */
  get(tenantId: string, id: string): Quote {
    const q = this.store.get(id)
    if (!q || q.tenantId !== tenantId) {
      throw new BusinessException('QUOTE_NOT_FOUND', `试算单不存在: ${id}`, HttpStatus.NOT_FOUND)
    }
    if (this.isExpired(q)) {
      q.status = QuoteStatus.EXPIRED
      throw new BusinessException('QUOTE_EXPIRED', `试算单已过期: ${id}`, HttpStatus.GONE)
    }
    return q
  }

  /** 商户渠道自选：标记 selectedProductCode（仅允许选试算列表内产品，§4.0 模式B） */
  select(tenantId: string, id: string, productCode: string): Quote {
    const q = this.get(tenantId, id) // 先做租户/过期校验
    const hit = q.results.find((r) => r.productCode === productCode)
    if (!hit) {
      throw new BusinessException('QUOTE_ITEM_NOT_FOUND', `试算单不含该产品: ${productCode}`, HttpStatus.BAD_REQUEST)
    }
    q.selectedProductCode = productCode
    this.logger.debug(`[Quote] 试算单 ${id} 选定产品 ${productCode}`)
    return q
  }

  /** 是否过期（状态或有效期任一判过期） */
  isExpired(q: Quote): boolean {
    return q.status === QuoteStatus.EXPIRED || new Date(q.expiresAt).getTime() < Date.now()
  }
}
