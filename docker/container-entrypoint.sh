#!/bin/sh
set -eu

cd /app
mkdir -p /data/uploads /data/legacy-original
if [ ! -e /data/medical.db ] && [ -f /legacy/prisma/dev.db ]; then
  cp -p /legacy/prisma/dev.db /data/legacy-original/dev.db
  cp -p /legacy/prisma/dev.db /data/medical.db
  if [ -d /legacy/uploads ]; then
    cp -a /legacy/uploads/. /data/uploads/
  fi
fi
node /app/node_modules/prisma/build/index.js migrate deploy
node /app/dist/main.js &
api_pid=$!
nginx_pid=

stop_children() {
  kill "$api_pid" 2>/dev/null || true
  if [ -n "$nginx_pid" ]; then
    kill "$nginx_pid" 2>/dev/null || true
  fi
  wait "$api_pid" 2>/dev/null || true
  if [ -n "$nginx_pid" ]; then
    wait "$nginx_pid" 2>/dev/null || true
  fi
}
trap stop_children EXIT INT TERM

nginx -g 'daemon off;' &
nginx_pid=$!
wait "$nginx_pid"
