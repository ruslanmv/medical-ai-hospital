# gateway/app/repos/password_resets.py
from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any

from psycopg.rows import dict_row

from .. import db


async def insert_reset_token(*, user_id: str, token_hash: str, expires_at: datetime) -> Dict[str, Any]:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                INSERT INTO password_resets (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                RETURNING id, user_id, expires_at
                """,
                (user_id, token_hash, expires_at),
            )
            row = await cur.fetchone()
        await conn.commit()
    if not row:
        raise RuntimeError("Failed to insert password reset token")
    return row


async def get_valid_reset_by_hash(token_hash: str) -> Optional[Dict[str, Any]]:
    """Return the reset row if it's valid (not used and not expired)."""
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT id, user_id, expires_at, used_at
                FROM password_resets
                WHERE token_hash = %s
                  AND used_at IS NULL
                  AND expires_at > now()
                """,
                (token_hash,),
            )
            return await cur.fetchone()


async def mark_reset_used(token_hash: str) -> None:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE password_resets SET used_at = now() WHERE token_hash = %s",
                (token_hash,),
            )
        await conn.commit()
