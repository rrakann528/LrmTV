#!/bin/sh

echo "[start] DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"

if [ -n "$DATABASE_URL" ]; then
  echo "[start] Running database migrations..."
  cd /app/lib/db && DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force --config ./drizzle.config.ts
  STATUS=$?
  cd /app
  if [ $STATUS -eq 0 ]; then
    echo "[start] Migrations completed successfully."
  else
    echo "[start] Migration failed with status $STATUS — starting server anyway."
  fi
else
  echo "[start] No DATABASE_URL — skipping migrations."
fi

echo "[start] Starting server..."
exec node /app/artifacts/api-server/dist/index.cjs
