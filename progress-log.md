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

---

## 2026-10-13（手动 · 系统设置新增「站点设置」：站点名称 / TDK / 统计代码）

**背景**：用户反馈「系统设置项里把站点名称设置以及 tdk 设置等项目也都加进去，要不然后续怎么用」——即系统设置不能只有加价/租户/进度，站点级基础配置得能改。

**完成**：新增「系统设置 → 站点设置」（路由 `/settings/site`，`super` 专属），四页签：

1. **基础信息**：站点名称（必填，≤30 字）、副标题 Slogan、站点域名、备案号、Logo / Favicon 地址、版权信息；联系方式（客服邮箱 / 电话 / 服务时间）与国际化（默认语言、时区）；右侧「品牌预览」实时展示 LOGO + 站点名观感。
2. **SEO / TDK**：首页 Title / Description / Keywords（带字数计数与超长标红，标题建议 ≤60、描述 ≤160）；标题拼接规则（分隔符 4 选 1 + 是否追加站点名：总是 / 仅首页 / 不追加）；**页面 TDK 规则表**（首页 / 商品详情 / 品类聚合 / 运费试算 / 资讯文章 / 自定义，可新增、编辑、删除、启停），模板支持 `{site}` `{name}` `{category}` 变量。
3. **统计与代码**：`<head>` 与 `<body>` 第三方代码注入、站长验证 meta、Sitemap 开关、`robots.txt`。
4. **效果预览**：浏览器标签页效果 + 搜索结果片段（SERP）按当前模板与示例数据实时渲染。

**联动与实现**：
- 新增 `web/src/api/settings.ts`（`GET/PUT /settings/site`、`POST/PUT/DELETE /settings/tdk-rules`、`POST /settings/site/reset`）与 `web/src/stores/site.ts`；
- `mock-data.ts` 新增 `siteSettings` 种子 + TDK 规则 CRUD，演示态写入 `localStorage('mock-site-v1')`，页面提供「重置演示数据」；
- **站点名称保存后立即联动后台侧栏 LOGO 与浏览器标签页标题**（`document.title = 页面名 - 站点名`），改完即见效果，而非只写进数据；
- 顺带修复：`titleSuffix=always` 时模板已含 `{site}` 会导致站点名重复拼接（如「耳机 - 站点名 - 站点名」），现按「已含站点名则不重复追加」处理，避免 SEO 品牌词堆砌。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ 浏览器实测：站点名改「跨境云仓·一件代发」保存 → 侧栏 LOGO 与标签页标题立即变、toast 提示；重开页面仍为新名（持久化）；TDK 表格 5→6 条（新增「批发页」规则落库）；预览页标题去重后为「无线蓝牙耳机 Pro - 跨境云仓·一件代发」；卖家租户视角菜单无「站点设置」、直访 `/settings/site` 被守卫重定向 `/`。

**下一步**：3.8 头程/尾程两段式（夜间自动化按 `dev-schedule.md` 接力）。

---

## 2026-10-13（手动 · 站点设置支持品牌图片直接上传 + 尺寸规范提示）

**背景**：用户反馈「Logo 图片地址 / Favicon 地址这两个要支持后台直接添加上传相关图片，对了尺寸大小要有提示」——原来只有两个纯文本框，运营得先把图传到某处再粘贴链接，且不知道传多大才合适。

**完成**：

