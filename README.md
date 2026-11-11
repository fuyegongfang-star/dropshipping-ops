# 一件代发货代运营系统（dropshipping-ops）

> 多租户 SaaS：一件代发 + 货代运营，全渠道（跨境 + 国内 + 独立站），国际物流段对接云途 / DHL / 4PX / 燕文。
> 关联架构方案：`../dropshipping-fulfillment-architecture-plan.md`（v1.5）
> 开发进度：`dev-schedule.md` ｜ 夜间自动开发日报：`progress-log.md`

## 技术栈

- **后端**：Node 20 + NestJS + TypeScript + PostgreSQL + Redis + BullMQ + MinIO + Prisma
- **前端**：Vue3 + Vite + TypeScript + Element Plus + Pinia + ECharts
- **基础设施**：Docker Compose（PG / Redis / MinIO / server / web）
- **规范**：方案 §31 —— 注释清晰、代码整齐（Prettier + ESLint + Stylelint + Conventional Commits）

## 目录结构

```
dropshipping-ops/
├── server/                 # NestJS 后端
│   ├── src/
│   │   ├── common/         # 跨模块公共能力：多租户、鉴权、统一响应/异常、日志
│   │   ├── config/         # 环境变量配置
│   │   ├── modules/        # 业务模块（按 feature 切分）
│   │   ├── database/       # Prisma 连接
│   │   ├── main.ts
│   │   └── app.module.ts
│   ├── prisma/
│   │   └── schema.prisma   # 全量数据模型（含多租户 tenantId）
│   └── ...
├── web/                    # Vue3 前端
├── deploy/
│   └── docker-compose.yml  # 本地一体化基础设施
└── dev-schedule.md         # 开发进度表（唯一进度真相源）
```

## UI 设计体系

> 前端遵循统一设计系统，所有页面共用同一套设计令牌（集中在 `web/src/styles/theme.css`）。
> 采用纯 CSS 方案：在 Element Plus 官方样式**之后**覆盖其 CSS 变量，因此无需引入 sass 或额外构建插件。

- **品牌主色**：靛蓝渐变家族（`#4F6EF7 → #3047C4`），辅以青 / 橘 / 紫作语义强调；中性灰阶采用现代 Slate 色板。
- **布局**：深色渐变侧边栏（图标菜单 + 可折叠）＋ 白底轻阴影顶栏 ＋ 浅灰主内容区，层级分明。
- **圆角与阴影**：卡片 16px 圆角、柔和分层阴影、悬停上浮，摒弃 Element Plus 默认扁平观感。
- **状态分级**：订单 / 租户 / 平台状态统一使用柔和胶囊标签（绿 / 琥珀 / 红 / 蓝 / 青），语义清晰不刺眼。
- **图标**：`web/src/components/AppIcon.vue` 提供零依赖内联 SVG 线性图标集（不引入图标字体包）。
- **统一页头**：`web/src/components/PageHeader.vue`（图标徽章 + 标题/副标题 + 右侧操作插槽），五张业务页共用。
- **动效**：路由切换 fade-slide 过渡、按钮与卡片悬停位移，克制统一。

改版涉及文件：`styles/theme.css`、`layouts/BasicLayout.vue`、`components/AppIcon.vue`、
`components/PageHeader.vue`、`views/{Dashboard,Orders,Catalog,Channels,Tenants}View.vue`。

> 约定：新增页面请沿用上述令牌（颜色用 `var(--*)` 变量），避免散落的硬编码色值。

## 快速开始（需联网安装依赖）

```bash
# 1. 安装依赖（根目录，workspaces 会一并装 server / web）
npm install

# 2. 生成 Prisma Client
npm run prisma:generate

# 3. 启动基础设施（PG / Redis / MinIO）
docker compose -f deploy/docker-compose.yml up -d

# 4. 后端开发
npm run start:dev --workspace server

# 5. 前端开发
npm run dev --workspace web
```

## 零依赖快速预览（演示模式，推荐先看这个）

> 只想**立刻在浏览器看到成果**、先不装 Docker / 数据库？用演示模式即可。
> 前端内置一套 mock 数据（`web/src/api/mock-data.ts`），由 `web/.env` 的 `VITE_USE_MOCK=true` 开启，
> 所有页面（订单 / 商品SKU / 渠道 / 租户 / 看板）纯前端渲染，且审单 / 状态转移 / 逆向 / 拉单都可交互。

```bash
# 1. 安装依赖（已装可跳过）
npm install --ignore-scripts

# 2. 启动前端（演示模式默认开启，无需后端 / 数据库）
npm run dev --workspace web
# 或构建后用静态服务预览：npm run build --workspace web && npm run preview --workspace web
```

打开 **http://localhost:5173** 即可。顶部右上角已默认选中 `demo` 租户。
确认无误后，想接真实后端再看「本地跑起来看成果」章节（需 Docker + PostgreSQL）。

