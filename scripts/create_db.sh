#!/usr/bin/env bash
set -euo pipefail

DB_IMAGE_NAME="${DB_IMAGE_NAME:-medical-db}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-medical-db-container}"
DB_PORT="${DB_PORT:-5432}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker and try again." >&2
  exit 1
fi

echo "Building PostgreSQL Docker image: ${DB_IMAGE_NAME} ..."
docker build -t "${DB_IMAGE_NAME}" -f Dockerfile.db .

# Remove stopped container if present
if [ -n "$(docker ps -aq -f status=exited -f name=${DB_CONTAINER_NAME})" ]; then
  docker rm "${DB_CONTAINER_NAME}" >/dev/null
fi

# Stop running container if present
if [ -n "$(docker ps -q -f name=${DB_CONTAINER_NAME})" ]; then
  docker stop "${DB_CONTAINER_NAME}" >/dev/null || true
  docker rm "${DB_CONTAINER_NAME}" >/dev/null || true
fi

echo "Starting PostgreSQL container: ${DB_CONTAINER_NAME} ..."
docker run -d --name "${DB_CONTAINER_NAME}" \
  -e POSTGRES_USER=mcp_user \
  -e POSTGRES_PASSWORD=mcp_password \
  -e POSTGRES_DB=medical_db \
  -p "${DB_PORT}:5432" \
  "${DB_IMAGE_NAME}"

# wait until healthy
printf "Waiting for database to initialize"; for i in {1..20}; do sleep 1; printf "."; done; echo

echo "✅ Database ready on port ${DB_PORT}"
echo "Logs: docker logs -f ${DB_CONTAINER_NAME}"