1. **新增通用组件 `web/src/components/ImageUploadField.vue`**（品牌图片上传字段，LOGO / Favicon 共用）：
   - **上传方式**：空态为「点击或拖拽」虚线区；已有图时预览图 hover 显示「替换」；另保留「使用图片地址」入口填外链（原有能力不丢）。
   - **尺寸大小提示（本次核心诉求）**：字段下方常驻规范条 —— **建议尺寸 / 最小尺寸 / 允许格式 / 体积上限**（LOGO 建议 512×512、最小 64×64、≤2048KB；Favicon 建议 64×64、最小 32×32、≤512KB），并明确写出"上传后自动压缩为 N×N 并居中裁切为正方形，横版图会被裁掉两侧"。
   - **上传即校验 + 判定回显**：格式白名单（MIME + 扩展名兜底）、源图体积超限直接拦截；随后读取**上传前的原始像素**给出三级判定 —— 🟢 符合规范 / 🟡 偏小（如 16×16 低于最小 32×32，放大模糊）/ 🟡 非 1:1（如 1200×800，已居中裁切，两侧内容被裁掉）/ ⚪ 外链无法校验，同时回显「实际 512×512 px · 11 KB · PNG」。
   - **自动压缩**：canvas 高清居中裁切为规范尺寸（LOGO 512 / Favicon 64），PNG 优先，超 400KB 依次降级 WebP（保留透明）→ JPEG（铺白底），演示模式 localStorage 不会被大图撑爆。
   - 判定基于**原图尺寸**而非压缩结果——首轮实测发现「压完再看尺寸」会把"原图偏小/横版图"两类问题全部掩盖，已修正。
2. **接口与双路**：`settings.ts` 新增 `LOGO_SPEC` / `FAVICON_SPEC` / `BRAND_ASSET_SPECS` 规格常量与 `settingsApi.uploadAsset()`（`POST /settings/assets`，入参为压缩后 dataURL）；`mock-data.ts` 新增 `/settings/assets` 分支，演示模式直接把 dataURL 当可访问地址回吐（`storage: demo-local`），与正式环境「后端解码→对象存储→返回 CDN 地址」同一调用契约。
3. **改了看得见**：`stores/site.ts` 暴露 `logoUrl` / `faviconUrl`；`BasicLayout.vue` 侧栏 LOGO 支持自定义图片（有图去渐变底、图片铺满圆角框），并新增动态 `link[rel=icon]` —— 保存后侧栏图标与浏览器标签图标当场切换。
4. **页面联动**：「效果预览」页签的浏览器标签页 mock 现在显示真实 favicon；品牌预览卡提示文案同步说明 LOGO / Favicon 的联动关系。
5. 配套：`AppIcon` 新增 `upload` / `image` / `link` 图标；新增 `scripts/make-test-images.cjs`（零依赖手写 PNG 编码，生成 1200×800 宽图 / 16×16 小图 / 300×300 方图供验收）；`.gitignore` 忽略 `.dev/shots`、`.dev/test-images`。

**验证**：`eslint --max-warnings 0` ✅ ｜ `vue-tsc --noEmit && vite build` ✅ ｜ agent-browser 实测（preview 4173，真文件上传）：
- 规范提示条渲染正确（LOGO 512×512/64×64/PNG·JPG·WEBP·SVG/≤2048KB；Favicon 64×64/32×32/含 ICO/≤512KB）；
- 宽图 1200×800 → 判定「原图 1200×800 非 1:1，已居中裁切为 512×512（两侧内容被裁掉），建议改用方图」，落盘 512×512 · 11 KB · PNG；
- 小图 16×16 → 判定「原图 16×16 低于最小 32×32，放大后可能模糊，建议重新上传 64×64」；
- 方图 300×300 → 🟢「尺寸符合规范（原图 300×300，已压缩为 64×64）」；
- 保存后：侧栏 LOGO 变为自定义图（dataURL 24.7KB）、`link[data-app-favicon]` 生成且 href 有效、标签页标题同步；**刷新后 LOGO 与 favicon 仍在**（localStorage 快照 28KB，远低于限额）；预览页签的浏览器标签 mock 显示真实 favicon。

**占位 / 待联调（统一 TODO）**：`POST /settings/assets` 的后端实现（解码 base64 → 落 MinIO → 返回 CDN 地址）随 §23 系统设置后端模块一并联调；当前演示模式全链路已通，正式模式前端调用契约已就绪。

**下一步**：3.8 头程/尾程两段式（夜间自动化按 `dev-schedule.md` 接力）。

---

## 2026-10-14（夜间自动化 23:10 启动 · 3.12 地址校验+分区 / 3.13 聚合平台兜底）

**背景**：阶段3 国际物流段收口（M3）。本次补齐最后两项物流能力：地址校验标准化（§18，脏地址/邮编分区/远程费驱动）与聚合平台兜底追踪（§3e，AfterShip/17TRACK 尾程归一化）。两者均按「可视化交付铁律」落地前端独立页面。

