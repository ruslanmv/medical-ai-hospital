#!/usr/bin/env bash
# scripts/db_schema_check.sh
# ==============================================================================
# DB Schema Inspector (Dockerized Postgres)
# Prints: server info, extensions, schemas, tables, views, enums, and for each
# expected table: columns, indexes, constraints, storage size, and row counts.
#
# MODIFIED: Checks for table existence before querying details to prevent
# "relation does not exist" errors and provide clearer output.
# ==============================================================================

set -Eeuo pipefail

# ----- Defaults (override via env or CLI) -------------------------------------
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-db}"          # match docker-compose
POSTGRES_USER="${POSTGRES_USER:-mcp_user}"
POSTGRES_DB="${POSTGRES_DB:-medical_db}"
DB_SCHEMA="${DB_SCHEMA:-public}"

# Full production set (space-separated)
EXPECTED_TABLES_DEFAULT="\
roles users user_roles user_settings auth_sessions password_resets \
patients patient_users vitals conditions allergies medications \
drugs drug_interactions appointments encounters encounter_notes \
documents tool_audit \
"

EXACT_COUNTS=0
QUIET=0

# ----- Helpers ----------------------------------------------------------------
die() { echo "❌ $*" >&2; exit 1; }
say() { [[ "$QUIET" -eq 1 ]] || echo -e "$*"; }
hr()  { [[ "$QUIET" -eq 1 ]] || printf '%s\n' "----------------------------------------------------------------"; }

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  -c, --container NAME   Docker container name (default: ${DB_CONTAINER_NAME})
  -U, --user USER        Postgres user          (default: ${POSTGRES_USER})
  -d, --db DBNAME        Postgres database      (default: ${POSTGRES_DB})
  -s, --schema SCHEMA    Schema to inspect      (default: ${DB_SCHEMA})
  -t, --tables "T1 T2"   Space-separated tables (default: all production tables)
  -x, --exact            Exact row counts (slower)
  -q, --quiet            Less verbose output
  -h, --help             Show this help

Env overrides supported: DB_CONTAINER_NAME, POSTGRES_USER, POSTGRES_DB, DB_SCHEMA
EOF
}

# ----- Parse CLI --------------------------------------------------------------
EXPECTED_TABLES="${EXPECTED_TABLES_DEFAULT}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--container) DB_CONTAINER_NAME="$2"; shift 2 ;;
    -U|--user)      POSTGRES_USER="$2"; shift 2 ;;
    -d|--db)        POSTGRES_DB="$2"; shift 2 ;;
    -s|--schema)    DB_SCHEMA="$2"; shift 2 ;;
    -t|--tables)    EXPECTED_TABLES="$2"; shift 2 ;;
    -x|--exact)     EXACT_COUNTS=1; shift ;;
    -q|--quiet)     QUIET=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) die "Unknown option: $1 (use --help)";;
  esac
done

# ----- Pre-flight -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "Docker is not installed or not in PATH."

if ! docker ps --format '{{.Names}}' | grep -qx "${DB_CONTAINER_NAME}"; then
  die "Container '${DB_CONTAINER_NAME}' is not running. Start it with: make db-up"
fi

# Verify psql inside the container (busybox 'sh' is enough)
if ! docker exec -i "${DB_CONTAINER_NAME}" sh -lc 'command -v psql >/dev/null 2>&1'; then
  die "psql is not available inside '${DB_CONTAINER_NAME}'. Is this a Postgres image?"
fi

PSQL=(docker exec -i "${DB_CONTAINER_NAME}" psql -X -q -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -P pager=off)

run_sql() {
  local sql="$1"
  # Add || true to prevent script exit on benign errors like "relation does not exist"
  # This makes the main loop's existence check the primary control flow.
  "${PSQL[@]}" -c "$sql" || true
}

title() { say ""; say "📌 $*"; hr; }

# ----- Introspection ----------------------------------------------------------
say "🔌 Connecting to container: ${DB_CONTAINER_NAME}"
hr
run_sql '\conninfo' || die "Failed to connect with psql."

title "🧭 Server / Database Info"
run_sql "SHOW server_version;"
run_sql "SELECT current_database() AS db, current_user AS user, current_setting('TimeZone') AS timezone;"

title "🧩 Installed Extensions"
run_sql "SELECT extname AS extension, extversion AS version
         FROM pg_extension
         ORDER BY extname;"

