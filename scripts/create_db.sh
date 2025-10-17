#!/usr/bin/env bash
# scripts/create_db.sh
# Build & run a standalone Postgres with our schema+seed baked in (from db/Dockerfile).
# Useful for quick local dev or CI without bringing up the whole compose stack.

set -euo pipefail

# ---- Config (override via env) ----------------------------------------------
DB_IMAGE_NAME="${DB_IMAGE_NAME:-medical-ai-db:local}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-db}"             # match docker-compose default
DB_PORT="${DB_PORT:-5432}"
DB_VOLUME_NAME="${DB_VOLUME_NAME:-medical_ai_db_data}"   # persistent named volume

# Load .env if present (safe export of simple KEY=VAL pairs)
if [[ -f ".env" ]]; then
  echo "Loading environment from .env ..."
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-mcp_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-mcp_password}"
POSTGRES_DB="${POSTGRES_DB:-medical_db}"
TZ="${TZ:-UTC}"

# ---- Pre-flight --------------------------------------------------------------
command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Please install Docker and try again." >&2
  exit 1
}

if [[ ! -f "db/10_init.sql" || ! -f "db/20_seed.sql" ]]; then
  echo "Missing db/10_init.sql or db/20_seed.sql. Run from repo root where ./db exists." >&2
  exit 1
fi

# ---- Build image -------------------------------------------------------------
echo "🛠  Building PostgreSQL image '${DB_IMAGE_NAME}' from db/Dockerfile ..."
docker build -t "${DB_IMAGE_NAME}" db/

# ---- Stop & remove any existing container with the same name -----------------
if docker ps -a --format '{{.Names}}' | grep -qx "${DB_CONTAINER_NAME}"; then
  echo "🧹 Removing existing container '${DB_CONTAINER_NAME}' ..."
  docker rm -f "${DB_CONTAINER_NAME}" >/dev/null 2>&1 || true
fi

# Ensure volume exists
docker volume inspect "${DB_VOLUME_NAME}" >/dev/null 2>&1 || docker volume create "${DB_VOLUME_NAME}" >/dev/null

# ---- Run container -----------------------------------------------------------
echo "🚀 Starting PostgreSQL container: ${DB_CONTAINER_NAME}"
docker run -d --name "${DB_CONTAINER_NAME}" \
  -e POSTGRES_USER="${POSTGRES_USER}" \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB="${POSTGRES_DB}" \
  -e TZ="${TZ}" \
  -p "${DB_PORT}:5432" \
  -v "${DB_VOLUME_NAME}:/var/lib/postgresql/data" \
  "${DB_IMAGE_NAME}" >/dev/null

# ---- Wait for readiness ------------------------------------------------------
echo -n "⏳ Waiting for database to become ready"
for _ in $(seq 1 60); do
  if docker exec -i "${DB_CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    echo
    echo "✅ Database is ready on port ${DB_PORT}"
    echo "   DSN: postgresql://${POSTGRES_USER}:******@localhost:${DB_PORT}/${POSTGRES_DB}"
    echo "   Logs: docker logs -f ${DB_CONTAINER_NAME}"
    exit 0
  fi
  echo -n "."
  sleep 1
done

echo
echo "❌ Database did not become ready in time. Showing last 50 log lines:"
docker logs --tail=50 "${DB_CONTAINER_NAME}" || true
exit 1
