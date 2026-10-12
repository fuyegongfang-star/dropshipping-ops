# 开发进度日报（夜间自动开发）

> 本文件由「夜间自动开发」自动化每日结束追加。人工引导记录亦记入此处。
> 格式：日期 / 完成 / 进行中 / 受阻+错误摘要 / 测试结果 / 下一步 / 提交号。

---

## 2026-10-10（人工起头 · 非夜间自动化）

- **完成**：阶段0 脚手架起头。
  - 0.1 monorepo 目录结构（server NestJS + web Vue3 + deploy docker-compose）
  - 0.2 多租户骨架：tenant.context（AsyncLocalStorage）+ tenant.middleware（code→UUID 解析注入）+ tenant.decorator + tenant.guard + tenants 模块（示范行级隔离写法）
  - 0.4 基础设施：docker-compose（PG16/Redis7/MinIO）+ 集中配置 config/configuration
  - 0.5 开发规范工具链：prettier / eslint / stylelint / commitlint 配置（方案 §31）
  - 0.6 CI 基线：GitHub Actions（lint + typecheck + prisma generate 卡点）
- **进行中**：0.3 鉴权与 RBAC 基线 —— JWT + Passport 落地，CASL 策略与精细化 RBAC 待阶段4。
- **核心资产**：
  - 全量 Prisma 数据模型（覆盖方案 §7 + §13~§30 全部表，所有业务表带 tenantId 行级隔离）。
  - 服务端骨架**已验证可编译**：`npm run typecheck` 与 `npm run lint` 均通过（exit=0）。
  - 前端 Vue3 脚手架（顶栏租户切换器 + 统一 HTTP 客户端带 `x-tenant-id`）就位。
- **受阻**：无（前端依赖未安装：vite/esbuild 在 Git Bash 下需 `--ignore-scripts` 规避安装坑，见记忆，待自动化处理）。
- **测试结果**：server lint ✅ / tsc ✅；前端未装依赖。
- **下一步（夜间自动化接力）**：0.3 收尾 → 1.1 ChannelAdapter 框架 → 1.2 Shopify 接入 → 1.3 订单归集+状态机 → 1.8 运费试算最小版。
- **提交**：`ed81e2e` chore: 阶段0 脚手架起头。

---

## 2026-10-10（夜间自动化 · 23:10 启动）

- **完成**：
  - **0.3 鉴权与 RBAC 基线** ✅ —— JWT + Passport 落地；CASL 策略按方案 §22 留待阶段4（口径一致）。
  - **1.1 ChannelAdapter 框架** ✅ —— 统一接口（拉单/审单/推单回传/轨迹）+ 抽象基类 + 注册表（实例/工厂双模式）+ 归一化 DTO + 共享可重试 HTTP 客户端（§2.1 指数退避 2/4/8/16/32s，5 次）+ 拉单落库（upsert→`Order` 初始态 `pending_review`，单条失败不中断）+ Mock 适配器。
  - **1.2 Shopify 接入** ✅ —— `ShopifyAdapter`（Admin REST 拉单/回传/查单/撤单/轨迹）+ 工厂（按店铺凭证）。
  - **1.3 订单归集 + 状态机** ✅ —— 12 态转移表 + 守卫 + 幂等 + `order_events` 审计 + 逆向流程；REST `/api/orders/:id/transition`、`/reverse`。
  - **1.4 审单引擎** ✅ —— 可插拔 `ReviewCheck`：地址完整性 + 黑名单（§26 预留）+ 库存/合规占位（带 `TODO(ops)` 责任人+日期，待 §1.7/§15、§19）；REST `/api/orders/:id/review`。
  - **1.7 商品/SKU 中心** ✅（续跑补充）—— `CatalogModule`：商品（SPU）/内部 SKU 的 CRUD（租户行级隔离）+ 三段映射解析（平台 SKU→内部 SKU `resolveByPlatformSku`、内部 SKU→供应商 SKU `resolveSupplierSku`、`syncPlatformSku`/`linkSupplierSku` 维护 §21）+ 计费重派生（`computeWeights`：实重 vs 体积重取大，对接 §4/§5）。拉单落库 `ChannelSyncService` 接入映射，按 `platformSku`（回退 `skuCode`）回填 `OrderItem.skuId`，打通「平台↔内部」映射闭环。
