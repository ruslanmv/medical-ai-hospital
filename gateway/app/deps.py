from fastapi import Depends, HTTPException, Request, status
from .db import pool
from .auth.sessions import read_session
from .repos.users import get_user_by_id

# Yield a cursor within a transaction; commits on success, rollbacks on exception
async def get_conn():
    async with pool.connection() as conn:
        async with conn.transaction():
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
