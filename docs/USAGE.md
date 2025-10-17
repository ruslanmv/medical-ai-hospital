# Usage — Register a User & Start Services

This guide shows exactly **which services to run** and the steps to **register and login** a user, both with **cURL** and the **Web UI**.

---

## What needs to be running?

For **registration/login** only:

- ✅ **db** (PostgreSQL)
- ✅ **gateway** (FastAPI)
- ❌ **mcp** (not required for auth)
- (Optional) **frontend** (Next.js) if you want to use the web UI instead of cURL

**Minimal Stack:** `db + gateway`  
**Full Stack:** `db + mcp + gateway + frontend`

---

## Start services

### Using Makefile

```bash
# Minimal for auth:
make db-up
make gw

# Optional (UI):
make fe

# Full stack:
make up
```

### Using Docker Compose directly
```bash
# Minimal:
docker compose up -d db gateway

# With UI:
docker compose up -d db gateway frontend
```
Default ports:

- **DB:** 5432
- **Gateway:** 8080
- **Frontend:** 3000
- **MCP:** 9090

### Verify health
```bash
curl -sS http://localhost:8080/health | jq .
# -> { "ok": true }
```
If that fails, inspect: `docker compose ps` and `docker compose logs gateway --follow`.

---

## Register & Login (API with cURL)
Requires `db` + `gateway`.

**1) Register**
```bash
curl -i -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Str0ng!Passw0rd"}'
```
**2) Login (capture cookie)**
```bash
curl -i -c cookies.txt -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Str0ng!Passw0rd"}'
```
**3) Me (authenticated)**
```bash
curl -s -b cookies.txt http://localhost:8080/auth/me | jq .




## Register & Login (Web UI)
Requires `frontend` + `gateway` + `db`.

1. Open `http://localhost:3000`
2. Use **Create account** (or go to `/register`) with your email/password.
3. After success, go to **Sign in** (or `/login`).
4. You’ll be redirected to `/dashboard`.

If the UI shows “Failed to fetch”:
- Ensure gateway is running: `curl http://localhost:8080/health`
- Confirm FE env: `NEXT_PUBLIC_API_BASE=http://localhost:8080`
- Confirm gateway CORS: `ALLOWED_ORIGINS=http://localhost:3000` and `ALLOW_CREDENTIALS=true`
- For localhost set: `SESSION_SECURE_COOKIES=false` and `SESSION_SAMESITE=lax`

---
## Common pitfalls & fixes
- **`400 Email already registered`** → Use another email.
- **`401 Not authenticated`** → Include the cookie: `-b cookies.txt`.
- **CORS / Failed to fetch** → Fix `ALLOWED_ORIGINS` and `ALLOW_CREDENTIALS`.
- **DB port conflict** → `export DB_PORT=5433` before `make up`.