> 关闭演示模式：删除 `web/.env` 或将其改为 `VITE_USE_MOCK=false`，此时前端走真实 `/api` 代理到后端。

### 页面一览（演示模式下均可直接交互）

| 菜单 | 路由 | 主要能力 |
|---|---|---|
| 仪表盘 | `/` | 核心指标统计卡、订单状态分布、**最近交付能力** |
| 订单中心 | `/orders` | 审单 / 状态转移 / 逆向、明细抽屉与事件时间线 |
| 商品 / SKU | `/catalog` | 平台↔内部↔供应商三段映射、计费重 |
| 渠道 / 店铺 | `/channels` | 店铺列表、Mock 店一键拉单 |
| 承运商管理 | `/carriers` | 云途 / DHL / 4PX / 燕文 · 六能力矩阵 + 健康状态 |
| 运费试算 | `/quotes` | 四层比价引擎痕迹 + 成本/售价双价列 + 渠道自选 |
| 运营配置 | `/pricing` | **加价规则可自定义增删改**（幅度行内改）+ 汇率调整 + 效果预览 |
| 站点设置 | `/settings/site` | **站点名称 / 品牌标识 / 首页 TDK / 页面 TDK 规则 / 统计代码 / 效果预览**（`super` 专属） |
| 租户管理 | `/tenants` | 多租户切换与隔离验证 |
| 开发进度 | `/progress` | 任务清单 / 完成度 / 最近交付（自动开发产出可视化） |

> 「运营配置」「站点设置」页的改写在演示模式下写入浏览器 `localStorage`，**刷新后仍保留**；两页均提供「重置演示数据」恢复初始种子。

### 站点设置（站点名称 / TDK / 统计代码）

`系统设置 → 站点设置`，四大页签：

- **基础信息**：站点名称（必填）、副标题 Slogan、域名、备案号、Logo / Favicon、版权、客服邮箱与电话、默认语言与时区；
  右侧「品牌预览」实时展示 LOGO 与站点名的实际观感。
- **SEO / TDK**：首页 Title / Description / Keywords（带字数提示，超长标红）+ 标题拼接规则（分隔符、是否追加站点名，
  已含站点名时自动去重）+ **页面 TDK 规则表**（首页 / 商品详情 / 品类 / 运费试算 / 资讯 / 自定义，可增删改与启停，
  模板支持 `{site}` `{name}` `{category}` 变量）。
- **统计与代码**：头部 / 底部第三方代码注入、站长验证 meta、Sitemap 开关、`robots.txt`。
- **效果预览**：浏览器标签页效果 + 搜索结果片段（SERP）实时渲染。

站点名称保存后**立即联动后台侧栏 LOGO 与浏览器标签页标题**（`web/src/stores/site.ts`），改完即可见。

### 开发进度可视化（每天都能看到新功能）

夜间自动开发每完成一批任务后，会运行进度生成器把 `dev-schedule.md` 的任务表同步到前端：

```bash
npm run progress:gen   # 生成 web/src/api/dev-progress.ts（任务清单 / 统计 / 最近交付）
```

生成物是静态数据，**演示模式与正式模式都直接可读**，因此第二天刷新网页即可在：

- 左侧菜单 **开发进度**（`/progress`）—— 看到新完成的任务、NEW 高亮与「去查看」入口；
- **仪表盘 → 最近交付能力** 卡片 —— 快速看到最近交付的几项；
- 顶栏 **铃铛「本次更新」** —— 有新增产出时显示红点，点开即列出最新完成的能力。

> 该机制已写入夜间自动化提示词的「可视化交付铁律」：业务任务必须同时交付页面/菜单/路由与 mock 数据，纯后端任务至少在进度页有条目，且每批结束必须重新生成并提交进度数据。

## 交付形态与角色隔离（上线时怎么切）

本系统的「演示脚手架」与「内部视图」都做了隔离，**上线交付无需删代码**：

| 组件 | 隔离方式 | 交付时动作 |
|---|---|---|
| Mock 演示数据 | 环境变量 `VITE_USE_MOCK`（默认 true） | 交付设 `VITE_USE_MOCK=false`，前端改走真实后端 `/api`；mock 分支不再执行 |
| 加价规则本地持久化 | 仅 mock 分支写入 `localStorage` | 正式模式走后端 API 落库，无需处理 |
| 站点设置（站点名称 / TDK）、开发进度页 `/progress`、本次更新提醒、租户管理页 | 角色 `super` 专属（菜单过滤 + 路由守卫 `meta.roles`） | 平台运营方（你）可见；外部卖家租户登录后自然看不到 |

- **角色**：前端 `web/src/stores/user.ts` 定义 `super`（平台运营方）/ `seller`（卖家租户）。
  演示模式下顶栏可切换身份以验证隔离效果；真实部署时角色应由登录接口返回并写入该 store。
  ⚠️ 前端显隐只是体验层，**不替代后端鉴权**——接口侧仍须按角色做权限校验。
