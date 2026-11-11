# 生产部署指南（云服务器 / 宝塔面板）

> 适用：`docker-compose.prod.yml`（nginx 前端 + NestJS API + PostgreSQL 16 + Redis 7 + MinIO）+ `deploy/bootstrap.sh` 一键部署。
> **诚实前置声明**：本项目此前从未在真实 PostgreSQL / Redis / MinIO 上跑通完整链路（开发沙箱无 Docker、本机 PG 停服）。
> `prisma db push` 建表、登录 round-trip、BullMQ 消费、Docker 镜像构建与 compose 启动**全部属于首次上线验证项**。
> 一键脚本本机已验证：shell 语法（`sh -n`）、`--env-only` 配置生成、占位符清空与 LF / 无 BOM。真机首次上线请仍按第六节逐条核验。

---

## 〇、一键部署（推荐）

```bash
git clone https://github.com/fuyegongfang-star/dropshipping-ops.git /opt/dropshipping-ops
cd /opt/dropshipping-ops
./deploy/bootstrap.sh          # 生成 .env → build → up -d → 等待 /api/health → 打印凭据
```

常用变体：

```bash
./deploy/bootstrap.sh --local                 # 只绑 127.0.0.1，前面挂宝塔 / nginx 反代
./deploy/bootstrap.sh --port 9000             # 改对外端口
./deploy/bootstrap.sh --env-only              # 只生成 .env，供自检或宝塔 UI 导入
./deploy/bootstrap.sh --no-build              # 已有镜像，快速重启
git pull && ./deploy/bootstrap.sh             # 更新版本（沿用已有 .env）
./deploy/backup.sh                            # 完整备份（库 + MinIO 附件卷）
```

脚本自动完成：生成 64 位 `APP_MASTER_KEY`、96 位 `JWT_SECRET`、48 位数据库口令与 MinIO 凭据
→ 清空所有 `<CHANGE_ME>` 占位符 → `.env` 权限 600 → `up -d --build` → API 容器启动时执行 `prisma db push`
→ 轮询 `/api/health` → 打印访问地址与**一次性凭据**。

**幂等**：已存在 `.env` 时绝不覆盖。`APP_MASTER_KEY` 一旦轮换，库里已加密的平台凭证将无法解密；只有显式 `--reset-env` 才会重新生成。

> 默认 `WEB_HOST=0.0.0.0`，对外 **HTTP 明文**；有宝塔 / nginx 反代时请加 `--local` 只绑回环。
> 依赖只有 Docker Engine 24+ / Compose v2 / openssl / GNU sed，**不需要宿主机 Node、psql 或 nginx**。

下面第一～七节是原理、宝塔逐步操作、核验清单与回滚，手动部署或排障时再看。

---

## 一、架构与端口

```
浏览器 ──HTTPS──> 宝塔站点 / 云 LB ──> web(nginx 容器:80) ──静态文件 / SPA 回退
                                      └── /api/* 反代 ──> api(NestJS:3000)
                                                            ├── postgres:5432（仅内网）
                                                            ├── redis:6379（仅内网）
                                                            └── minio:9000（仅内网）
```

| 服务 | 对外 | 说明 |
| :--- | :--- | :--- |
| `web` | `${WEB_HOST}:${WEB_PORT}` → 容器 80，默认 `0.0.0.0:8080` | nginx 托管 SPA，`/api` 反代到 `api:3000` |
| `api` | 仅 compose 内网 `:3000` | 全局前缀 `/api`，`/api/health` 公开探活 |
| `postgres` / `redis` / `minio` | **不暴露宿主端口** | 只有 compose 内网可达 |
| MinIO 控制台 `:9001` | 不映射 | 需要时在 compose 里临时加端口映射，用完移除 |

- `api` 容器启动命令为 `npx prisma db push --skip-generate && node dist/main.js`：当前仓库用 `db push` 管理表结构（**无 migrations 目录**），该命令幂等，可重复启动。
- 生产构建在 `web/Dockerfile` 内执行 `npm run build:prod`，`vite.config.ts` 强制校验 `VITE_USE_MOCK=false`，演示数据无法被构建进生产包。
- 卷 `ds_pgdata` / `ds_redisdata` / `ds_miniodata` 使用固定名，`backup.sh` 直接按名挂载，不依赖 compose 项目名。

---

## 二、服务器前置条件

