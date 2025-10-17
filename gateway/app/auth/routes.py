from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from ..models.auth import RegisterIn, LoginIn, MeOut
from .hashing import hash_password, verify_password
from .sessions import create_session, revoke_session
from ..deps import get_conn, get_current_user
from ..repos.users import get_user_by_email, create_user, add_role, get_user_public

router = APIRouter()

@router.post("/register", status_code=201)
async def register(payload: RegisterIn, cur=Depends(get_conn)):
    user = await get_user_by_email(cur, payload.email)
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    pwd_hash = hash_password(payload.password)
    row = await create_user(cur, email=payload.email, password_hash=pwd_hash)
    await add_role(cur, user_id=row["id"], role_code="patient")
    return {"ok": True}

@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response, cur=Depends(get_conn)):
    user = await get_user_by_email(cur, payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await create_session(user_id=user["id"], request=request, response=response)
    return {"ok": True}

@router.post("/logout")
async def logout(request: Request, response: Response):
    await revoke_session(request=request, response=response)
    return {"ok": True}

@router.get("/me", response_model=MeOut)
async def me(user=Depends(get_current_user)):
    return get_user_public(user)
