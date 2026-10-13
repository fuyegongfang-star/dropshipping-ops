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

---

## 2026-10-12（续跑 · 3.6 加价规则引擎 + 币种归一）

**完成**：3.6 加价规则引擎 + 币种归一（§10 双价列 / 加价层 / 币种归一）。
- **FxService**：币种归一，内存汇率种子 USD/EUR/GBP→CNY（7.2/7.8/9.1）；缺失汇率诚实抛错（不静默 1:1）；TODO Redis + 真实 FX 源。
- **MarkupRulesService**：规则解析，作用域 GLOBAL/CARRIER/PRODUCT/ROUTE_ZONE/TENANT；跨作用域叠加 + 同(作用域,类型)最具体/高 priority 胜出；默认全局 15% + 最低毛利 ¥5。
- **MarkupEngineService**：比价 L4 后执行 carrier_cost→基准币种→加价叠加（PERCENT/FIXED/TIERED）→最低毛利保护→双价列（sell_price/margin/fx 快照）。
- **接入比价引擎**：`PricingModule` 装配三服务；`PricingEngineService` 注入 `MarkupEngineService`，L4 后 `enrichQuotes` 回填 quotes，`selected` 改按 sellPrice 锁价（报价即实收）。`RateQuote` 增 `margin?`/`fxRateSnapshot?`。

**测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（117 passed / 16 suites，新增 18 条 markup 单测）。

**提交**：`af93581`（3.6 加价规则引擎 + 币种归一）。

**下一步**：3.7 运费试算门户(正式)（§4：商户自助试算 + 渠道自选 + quote 锁定；`POST /pricing/compare` 引擎已就绪，需补门户 API/页与 quote 有效期/成本快照）。

---

## 2026-10-12（续跑 · 3.7 运费试算门户正式）

**完成**：3.7 运费试算门户(正式)（§4 运费试算与渠道自选）。
- **QuotesService**：试算结果落库（`quote_id` UUID + 24h 有效期 + 租户隔离 + `selectedProductCode` 渠道自选）；过期标记 `EXPIRED` 并诚实抛 `QUOTE_EXPIRED`。
- **QuotesController**：`POST /pricing/quotes`（试算 + trial 落库）、`GET /pricing/quotes/:id`（租户隔离 + 过期校验）、`PATCH /pricing/quotes/:id/select`（渠道自选，仅限列表内产品）。
- 复用比价引擎(trial) + 加价层，试算价与真实下单价口径一致（§4.1/§4.6 试算即所见）。

**测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（122 passed / 17 suites，新增 5 条 quote 单测）。

**提交**：`cb04b4c`（3.7 运费试算门户正式）。

**下一步**：3.8 头程/尾程两段式（`shipment_legs` leg_type first/last；建单可拆分两段运单，轨迹带 leg 维度，§14）。

---

## 2026-10-13（手动 · 前端补齐：承运商 / 运费试算 / 加价·币种）

**背景**：阶段3 夜间自动化 3.2–3.7 交付的是**后端能力**（`carriers` / `pricing` 模块），前端此前仅 5 个页面，用户反馈"看不到对应菜单"。

**完成**：补齐 3 个前端业务页 + 左侧菜单 + 路由，走纯前端演示(mock)模式即可直接查看：
- **承运商管理** `web/src/views/CarriersView.vue`：云途/DHL/4PX/燕文四家 · 能力矩阵六徽章（比价/建单/面单/轨迹/取消/订阅）+ 健康状态/时延/可用率 + 顶部汇总卡。
- **运费试算** `web/src/views/QuotesView.vue`：目的国/重量/尺寸/品类/申报价值 → `POST /pricing/compare` → 展示比价引擎 **L1–L4 执行痕迹** + **双价列**（成本 → 加价后客户售价）+ 渠道自选。
- **加价 / 币种** `web/src/views/PricingRulesView.vue`：加价规则表（作用域/目标/加价值/优先级/启停）+ 币种汇率表。
- **mock 数据层**：`mock-data.ts` 新增 carriers / markup-rules / fx 种子与 `doCompare` 四层引擎模拟；`http.ts` 的 POST/PUT 现向 `mockRouter` 透传 `body`。
- **导航**：`router/index.ts` 增 `/carriers`、`/quotes`、`/pricing`；`BasicLayout.vue` 菜单 +3 项；`AppIcon.vue` 增 calculator/sliders/shield/bolt/coins/flag/clock/select 图标。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测（预览端口）四页渲染 + 试算结果均正常。

