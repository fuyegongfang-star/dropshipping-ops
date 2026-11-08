# 交付与集成状态总览（v1.5 收尾 · 2026-11-02）

> 本文件为「一件代发 + 货代运营 SaaS」方案的 **§31 收尾文档对齐** 产出，配套夜间自动开发引擎的收官批次（任务 10.1）。
> 它对齐方案权威规格、开发进度真相源（`dev-schedule.md`）与代码现状，给出**可验证的交付清单**与**诚实的待办清单**。

---

## 1. v1.5 主线交付总览

| 维度 | 状态 |
| --- | --- |
| 方案版本 | v1.5（主链路 §1~§11 + 审计清单 §12 + 18 项细化 §13~§30 + 开发规范 §31） |
| 任务完成度 | **70 / 70（100%）** —— 阶段0~阶段9 全部收口 |
| 安全加固 | 9.1~9.8 全部完成（JWT 全局守卫 / 租户 JWT 派生 / 生产密钥 fail-fast / 租户隔离缺省拒绝 / OpenAPI 守卫 / 承运成本 null / 构建收敛 / Web 登录页） |
| 端到端作业流 | 采购 → 中转仓扫码入库 → 打包核对 → 跨境面单 → 出库回传 → 正式跨境物流，全链路闭环 |
| 可视化 | 全部业务能力均提供前端页面（演示 / 正式双路），详见「开发进度」页（`/progress`） |

**主线已覆盖的能力域**：渠道接入（Shopify/Amazon/Mock + 淘宝/抖音演示）、订单归集与状态机、审单引擎、履约路由、物流回传与轨迹、商品/SKU 中心、供应商代发、比价引擎 + 加价 + 币种归一、运费试算门户、头程/尾程两段式、面单 PDF/ZPL、报关/合规、轨迹双通道 + NDR、地址校验 + 分区、聚合平台兜底、收款账务（wallet+ledger）、账单 + 承运商对账、利润核算、多租户隔离强化、精细化 RBAC、运营配置后台、报表看板、理赔保险、多语言多币种、风控体系、开放 API/ERP 集成、Amazon SP-API 完整对接、容量/灾备、条码介质与 PDA 接入、平台凭证工厂化接入、安全加固续。

---

## 2. 本批次交付：10.1 凭证工厂 ↔ 注册表 真实桥接

**问题**：任务 8.1/8.2 已建成「平台凭证工厂」（`platform-credentials` 模块），可加密落库淘宝 TOP / 抖音 / 云途 / DHL / 4PX / 燕文的密钥，但**凭证与真实适配器之间未打通**——`PlatformAdapterFactory.resolveAdapter` 仅返回 `scaffold-todo` 描述符，适配器无法真正消费已存凭证。

**本次落地**（`server/src/modules/platform-credentials/integration-bridge.service.ts` + 控制器 `GET /platform-credentials/integration` + 前端「平台凭证管理」页桥接徽章）：

- 新增 `PlatformIntegrationBridgeService`，注入 `PlatformCredentialService` + `CarrierRegistryService` + `ChannelRegistryService`；
- **承运商侧**：`yunexpress / dhl / fourpx / yanwen` 已配置凭证时，经 `CarrierRegistryService` 工厂构建**真实适配器实例**，解密凭证作为 `authConfig` 注入（与 3.2~3.4 适配器构造约定一致）；
- **渠道侧**：`taobao / douyin` 已配置凭证时，经 `ChannelRegistryService` 取到已注册演示实例（`Shopify / Amazon` 为店铺级凭证，超出平台凭证范畴，真实 OAuth 联调为 TODO）；
- **诚实原则**：本服务只完成「凭证 → 适配器实例」装配与可达性判定，**绝不发起真实联网调用**；各适配器内部真实 HTTP 端点/字段仍为合理占位（`TODO(ops): 2026-11 联调校正`），故集成快照中 `realApiTodo` 一律为 `true`。

### 桥接状态表（前端 / 后端同口径）

| 平台 | 侧 | 凭证工厂 | 适配器桥接（凭证存在时） | 真实 API 联调 |
| --- | --- | --- | --- | --- |
| 云途 YunExpress | 承运 | ✅ | ✅ 注册表工厂 → `yunexpress` 适配器 | ⏳ TODO |
| DHL Express | 承运 | ✅ | ✅ 注册表工厂 → `dhl` 适配器 | ⏳ TODO |
| 递四方 4PX | 承运 | ✅ | ✅ 注册表工厂 → `fourpx` 适配器 | ⏳ TODO |
| 燕文 Yanwen | 承运 | ✅ | ✅ 注册表工厂 → `yanwen` 适配器 | ⏳ TODO |
| 淘宝 TOP | 渠道 | ✅ | ✅ 注册表演示实例 → `taobao` | ⏳ TODO（店铺级 OAuth） |
| 抖音开放平台 | 渠道 | ✅ | ✅ 注册表演示实例 → `douyin` | ⏳ TODO（店铺级 OAuth） |

