#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
OUTPUT_DIR=${1:-"$ROOT/backups"}
COMPOSE_FILE="$ROOT/docker-compose.yml"
ENV_FILE="$ROOT/deploy/.env"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
ARCHIVE="$OUTPUT_DIR/medical-backup-$STAMP.tar.gz"
TEMP="$ARCHIVE.tmp"

mkdir -p "$OUTPUT_DIR"
if [ ! -f "$ENV_FILE" ]; then
  echo "缺少 $ENV_FILE，请先从 deploy/.env.example 创建部署配置" >&2
  exit 1
fi
umask 077
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T app sh -eu -c '
  node - <<'NODE'
const fs = require("node:fs");
const { PrismaClient } = require("/app/node_modules/@prisma/client");
const { execFileSync } = require("node:child_process");
(async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`PRAGMA wal_checkpoint(FULL)`;
  } finally {
    await prisma.$disconnect();
  }
  execFileSync("tar", ["-C", "/data", "-cf", "-", "medical.db", "uploads", "legacy-original"], { stdio: ["ignore", process.stdout, "inherit"] });
})().catch((error) => { console.error(error.message); process.exit(1); });
NODE
' | gzip -9 > "$TEMP"
mv "$TEMP" "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
printf 'Backup written to %s\n' "$ARCHIVE"
