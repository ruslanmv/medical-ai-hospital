# Database — Production Schema & Seed

This folder contains the **idempotent** production schema and a minimal seed used by Docker Compose to initialize Postgres **on first boot only**. If a database volume already exists, these scripts are **not** re-run.

## Files

* **10_init.sql** — Full DDL (tables, enums, indexes, triggers, views).
* **20_seed.sql** — Demo data: roles, users, patients, vitals, drugs, interactions.
* **migrations/** — Placeholder for future migration tooling (e.g., Alembic); **not** used by Compose init.

Compose mounts these files into the container at `/docker-entrypoint-initdb.d/`. The official Postgres image runs every `*.sql`, `*.sql.gz`, or `*.sh` script in that directory **only when the data directory is empty** (i.e., the first time the volume is created).

---

## How Initialization Works

On the **first** start of the `db` service with an empty volume, the Postgres entrypoint:

1. Initializes a new database cluster.
2. Executes every script in `/docker-entrypoint-initdb.d/` in alphanumeric order.
3. Marks the volume as initialized.

On subsequent restarts with an existing volume, **no scripts are executed**.

---

## Docker Compose Configuration

Ensure your `docker-compose.yml` mounts the files with **these exact names**:

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: mcp_password
      POSTGRES_DB: medical_db
    volumes:
      - db_data:/var/lib/postgresql/data
      - ./db/10_init.sql:/docker-entrypoint-initdb.d/10_init.sql:ro
      - ./db/20_seed.sql:/docker-entrypoint-initdb.d/20_seed.sql:ro
```

> If you rename the files (e.g., `01_init.sql`) but don’t update the Compose mounts, the scripts won’t be present in the container and nothing will be created.

---

## Usage

### First-Time Startup (or a Full Reset)

Start **only** the database:

```bash
docker-compose up -d db
```

Re-run initialization (wipe data volume):

```bash
# Stop containers AND remove the database volume (-v is crucial)
docker-compose down -v

# Start the database again to recreate the volume and re-run init/seed scripts
docker-compose up -d db
```

### Verifying the Setup

List relations (tables & views):

```bash
docker-compose exec -T db psql -U mcp_user -d medical_db -c "\dt+"
```

You should see tables like `users`, `patients`, `vitals`, etc.

Count rows in a table:

```bash
docker-compose exec -T db psql -U mcp_user -d medical_db -c "SELECT COUNT(*) FROM users;"
```

---

## Troubleshooting: “relation … does not exist”

If you see errors like `ERROR: relation "users" does not exist`, the schema scripts didn’t run.

**Checklist:**

1. **Remove the volume and re-init:**

   ```bash
   docker-compose down -v
   docker volume ls    # optional: confirm the named volume was removed
   docker-compose up -d db
   ```

2. **Confirm file names & mounts match:**
   `db/10_init.sql` and `db/20_seed.sql` must be mounted exactly as in compose.

3. **Verify scripts are visible in the container:**

   ```bash
   docker-compose exec -T db sh -lc "ls -l /docker-entrypoint-initdb.d/"
   ```

4. **Check container logs for SQL errors during init:**

   ```bash
   docker-compose logs db
   ```

5. **Fix port conflicts / restart loops:**
   If the `db` container keeps restarting, inspect with:

   ```bash
   docker-compose ps
   docker-compose logs db
   ```

> 99% of the time, `docker-compose down -v` followed by `docker-compose up -d db` with correct mounts fixes it. ✅

---

## Useful Commands

**List relations:**

```bash
docker-compose exec -T db psql -U mcp_user -d medical_db -c "\dt+"
```

**Show recent logs:**

```bash
docker-compose logs -n 200 db
```

**Interactive psql shell:**

```bash
docker-compose exec -it db psql -U mcp_user -d medical_db
```

**Dump a database snapshot:**

```bash
docker-compose exec -i db pg_dump -U mcp_user -d medical_db > db/dump.sql
```

**Restore from a dump (requires a fresh DB):**

```bash
docker-compose down -v
docker-compose up -d db
sleep 3
docker-compose exec -i db psql -U mcp_user -d medical_db < db/dump.sql
```

---

## Notes

* Password hashes in `20_seed.sql` are placeholders; replace in real deployments.
* `updated_at` is maintained via triggers where appropriate.
* Views `v_latest_vitals` and `v_patient_profile` support `/me/patient` snapshots in the gateway.
