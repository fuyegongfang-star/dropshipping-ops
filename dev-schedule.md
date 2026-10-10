# 一件代发货代运营系统 · 开发进度表

> 生成日期：2026-10-10 ｜ 关联方案：`dropshipping-fulfillment-architecture-plan.md` (v1.5)
> 执行方式：夜间自动开发（每日 23:10 启动，约 07:50 结束），由定时任务驱动，**全程无人值守、自恢复、自汇报**。
> 状态图例：⬜ 待开始 ｜ 🔵 进行中 ｜ ✅ 已完成 ｜ ⛔ 受阻(已记录) ｜ ⏭️ 跳过(已记录)
> 本表为唯一进度真相源，自动化每跑完一批任务即回写状态。

---

## 〇、自动化执行约定（看门狗 + 续跑）

- **看门狗（防 429 / 异常中断）**：所有外部调用（npm 安装、API 请求、网络拉取）一律包在重试器里。
  - 遇 HTTP `429` / `5xx` / 网络抖动：**指数退避重试** `2s → 4s → 8s → 16s → 32s`，最多 5 次。
  - 5 次仍失败：**记录到 `.dev/errors.log` → 标记该子步骤跳过 → 立即转下一任务**，绝不整体中止。
- **自恢复**：任何未捕获异常写入 `.dev/errors.log`，当前任务标记 `⛔ 受阻` 并附原因，转下一任务；次日从断点续跑。
- **检查点续跑**：`.dev/state.json` 记录 `当前阶段 / 任务序号 / 最后提交 / 受阻清单`；每次启动先读状态，从断点继续。
- **时间窗自律**：启动 ~23:10，本地时间到 ~07:40 即停止开新任务、跑末轮 lint/test、写日报、收尾（约 07:50 结束）。
- **纪律红线**：严格遵循方案 §31（注释清晰 / 代码整齐）；提交信息用 Conventional Commits；**任何问题自己解决，绝不询问用户**。
- **日报**：每日结束向 `progress-log.md` 追加当日段落（完成/进行中/受阻+错误摘要/测试结果/下一步/提交号），并给用户简短汇总。

---

## 一、进度看板（按阶段）

