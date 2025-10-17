# Installation — Medical AI Hospital Portal (Production-Ready)

This guide brings up the full stack with **Docker Compose** and shows how to verify the system end-to-end.

## Prerequisites

- **Docker** and **Docker Compose v2** (`docker compose version`)
- **Make** (optional; you can use `docker compose` directly)
- (Optional for local dev)
  - Node.js 18+ (Next.js frontend)
  - Python 3.11 (if running the Gateway outside of containers)

---

## 1) Clone and prepare

```bash
git clone [https://github.com/](https://github.com/)<your-org>/medical-ai-hospital.git
cd medical-ai-hospital
```
Make sure the structure includes:

- `docker-compose.yml`
- `gateway/` (Dockerfile, app/, requirements.txt, etc.)
- `frontend/` (Dockerfile, app/, components/, ...)
- `db/01_init.sql` (schema)

The `db/01_init.sql` contains the production schema (users, patients, clinical data, etc.).

## 2) Configure environment (defaults are sane)
The Compose file already provides inline environment values suitable for local dev:

- **Gateway → DB:** `postgresql://mcp_user:mcp_password@db:5432/medical_db`
- **Gateway → CORS:** `ALLOWED_ORIGINS=http://localhost:3000` and `ALLOW_CREDENTIALS=true`
- **Gateway → Sessions:** cookie `sid`, `lax` mode, not `Secure` in dev
- **Gateway → MCP:** `MCP_BASE_URL=http://mcp:8080` with `MCP_BEARER_TOKEN=dev-token`
- **Frontend → Gateway:** `NEXT_PUBLIC_API_BASE=http://localhost:8080`

If your host uses Postgres already on `5432`, either:
- `export DB_PORT=5433` before `make up`, or
- remove the `db.ports` mapping from `docker-compose.yml`.

## 3) Start the stack

**Option A — Start everything**
```bash
make up
```
- **Frontend:** `http://localhost:3000`
- **Gateway:** `http://localhost:8080/health`
- **MCP:** `http://localhost:9090`

**Option B — Start only what you need**
For registration/login only, you just need `db` + `gateway`:
```bash
make db-up
make gw
```

## 4) Verify health

```bash
# Gateway
curl -sS http://localhost:8080/health | jq .

# Postgres
docker compose logs db --follow
```
If `/health` is not reachable, check container status:
```bash
docker compose ps
docker compose logs gateway --follow
```

## 5) Register and login (API)
```bash
# Register
curl -i -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Str0ng!Passw0rd"}'

# Login (capture cookie)
curl -i -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Str0ng!Passw0rd"}'

# Me (authenticated)
curl -s -b cookies.txt http://localhost:8080/auth/me | jq .
```

## 6) Frontend
If you prefer running the Next.js app outside Docker:
```bash
cd frontend
cp .env.local.example .env.local   # ensure NEXT_PUBLIC_API_BASE=http://localhost:8080
npm ci
npm run dev
# http://localhost:3000
```
The Home page advertises the platform; register via `/register` and sign in via `/login`.

## 7) Production notes
- **TLS:** Put a reverse proxy (NGINX, Traefik) in front of Gateway and Frontend. Enforce HTTPS and HSTS.
- **Cookies:** In production set `SESSION_SECURE_COOKIES=true` and `SESSION_SAMESITE=Strict`.
- **Secrets:** Use a vault (e.g., AWS Secrets Manager / HashiCorp Vault) for `COOKIE_SECRET`, DB password, and `MCP_BEARER_TOKEN`.
- **Backups:** Schedule Postgres backups and monitor replication/retention.
- **Observability:** Aggregate logs, add request IDs, collect metrics (latency, error rates).
- **Hardening:** Apply WAF/IPS/IDS, restrict CORS to production origins only, enable rate limiting.

## 8) Troubleshooting
- **Port conflicts:** If host Postgres is using `5432`, `export DB_PORT=5433` and re-run `make up`.
- **Gateway “connection refused”:** Check logs with `docker compose logs gateway --follow`.
- **Frontend “Failed to fetch”:**
  - Ensure gateway is up: `curl http://localhost:8080/health`
  - Verify `NEXT_PUBLIC_API_BASE` in `frontend/.env.local`.
  - Verify gateway CORS: `ALLOWED_ORIGINS` includes your FE origin and `ALLOW_CREDENTIALS=true`.