**完成任务**：
- **3.12 地址校验与分区（§18）**：后端 `carriers/address/`（AddressService 标准化/质量分/脏地址检测 + ZoneMapService 邮编→分区/远程/可达，按承运商覆盖）；`POST /carriers/address/validate`；单测 12 cases。前端新增 `AddressView.vue`（物流履约→地址校验）：表单→质量分徽章+标准化地址+分区结论+分级问题+各承运商可行性表，内置合规/脏地址示例，演示+正式双路通。
- **3.13 聚合平台兜底（§3e）**：后端 `carriers/aggregator/`（AggregatorService 经 AfterShip/17TRACK 归一化尾程轨迹，诚实原则：不支持平台抛 NOT_IMPLEMENTED、fail 哨兵返回 fallback 建议直连）；`POST /carriers/aggregator/track` + `GET /carriers/aggregator/catalog`；单测 5 cases。前端新增 `AggregatorView.vue`（物流履约→聚合追踪）：选平台+尾程承运商+轨迹号→归一化轨迹时间线+fallback 提示。
- **前端新增页面**：`AddressView.vue`、`AggregatorView.vue`；`carriers.ts` 增 `validateAddress`/`aggregateTrack`/`listAggregators` API 与类型；`mock-data.ts` 增 `doValidateAddress`/`doAggregateTrack`/`doAggregatorCatalog`（与后端同口径）；`AppIcon` 增 `pin`；`router` + `BasicLayout.menuNodes` 注册两页（物流履约分组）。
- **进度生成器**：`scripts/gen-progress.cjs` 的 `EXPLICIT_ROUTES` 增补 `3.12→/address`、`3.13→/aggregator`；重跑 `npm run progress:gen`（45 任务/25 完成/55.6%）；`dev-schedule.md` 状态列 3.12、3.13 置 ✅ 并追加进度段落。

**进行中**：无。
**受阻**：无。
**测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（155 passed / 23 suites，新增 17）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
**提交**：本批统一提交（3.12+3.13 后端/前端/进度生成器/文档），随后检查点提交。
**本次新增前端页面与菜单**：
- 物流履约 → 「地址校验」（/address）：AddressView.vue
- 物流履约 → 「聚合追踪」（/aggregator）：AggregatorView.vue

**下一步**：阶段3 收口完成（M3 达成）。进入阶段4：4.1 收款账务 wallet+ledger（§16 复式记账/预充值/账期/退款）→ 4.2 商户账单+承运商对账 → 4.3 利润核算 → 4.4 多租户隔离强化 → 4.5 精细化 RBAC → 4.6 运营配置后台 → 4.7 报表指标 → 4.8 理赔保险 → 4.9 多语言多币种前端。另：3.12 的 zone_maps 可在 §4.4 接入远程附加费、在比价 L2 可达性复用。

**明天打开网页能看到什么**：左侧「物流履约」新增两个菜单——「地址校验」（填收件地址即见质量分、标准化地址、分区结论、各承运商可达性/远程费提示，含一键合规/脏地址示例）与「聚合追踪」（选 AfterShip/17TRACK + 尾程承运商 + 轨迹号即见归一化尾程轨迹时间线，含 fail 哨兵演示兜底）；「开发进度」页与仪表盘「最近交付」卡片新增 3.12/3.13 条目。

---

## 2026-10-15 ~ 2026-10-16（夜间自动化 · 补记 4.1–4.5，明细见 dev-schedule.md 进度更新）

> 以下四夜批次已在 dev-schedule.md / .dev/state.json 落档，但漏写本日报；此处补记关键交付与「次日可见」。

