from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from . import db  # Import the module itself
from .auth.sessions import read_session
from .repos.users import get_user_by_id

async def get_conn():
    # Access the 'pool' variable through the module namespace
    if not db.pool:
        raise RuntimeError("DB pool not initialized")
    async with db.pool.connection() as conn:
        async with conn.cursor() as cur:
            yield cur

async def get_current_session(request: Request):
    session = await read_session(request)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session

async def get_current_user(request: Request, cur=Depends(get_conn)):
    session = await get_current_session(request)
    user = await get_user_by_id(cur, session.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user