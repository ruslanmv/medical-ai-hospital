# db/Dockerfile
# Production-ready Postgres image with schema + seed baked in.
# You can still override POSTGRES_* at runtime with `-e` or env_file.

FROM postgres:15

LABEL org.opencontainers.image.title="medical-ai-hospital-db" \
      org.opencontainers.image.description="PostgreSQL with hospital schema and seed" \
      org.opencontainers.image.source="https://example.com/medical-ai-hospital" \
      org.opencontainers.image.licenses="Apache-2.0"

# Safe defaults (overridable at `docker run` time or via compose env_file)
ENV TZ=UTC \
    POSTGRES_USER=mcp_user \
    POSTGRES_PASSWORD=mcp_password \
    POSTGRES_DB=medical_db

# Init scripts run only on FIRST BOOT of a fresh/empty data volume.
# Keep them read-only in the image layer.
COPY 10_init.sql /docker-entrypoint-initdb.d/10_init.sql
COPY 20_seed.sql /docker-entrypoint-initdb.d/20_seed.sql

# Healthcheck so external orchestrators can wait for readiness.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" || exit 1