> 前端「平台凭证管理」页（`/platform-credentials`）每个平台卡片新增**桥接徽章**：`已桥接适配器`（绿）/ `待联调`（黄）/ `未配置`（灰），并标注「真实 API 联调：TODO」。演示（`mock-data.ts`）与正式（后端）双路同口径。

---

## 3. 诚实待办清单（上线前必须消除的技术债）

以下为收尾时仍**未闭环**的项，统一标注责任人与排期，禁止静默遗留：

1. **真实平台 API 联调**（2026-11，责任人：ops）：云途 HMAC / DHL OAuth2 / 4PX·燕文 MD5 / 淘宝 TOP Session / 抖音 OAuth2 的**真实端点与字段**校正；当前全部为占位（`TODO(ops): 2026-11 联调校正`）。
2. **承运成本回传**（已做占位防御）：9.6 已将 `carrierCost` 占位 `0` 改为 `null`，成本待真实回传；`generateBills` 已对 `null` 做排除，避免利润虚高。待 §9 费用回传回填真实成本。
3. **凭证持久化**：✅ **已完成（2026-11-03 夜间批次 11.1）**。`platform-credentials` 原进程级内存存储端口（`InMemoryCredentialStore`）已下沉为 **Prisma 持久化 + 租户行级隔离**——新增 `PlatformCredential` 模型（`(tenantId, platform)` 唯一约束 upsert 幂等覆盖），实现 `PrismaCredentialStore`（实现同一 `CredentialStorePort`，仅切换 `CREDENTIAL_STORE` 绑定即可，上层服务/控制器/工厂仅增 `await`）；运行时需 PostgreSQL（沙箱无 Docker 未端到端验证，本地 `prisma db push` 后即可生效）。单测 `prisma-credential-store.spec.ts`（mock PrismaService）验证租户隔离与查询形态。
4. **分布式缓存**：✅ **已完成（2026-11-08 夜间批次 11.3）**。新增 `common/cache` 模块（`CacheService` + `MemoryCacheBackend` 默认零依赖 + `RedisCacheBackend` ioredis 懒加载 + `CacheModule` 全局，REDIS_URL 驱动后端选择，Redis 不可用优雅降级内存）；承运商 OAuth 令牌（云途/DHL）已由实例内存升级为按账号共享缓存（跨实例去重避免重复换取触发承运商限流）。代码已就绪可投产；生产真正启用「共享缓存」需部署 Redis 并配置 `REDIS_URL`（沙箱无 Redis，默认走内存，单测覆盖内存/Redis 双路径）。FX 汇率仍走内存热缓存（§10.3 同步零 await 热路径不受影响，后续可经 CacheService 加二级缓存）。
5. **本机 PG 端到端验证**：沙箱无 Docker，未跑起真实 PostgreSQL；用户需按 README 起库后做端到端验收。
6. **费用/对账持久化**：quote 内存表、FX/加价规则内存表待落 `quotes` / `markup_rules` 等表（§7/§10.6）。

---

## 4. 运行方式（演示 / 生产）

### 零依赖演示模式（推荐先看成果）
```bash
# 前端内置 mock 数据，由 web/.env 的 VITE_USE_MOCK=true 开启（默认）
npm run dev --workspace web
# 或：npm run build --workspace web && npm run preview --workspace web
```
> 演示模式下全部业务页面可直接交互改写内存状态，**无需后端 / 数据库**。

### 正式模式（需 Docker + Node 20+）
```bash
# 1. 基础设施（PG / Redis / MinIO）
docker compose -f deploy/docker-compose.yml up -d
# 2. 建表 + 种子
cd server && npx prisma db push && npm run seed
# 3. 后端（:3000）+ 前端（:5173）
npm run start --workspace server & npm run dev --workspace web
```
> **生产构建必须 `VITE_USE_MOCK=false`**（`npm run build:prod`），否则 `vite build` 直接失败并提示，杜绝演示假数据上生产（安全加固 9.7）。后端生产启动会校验 `JWT_SECRET` / `APP_MASTER_KEY` 缺失即 fail-fast 拒绝（9.3）。

---

## 5. 如何接入真实平台凭证（运营/实施 SOP）

1. 以 `super` 角色进入「平台凭证管理」页（`/platform-credentials`），对目标平台点「配置」填入密钥；
2. 后端经 AES-256-GCM 加密落库（明文绝不持久化），列表/接口不返回明文；
3. 桥接层（10.1）在凭证存在时自动把密钥注入对应适配器 `authConfig`；
4. 待 §3 真实端点校正与持久化（待办 1/3）完成后，适配器即可发起真实调用——届时 `realApiTodo` 置否、桥接徽章转为「已联调」。

---

## 6. 进度查看入口

- 网页「开发进度」页（`/progress`）与仪表盘「最近交付能力」卡片：由 `npm run progress:gen` 解析 `dev-schedule.md` 自动生成 `web/src/api/dev-progress.ts`，次日刷新即可见。
- 本次新增任务 `10.1` 已写入进度表并标记 ✅，已随本批次提交。
