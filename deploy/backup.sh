#!/bin/sh
# 完整备份：PostgreSQL 逻辑备份 + MinIO 附件卷
# 全部在容器内执行，宿主机不需要 psql / Node，也不需要能解析 compose 服务名。
set -eu

SCRIPT_DIR=${0%/*}
[ "$SCRIPT_DIR" = "$0" ] && SCRIPT_DIR=.
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT"

COMPOSE="docker-compose.prod.yml"
[ -f .env ] || { echo "[backup] 错误：缺少 .env，请先执行 ./deploy/bootstrap.sh" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "[backup] 错误：缺少 docker" >&2; exit 1; }

get_env() { sed -n "s|^$1=||p" .env | head -n 1; }

BACKUP_ROOT=$(get_env BACKUP_ROOT)
[ -n "$BACKUP_ROOT" ] || BACKUP_ROOT="$ROOT/backups"
PGUSER=$(get_env POSTGRES_USER)
[ -n "$PGUSER" ] || PGUSER=dropshipping
PGDB=$(get_env POSTGRES_DB)
[ -n "$PGDB" ] || PGDB=dropshipping

mkdir -p "$BACKUP_ROOT"
TS=$(date +%Y%m%d-%H%M%S)

echo "[backup] 导出数据库 → $BACKUP_ROOT/db-$TS.sql.gz"
docker compose -f "$COMPOSE" exec -T postgres \
  pg_dump -U "$PGUSER" -d "$PGDB" --no-owner --clean --if-exists \
  | gzip > "$BACKUP_ROOT/db-$TS.sql.gz"

echo "[backup] 打包 MinIO 附件卷 → $BACKUP_ROOT/minio-$TS.tar.gz"
docker run --rm \
  -v ds_miniodata:/data:ro \
  -v "$BACKUP_ROOT":/backup \
  alpine:3.20 \
  tar czf "/backup/minio-$TS.tar.gz" -C /data .

echo "[backup] 完成："
ls -lh "$BACKUP_ROOT/db-$TS.sql.gz" "$BACKUP_ROOT/minio-$TS.tar.gz"
echo "[backup] 恢复演练与注意事项见 deploy/README.md 第七节"