- **进行中**：无。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（29 passed / 4 suites）。
- **下一步**：1.5 履约路由 / 1.6 物流回传+轨迹 / 1.8 运费试算最小版 / 1.9 供应商代发链路 / 1.10 Amazon SP-API 评估。1.5/1.6/1.8/1.9 依赖阶段3 承运商适配器与费率卡（§3/§4）；1.7 已完成，待 §15 WMS 落地后 1.4 库存校验占位可接 `CatalogService` 真实校验。
- **提交**：`7714434`（`feat(channels/orders/catalog): 阶段1 MVP 履约框架 1.1-1.4 + 商品SKU中心 1.7`）；前端脚手架验证另见 `6868660`（`chore(web)`）。
- **用户汇总**：本夜跑通「拉单→审单→状态机→逆向」MVP 主干，并续补商品/SKU 中心（平台↔内部↔供应商三段映射 + 计费重）：Shopify 渠道拉单归一化落库并按平台 SKU 回填内部 `skuId`，审单引擎校验，状态机驱动流转，全程行级隔离 + 统一响应/异常/日志；新增 13 个单测覆盖映射解析/计费重/归属校验/供应商关联/落库回填，合计 29 个单测全绿。

---

## 2026-10-10（续跑 · Amazon SP-API 评估）

- **完成**：
  - **1.10 Amazon SP-API 评估** ✅（§29）—— `AmazonLwaClient`：LWA OAuth2 认证闸门（client_credentials/refresh_token 双 grant + 令牌缓存，复用 RetryableHttpService 重试/退避）。`AmazonAdapter`：落入 §3 ChannelAdapter 框架，拉单 Orders v0 归一化 + 二次 `getOrderItems` 补明细 + 状态映射 + LWA 鉴权头；`AmazonRequestSigner` 接口（Noop 占位）+ `AmazonAdapterFactory`（按店铺凭证构建，注册进渠道注册表）。
  - **评估结论**：LWA 认证闸门已可独立验证（无需 SigV4）；SP-API 读写端点需 AWS SigV4 签名 + 开发者账号/应用审核（周期数天~数周），FBA/FBM 推单/轨迹/撤单明确标记为阶段5 完整对接（任务 5.3）；FBA 由 Amazon 履约、FBM 自发货。
- **进行中**：无。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（33 passed / 5 suites）。
- **下一步**：1.5 履约路由 / 1.6 物流回传+轨迹 / 1.8 运费试算最小版 / 1.9 供应商代发链路（依赖阶段3 承运商适配器与费率卡 §3/§4）；阶段1 MVP 主干 + SKU 中心 + Amazon 评估均已落地，剩余多为阶段3 依赖项。
- **提交**：原夜间批次漏提交，已于 2026-10-11 随文档/检查点一并补提交（见 `feat(channels/amazon): 阶段1 Amazon SP-API 评估 1.10`）。
- **用户汇总**：本续跑完成 Amazon SP-API 可行性评估并落地了可验证的认证闸门（LWA）与框架贴合的拉单归一化骨架；明确 SigV4 与 FBA/FBM 推单为阶段5 完整对接，避免生产误用（其余端点抛 NOT_IMPLEMENTED）。合计单测增至 33 个、5 个套件全绿。

---

## 2026-10-11（夜间自动化 23:10 启动 · CarrierAdapter 框架 3.1）