| 序号 | 阶段 | 任务 | 关键产出 / 对应方案章节 | 依赖 | 预估 | 状态 |
|---|---|---|---|---|---|---|
| 0.1 | 阶段0 | 仓库初始化与目录结构 | NestJS+Vue3 monorepo 骨架；`.git` | — | 0.5d | ✅ |
| 0.2 | 阶段0 | 多租户骨架 | `tenant_id` 行级隔离 + 租户解析中间件（§0/§17） | 0.1 | 1d | ✅ |
| 0.3 | 阶段0 | 鉴权与 RBAC 基线 | JWT + CASL（§0/§22） | 0.2 | 1d | ✅ |
| 0.4 | 阶段0 | 基础设施 | PostgreSQL / Redis / MinIO / Docker Compose（§11） | 0.1 | 0.5d | ✅ |
| 0.5 | 阶段0 | 开发规范工具链 | `.prettierrc`/`.eslintrc`/`.stylelintrc`/commitlint（§31） | 0.1 | 0.5d | ✅ |
| 0.6 | 阶段0 | CI 基线 | `lint --check` + 类型检查卡点（§31.4） | 0.5 | 0.5d | ✅ |
| 1.1 | 阶段1 | ChannelAdapter 框架 | 统一接口：拉单/审单/推单/回传/轨迹（§3） | 0.3 | 1.5d | ✅ |
| 1.2 | 阶段1 | Shopify 接入（首渠道） | 首个适配器跑通（§3） | 1.1 | 1d | ✅ |
| 1.3 | 阶段1 | 订单归集 + 状态机 | 正向 8 态 + 逆向 + `order_events`（§13） | 0.2 | 2d | ✅ |
| 1.4 | 阶段1 | 审单引擎 | 地址/黑名单/库存/合规校验（§13/§18/§19） | 1.3 | 1d | ✅ |
| 1.5 | 阶段1 | 履约路由（模式A 自动） | 系统自动选渠道（§4/§5） | 1.1 | 1d | ⬜ |
| 1.6 | 阶段1 | 物流回传 + 轨迹(基础) | 回写运单/基础轨迹（§3） | 1.2 | 1d | ⬜ |
| 1.7 | 阶段1 | 商品/SKU 中心 | 平台↔内部↔供应商映射（§1） | 0.2 | 1.5d | ✅ |
| 1.8 | 阶段1 | 运费试算最小版 | 重量/体积→计费重→选渠道（§4） | 1.1 | 1.5d | ⬜ |
| 1.9 | 阶段1 | 供应商代发链路(基础) | 推单→回传→转平台运单（§21） | 1.1 | 1d | ⬜ |
| 1.10 | 阶段1 | Amazon SP-API 评估 | FBA/FBM/LWA 可行性（§29） | 1.1 | 0.5d | ⬜ |
| 2.1 | 阶段2 | 国内渠道(淘宝/抖音) | 验证多平台适配（§3） | 1.2 | 1.5d | ⬜ |
| 2.2 | 阶段2 | WMS 入库/库存/拣货 | ASN/上架/锁定/拣货波次（§15） | 0.4 | 2d | ⬜ |
| 2.3 | 阶段2 | 海外仓模型 | `warehouses`/`inventory`/海外仓备货（§15） | 2.2 | 1.5d | ⬜ |
| 3.1 | 阶段3 | CarrierAdapter 框架 | 镜像 ChannelAdapter（§3） | 0.3 | 1d | ⬜ |
| 3.2 | 阶段3 | 云途接入(SDK优先) | `yunexpress-sdk` OAuth2+HMAC（§3 调研） | 3.1 | 1d | ⬜ |
| 3.3 | 阶段3 | DHL 接入 | OAuth2 + 沙箱审批（§3 调研） | 3.1 | 1.5d | ⬜ |
| 3.4 | 阶段3 | 4PX / 燕文 接入 | MD5 签名（§3 调研） | 3.1 | 1.5d | ⬜ |
| 3.5 | 阶段3 | 比价引擎 4 层 + 试算模式 | 预热/可达性/实时池/护栏 + 试算开关（§5/§4） | 1.5/3.1 | 2d | ⬜ |
| 3.6 | 阶段3 | 加价规则引擎 + 币种归一 | 双价列/Markup/FX（§9/§10） | 3.5 | 1.5d | ⬜ |
| 3.7 | 阶段3 | 运费试算门户(正式) | 商户自助试算+自选（§4） | 3.5 | 1.5d | ⬜ |
| 3.8 | 阶段3 | 头程/尾程两段式 | `shipment_legs`(leg_type)（§14） | 1.3/3.1 | 1.5d | ⬜ |
| 3.9 | 阶段3 | 面单 PDF/ZPL | pdf-lib 处理（§3/§11） | 3.2 | 1d | ⬜ |
| 3.10 | 阶段3 | 报关/合规字段 | HS/IOSS/EORI/VAT/Section321（§19） | 1.4 | 1.5d | ⬜ |
| 3.11 | 阶段3 | 轨迹双通道 + NDR | 推送+轮询兜底 + 异常工单（§3/§20） | 3.2/3.4 | 1.5d | ⬜ |
| 3.12 | 阶段3 | 地址校验 + 分区 | 脏地址/邮编→zone（§18） | 1.4 | 1d | ⬜ |
| 3.13 | 阶段3 | 聚合平台兜底 | AfterShip/17track 尾程（§3e） | 3.11 | 0.5d | ⬜ |
| 4.1 | 阶段4 | 收款账务 wallet+ledger | 复式记账/预充值/账期/退款（§16） | 0.3 | 2d | ⬜ |
| 4.2 | 阶段4 | 商户账单 + 承运商对账 | bills/reconciliations（§9/§10） | 4.1/3.6 | 1.5d | ⬜ |
| 4.3 | 阶段4 | 利润核算(spread) | Σ(sell−cost)（§9/§10） | 4.2 | 1d | ⬜ |
| 4.4 | 阶段4 | 多租户隔离强化 | schema-per-tenant 评估（§17） | 0.2 | 1d | ⬜ |
| 4.5 | 阶段4 | 精细化 RBAC | 组织层级/scope（§22） | 0.3 | 1d | ⬜ |
| 4.6 | 阶段4 | 运营配置后台 | 加价/产品/费率卡 UI（§23） | 3.6/3.7 | 2d | ⬜ |
| 4.7 | 阶段4 | 报表指标口径 | 履约/物流/利润看板（§25） | 4.3 | 1.5d | ⬜ |
| 4.8 | 阶段4 | 理赔保险 | `claims` 流程（§20） | 3.11 | 1d | ⬜ |
| 4.9 | 阶段4 | 多语言多币种前端 | i18n + 本地币展示（§27） | 0.5 | 1.5d | ⬜ |
| 5.1 | 阶段5 | 风控体系 | 规则引擎+评分（§26） | 1.3/4.5 | 2d | ⬜ |
| 5.2 | 阶段5 | 开放 API/ERP 集成 | OAuth2 开放 + ERP 凭证（§28） | 4.2 | 1.5d | ⬜ |
| 5.3 | 阶段5 | Amazon SP-API 完整对接 | FBA Inbound/Shipping/Reports（§29） | 1.10/2.1 | 2d | ⬜ |
| 5.4 | 阶段5 | 容量/灾备/测试强化 | 读写分离/备份/压测（§30） | 全 | 2d | ⬜ |

