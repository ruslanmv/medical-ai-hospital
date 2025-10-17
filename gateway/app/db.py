from __future__ import annotations

from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from .config import settings

pool: AsyncConnectionPool | None = None

async def init_pool() -> None:
    global pool
    if pool:
        return
    pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        timeout=settings.db_timeout_sec,
        kwargs={"row_factory": dict_row},
        open=True,
    )

async def close_pool() -> None:
    if pool:
        await pool.close()
