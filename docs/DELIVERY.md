<div align="center">

# 📦 交付与集成状态总览

**v1.5 收尾 · 2026-11-02 · 方案 §31 对齐产出**

[![MIT](https://img.shields.io/badge/License-MIT-16a34a?style=flat-square)](../LICENSE)
[![74 / 74](https://img.shields.io/badge/progress-74%2F74-16a34a?style=flat-square)](../dev-schedule.md)
[![426 tests](https://img.shields.io/badge/tests-426-16a34a?style=flat-square)](../server/src/)

[🏠 返回首页](../README.md)　·　[🚀 部署指南](../deploy/README.md)　·　[📊 进度真相源](../dev-schedule.md)

</div>

> [!IMPORTANT]
> 本文件对齐方案权威规格、进度真相源（`dev-schedule.md`）与代码现状，给出**可验证的交付清单**与**诚实的待办清单**。
> ✅ 表示代码已落地并有单测覆盖；⏳ 表示仍待真机环境或外部联调。**未验证的项一律不标记为完成。**

## 目录

- [1. v1.5 主线交付总览](#1-v15-主线交付总览)
- [2. 平台凭证工厂 ↔ 注册表真实桥接](#2-平台凭证工厂--注册表真实桥接)
- [3. 诚实待办清单](#3-诚实待办清单上线前必须消除的技术债)
- [4. 运行方式](#4-运行方式演示--生产)
- [5. 接入真实平台凭证 SOP](#5-如何接入真实平台凭证运营实施-sop)
- [6. 进度查看入口](#6-进度查看入口)

**状态图例**：✅ 已完成　·　⏳ 待联调 / 待环境　·　⏭️ 被后续版本覆盖

---

## 1. v1.5 主线交付总览

| 维度 | 状态 |
| :--- | :--- |
| 方案版本 | v1.5（主链路 §1~§11 + 审计清单 §12 + 18 项细化 §13~§30 + 开发规范 §31） |
| 任务完成度 | **74 / 74（100%）** —— 阶段 0~11 全部收口（含阶段 11 上线前技术债） |
| 安全加固 | 9.1~9.8 全部完成：JWT 全局守卫 / 租户 JWT 派生 / 生产密钥 fail-fast / 租户隔离缺省拒绝 / OpenAPI 守卫 / 承运成本 null / 构建收敛 / Web 登录页 |
| 端到端作业流 | 采购 → 中转仓扫码入库 → 打包核对 → 跨境面单 → 出库回传 → 正式跨境物流，全链路闭环 |
| 可视化 | 全部业务能力均提供前端页面（演示 / 正式双路），详见「开发进度」页（`/progress`） |

<details>
<summary><b>能力域清单（点击展开）</b></summary>

渠道接入（Shopify / Amazon / Mock + 淘宝 / 抖音演示）、订单归集与状态机、审单引擎、履约路由、物流回传与轨迹、商品 / SKU 中心、供应商代发、比价引擎 + 加价 + 币种归一、运费试算门户、头程 / 尾程两段式、面单 PDF / ZPL、报关 / 合规、轨迹双通道 + NDR、地址校验 + 分区、聚合平台兜底、收款账务（wallet + ledger）、账单 + 承运商对账、利润核算、多租户隔离强化、精细化 RBAC、运营配置后台、报表看板、理赔保险、多语言多币种、风控体系、开放 API / ERP 集成、Amazon SP-API 完整对接、容量 / 灾备、条码介质与 PDA 接入、平台凭证工厂化接入、安全加固续。

</details>

---

## 2. 平台凭证工厂 ↔ 注册表真实桥接

**问题**：任务 8.1 / 8.2 已建成「平台凭证工厂」（`platform-credentials` 模块），可加密落库淘宝 TOP / 抖音 / 云途 / DHL / 4PX / 燕文的密钥，但**凭证与真实适配器之间未打通** —— `PlatformAdapterFactory.resolveAdapter` 仅返回 `scaffold-todo` 描述符，适配器无法真正消费已存凭证。

**落地**（`integration-bridge.service.ts` + `GET /platform-credentials/integration` + 前端「平台凭证管理」页桥接徽章）：

- 新增 `PlatformIntegrationBridgeService`，注入 `PlatformCredentialService` + `CarrierRegistryService` + `ChannelRegistryService`；
- **承运商侧**：`yunexpress / dhl / fourpx / yanwen` 已配置凭证时，经注册表工厂构建**真实适配器实例**，解密凭证作为 `authConfig` 注入；
- **渠道侧**：`taobao / douyin` 已配置凭证时，经注册表取到已注册演示实例（`Shopify / Amazon` 为店铺级凭证，真实 OAuth 联调为 TODO）；
- **诚实原则**：本服务只完成「凭证 → 适配器实例」装配与可达性判定，**绝不发起真实联网调用**；各适配器内部真实 HTTP 端点 / 字段仍为合理占位（`TODO(ops): 2026-11 联调校正`），集成快照中 `realApiTodo` 一律为 `true`。

### 桥接状态表（前端 / 后端同口径）

| 平台 | 侧 | 凭证工厂 | 适配器桥接（凭证存在时） | 真实 API 联调 |
| :--- | :--- | :---: | :--- | :---: |
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

| # | 项 | 状态 | 说明 |
| :---: | :--- | :---: | :--- |
| 1 | 真实平台 API 联调 | ⏳ | **2026-11，责任人：ops**。云途 HMAC / DHL OAuth2 / 4PX·燕文 MD5 / 淘宝 TOP Session / 抖音 OAuth2 的真实端点与字段校正；当前全部为占位（`TODO(ops): 2026-11 联调校正`）。 |
| 2 | 承运成本回传 | ⏳ | 9.6 已把 `carrierCost` 占位 `0` 改为 `null`（**占位防御已做**），成本待真实回传；`generateBills` 已排除 `null`，避免「已售却无成本」的虚高利润。 |
| 3 | 凭证持久化 | ✅ | **2026-11-03 夜间批次 11.1 完成**。`PlatformCredential` 模型（`(tenantId, platform)` 唯一约束 upsert 幂等覆盖）+ `PrismaCredentialStore`，租户行级隔离；单测覆盖。运行时需 PostgreSQL。 |
| 4 | 分布式缓存 | ✅ | **2026-11-08 夜间批次 11.3 完成**。`common/cache`（`CacheService` + 内存 / Redis 双后端 + 优雅降级），承运商 OAuth 令牌按账号共享。生产启用共享缓存需部署 Redis 并配 `REDIS_URL`。 |
| 5 | 本机 PG 端到端验证 | ⏳ | 沙箱无 Docker、本机 PG 停服，未跑起真实 PostgreSQL；需按 [部署指南第六节](../deploy/README.md#六首次上线核验清单逐条打勾再正式用) 逐条验收。 |
| 6 | 费用 / 对账持久化 | ⏭️ | 11.2 已将 quote / FX / 加价规则三服务下沉到 `quotes` / `fx_rates` / `markup_rules` 表（§7 / §10.6），本项已覆盖。 |

> [!NOTE]
> 第 1 / 2 / 5 项属于**沙箱内不可验证**（需真实密钥、真实回传、真机基础设施），本次不伪造通过、不虚假推进。

---

## 4. 运行方式（演示 / 生产）

### 零依赖演示模式（推荐先看成果）

```bash
# 前端内置 mock 数据，由 web/.env 的 VITE_USE_MOCK=true 开启（默认）
npm install --ignore-scripts
npm run dev --workspace web
# 打开 http://localhost:5173
```

> 演示模式下全部业务页面可直接交互改写内存状态，**无需后端 / 数据库**。

### 正式模式（Docker 24+ / Compose v2）

```bash
git clone https://github.com/fuyegongfang-star/dropshipping-ops.git /opt/dropshipping-ops
cd /opt/dropshipping-ops
./deploy/bootstrap.sh        # 生成密钥 → 构建 → 起 5 个服务 → 等待 /api/health
```

> **生产构建必须 `VITE_USE_MOCK=false`**（`npm run build:prod`），否则 `vite build` 直接失败并提示，杜绝演示假数据上生产（安全加固 9.7）。后端生产启动会校验 `JWT_SECRET` / `APP_MASTER_KEY`，缺失即 fail-fast 拒绝（9.3）。完整步骤见 [`deploy/README.md`](../deploy/README.md)。

---

## 5. 如何接入真实平台凭证（运营 / 实施 SOP）

1. 以 `super` 角色进入「平台凭证管理」页（`/platform-credentials`），对目标平台点「配置」填入密钥；
2. 后端经 AES-256-GCM 加密落库（明文绝不持久化），列表 / 接口不返回明文；
3. 桥接层（10.1）在凭证存在时自动把密钥注入对应适配器 `authConfig`；
4. 待第 3 节的真实端点校正（待办 1）完成后，适配器即可发起真实调用 —— 届时 `realApiTodo` 置否、桥接徽章转为「已联调」。

> ⚠️ `APP_MASTER_KEY` 一旦轮换，库里已加密的凭证将无法解密。部署脚本默认**沿用已有 `.env`**，请勿随意 `--reset-env`。

---

## 6. 进度查看入口

- 网页「开发进度」页（`/progress`）与仪表盘「最近交付能力」卡片：由 `npm run progress:gen` 解析 `dev-schedule.md` 自动生成 `web/src/api/dev-progress.ts`，次日刷新即可见。
- 真相源：[`dev-schedule.md`](../dev-schedule.md) ｜ 每日日报：[`progress-log.md`](../progress-log.md)。
- 任务 `10.1` 已写入进度表并标记 ✅，已随对应批次提交。

---

<div align="center">

[MIT](../LICENSE) © 2026 fuyegongfang-star · 本文件随代码一同维护，状态与代码不一致时以代码为准

</div>
