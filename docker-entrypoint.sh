#!/bin/sh
set -e

ENV_FILE="/app/config/env_file"

if [ -f "$ENV_FILE" ]; then
  echo "Loading env from $ENV_FILE"
  cp "$ENV_FILE" /app/.env.local
fi

RUN_MODE=${RUN_MODE:-dev}

if [ "$RUN_MODE" = "dev" ]; then
  echo "Starting dev server..."
  exec bun run dev
else
  echo "Starting production server..."
  exec bun run start
fi
