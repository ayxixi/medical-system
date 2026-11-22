#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
ARCHIVE=${1:?用法：restore.sh <medical-backup.tar.gz>}
COMPOSE_FILE="$ROOT/docker-compose.yml"
ENV_FILE="$ROOT/deploy/.env"

case "$ARCHIVE" in
  /*) ;;
  *) ARCHIVE="$PWD/$ARCHIVE" ;;
esac
[ -f "$ARCHIVE" ] || { echo '备份文件不存在' >&2; exit 1; }
[ -f "$ARCHIVE.sha256" ] || { echo '缺少 SHA256 校验文件' >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "缺少 $ENV_FILE，请先从 deploy/.env.example 创建部署配置" >&2; exit 1; }
(cd "$(dirname -- "$ARCHIVE")" && sha256sum -c "$(basename -- "$ARCHIVE").sha256")

echo '恢复会覆盖当前数据库和附件。请确认备份文件可信并在维护窗口执行。'
echo '恢复前先创建当前数据的在线备份，作为回滚点。' >&2
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh app -eu -c '
  stage=/data/.restore-staging
  rollback=/data/.restore-rollback
  rm -rf "$stage"
  mkdir -m 700 "$stage"
  gzip -dc | tar -xpf - -C "$stage"
  test -f "$stage/medical.db"
  test -d "$stage/uploads"
  test -d "$stage/legacy-original"
  if test -e "$rollback"; then
    echo "已有恢复回滚目录：$rollback" >&2
    exit 1
  fi
  mkdir -m 700 "$rollback"
  test ! -e /data/medical.db || mv /data/medical.db "$rollback/medical.db"
  test ! -e /data/uploads || mv /data/uploads "$rollback/uploads"
  test ! -e /data/legacy-original || mv /data/legacy-original "$rollback/legacy-original"
  mv "$stage/medical.db" /data/medical.db
  mv "$stage/uploads" /data/uploads
  mv "$stage/legacy-original" /data/legacy-original
  rmdir "$stage"
' < "$ARCHIVE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app wget -q -O /dev/null http://127.0.0.1:8080/health
printf 'Restore completed and health check passed. Previous data is retained in /data/.restore-rollback until manually reviewed.\n'
