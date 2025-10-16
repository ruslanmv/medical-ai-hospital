from fastapi import APIRouter, Depends, HTTPException, Response, Request
from ..models.auth import RegisterIn, LoginIn, MeOut
from ..auth.sessions import create_session, revoke_session
from ..auth.hashing import hash_password, verify_password
from ..deps import get_conn, get_current_user
from ..repos.users import get_user_by_email, create_user, add_role, get_user_public

router = APIRouter()

@router.post("/register", status_code=201)
async def register(payload: RegisterIn, cur=Depends(get_conn)):
    existing = await get_user_by_email(cur, payload.email)
    if existing:
        raise HTTPException(400, "Email already registered")
    pwd_hash = hash_password(payload.password)
    user = await create_user(cur, email=payload.email, password_hash=pwd_hash)
    await add_role(cur, user_id=user["id"], role_code="patient")
    return {"ok": True}


@router.post("/login")
async def login(payload: LoginIn, response: Response, cur=Depends(get_conn)):
    user = await get_user_by_email(cur, payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await create_session(user_id=user["id"], response=response)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    await revoke_session(request=request, response=response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(user=Depends(get_current_user)):
    return get_user_public(user)
