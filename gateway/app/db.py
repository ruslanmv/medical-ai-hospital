from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from .config import settings

pool: AsyncConnectionPool

async def init_pool():
    global pool
    pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        timeout=settings.db_timeout_sec,
        kwargs={"row_factory": dict_row},  # return dict rows
        open=True,
    )

async def close_pool():
    await pool.close()
