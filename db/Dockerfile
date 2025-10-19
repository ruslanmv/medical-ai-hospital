# db/Dockerfile
# Build a Postgres 15 image preloaded with our init SQL and a sane healthcheck.

FROM postgres:15

# Defaults — can be overridden at runtime with -e or via docker-compose env_file
ENV TZ=UTC \
    POSTGRES_USER=mcp_user \
    POSTGRES_PASSWORD=mcp_password \
    POSTGRES_DB=medical_db

# Copy init scripts (idempotent; run only on first boot when volume is empty)
COPY 10_init.sql /docker-entrypoint-initdb.d/10_init.sql
COPY 20_seed.sql /docker-entrypoint-initdb.d/20_seed.sql

# Healthcheck: wait until database accepts connections
HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" || exit 1
