# =============================================================================
# Makefile — Monorepo Dev & Ops (DB + Gateway + Frontend)
# =============================================================================
# Cross-platform where reasonable; dev targets use Docker and Node/Python tools.
# =============================================================================

.DEFAULT_GOAL := help

# --- Versions / Ports ---------------------------------------------------------
FRONTEND_PORT ?= 3000
GATEWAY_PORT  ?= 8080
MCP_PORT      ?= 9090
DB_PORT       ?= 5432

# --- Docker Compose Detection (v2 plugin vs v1 binary) -----------------------
# Prefer 'docker compose' (v2). Fall back to 'docker-compose' (v1) when needed.
HAVE_DOCKER_COMPOSE_V2 := $(shell docker compose version >/dev/null 2>&1 && echo 1 || echo 0)
HAVE_DOCKER_COMPOSE_V1 := $(shell docker-compose --version >/dev/null 2>&1 && echo 1 || echo 0)

ifeq ($(HAVE_DOCKER_COMPOSE_V2),1)
  COMPOSE := docker compose
else ifeq ($(HAVE_DOCKER_COMPOSE_V1),1)
  COMPOSE := docker-compose
else
  $(error Docker Compose not found. Install Compose v2 ('docker compose') or v1 ('docker-compose'))
endif

.PHONY: help up down ps logs tail restart \
        db-up db-down db-logs db-sh dump \
        fe fe-build fe-start fe-lint \
        gw gw-lint gw-test \
        bootstrap fmt lint test \
        seed smoke clean compose-version

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/ { printf "  %-20s %s\n", $$1, $$2 } ' $(MAKEFILE_LIST)

compose-version: ## Show which Compose variant is being used
	@echo "Using: $(COMPOSE)"
	@$(COMPOSE) version || true

# --- Orchestration ------------------------------------------------------------
up: ## Start all services (DB, MCP, Gateway, Frontend)
	$(COMPOSE) up -d --build
	@echo "→ http://localhost:$(FRONTEND_PORT)  (frontend)"
	@echo "→ http://localhost:$(GATEWAY_PORT)   (gateway)"
	@echo "→ http://localhost:$(MCP_PORT)       (mcp)"

down: ## Stop and remove all services
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

# --- Database -----------------------------------------------------------------

DB_PSQL = docker exec -i db psql -U mcp_user -d medical_db -v ON_ERROR_STOP=1 -X -q -P pager=off

db-up: ## Start only the database
	$(COMPOSE) up -d db

db-down: ## Stop and remove the database
	$(COMPOSE) rm -sfv db

db-logs: ## Tail database logs
	$(COMPOSE) logs -f --tail=200 db

# Dumps the current schema and data to ./db/dump.sql
# WARNING: includes data — do not commit in prod.
dump: ## Dump DB schema+data to db/dump.sql
	@mkdir -p db
	docker exec -i db pg_dump -U mcp_user -d medical_db > db/dump.sql
	@echo "Wrote db/dump.sql"

# --- Frontend -----------------------------------------------------------------
fe: ## Start frontend only (dev)
	$(COMPOSE) up -d frontend

fe-build: ## Build frontend image
	$(COMPOSE) build frontend

fe-start: ## Start FE dev server (attach)
	$(COMPOSE) up frontend

fe-lint: ## Lint FE
	$(COMPOSE) run --rm frontend npm run lint

# --- Gateway ------------------------------------------------------------------

gw: ## Start gateway only (dev)
	$(COMPOSE) up -d gateway

gw-lint: ## Lint gateway (ruff)
	$(COMPOSE) run --rm gateway ruff check .

gw-test: ## Run gateway tests (pytest)
	$(COMPOSE) run --rm gateway pytest -q

# --- Project Hygiene ----------------------------------------------------------
bootstrap: ## Install toolchains (Node deps, Python deps)
	$(COMPOSE) run --rm frontend npm ci
	$(COMPOSE) run --rm gateway uv sync

fmt: ## Format all code (FE+GW)
	$(COMPOSE) run --rm gateway ruff format .
	$(COMPOSE) run --rm gateway black .

lint: ## Lint all code (FE+GW)
	$(COMPOSE) run --rm gateway ruff check . || true
	$(COMPOSE) run --rm frontend npm run lint || true

# --- QA ----------------------------------------------------------------------
seed: ## (Optional) Seed via MCP tools or SQL (extend as needed)
	@echo "Seed step can be implemented via ./db/migrations or scripts."

smoke: ## End-to-end smoke test
	./scripts/health.sh

clean: ## Remove build artifacts and volumes
	$(COMPOSE) down -v --remove-orphans
	@rm -f db/dump.sql
	@echo "Cleaned."