- **4.1 收款账务 wallet+ledger（§16）**：后端 finance 模块 WalletService（复式记账六类型/预充值冻结/信用账期/可用额度校验/风控冻结）+ WalletController + FinanceModule；前端 **WalletView（/wallet，财务中心）**；jest 162 passed。
- **4.2 商户账单 + 承运商对账（§9/§10）**：bills/reconciliations 模块 + 前端账单/对账页（财务中心）。
- **4.3 利润核算 spread 报表化（§9/§10）**：billing 增 getProfitBreakdown/getProfitTrend；前端 **ProfitView（/profit，财务中心）** 四宫格 + ECharts 利润趋势 + 按租户/承运商表；jest 171 passed。
- **4.4 多租户隔离强化（§17）**：共享库 + tenant_id 行级隔离（评估弃用 schema-per-tenant）；tenant-isolation + secret-encryption(AES-256-GCM) + JWT 验签回退；前端 **SecurityView（/security，super 专属）**。
- **4.5 精细化 RBAC（§22）**：rbac 子模块（权限点/角色蓝图/@RequirePermissions/PermissionsGuard）；前端 **RbacView（/rbac，super 专属）** 权限矩阵 + 角色管理；jest 188 passed。
- **本段新增前端页面与菜单**：财务中心 → 钱包(/wallet)、利润核算(/profit)；系统设置 → 权限管理(/rbac, super)、安全加固(/security, super)。

---

## 2026-10-17（夜间自动化 23:10 启动 · 4.6 运营配置后台）

**背景**：阶段4 运营侧配置收口。本次补完并收口「运营配置」页（系统设置 → /pricing）：加价规则、物流产品/费率卡、币种与汇率三块能力的后台 CRUD 与前端可视化。

**完成任务**：
- **后端**：
  - `markup-config` 子模块：`MarkupConfigService`（6 条种子：全局 12% / 租户 acme 5% / 承运商 DHL 8%·云途 15% / 产品 带电 6% / 渠道 Amazon 2% 停用）+ `MarkupConfigController`（`/pricing/markup-rules` CRUD）+ `markup-config.types`（class-validator DTO）。
  - `fx` 接口：`FxController`（`/pricing/fx` GET 列表 + PUT `:base/:quote` 调汇率，≤0 抛 FX_RATE_INVALID）；`fx.service` 增 `listRates`/`updateRate` + `DISPLAY_RATE_PAIRS`（USD/EUR/GBP→CNY）。
  - 收口 `product` 子模块（续 3.7 半截工程）：`LogisticsProduct` 全字段 CRUD + `GET :id/rate?weightKg=` 费率卡成本试算（首重价 + 续重价 × max(0, 计费重−1)）。
  - 单测：`markup-config.service.spec`（7 cases）+ `logistics-product.service.spec`（修前批次按创建倒序失效）全绿；全仓 **jest 202 passed / 30 suites**。
- **前端**：
  - `PricingRulesView.vue` 改三 Tab：「加价规则」（既有）/「物流产品 / 费率卡」（新增 `OperationsProducts.vue`）/「币种与汇率」（既有）。
  - `OperationsProducts.vue`：产品目录表（承运商/物流段/目的区/时效/费率卡/启用开关）+ 新增编辑对话框（承运商/产品名必填等 14 字段）+ 费率卡成本试算对话框（计费重→承运商成本）。
  - `pricing.ts` 增 `CarrierCode`/`LegType`/`CargoType` 类型 + `CARRIER_LABELS`/`LEG_LABELS`/`CARGO_LABELS` + `LogisticsProduct`/`RateCardQuote`/`ProductInput` + `productsApi`（list/create/update/remove/rate）。
  - `mock-data.ts` 增 `MockLogisticsProduct` + 4 条种子 + `doListProducts`/`doCreateProduct`/`doUpdateProduct`/`doRemoveProduct`/`doProductRate`（演示+正式双路通）。
  - 路由与菜单沿用既有 /pricing（系统设置，图标 sliders）。
- **进度生成器**：`npm run progress:gen` → 45 任务 / 31 完成（68.9%）。

**进行中**：无。
**受阻**：无。
**测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（202 passed / 30 suites，新增 7 + 修复 1）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
**提交**：`e553483` feat(ops): 运营配置后台 加价规则+物流产品费率卡+汇率 CRUD (§23 4.6)；随后检查点提交（state/schedule/progress）。
**本次新增/变更前端页面与菜单**：
- 系统设置 → 「运营配置」（/pricing）：新增「物流产品 / 费率卡」Tab（OperationsProducts.vue），加价规则与币种汇率 Tab 沿用。