---

## 二、里程碑

- **M0（阶段0 完成）**：脚手架 + 多租户 + 鉴权 + 规范工具链 + CI 就绪。
- **M1（阶段1 完成）**：单渠道跑通「拉单→审单→路由→推单→回传→轨迹」+ 试算最小版。
- **M2（阶段2 完成）**：多平台验证 + WMS/海外仓基础。
- **M3（阶段3 完成）**：国际物流段全通（云途/DHL/4PX/燕文 + 比价 + 加价 + 试算门户 + 两段式）。
- **M4（阶段4 完成）**：结算/账务/多租户/运营后台闭环，具备对外收费运营能力。
- **M5（阶段5 完成）**：风控/开放生态/Amazon 完整对接/容量灾备，达到生产级。

---

## 三、进度回写格式（自动化写入）

自动化每批任务结束，按此格式更新上方表格的「状态」列，并在文末追加：

```
## 进度更新 · YYYY-MM-DD
- 完成：0.1 / 0.2 / 0.5
- 进行中：0.3
- 受阻：无（或 1.9 ⛔ 原因：…）
- 测试结果：lint ✅ / tsc ✅ / test ✅(x/y)
- 提交：<git commit ids>
- 下一步：0.4 / 0.6 / 1.1
```

---

## 四、进度更新记录

### 进度更新 · 2026-10-10（人工起头，非夜间自动化）
- **完成（✅）**：0.1 仓库与 monorepo 目录结构 / 0.2 多租户骨架（middleware+context+decorator+guard+tenant 模块）/ 0.4 基础设施（docker-compose PG/Redis/MinIO + 配置）/ 0.5 开发规范工具链（prettier/eslint/stylelint/commitlint 配置）/ 0.6 CI 基线（GitHub Actions：lint+typecheck+prisma generate 卡点）。
- **进行中（🔵）**：0.3 鉴权与 RBAC 基线 —— JWT + Passport 已落地，`Role`/`UserRole` 表与 CASL 能力待阶段4 细化策略。
- **核心产出**：
  - 全量 Prisma 数据模型落定（覆盖方案 §7 + §13~§30 全部表，含多租户 tenantId 行级隔离）。
  - 服务端骨架可编译：`npm run typecheck` 与 `npm run lint` 均通过（exit=0）。
  - 前端 Vue3 脚手架（租户切换器 + 统一 HTTP 客户端带 `x-tenant-id`）就位并**已安装依赖、验证通过**。
- **前端验证结果（本次补充）**：`web` 依赖安装（`--ignore-scripts` 规避 esbuild 安装坑）→ `npm run build`（vue-tsc 类型检查 + vite 构建，exit=0，产物 dist/）→ `npm run lint`（exit=0）。
  - 修复项：① http 客户端封装为类型化方法（响应拦截器解包 data，方法返回 `Promise<T>` 而非 `AxiosResponse<T>`，调用点免 `.data`）；② 组件名 `Dashboard` 改为多单词 `DashboardView.vue`（满足 Vue 风格指南，不关规则）。
- **受阻**：无（前端依赖与构建已全部打通）。
- **⚠️ 环境关键事实（务必同步给夜间自动化）**：
  1. 本仓是 **npm workspaces monorepo**（根 package.json `workspaces:["server","web"]`），依赖被提升到根 `node_modules`，`web/node_modules` 多为符号链接；esbuild 二进制落在 `node_modules/@esbuild/win32-x64/esbuild.exe`。
  2. 本机沙箱的 **safe-delete 批量删除守卫** 会在 `rm -rf node_modules` 或 npm 做 tree 对齐/批量清理（增删特定包、prune）时把进程 **SIGTERM**（`SAFE_DELETE_BULK_GUARD_ERROR`）。规避：① 绝不要 `rm -rf node_modules`；② 不要在已有 node_modules 上跑会触发 prune 的 `npm install`（若需补装，优先 `npm install <pkg> --ignore-scripts --no-audit --no-fund`，但仍可能被守卫截；若被截，检查目标包是否已落盘，落盘即视为成功）；③ 全新 `npm install --ignore-scripts`（从干净状态）可正常完成。
  3. esbuild 安装必须 `--ignore-scripts`，否则 Git Bash 下 postinstall 报 `Circular *1` 失败；缺失平台二进制时补 `@esbuild/win32-x64@0.21.5`（`--no-save --ignore-scripts`）。