**说明**：本次为后端能力的"可视化前端"（演示级），正式版仍按原排期推进（3.7 备注的「试算门户前端页」、4.6「运营配置后台」）。

**下一步**：夜间自动化按原计划 3.8 头程/尾程两段式接力（不受本次前端补充影响）。

---

## 2026-10-13（手动 · 加价规则可自定义 + 开发进度可视化）

**背景**：用户反馈两点 —— ①「加价幅度比例不能自定义设置」；②「不管演示还是正式，每天自动开发完，第二天刷新网页要能看到新功能，否则不知道怎么提出调整」。

**完成**：

1. **加价规则全面可编辑**（`web/src/views/PricingRulesView.vue` + `web/src/api/pricing.ts` + `web/src/api/mock-data.ts`）
   - 表格「加价幅度」列改为数字输入框，可直接改（百分比 / 固定金额自适应，单位自动切换）→ 走 `PUT /pricing/markup-rules/:id` 落库；
   - 「新增规则」对话框：作用域 / 目标（可自由输入）/ 加价方式 / 加价幅度 / 优先级 / 说明 / 启用 → `POST /pricing/markup-rules`；
   - 行操作「编辑」「删除」、状态开关启停均为真实落库；币种汇率可编辑（`PUT /pricing/fx/:base/:quote`）；
   - 顶部新增「加价效果预览」：实时显示全局基准加价率 → 成本 $10 的客户售价，改完立即联动；
   - **演示态持久化**：加价规则与汇率的改动写入 `localStorage`，刷新浏览器后仍在；页面提供「重置演示数据」恢复种子。
2. **开发进度可视化**（新增 `scripts/gen-progress.cjs` + 生成物 `web/src/api/dev-progress.ts`）
   - `npm run progress:gen` 解析 `dev-schedule.md` 任务表 → 生成前端可直接消费的进度数据（任务清单 / 状态 / 统计 / 最近交付 / 任务→页面路由映射）；
   - 新页面「开发进度」`/progress`：总体完成度 + 最近交付（NEW 高亮 + 去查看）+ 分阶段任务清单（阶段筛选 + 关键词搜索）；
   - 仪表盘新增「最近交付能力」卡片；顶栏铃铛改为「本次更新」提醒（用生成提交号比对 localStorage 已读标记，有新增即显示红点）；
   - 演示模式与正式模式读同一份静态数据，**无需后端即可查看**。
3. **夜间自动化加固**（`a7ed8f48`）：提示词新增【可视化交付铁律】——业务能力类任务必须同时交付「页面 + 菜单 + 路由 + mock 双路」，纯后端任务至少在进度页有可见条目；**每批任务最后必须运行 `npm run progress:gen` 并提交**；收尾必须通过 `web` 的 lint + build。
4. **附带修复**：`theme.css` 补上一直被引用却未定义的 `.w-full` 工具类；「加价 / 币种」页由左右分栏改为上下整宽，避免「操作」列被挤出可视区。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测：新增规则（幅度 22）落库 + toast ✅、行内改全局 12→20 联动预览并 toast ✅、刷新后仍为改后值 ✅、重置回 12 ✅、进度页 42.2%（19/45）与仪表盘最近交付 4 项 ✅。

**下一步**：3.8 头程/尾程两段式（夜间自动化按 `dev-schedule.md` 接力）。

---

## 2026-10-13（手动 · 交付隔离：角色显隐）

**背景**：用户问「最后交付时这些开发期脚手架怎么处理，是去掉还是？」→ 决策：**不删代码，改用极简角色隔离**（平台运营方可见，卖家租户不可见）。

**完成**：

1. **新增角色 store** `web/src/stores/user.ts`：`super`（平台运营方）/ `seller`（卖家租户），默认 `super`（保证开发期你仍能看到全部），`localStorage` 持久化。
2. **路由守卫** `web/src/router/index.ts`：`/progress`、`/tenants` 加 `meta.roles: ['super']`，`beforeEach` 拦截非对应角色并重定向首页。
3. **布局菜单按角色过滤** `web/src/layouts/BasicLayout.vue`：`menus` 加 `roles` 字段 + `visibleMenus` 计算属性；演示模式顶栏新增身份切换下拉（平台运营方 / 卖家租户）便于验证。
4. **本次更新提醒角色隐藏** `web/src/components/WhatsNew.vue`：仅 `super` 渲染，卖家租户看不到开发进度类内部提醒。
5. **文档**：README 新增「交付形态与角色隔离」章节，说明 mock/本地持久化/内部视图三者的上线切换方式。