- **完成**：
  - **3.1 CarrierAdapter 框架** ✅（§3，镜像 ChannelAdapter）—— 承运商侧可插拔适配器体系：统一六能力接口 `CarrierAdapter`（比价/建单/面单/轨迹/取消/订阅）、抽象基类（复用 `RetryableHttpService` 重试退避 + `AppLogger`）、`CarrierCode`/`CarrierCapability`/`CarrierHealth` 常量、计费重/抛重计算 `weight.ts`（§4.2 核心）、归一化 DTO（比价/建单/报关§19/轨迹）、**实例+工厂双模式注册表**（含租户 `CarrierAccount` 凭证分发 §2.2）、`MockCarrierAdapter` 自测桩、`CarriersService`+`CarriersController`（REST 入口 `/carriers/...`）+ `CarriersModule`（已接入 `AppModule`）。
- **进行中**：无。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（新增 20 / 全仓 53 passed / 8 suites）。
- **下一步**：3.2 云途接入（SDK 优先，OAuth2+HMAC）→ 3.3 DHL → 3.4 4PX/燕文（MD5）→ 3.5 比价引擎4层 → 3.6 加价规则引擎。3.1 已打通工厂注册与租户账号分发通道，3.2~3.4 注册工厂即接入。阶段1 收口任务 1.5/1.6/1.8/1.9 顺延至 3.5/3.6 后补。
- **提交**：`feat(carriers): 阶段3 CarrierAdapter 框架 3.1（接口/注册表/Mock/REST/单测）`。
- **用户汇总**：今夜完成阶段3 开局——承运商适配器框架 CarrierAdapter，与渠道侧 ChannelAdapter 完全对称：统一六能力接口 + 抽象基类（共享重试/日志）+ 实例/工厂双模式注册表（工厂按租户账号凭证构建，§2.2）+ 计费重计算（§4.2 货代试算核心）+ 归一化 DTO（比价/建单/报关/轨迹）+ Mock 自测桩 + REST 入口。已接入应用并补齐 20 个单测，全仓 53 单测全绿、类型检查与零警告 Lint 通过。下一步顺推云途/DHL/4PX/燕文真实适配器与比价引擎。

---

## 2026-10-12（夜间自动化 · 承运商真实适配器 3.2-3.4 + 比价引擎 3.5）

**完成**：阶段3 承运商真实适配器全部接入 + 比价引擎。
- **3.2 云途 YunExpress**：OAuth2 client_credentials 换 token（实例内存缓存，提前 60s 刷新，TODO Redis）+ HMAC-SHA256 签名（canonical=`appId.timestamp.body`），六能力全实现；`carrierCost` 暂占位 0（待 §9 费用回传）。
- **3.3 DHL**：OAuth2 Basic（`base64(clientId:clientSecret)`）+ `DHL-API-Key` 头，能力 RATE/SHIP/LABEL/TRACK；**无 cancel/subscribe，诚实抛 `NOT_IMPLEMENTED`**。
- **3.4 4PX / 燕文**：共享 MD5 签名（32 位小写）；4PX 5 能力（含 cancel），燕文 3 能力（无 rate/cancel/subscribe，诚实抛 `NOT_IMPLEMENTED`）；CarriersModule 工厂注册四承运商，`CarriersService.resolve` 工厂优先分发租户账号凭证。
- **3.5 比价引擎**：L1 预热费率卡预留（返回空，TODO Redis）→ L2 可达性地图（禁运国/敏感货）→ L3 有界并行实时池（2s SLA，失败捕获不中断）→ L4 诚实护栏（去重→成本升序→截断 20 条）；试算模式返回多列表不锁价；`CarriersService.resolveAdapter` 公开方法供引擎按租户解析。

**诚实原则**：不支持能力一律抛 `NOT_IMPLEMENTED`，不在 `capabilities` 声明谎称；所有 API 路径/字段为合理占位（`TODO 2026-11 联调校正`）。

**测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（99 passed / 13 suites，新增 8 条比价引擎单测）。

**提交**：`64223ba`（3.2-3.4 适配器）、`1bbafca`（3.5 比价引擎）、`4ff82d3`（检查点）。

**下一步**：3.6 加价规则引擎 + 币种归一（§9/§10，填充 `RateQuote.sellPrice` 与利润核算基础）。阶段1 收口 1.5/1.6/1.8/1.9 可在 3.5/3.6 后补。