| 项 | 要求 |
| :--- | :--- |
| 配置 | 建议 2 核 4G 起（NestJS + nginx + PG + Redis + MinIO） |
| 软件 | Docker Engine 24+ 与 Compose v2、openssl、GNU sed（一般 Linux 自带）；宝塔面板可选 |
| 域名 | 已解析到服务器，SSL 在宝塔站点申请（Let's Encrypt 即可）；无域名可先用 IP 跑通 |
| Node | **一键部署不需要宿主机 Node**：编译在镜像内、建表在容器启动时 |

---

## 三、宝塔面板路线（贴合现有运维习惯）

1. **放代码 + 启动**：仓库公开，服务器可匿名拉取（**无需 deploy key / PAT**）：
   `git clone https://github.com/fuyegongfang-star/dropshipping-ops.git /opt/dropshipping-ops`，
   然后 `./deploy/bootstrap.sh --local`。也可在宝塔「文件」上传项目 zip 解压到同一目录。
2. **（可选）生成配置供 UI 导入**：`./deploy/bootstrap.sh --env-only` 只产 `.env`，不启动容器；
   内容已随机化、`chmod 600`，可直接作为编排的环境变量文件。
3. **手工配置 `.env` 的要点**（仅当不用一键脚本）：`cp deploy/.env.prod.example .env` 后逐项替换：
   - `APP_MASTER_KEY`：`openssl rand -hex 32`
   - `JWT_SECRET`：`openssl rand -hex 48`
   - `POSTGRES_PASSWORD`：`openssl rand -hex 24`，且必须与 `DATABASE_URL` 里的口令**完全一致**，主机名必须是 `postgres`（不是 `localhost`）。
   - `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` 要与 `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` 同值。
   - 所有 `<CHANGE_ME>` 要么填真值、要么**留空**；留着尖括号会被当成真实值。
4. **导入编排**（宝塔 UI 等价路径）：宝塔 → Docker → 「编排 / Compose」→ 新建，选择或粘贴
   `docker-compose.prod.yml`，项目目录设为 `/opt/dropshipping-ops`，环境变量文件选 `.env`，启动。
   > 若宝塔版本只支持直接上传 compose 文件，上传后到「容器编排」创建即可。
5. **看建表日志**：Docker → 容器 → `api` → 日志，应看到 `prisma db push` 完成 → `[dropshipping-ops] server listening on :3000`。
6. **建站点反代**：宝塔 → 网站 → 添加站点（域名）→ 反向代理 → 目标 URL `http://127.0.0.1:8080` → 提交；再到「SSL」申请证书并开启强制 HTTPS。
7. **端口放行两道，缺一不可**：
   - 宝塔「安全」→ 防火墙：放行 **80 / 443**（不要放行 8080、3000、5432、6379、9000、9001）。
   - 云厂商控制台 → 安全组：同样放行 **80 / 443**。
8. **按第六节核验清单逐条验收**。

---

## 四、命令行路线（等价）

```bash
# 一条命令即可（等价于下面全部步骤）
./deploy/bootstrap.sh

# 手动等价流程（需要自定义时）
cp deploy/.env.prod.example .env      # 然后逐项替换 / 清空 <CHANGE_ME>
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api
curl --noproxy '*' http://127.0.0.1:8080/api/health
```

