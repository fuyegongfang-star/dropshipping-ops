#!/bin/sh
# 一件代发货代运营系统 — 一键部署（clone 之后只需执行本脚本）
#
# 依赖：docker + Docker Compose v2 + openssl + GNU sed。
# 不需要宿主机安装 Node / psql / nginx：构建在镜像内完成，建表在 API 容器启动时执行。
#
# 幂等：已存在 .env 时沿用，绝不覆盖。APP_MASTER_KEY 一旦轮换，
# 库里已加密的平台凭证将无法解密，所以只在 --reset-env 时才重新生成。
#
# 全流程：生成 .env(600) → up -d --build → 等待 /api/health → 打印一次性凭据。
set -eu

# 纯 shell 推导脚本目录，不依赖 dirname / readlink（精简环境下可能缺失）
SCRIPT_DIR=${0%/*}
[ "$SCRIPT_DIR" = "$0" ] && SCRIPT_DIR=.
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

ENV_FILE="$ROOT/.env"
TEMPLATE="$ROOT/deploy/.env.prod.example"
COMPOSE="docker-compose.prod.yml"

PORT=""
FORCE_LOCAL=0
ENV_ONLY=0
NO_BUILD=0
RESET_ENV=0

usage() {
  cat <<'EOF'
用法：./deploy/bootstrap.sh [选项]

  （无参数）   生成 .env → 构建镜像 → 启动 postgres/redis/minio/api/web → 等待 /api/health
  --port N     指定 web 对外端口（默认 8080）
  --local      只绑定 127.0.0.1（前面已有宝塔 / nginx 反代时更安全）
  --env-only   只生成 .env，不构建不启动（供自检 / 宝塔 UI 手工导入）
  --no-build   跳过镜像构建，用已有镜像启动
  --reset-env  强制重新生成 .env（会轮换密钥，已加密数据将不可解密！）
  -h, --help   显示本帮助

示例：
  git clone https://github.com/fuyegongfang-star/dropshipping-ops.git /opt/dropshipping-ops
  cd /opt/dropshipping-ops && ./deploy/bootstrap.sh

  ./deploy/bootstrap.sh --local --port 8080
EOF
}

die() { echo "[bootstrap] 错误：$*" >&2; exit 1; }

# 从文件读取 KEY=VALUE（不回显任何值到日志，调用方自行决定）
get_env_from() { sed -n "s|^$1=||p" "$2" | head -n 1; }
set_env() { sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --port)      [ $# -ge 2 ] || die "--port 缺少参数"; PORT="$2"; shift 2 ;;
    --local)     FORCE_LOCAL=1; shift ;;
    --env-only)  ENV_ONLY=1; shift ;;
    --no-build)  NO_BUILD=1; shift ;;
    --reset-env) RESET_ENV=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *) die "未知参数：$1（用 --help 查看用法）" ;;
  esac
done

[ -f "$TEMPLATE" ] || die "找不到模板 $TEMPLATE"
[ -f "$COMPOSE" ] || die "找不到 $COMPOSE（请在仓库根目录执行本脚本）"
command -v openssl >/dev/null 2>&1 || die "缺少 openssl（用于生成随机密钥）"

# ---------------------------------------------------------------- .env
NEW_ENV=0
if [ -f "$ENV_FILE" ] && [ "$RESET_ENV" -eq 0 ]; then
  echo "[bootstrap] 沿用已有 .env（不覆盖密钥）"
else
  if [ "$RESET_ENV" -eq 1 ]; then
    echo "[bootstrap] ⚠ 重新生成 .env：旧 APP_MASTER_KEY 失效，已加密的平台凭证将无法解密"
  fi
  NEW_ENV=1

  APP_MASTER_KEY=$(openssl rand -hex 32)   # 64 位 hex = AES-256
  JWT_SECRET=$(openssl rand -hex 48)       # 96 位
  DB_PASSWORD=$(openssl rand -hex 24)      # 48 位 hex，避免特殊字符破坏连接串
  MINIO_USER=$(openssl rand -hex 12)
  MINIO_PASSWORD=$(openssl rand -hex 24)

  PGUSER=$(get_env_from POSTGRES_USER "$TEMPLATE")
  [ -n "$PGUSER" ] || PGUSER=dropshipping
  PGDB=$(get_env_from POSTGRES_DB "$TEMPLATE")
  [ -n "$PGDB" ] || PGDB=dropshipping

  WEB_BIND="0.0.0.0"
  [ "$FORCE_LOCAL" -eq 1 ] && WEB_BIND="127.0.0.1"

  cp "$TEMPLATE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  set_env APP_MASTER_KEY      "$APP_MASTER_KEY"
  set_env JWT_SECRET          "$JWT_SECRET"
  set_env POSTGRES_PASSWORD   "$DB_PASSWORD"
  set_env DATABASE_URL        "postgresql://${PGUSER}:${DB_PASSWORD}@postgres:5432/${PGDB}?schema=public"
  set_env MINIO_ROOT_USER     "$MINIO_USER"
  set_env MINIO_ROOT_PASSWORD "$MINIO_PASSWORD"
  set_env MINIO_ACCESS_KEY    "$MINIO_USER"
  set_env MINIO_SECRET_KEY    "$MINIO_PASSWORD"
  set_env WEB_HOST            "$WEB_BIND"
  set_env BACKUP_ROOT         "$ROOT/backups"
  [ -n "$PORT" ] && set_env WEB_PORT "$PORT"

  # 模板里其余可选占位符一律清空：留着 <...> 会被当成真实值
  sed -i 's|=<[^>]*>$|=|' "$ENV_FILE"

  echo "[bootstrap] 已生成 .env（权限 600）：所有密钥已随机化，占位符已清空"
fi

WEB_PORT_VALUE=$(get_env_from WEB_PORT "$ENV_FILE")
[ -n "$WEB_PORT_VALUE" ] || WEB_PORT_VALUE=8080
WEB_HOST_VALUE=$(get_env_from WEB_HOST "$ENV_FILE")
DB_PASSWORD_VALUE=$(get_env_from POSTGRES_PASSWORD "$ENV_FILE")
MINIO_USER_VALUE=$(get_env_from MINIO_ROOT_USER "$ENV_FILE")
MINIO_PASS_VALUE=$(get_env_from MINIO_ROOT_PASSWORD "$ENV_FILE")

if [ "$ENV_ONLY" -eq 1 ]; then
  echo "[bootstrap] --env-only：仅生成配置，未启动服务"
  echo "  配置文件：$ENV_FILE"
  if [ "$NEW_ENV" -eq 1 ]; then
    echo "  POSTGRES_PASSWORD：$DB_PASSWORD_VALUE"
    echo "  MINIO_ROOT_USER：$MINIO_USER_VALUE"
    echo "  MINIO_ROOT_PASSWORD：$MINIO_PASS_VALUE"
    echo "  （仅本次显示，请离线保存 .env）"
  fi
  exit 0
fi

# ---------------------------------------------------------------- 启动
command -v docker >/dev/null 2>&1 || die "缺少 docker，请先安装 Docker Engine 24+"
docker compose version >/dev/null 2>&1 || die "需要 Docker Compose v2（docker compose version）"

mkdir -p "$ROOT/backups"
echo "[bootstrap] 构建镜像并启动 postgres / redis / minio / api / web ..."
if [ "$NO_BUILD" -eq 1 ]; then
  docker compose -f "$COMPOSE" up -d
else
  docker compose -f "$COMPOSE" up -d --build
fi

echo "[bootstrap] 等待 /api/health（首次构建镜像 + prisma db push，通常需要 2-5 分钟）..."
READY=0
i=0
while [ "$i" -lt 150 ]; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --noproxy '*' --max-time 3 "http://127.0.0.1:${WEB_PORT_VALUE}/api/health" >/dev/null 2>&1; then READY=1; break; fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -q -O /dev/null -T 3 "http://127.0.0.1:${WEB_PORT_VALUE}/api/health" >/dev/null 2>&1; then READY=1; break; fi
  fi
  i=$((i + 1))
  sleep 2
done

echo ""
echo "================ 部署结果 ================"
if [ "$READY" -eq 1 ]; then
  echo "状态：✅ /api/health 已就绪"
else
  echo "状态：⚠ 5 分钟内健康检查未就绪，容器仍在后台启动，请查看日志："
  echo "      docker compose -f $COMPOSE logs --tail=100 api"
fi
echo "访问地址：http://${WEB_HOST_VALUE}:${WEB_PORT_VALUE}（WEB_HOST=0.0.0.0 时请用服务器 IP 访问）"
if [ "$NEW_ENV" -eq 1 ]; then
  echo ""
  echo "一次性凭据（仅本次显示，.env 内亦有，请离线备份）："
  echo "  POSTGRES_PASSWORD  = $DB_PASSWORD_VALUE"
  echo "  MINIO_ROOT_USER    = $MINIO_USER_VALUE"
  echo "  MINIO_ROOT_PASSWORD= $MINIO_PASS_VALUE"
  echo "  JWT_SECRET / APP_MASTER_KEY 已写入 .env，不在此打印"
else
  echo "凭据：见 $ENV_FILE（本次未重新生成）"
fi
cat <<'EOF'

常用命令：
  查日志   docker compose -f docker-compose.prod.yml logs -f api
  看状态   docker compose -f docker-compose.prod.yml ps
  停止     docker compose -f docker-compose.prod.yml down
  备份     ./deploy/backup.sh
  更新     git pull && ./deploy/bootstrap.sh

安全提醒：
  · 当前是 HTTP 明文；公网部署请在前面挂宝塔 / nginx 反代并启用 HTTPS
  · 防火墙 + 云安全组只开 80/443，勿把 8080 / 5432 / 6379 / 9000 暴露公网
  · .env 含 APP_MASTER_KEY，丢失后已加密的平台凭证不可解密，务必离线备份
  · 生产构建已强制 VITE_USE_MOCK=false；如需演示数据请用 npm run dev --workspace web
EOF

[ "$READY" -eq 1 ] || exit 1