**明天打开网页能看到什么**：进入「系统设置 → 运营配置」，切到新增的「物流产品 / 费率卡」Tab——可见 4 条种子物流产品（云途-标准专线/默认、DHL-Express 优先、4PX-经济小包、燕文-带电专线），支持新增/编辑（承运商、物流段、目的区、时效、抛比、首重价/续重价、币种、可达国家、启用/默认/可见）/删除，以及点「试算」输入计费重即时看到承运商成本（首重价 + 续重价 × max(0, 计费重−1)）；加价规则与币种汇率 Tab 保持可用；演示模式无需后端即可交互改写内存状态。

**下一步**：4.7 报表指标口径（§25 履约/物流/利润看板）→ 4.8 理赔保险 → 4.9 多语言多币种前端。

---

## 2026-10-18（夜间自动化 · 4.7 报表指标口径）

**背景**：阶段4 收口运营侧指标可视化。本次落地「运营报表」页（业务运营 → /reports），将 §25 五类指标（履约时效 / 物流时效 / 利润 / 渠道分布 / 异常率）聚合为单请求看板。

**完成任务**：
- **后端**：`modules/reports/` —— `reports.types.ts`（五类指标 TS 接口）、`reports.service.ts`（演示口径代表值：履约三段几何均值达成率、四渠道平均时效+异常率、近 6 账期利润趋势+租户/渠道拆解、渠道单量占比、异常构成）、`reports.controller.ts`（`GET /reports/overview`）、`reports.module.ts` 接入 `AppModule`。单测 `reports.service.spec`（6 cases）。
- **前端**：`ReportsView.vue`（/reports）核心指标卡（整体履约达成率 / 综合异常率 / 近 6 期平台利润 / 总单量）+ 五张 ECharts（履约各段时长、物流时效+异常率双轴、利润趋势、渠道单量占比饼、异常构成饼）+ 利润拆解表（租户/渠道）；新增可复用 `components/BaseChart.vue`（ECharts 封装，统一 init/resize/dispose）；`api/reports.ts` 类型 + `reportsApi.overview`；`mock-data.ts` 增 `doGetReportDashboard`（与后端同口径，演示+正式双路通）；`router` 注册 /reports、`BasicLayout.menuNodes` 业务运营分组注册（icon `chart`）、`AppIcon` 增 `chart`。
- **进度生成器**：`npm run progress:gen` → 45 任务 / 32 完成（71.1%）。

**进行中**：无。
**受阻**：无。
**测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（208 passed / 31 suites，新增 6）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
**提交**：`8d48209` feat(reports): 运营报表 五类看板 (§25 4.7)；随后检查点提交。
**本次新增前端页面与菜单**：
- 业务运营 → 「运营报表」（/reports）：ReportsView.vue（指标卡 + 五图 + 利润拆解表）。

**明天打开网页能看到什么**：左侧「业务运营」新增「运营报表」菜单——进入后可见整体履约达成率/综合异常率/近6期平台利润/总单量四张指标卡，以及履约各段时长柱状图、物流时效+异常率双轴图、利润趋势图、渠道单量占比饼图、异常构成饼图、按租户/渠道利润拆解表；演示模式无需后端即可渲染。

**下一步**：4.8 理赔保险（§20 claims 流程）→ 4.9 多语言多币种前端（§27）。

---

## 2026-10-18（夜间自动化 · 4.8 理赔保险 + 4.9 多语言多币种前端）

**背景**：阶段4 收口。本次落地「理赔保险」与「多语言多币种前端」两项，阶段4（M4 结算/账务/多租户/运营后台/报表/理赔/多语言）全部完成。

