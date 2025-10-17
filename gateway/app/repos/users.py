from __future__ import annotations

from typing import Optional, Dict, Any
from ..db import pool

# --- Users --------------------------------------------------------------

async def get_user_by_email(cur, email: str) -> Optional[Dict[str, Any]]:
    await cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    return await cur.fetchone()

async def get_user_by_id(cur, user_id: str) -> Optional[Dict[str, Any]]:
    await cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    return await cur.fetchone()

async def create_user(cur, *, email: str, password_hash: str) -> Dict[str, Any]:
    await cur.execute(
        """
        INSERT INTO users (email, password_hash, password_algo)
        VALUES (%s, %s, 'argon2id')
        RETURNING id, email, is_verified, created_at
        """,
        (email, password_hash),
    )
    return await cur.fetchone()

async def add_role(cur, *, user_id: str, role_code: str) -> None:
    await cur.execute(
        "INSERT INTO user_roles (user_id, role_code) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (user_id, role_code),
    )

def get_user_public(row: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": row["id"], "email": row["email"], "is_verified": row.get("is_verified", False)}

# --- Sessions (use pool internally; no cur needed) ----------------------

async def insert_session(*, user_id: str, token_hash: str, expires_at, ip_address: str | None, user_agent: str | None):
    if not pool:
        raise RuntimeError("DB pool not initialized")
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO auth_sessions (user_id, session_token_hash, ip_address, user_agent, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, user_id, expires_at
            """,
            (user_id, token_hash, ip_address, user_agent, expires_at),
        )
        return await cur.fetchone()

async def get_session_by_token_hash(token_hash: str):
    if not pool:
        raise RuntimeError("DB pool not initialized")
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            SELECT id, user_id, expires_at
            FROM auth_sessions
            WHERE session_token_hash = %s
              AND revoked_at IS NULL
              AND expires_at > now()
            """,
            (token_hash,),
        )
        return await cur.fetchone()

async def delete_session_by_token_hash(token_hash: str) -> None:
    if not pool:
        raise RuntimeError("DB pool not initialized")
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            "UPDATE auth_sessions SET revoked_at = now() WHERE session_token_hash = %s",
            (token_hash,),
        )
