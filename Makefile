# Makefile — Monorepo Dev & Ops (DB + Gateway + Frontend)
# - Uses docker compose (v2) if available, falls back to docker-compose (v1).
# - `gw` starts only gateway (no deps). Use `gw-deps` for gateway + db + mcp.
# - Override ports on the fly: e.g. `DB_PORT=5433 make up`.

.DEFAULT_GOAL := help

# --------- Ports (override via env) ------------------------------------------
FRONTEND_PORT ?= 3000
GATEWAY_PORT  ?= 8080
MCP_PORT      ?= 9090
DB_PORT       ?= 5432

# --------- Compose detection -------------------------------------------------
HAVE_DOCKER_COMPOSE_V2 := $(shell docker compose version >/dev/null 2>&1 && echo 1 || echo 0)
HAVE_DOCKER_COMPOSE_V1 := $(shell docker-compose --version >/dev/null 2>&1 && echo 1 || echo 0)

ifeq ($(HAVE_DOCKER_COMPOSE_V2),1)
  COMPOSE := docker compose
else ifeq ($(HAVE_DOCKER_COMPOSE_V1),1)
  COMPOSE := docker-compose
else
  $(error Docker Compose not found. Install Compose v2 ('docker compose') or v1 ('docker-compose'))
endif

# --------- Phony targets -----------------------------------------------------
.PHONY: help up down down-v stop ps logs tail restart \
        db-up db-down db-logs dump \
        fe fe-build fe-start fe-lint \
        gw gw-deps gw-lint gw-test \
        bootstrap fmt lint test \
        seed smoke clean compose-version

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_.-]+:.*##/ { printf "  %-20s %s\n", $$1, $$2 } ' $(MAKEFILE_LIST)

compose-version: ## Show which Compose variant is being used
	@echo "Using: $(COMPOSE)"
	@$(COMPOSE) version || true

# --------- Orchestration -----------------------------------------------------
up: ## Start all services (DB, MCP, Gateway, Frontend)
	$(COMPOSE) up -d --build
	@echo "→ http://localhost:$(FRONTEND_PORT)  (frontend)"
	@echo "→ http://localhost:$(GATEWAY_PORT)   (gateway)"
	@echo "→ http://localhost:$(MCP_PORT)       (mcp)"

stop: ## Stop all services (without removing containers)
	$(COMPOSE) stop

down: ## Stop and remove containers (preserves data volumes)
	$(COMPOSE) down

down-v: ## Stop and remove containers AND data volumes (deletes DB data)
	$(COMPOSE) down -v

ps: ## Show service status
	$(COMPOSE) ps

logs: ## Tail logs (all)
	$(COMPOSE) logs -f --tail=200

tail: ## Tail one service logs: make tail S=frontend|gateway|db|mcp
	@[ -n "$(S)" ] || (echo "Usage: make tail S=<service>" && exit 1)
	$(COMPOSE) logs -f --tail=200 $(S)

restart: ## Restart one service: make restart S=gateway
	@[ -n "$(S)" ] || (echo "Usage: make restart S=<service>" && exit 1)
	$(COMPOSE) up -d --build $(S)

# --------- Database ----------------------------------------------------------
DB_PSQL = docker exec -i db psql -U mcp_user -d medical_db -v ON_ERROR_STOP=1 -X -q -P pager=off

db-up: ## Start or (re)create the database service; remove conflicting 'db' container if it exists
	@# If any container named 'db' exists (even from outside compose), remove it to avoid name conflicts.
	@docker ps -a --format '{{.Names}}' | grep -x 'db' >/dev/null 2>&1 && \
	  (echo "→ Removing pre-existing 'db' container to avoid name conflict"; docker rm -fv db >/dev/null) || true
	$(COMPOSE) up -d --build db
	@echo "DB ready on port $(DB_PORT)"

db-down: ## Stop and remove the database (handles running or foreign containers cleanly)
	-$(COMPOSE) stop db || true
	-$(COMPOSE) rm -sfv db || true
	@# In case the db container was created outside of this compose project:
	-@docker ps -a --format '{{.Names}}' | grep -x 'db' >/dev/null 2>&1 && docker rm -fv db || true

db-logs: ## Tail database logs
	$(COMPOSE) logs -f --tail=200 db

dump: ## Dump DB schema+data to db/dump.sql (includes data)
	@mkdir -p db
	docker exec -i db pg_dump -U mcp_user -d medical_db > db/dump.sql
	@echo "Wrote db/dump.sql"

# --------- Frontend ----------------------------------------------------------
fe: ## Start frontend only (detached)
	$(COMPOSE) up -d frontend

fe-build: ## Build frontend image
	$(COMPOSE) build frontend

fe-start: ## Start FE in attached mode
	$(COMPOSE) up frontend

fe-lint: ## Lint FE
	$(COMPOSE) run --rm frontend npm run lint || true

# --------- Gateway -----------------------------------------------------------
# NOTE: `gw` will not start db/mcp. Use `gw-deps` to bring them too.
gw: ## Start gateway only (no deps)
	$(COMPOSE) up -d --no-deps --build gateway

gw-deps: ## Start gateway + dependencies (db, mcp)
	$(COMPOSE) up -d --build gateway

gw-lint: ## Lint gateway (ruff)
	$(COMPOSE) run --rm gateway ruff check . || true

gw-test: ## Run gateway tests (pytest)
	$(COMPOSE) run --rm gateway pytest -q || true

# --------- Project Hygiene ---------------------------------------------------
bootstrap: ## Install toolchains (Node deps, Python deps)
	$(COMPOSE) run --rm frontend npm ci || true
	$(COMPOSE) run --rm gateway pip install -r requirements.txt || true

fmt: ## Format gateway code
	$(COMPOSE) run --rm gateway ruff format . || true
	$(COMPOSE) run --rm gateway black . || true

lint: ## Lint gateway & frontend
	$(COMPOSE) run --rm gateway ruff check . || true
	$(COMPOSE) run --rm frontend npm run lint || true

# --------- QA ---------------------------------------------------------------
seed: ## (Optional) Seed via SQL or scripts
	@echo "Implement seeding via ./db/migrations or scripts as needed."

smoke: ## Quick health checks (requires curl & jq)
	@echo "Gateway:" && curl -fsS http://localhost:$(GATEWAY_PORT)/health | jq . || true
	@echo "MCP:" && curl -fsS http://localhost:$(MCP_PORT)/health || true
	@echo "Frontend:" && curl -fsS http://localhost:$(FRONTEND_PORT)/ | head -n 3 || true

clean: ## Nuke everything: containers, volumes, and artifacts
	$(COMPOSE) down -v --remove-orphans
	@rm -f db/dump.sql
	@echo "Cleaned."
