#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[start] Running database migrations..."
  pnpm --filter @workspace/db push-force || echo "[start] Migration warning (non-fatal), continuing..."
  echo "[start] Migrations done."
else
  echo "[start] No DATABASE_URL set, skipping migrations."
fi

echo "[start] Starting server..."
exec node artifacts/api-server/dist/index.cjs
