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