- 一句话：**开发期能看到全部，是因为默认身份就是 `super`；交付给卖家后他们登录即自动只见业务功能。**

## 生产部署（硬编码约束，review B3）

> **生产构建必须 `VITE_USE_MOCK=false`**，否则 `vite build` 直接失败并给出明确提示，杜绝把「演示假数据」误上生产。

- 前端：`web/vite.config.ts` 在 `mode==='production'` 时强制校验 `VITE_USE_MOCK`，缺省（未设置）或 `true` 一律拒绝。
- 正确姿势（二选一）：
  ```bash
  npm run build:prod                 # 自动 VITE_USE_MOCK=false 生产构建
  # 或显式指定：
  VITE_USE_MOCK=false npm run build  # 等价于 build:prod
  ```
- 本地演示 / 预览仍用 `npm run dev`（开发模式不受限）。
- 后端：当前 `server` 无 `USE_MOCK` 残留分支，生产即为真实链路（PostgreSQL + Redis + BullMQ + MinIO）；生产部署时请确认 `JWT_SECRET` / `APP_MASTER_KEY` 已配置（缺省会在启动期 fail-fast 拒绝，见方案 §31 / 安全加固 9.3）。

## 本地跑起来看成果（含演示数据）

> 目标：在你本机把前后端跑起来，打开浏览器直观看到「订单中心 / 商品SKU / 渠道 / 租户」与状态机、审单、逆向等能力。
> 本机需已安装 **Docker**（用于 PG/Redis/MinIO）与 **Node 20+**。

```bash
# 0. 仓库根目录安装依赖（workspaces 一并装 server / web；esbuild 在 Windows Git Bash 下需 --ignore-scripts）
npm install --ignore-scripts

# 1. 生成 Prisma Client
npm run prisma:generate --workspace server

# 2. 启动基础设施（PostgreSQL / Redis / MinIO）
docker compose -f deploy/docker-compose.yml up -d

# 3. 建表（按 schema 直接推送，无需迁移历史，适合本地演示）
cd server && cp .env.example .env && npx prisma db push && cd ..

# 4. 写入演示数据：租户 demo + 店铺(Shopify/Amazon/Mock) + 商品/SKU + 多状态订单
npm run seed --workspace server

# 5. 启动后端（:3000）
npm run start:dev --workspace server

# 6. 另开终端启动前端（:5173）
npm run dev --workspace web
```

打开浏览器访问 **http://localhost:5173** 即可。顶部右上角已默认选中 `demo` 租户，所有数据按租户隔离展示。

**建议体验路径**
- **订单中心**：点「详情」→ 试「审单」（待审单会转 approved / rejected）、「状态转移」（按合法转移表候选目标态）、「逆向」（撤单/拦截/改址/退货）。
- **渠道中心**：对 **Mock 演示店** 点「拉单」，会实时生成 `pending_review` 订单（Shopify/Amazon 需配置真实凭证，否则返回错误，可观察异常处理）。
- **商品/SKU**：查看平台↔内部↔供应商三段映射与「计费重」（实重 vs 体积重取大）。
- **租户管理**：新建租户并「切换查看」，验证行级隔离。

> 生产部署请用 `npx prisma migrate dev --name init` 管理迁移，而非 `db push`；并收紧 CORS 与 `x-tenant-id` 校验（见方案 §17）。

## 多租户约定

- 所有业务表带 `tenantId`（行级隔离，见方案 §0 / §17）。
- 租户上下文由 `common/tenant` 中间件从子域名或请求头 `x-tenant-id` 解析，注入 `AsyncLocalStorage`，供 Service 层自动过滤。

## 开发纪律（强制，方案 §31）

- 注释：业务逻辑 Why 优先、中文注释、字段带单位与业务含义、TODO 带责任人+日期。
- 代码：函数 ≤50 行、文件 ≤400 行、按 feature 切分、禁 magic number、统一响应/异常/日志。
- 提交：Conventional Commits（feat/fix/refactor/docs… + 中文简述）。

> 本仓库由「夜间自动开发」自动化驱动，全程无人值守、自恢复（看门狗：429/异常指数退避重试）。

## 开源许可

本项目采用 [MIT License](LICENSE) 开源。

> **部署安全提示**：`server/.env.example` 与 `deploy/docker-compose.yml` 中的
> `postgres/postgres`、`minioadmin/minioadmin`、`JWT_SECRET=change-me-in-prod` 等均为
> **本地开发占位默认值**，只用于一键启动本地环境。**上线前必须全部替换**，并配置强随机的
> `JWT_SECRET` / `APP_MASTER_KEY`（生产环境缺失时服务会拒绝启动）。真实凭证、平台 API 密钥、
> 私钥文件一律不要写入任何受版本控制的文件。
