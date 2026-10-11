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