常用运维：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml down            # 停服（卷数据保留）
docker compose -f docker-compose.prod.yml logs --tail=200 api
./deploy/backup.sh                                       # 库 + 附件卷备份
```

更新版本：`git pull && ./deploy/bootstrap.sh`（沿用已有 `.env`，不轮换密钥；容器启动时重新执行幂等的 `prisma db push`）。

---

## 五、第一次上线最容易踩的坑

| 现象 | 原因 / 处理 |
| :--- | :--- |
| `bootstrap.sh` 报缺少 openssl | 安装 `openssl`；Debian/Ubuntu `apt install -y openssl`，Alpine `apk add openssl` |
| `sh: bootstrap.sh: bad interpreter: /bin/sh^M` | 文件被 Windows 改成 CRLF；仓库已用 `.gitattributes` 锁 LF，`git config core.autocrlf false` 后重新拉取 |
| 健康检查 5 分钟仍未就绪 | 首次要构建两个镜像并 `prisma db push`，先看 `docker compose -f docker-compose.prod.yml logs --tail=100 api`；容器仍在后台启动，不代表失败 |
| nginx 502 / `connect() failed` | `api` 尚未 healthy（等建表跑完），或 `nginx.conf` 里 `proxy_pass http://api:3000` 服务名与 compose 不一致 |
| API 启动即退出，提示「启动拦截」 | `.env` 里 `JWT_SECRET` / `APP_MASTER_KEY` 缺失或仍是 `change-me-in-prod`；生产 fail-fast 是**设计行为**，用一键脚本可避免 |
| 前端构建报「生产构建必须 VITE_USE_MOCK=false」 | `web/.env.production` 未被复制进镜像，或被改动；该文件已随仓库发布且被 `.gitignore` 放行，勿删除 |
| 页面能开但数据是假的 | 误用了 `npm run dev` 的演示包；生产镜像走 `build:prod`，检查 `web/.env.production` 内容只有一行 `VITE_USE_MOCK=false` |
| 连不上数据库 | `DATABASE_URL` 主机名写成 `localhost`（应为 `postgres`），或口令与 `POSTGRES_PASSWORD` 不一致 |
| MinIO 报签名 / 凭证错误 | `MINIO_ROOT_USER/PASSWORD` 与 `MINIO_ACCESS_KEY/SECRET_KEY` 不一致；compose 已用前者覆盖注入后端，手工配 `.env` 时务必同值 |
| 平台凭证解密失败 | 部署后轮换过 `APP_MASTER_KEY`；需重新录入全部平台凭证，切勿随意 `--reset-env` |
| 承运商 / 渠道功能「已配置」却没真实调用 | 预期行为：真实 API 端点仍为占位，集成快照 `realApiTodo=true`，详见 `docs/DELIVERY.md` 第三节 |

---

## 六、首次上线核验清单（逐条打勾再正式用）

1. [ ] `api` 日志出现 `prisma db push` 完成，且无 SQL 报错（**建表第一次在真库执行**）。
2. [ ] `GET /api/health` 返回 200 且 `data.status = "ok"`；`docker compose -f docker-compose.prod.yml ps` 五个服务均 healthy。
3. [ ] 登录 round-trip：`POST /api/auth/login` 拿令牌，`GET /api/...` 带 `Authorization: Bearer` 返回 200；未带令牌返回 401（全局守卫生效）。
4. [ ] 多租户隔离：用两个不同租户令牌请求同一列表，返回数据不交叉；手工伪造 `x-tenant-id` 头不改变结果。
5. [ ] 前端：打开 `https://域名`，左侧五组菜单可点，页面无「演示模式」数据（生产包已强制关闭 mock）。
6. [ ] 队列与缓存：Redis 在线时 `common/cache` 走 Redis 后端；停掉 redis 容器后 API 不崩、优雅降级到内存。
7. [ ] 对象存储：上传 / 生成一次面单 PDF，确认 MinIO 卷内有对象且可下载。
8. [ ] 持久化：`docker compose restart api` 后订单 / 配置数据仍在（卷生效）。
9. [ ] 备份：`./deploy/backup.sh` 产物落到 `BACKUP_ROOT`，并至少做一次恢复演练。
10. [ ] 防火墙：宝塔「安全」+ 云安全组都只放 80/443，8080 / 3000 / 5432 / 6379 / 9000 / 9001 未对公网开放。
11. [ ] 密钥：`.env` 已离线备份，确认仓库与镜像内均无真实密钥；`APP_MASTER_KEY` 已记录保管责任人。

---

## 七、回滚与数据安全

- 卷：`ds_pgdata`（库）、`ds_redisdata`（队列）、`ds_miniodata`（附件），`docker compose down` **不会**删除。
- 备份：`./deploy/backup.sh` 在 compose 网络内用 `pg_dump` 导出数据库，并直接挂载 `ds_miniodata` 卷打包附件；
  宿主机无需 `psql` / Node，也不需要能解析 compose 服务名。
- 恢复：先 `docker compose -f docker-compose.prod.yml down`（保留卷），导入 `db-*.sql.gz` 后解压 `minio-*.tar.gz` 回卷，再 `up -d --no-build`。
- 密钥：`.env` 与 `APP_MASTER_KEY` 一旦丢失，已加密入库的平台凭证无法解密 —— 请离线妥善备份，
  且 **绝不入库 / 不写日志 / 不贴到工单**。更换 `APP_MASTER_KEY` 前需重新录入所有平台凭证。
- 版本回滚：`git checkout <上一版本 tag> && ./deploy/bootstrap.sh --no-build`（**不要** `--reset-env`，否则密钥轮换）。