**隔离边界（交付时）**：Mock 演示数据由 `VITE_USE_MOCK` 控制（交付设 `false` 走真实后端）；加价本地持久化仅 mock 生效；开发进度页 / 本次更新提醒 / 租户管理页仅 `super` 可见。前端显隐不替代后端鉴权。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测：super 菜单 9 项（含租户管理/开发进度），seller 菜单 7 项（已隐藏）+ 直接访问 `/progress` 被重定向 `/` + whatsnew 数量 seller=0 / super=1 ✅。

**下一步**：3.8 头程/尾程两段式（夜间自动化按 `dev-schedule.md` 接力）。

---

## 2026-10-13（手动 · 菜单重构：四组分类 + 系统设置）

**背景**：用户提出「盘一下现有菜单及后续要加的菜单，有些东西放系统设置里比较合适」。盘点后确认：`加价/币种`（平台利润规则）、`租户管理`、`开发进度` 这类「平台配置 / 不天天点」的项混在一级菜单里，且未来会新增约 10 个菜单（供应商、仓储、运单、账务、报表、权限、i18n、开放平台…），平铺将达 19 项，过长难找。用户拍板：**完整四组 + 系统设置**。

**完成**：
1. **菜单分组重构**（`web/src/layouts/BasicLayout.vue`）：`menus` 平铺数组 → `menuNodes` 分组结构（`type: MenuEntry | { group, groupIcon, children }`）；模板支持独立项与 `el-sub-menu` 两种渲染；`el-sub-menu__title` 补深色侧栏样式。
   - **概览**：仪表盘（独立项）
   - **业务运营**：订单中心 / 商品·SKU / 渠道·店铺
   - **物流履约**：承运商管理 / 运费试算
   - **财务中心**：（暂空，待阶段4 账务4.1/对账4.2/利润4.3/理赔4.8 入座）
   - **系统设置**：运营配置（原「加价/币种」）/ 租户管理(super) / 开发进度(super)
   - 空分组（当前财务中心）自动不渲染；分组内子项按角色过滤，无可见子项则整组隐藏。
2. **运营配置改名**：菜单 + 路由 meta + 页面标题统一为「运营配置 · 加价 / 币种」（路由 `/pricing` 不变）。
3. **图标**：`AppIcon.vue` 新增 `grid`（业务运营）、`settings`（系统设置）两个分组图标。
4. **夜间自动化加固**（`a7ed8f48`）：提示词中三处 `menus` 引用改为 `menuNodes` 分组结构，并写入【菜单归类规则】——新增菜单必须入座对应 group，平台配置类且不天天点的才进「系统设置」。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测：super 侧 = 仪表盘 + 业务运营(3) + 物流履约(2) + 系统设置(3，含租户管理/开发进度)、财务中心按预期不显示；seller 侧 = 系统设置仅剩「运营配置」、顶栏无「本次更新」铃铛、直访 `/progress`·`/tenants` 均被守卫重定向 `/`；分组内点击「系统设置→运营配置」正确导航到 `/pricing`。

**下一步**：3.8 头程/尾程两段式（夜间自动化按 `dev-schedule.md` 接力；新菜单将按四组归类入座）。

---

## 2026-10-13（手动 · 子菜单展开配色修复）

**背景**：用户反馈「子菜单展开之后颜色极不协调」——展开分组后，二级项下面露出**一块浅色/白色背景**。

**根因**：Element Plus 的内联子菜单 `<ul class="el-menu--inline">` 默认带自己的浅色背景；此前只把顶层 `.side-menu` 设成透明，未覆盖嵌套层。

**修复**（`web/src/layouts/BasicLayout.vue`）：
1. `.side-menu :deep(.el-menu--inline)` → `background: transparent !important`，消除白底块；
2. 二级项统一配色：`#9fabcb`（略暗于一级）、左缩进 `margin-left:22px` + `padding-left:14px`、高度 40px、字号 13.5px；hover 提亮 `rgba(255,255,255,0.06)`；激活态用品牌色渐隐底 + 左侧 3px 条。
3. **折叠态补齐**：给 `el-sub-menu` 加 `popper-class="side-submenu-popup"`，新增非 scoped `<style>` 块（限定在该类下，不污染全局弹层）把 hover 弹出的浮层设成深色 `#16213c` + 圆角项，避免折叠时又是白浮层。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测：展开三组后二级项为深底浅字、无白块（截图 40）；折叠态浮层计算样式背景 `rgb(22,33,60)` ✅（截图 41）。