**完成任务**：
- **4.8 理赔保险（§20）**：
  - 后端 `server/src/modules/claims/` —— `claims.types.ts`（ClaimType/Status/ResponsibleParty + Create/Update DTO 校验）、`claims.service.ts`（内存实现：租户隔离 + 列表/详情/新建/状态流转）、`claims.controller.ts`（`GET /claims`、`POST /claims`、`PATCH /claims/:id/status`，`@TenantId()` 隔离）、`claims.module.ts` 接入 `AppModule`；`Claim` schema 补全 `cause`/`responsibleParty`/`refCarrierClaimId`/`note`/`updatedAt`。单测 `claims.service.spec`（5 cases：租户隔离/筛选/新建默认态/状态流转/越权 404）。
  - 前端 `ClaimsView.vue`（/claims，财务中心）：概览四卡（总数/待处理/处理中/已赔付）+ 状态/类型筛选 + 列表（异常类型/责任方/金额/状态标签 + 展开看原因/备注/承运商理赔号）+ 新建对话框（运单/类型/责任方/金额/承运商理赔号/原因）+ 状态推进对话框（按 §20 合法后继）；`api/claims.ts`（类型 + 标签 + 合法后继 + `claimsApi`）+ `mock-data.ts` 同口径内存实现（演示+正式双路通）；`AppIcon` 增 `claim`；路由 + 菜单注册。
- **4.9 多语言多币种前端（§27）**：
  - 轻量 i18n：`web/src/locales/index.ts`（`t()` + 响应式 `locale` + 中/英字典 + `setLocale`/`setCurrency`/`money`/`toDisplay` + `FX_RATES`/`CURRENCY_SYMBOLS` 复用 §10.3 汇率口径）。**未引入 vue-i18n 第三方依赖**，避免安装触发本机 safe-delete 守卫导致 build 中断。
  - 顶栏语言切换（中/English）+ 展示币种切换（CNY/USD/EUR/GBP）；侧栏菜单/分组/顶栏文案接入 `t()` 即时翻译；「本地化设置」页（/localization，系统设置）语言 + 展示币种 + 汇率表 + 换算演示；利润核算页金额按展示币种实时换算。
  - 演示/正式双路通：mock 无需后端即可切换语言与币种。
- **进度生成器**：`npm run progress:gen` → 45 任务 / 34 完成（75.6%）。

**进行中**：无。
**受阻**：无。
**测试结果**：server `tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（213 passed / 32 suites，新增 5）｜ web `vue-tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `vite build` ✅。
**提交**：`8dde7b1`(feat claims/web 4.8) / `e3735ce`(progress) / `fda4dc8`(chore 检查点 4.8) / `5a5ff34`(feat i18n/web 4.9) / `e8bf89d`(progress)。
**本次新增前端页面与菜单**：
- 财务中心 → 「理赔保险」（/claims）：ClaimsView.vue（概览 + 列表 + 新建 + 状态推进）。
- 系统设置 → 「本地化设置」（/localization）：LocalizationView.vue（语言 + 展示币种 + 汇率表 + 换算演示）。
- 顶栏新增「语言 / 展示币种」切换；左侧菜单与顶栏文案支持中/英切换。
- 利润核算页金额随展示币种实时换算。

**明天打开网页能看到什么**：
- 财务中心新增「理赔保险」：可看 4 条种子理赔（丢件已赔付/破损已通过/延误处理中/清关失败待处理），按状态/类型筛选，新建理赔并推进状态（open→processing→approved/rejected→paid），演示模式无需后端即可操作。
- 顶栏右上角新增「语言（中/English）」与「展示币种（CNY/USD/EUR/GBP）」下拉：切换语言后整个侧栏菜单、分组、顶栏文案即时中英文切换；切换展示币种后，「利润核算」页所有金额与趋势图按所选币种换算显示（记账仍基准币 CNY，仅前端展示换算）。
- 系统设置新增「本地化设置」页：可再次设置语言/币种，查看 §10.3 汇率表（1 单位币种 = 多少 CNY / ¥1 = 多少币种），并输入基准币金额查看四种币种换算对照。

**下一步**：5.1 风控体系（§26 规则引擎 + 评分）→ 5.2 开放 API/ERP 集成 → 5.3 Amazon SP-API 完整对接 → 5.4 容量/灾备/测试强化。

---

## 2026-10-20（夜间自动化 · 5.1 风控体系 + 5.2 开放 API/ERP 集成）

**背景**：阶段5 启动。本夜完成「风控体系」与「开放 API/ERP 集成」两项，阶段5（M5 平台化/开放生态/合规）开局两关落地。

