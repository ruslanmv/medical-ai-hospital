# medical-ai-hospital/gateway/app/repos/users.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from psycopg.rows import dict_row

from .. import db  # IMPORTANT: import the module, not a value from it


# ------------------------ Users ------------------------
async def create_user(
    *,
    email: str,
    password_hash: str,
    password_algo: str = "argon2id",
    display_name: Optional[str] = None,
    phone: Optional[str] = None,
) -> dict | None:
    """
    Create a user if the email is not already registered.
    Returns minimal user info if created, otherwise None.
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                INSERT INTO users (email, password_hash, password_algo, display_name, phone)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                RETURNING id, email, is_verified, created_at
                """,
                (email, password_hash, password_algo, display_name, phone),
            )
            row = await cur.fetchone()
        await conn.commit()
    return row


async def get_user_by_email(email: str) -> dict | None:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            return await cur.fetchone()


async def get_user_by_id(user_id: str) -> dict | None:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return await cur.fetchone()


# --------------------- Auth Sessions -------------------
async def insert_session(
    *,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> dict:
    """
    Insert an auth session row and return minimal data for cookie lifetime, etc.
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                INSERT INTO auth_sessions (user_id, session_token_hash, ip_address, user_agent, expires_at)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, user_id, expires_at
                """,
                (user_id, token_hash, ip_address, user_agent, expires_at),
            )
            row = await cur.fetchone()
        await conn.commit()
    if not row:
        raise RuntimeError("Session insertion failed")
    return row


async def get_session_by_token_hash(token_hash: str) -> dict | None:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT id, user_id, expires_at FROM auth_sessions
                WHERE session_token_hash = %s
                  AND (expires_at IS NULL OR expires_at > now())
                  AND revoked_at IS NULL
                """,
                (token_hash,),
            )
            return await cur.fetchone()


async def delete_session_by_token_hash(token_hash: str) -> None:
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE auth_sessions SET revoked_at = now() WHERE session_token_hash = %s",
                (token_hash,),
            )
        await conn.commit()


# --------------------- Password & Security helpers -------------------
async def update_password_hash(user_id: str, new_hash: str, algo: str = "argon2id") -> None:
    """
    Update a user's password hash (and algorithm label).
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE users SET password_hash = %s, password_algo = %s WHERE id = %s",
                (new_hash, algo, user_id),
            )
        await conn.commit()


async def revoke_all_sessions_for_user(user_id: str) -> None:
    """
    Revoke all active sessions for a user (logs them out everywhere).
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL",
                (user_id,),
            )
        await conn.commit()
