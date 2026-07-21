#!/bin/bash
set -e

ENV_FILE="/mnt/nfs/dev/.env.dev"
IMAGE_NAME="dashboard-dev"
CONTAINER_NAME="dashboard-container-dev"

echo "=== Reading env file: $ENV_FILE ==="ß
BUILD_ARGS=""
while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  # Only pass NEXT_PUBLIC_* vars as build args
  if [[ "$key" == NEXT_PUBLIC_* ]]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg ${key}=${val}"
  fi
done < "$ENV_FILE"

echo "=== Building production image: $IMAGE_NAME ==="
docker build -t "$IMAGE_NAME" $BUILD_ARGS /home/sll/dashboard

echo "=== Stopping old container ==="
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "=== Starting production container ==="
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 3003:3000 \
  -p 3031:3000 \
  -v /mnt/nfs/dev/.env.dev:/app/config/env_file:ro \
  -e BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
  -e RUN_MODE=prod \
  "$IMAGE_NAME"

echo "=== Done! Container started with RUN_MODE=prod ==="
docker logs -f "$CONTAINER_NAME"
