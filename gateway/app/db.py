from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

from .config import settings

log = logging.getLogger("gateway.db")

# Private module-level handle; do not import this name elsewhere.
_pool: AsyncConnectionPool | None = None


async def init_pool() -> None:
    """Create the global async pool (idempotent)."""
    global _pool
    if _pool is not None:
        return

    log.info("Creating DB pool …")
    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=10,
        timeout=10,  # seconds to wait for a connection
        open=True,   # establish immediately (fail fast on misconfig)
    )
    # Optional quick probe
    async with _pool.connection() as conn:
        await conn.execute("SELECT 1")
    log.info("DB pool ready")


async def close_pool() -> None:
    """Close and reset the global pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> AsyncConnectionPool:
    """Return the live pool or raise if not initialized.

    Always import and call this function instead of importing a `pool` variable.
    """
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool


@asynccontextmanager
async def cursor():
    """Convenience context manager that yields a dict-row cursor and commits on exit."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            yield cur
            await conn.commit()
