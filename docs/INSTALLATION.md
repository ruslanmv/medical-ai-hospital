# Installation — Medical AI Hospital Portal

This guide gets you from zero to a running stack (DB + MCP + Gateway + Frontend) using Docker Compose.

## Prerequisites
- Docker & Docker Compose v2
- Node.js 18+
- Python 3.11 (for local dev, optional if you only use Compose)

## Quickstart (all-in-one)
```bash
make up
# Frontend: http://localhost:3000
# Gateway:  http://localhost:8080/health
# MCP:      http://localhost:9090/health (if exposed)
```
## Configure environment
`docker-compose.yml` has sane defaults. For local dev, you can edit the environment variables inline or export them before `make up`.
- Frontend points to gateway via `NEXT_PUBLIC_API_BASE`.
- Gateway points to DB and MCP via service names.

## Database
The first boot loads `db/01_init.sql` which contains the full production schema (copied from `medical-mcp-toolkit/db/10_init.sql`).
To inspect the DB:
```bash
make db-up
make db-logs
./scripts/db_schema_check.sh
```

## MCP Server
The compose file assumes a container named `mcp` listening on `:9090` with bearer auth (`MCP_BEARER_TOKEN`).
If you build from source, replace the `image:` with a `build:` context to your MCP repo.

## Gateway API
FastAPI app listening on `:8080`.
Reads env vars defined in `gateway/.env.example` (Compose passes them as environment vars).

## Frontend (Next.js)
Default dev server `:3000`.
For local dev without Compose, run:
```bash
cd frontend
cp .env.local.example .env.local
npm ci && npm run dev
```

## Health checks
```bash
./scripts/health.sh
```
This script exercises register/login, `/me`, `/me/patient` minimal flows.

## Common issues
- **CORS**: Ensure `ALLOWED_ORIGINS` in gateway includes the frontend origin.
- **Cookies**: In prod, serve over HTTPS and set `SESSION_SECURE_COOKIES=true`.
- **MCP auth**: Make sure `MCP_BEARER_TOKEN` matches gateway configuration.
