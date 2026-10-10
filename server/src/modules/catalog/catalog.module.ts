/**
 * 商品/SKU 中心模块（任务 1.7，方案 §1）。
 * 提供：商品（SPU）/ 内部 SKU 的 CRUD、三段映射解析（平台↔内部↔供应商）与计费重派生。
 * 导出 CatalogService 供渠道模块（拉单回填 OrderItem.skuId）与后续履约路由复用。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Module } from '@nestjs/common'
import { CatalogService } from './catalog.service'
import { CatalogController } from './catalog.controller'

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
