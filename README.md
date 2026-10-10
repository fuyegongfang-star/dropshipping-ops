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

## 多租户约定

- 所有业务表带 `tenantId`（行级隔离，见方案 §0 / §17）。
- 租户上下文由 `common/tenant` 中间件从子域名或请求头 `x-tenant-id` 解析，注入 `AsyncLocalStorage`，供 Service 层自动过滤。

## 开发纪律（强制，方案 §31）

- 注释：业务逻辑 Why 优先、中文注释、字段带单位与业务含义、TODO 带责任人+日期。
- 代码：函数 ≤50 行、文件 ≤400 行、按 feature 切分、禁 magic number、统一响应/异常/日志。
- 提交：Conventional Commits（feat/fix/refactor/docs… + 中文简述）。

> 本仓库由「夜间自动开发」自动化驱动，全程无人值守、自恢复（看门狗：429/异常指数退避重试）。