title "📦 Schemas (user-visible)"
run_sql "SELECT nspname AS schema, pg_catalog.pg_get_userbyid(nspowner) AS owner
         FROM pg_namespace
         WHERE nspname NOT IN ('pg_catalog','information_schema')
         ORDER BY nspname;"

title "📑 Tables in schema '${DB_SCHEMA}'"
run_sql "SELECT table_name
         FROM information_schema.tables
         WHERE table_schema='${DB_SCHEMA}' AND table_type='BASE TABLE'
         ORDER BY table_name;"

title "🔭 Views in schema '${DB_SCHEMA}'"
run_sql "SELECT table_name AS view_name
         FROM information_schema.views
         WHERE table_schema='${DB_SCHEMA}'
         ORDER BY table_name;"

title "🧱 Materialized Views in schema '${DB_SCHEMA}'"
run_sql "SELECT matviewname AS matview_name
         FROM pg_matviews
         WHERE schemaname='${DB_SCHEMA}'
         ORDER BY matviewname;"

title "🎨 ENUM types in '${DB_SCHEMA}'"
run_sql "SELECT t.typname AS enum_name,
                string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values
         FROM pg_type t
         JOIN pg_enum e ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = '${DB_SCHEMA}'
         GROUP BY t.typname
         ORDER BY t.typname;"

title "🧠 Key View Definitions"
run_sql "SELECT viewname, pg_get_viewdef((quote_ident(schemaname)||'.'||quote_ident(viewname))::regclass, true) AS definition
         FROM pg_views
         WHERE schemaname='${DB_SCHEMA}'
         AND viewname IN ('v_latest_vitals','v_patient_profile')
         ORDER BY viewname;"

# ----- Per-table deep dive ----------------------------------------------------
title "📋 Column details, indexes, constraints, sizes & row counts"
IFS=' ' read -r -a TABLES <<< "${EXPECTED_TABLES}"
for tbl in "${TABLES[@]}"; do
  [[ -z "$tbl" ]] && continue
  say ""
  say "▶ ${DB_SCHEMA}.${tbl}"
  hr

  # ✅ FIX: Check if table exists before proceeding
  table_exists=$("${PSQL[@]}" -tA -c "SELECT 1 FROM information_schema.tables WHERE table_schema='${DB_SCHEMA}' AND table_name='${tbl}'")

  if [[ "${table_exists}" != "1" ]]; then
    say "⚠️  Table not found in schema '${DB_SCHEMA}'."
    continue # Skip to the next table
  fi

  # --- If table exists, proceed with all the detail queries ---

  # Columns
  run_sql "
    SELECT
      c.ordinal_position AS pos,
      c.column_name      AS name,
      COALESCE(c.data_type, c.udt_name) AS data_type,
      c.is_nullable      AS nullable,
      c.column_default   AS default
    FROM information_schema.columns c
    WHERE c.table_schema='${DB_SCHEMA}' AND c.table_name='${tbl}'
    ORDER BY c.ordinal_position;
  "

  # Indexes
  say "• Indexes"
  run_sql "
    SELECT indexname AS name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname='${DB_SCHEMA}' AND tablename='${tbl}'
    ORDER BY indexname;
  "

  # Constraints
  say "• Constraints"
  run_sql "
    SELECT con.conname AS name,
           CASE con.contype
             WHEN 'p' THEN 'PRIMARY KEY'
             WHEN 'u' THEN 'UNIQUE'
             WHEN 'f' THEN 'FOREIGN KEY'
             WHEN 'c' THEN 'CHECK'
             WHEN 'x' THEN 'EXCLUDE'
             ELSE con.contype::text
           END AS type,
           pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname='${DB_SCHEMA}' AND rel.relname='${tbl}'
    ORDER BY con.conname;
  "

  # Size + row count (now safe to run)
  if [[ "${EXACT_COUNTS}" -eq 1 ]]; then
    say "• Size & rows (exact)"
    run_sql "
      SELECT
        pg_size_pretty(pg_total_relation_size('${DB_SCHEMA}.${tbl}')) AS total_size,
        (SELECT COUNT(*)::bigint FROM ${DB_SCHEMA}.${tbl}) AS exact_rows;
    "
  else
    say "• Size & rows (estimated)"
    run_sql "
      SELECT
        pg_size_pretty(pg_total_relation_size('${DB_SCHEMA}.${tbl}')) AS total_size,
        (SELECT reltuples::bigint FROM pg_class WHERE oid='${DB_SCHEMA}.${tbl}'::regclass) AS est_rows;
    "
  fi
done

say ""
say "✅ Done. DB schema looks good if the above sections populated correctly."