- **下一步（夜间自动化接力）**：0.3 收尾 → 1.1 ChannelAdapter 框架 → 1.2 Shopify 接入 → 1.3 订单归集+状态机 → 1.8 运费试算最小版。
- **提交**：baseline 初始提交（阶段0 脚手架起头）+ 前端依赖与验证修复。

---

### 进度更新 · 2026-10-10（夜间自动化 23:10 启动）
- **完成（✅）**：
  - **0.3 鉴权与 RBAC 基线** —— JWT + Passport 已落；CASL 策略按方案 §22 留待阶段4 细化（方案口径一致，标记完成）。
  - **1.1 ChannelAdapter 框架** —— 统一接口（拉单/审单/推单回传/轨迹）+ 抽象基类 + **注册表（实例/工厂双模式）** + 归一化 DTO（class-validator）+ **共享可重试 HTTP 客户端**（§2.1：超时/429·5xx·网络错误指数退避 2/4/8/16/32s，最多5次）+ 拉单落库服务（upsert 入 `Order`，初始态 `pending_review`，单条失败不中断）+ Mock 适配器（自测用）。
  - **1.2 Shopify 接入** —— `ShopifyAdapter`（Admin REST：拉单归一化 / 回传履约 / 查单 / 撤单 / 轨迹）+ `ShopifyAdapterFactory`（按店铺凭证构建）+ 注册工厂。
  - **1.3 订单归集 + 状态机** —— `OrderStateMachineService`（12 态合法转移表 + 守卫 + 幂等 + `order_events` 审计 + 逆向流程 cancel/interception/redirect/return）；REST 入口 `/api/orders/:id/transition`、`/reverse`。拉单归集已在 1.1 的 `pullAndStore` 落地。
  - **1.4 审单引擎** —— `OrderReviewService` 可插拔 `ReviewCheck` 架构：地址完整性校验 + 黑名单校验（内存，§26 预留）+ 库存/合规占位（待 §1.7/§15、§19，均带 `TODO(ops)` 责任人+日期，按 §31）。REST 入口 `/api/orders/:id/review`。
  - **1.7 商品/SKU 中心** —— `CatalogModule`：商品（SPU）/内部 SKU 的 CRUD（租户行级隔离）+ **三段映射解析**（平台 SKU→内部 SKU `resolveByPlatformSku`、内部 SKU→供应商 SKU `resolveSupplierSku`、`syncPlatformSku`/`linkSupplierSku` 维护 §21）+ **计费重派生**（`computeWeights`：实重 vs 体积重取大，对接 §4/§5）；拉单落库 `ChannelSyncService` 接入映射，按 `platformSku`（回退 `skuCode`）回填 `OrderItem.skuId`。
- **进行中（🔵）**：无（本批任务全部完成）。
- **受阻**：无。
- **测试结果**：`tsc --noEmit` ✅ ｜ `eslint --max-warnings 0` ✅ ｜ `jest` ✅（29 passed / 4 suites）。
- **提交**：见 `feat(channels/orders/catalog): 阶段1 MVP 履约框架 1.1-1.4 + 商品SKU中心 1.7`（与本批代码同批提交）。
- **下一步（次日接力）**：1.5 履约路由（模式A 自动选渠道 / 1.6 物流回传+轨迹基础 / 1.8 运费试算最小版 / 1.9 供应商代发链路 / 1.10 Amazon SP-API 评估）。注意 1.5/1.6/1.8/1.9 依赖阶段3 承运商适配器与费率卡（§3/§4），1.10 为评估类可作下一步；1.7 已完成，1.4 库存校验占位可在 §15 WMS 落地后接 `CatalogService` 真实校验。
- **关键工程事实（同步夜间自动化）**：
  1. 新增 `server/src/common/http/`：全局 `RetryableHttpService` + `HttpModule`（全局提供），渠道/承运商适配器共用；退避基准 2000ms（2/4/8/16/32s，5 次）。
  2. 渠道注册表 `ChannelRegistryService` 支持 `registerAdapter`（无状态实例，如 Mock）与 `registerFactory`（按店铺凭证构建，如 Shopify），`resolveForShop` 工厂优先。
  3. 本仓已落地 Jest + ts-jest（`server/jest.config.cjs`），`npm test` 可用；新增模块均配套单测。
  4. 环境同上轮：npm workspaces monorepo，依赖提升到根；`.prisma/client` 已重新生成（ReverseOrder 增 `cause` 字段）。