**完成任务**：
- **5.1 风控体系（§26）**：
  - 后端 `server/src/modules/risk/` —— 规则引擎三类别（欺诈 fraud / 黑名单 blacklist / 敏感货瞒报 misdeclaration）+ 评分阈值（高风险 ≥60 / 中风险 ≥30）+ 命中黑名单强制判高 + 高风险转人工审核（pending）；黑名单覆盖地址 / 买家 / 支付；单测覆盖引擎与策略。
  - 前端 `RiskView.vue`（/risk，业务运营）：概览四卡 + 风险订单 + 规则引擎 + 黑名单三 Tab；`api/risk.ts` + `mock-data.ts` 同口径内存实现（演示+正式双路通）；`AppIcon` 增 `risk`；路由 + 菜单注册。
  - 注：本批接管一个前序漏提交批次，已完成全部验证并补提交。
  - 质量门禁：server `tsc` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（222 passed / 35 suites）｜ web `vue-tsc` ✅ ｜ `eslint` ✅ ｜ `vite build` ✅。
- **5.2 开放 API/ERP 集成（§28）**：
  - 后端 `server/src/modules/openapi/` —— `OpenApiService`（内存实现：client_credentials 换令牌 / 客户端增删 / 密钥轮换 / 滑动窗口限流 / 开放订单 / 多家承运商报价 + 加价层（口径对齐比价引擎）/ 账单 / 借贷平衡 ERP 凭证 / Webhook 订阅 / 作用域校验 / 脱敏画像）、`OpenApiGuard`（Bearer 校验 `aud=openapi`）、`OpenApiController`（`GET oauth/token`·`me`·`orders`·`bills`·`erp/gl`、`POST quotes`·`webhooks`·`clients`、`DELETE clients/:id`、`POST clients/:id/rotate`）、types / decorator / module；单测 service.spec 11 + controller.spec 6。
  - 前端 `OpenPlatformView.vue`（/open-platform，super 专属，系统设置）：概览四卡 + API 客户端 / Webhook / 接口文档 / 调用示例四 Tab + 新建客户端（含密钥弹窗）/ 新建 Webhook；`api/openapi.ts` + `mock-data.ts` 双路通；`AppIcon` 增 `api`；路由 + 菜单 +  locales 注册；进度生成器 `EXPLICIT_ROUTES` 补 `5.2→/open-platform`。
  - 质量门禁：server `tsc` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（239 passed / 35 suites，新增 17）｜ web `vue-tsc` ✅ ｜ `eslint` ✅ ｜ `vite build` ✅。

**进行中**：无。
**受阻**：无。
**看门狗**：未触发（零外部网络 / 安装）。
**提交**：`98dc256`(feat risk 5.1) ｜ `66208dd`(chore 检查点 5.1) ｜ `b60d426`(feat openapi 5.2 + progress)。
**本次新增前端页面与菜单**：
- 业务运营 → 「风控中心」（/risk）：RiskView.vue（概览 + 风险订单 + 规则引擎 + 黑名单）。
- 系统设置 → 「开放平台」（/open-platform，super 专属）：OpenPlatformView.vue（API 客户端 / Webhook / 接口文档 / 调用示例）。

**明天打开网页能看到什么**：
- 业务运营新增「风控中心」：可见风险订单概览四卡、风险订单列表、规则引擎（三类别 + 高风险 / 中风险阈值 + 黑名单强制判高 + 转人工审核）、黑名单（地址 / 买家 / 支付）三 Tab；演示模式无需后端即可查看。
- 系统设置新增「开放平台」（仅 super 角色可见）：概览四卡 + API 客户端 Tab（列表 / 新建客户端并展示密钥弹窗 / 删除 / 轮换密钥）+ Webhook Tab（订阅 / 列表）+ 接口文档 Tab（作用域、端点、调用示例），并内置多语言 OAuth2 / REST 调用示例；演示 + 正式双路通。

**下一步**：5.3 Amazon SP-API 完整对接（§29 FBA Inbound / Shipping / Reports）→ 5.4 容量 / 灾备 / 测试强化（§30）。
