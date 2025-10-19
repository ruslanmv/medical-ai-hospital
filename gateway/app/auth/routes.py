# medical-ai-hospital/gateway/app/auth/routes.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, SecretStr

from ..models.auth import RegisterIn, LoginIn, MeOut
from ..repos.users import create_user, get_user_by_email
from .passwords import hash_password, verify_password
from .sessions import create_session, revoke_session
from ..deps import get_current_user
from .reset import request_password_reset, perform_password_reset

router = APIRouter()


# ------------------------ Account Registration/Login ------------------------
@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterIn):
    """
    Create a user account. Idempotent on email: if the email already exists,
    report 409 but don't leak whether the account is verified/active.
    """
    pw_hash = hash_password(payload.password)  # SecretStr supported by helper
    row = await create_user(email=str(payload.email), password_hash=pw_hash)

    if row:
        return {"ok": True, "created": True}

    # Email already exists
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Email already registered",
    )


@router.post("/login", response_model=MeOut)
async def login(payload: LoginIn, request: Request, response: Response):
    """
    Verify credentials and issue a secure session cookie.
    """
    user = await get_user_by_email(str(payload.email))
    if not user or not verify_password(payload.password, user["password_hash"]):
        # Avoid credential oracle
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")

    await create_session(user_id=str(user["id"]), request=request, response=response)
    return MeOut(id=str(user["id"]), email=user["email"], is_verified=bool(user.get("is_verified", False)))


@router.post("/logout")
async def logout(request: Request, response: Response):
    """
    Revoke the current session cookie (if present).
    """
    await revoke_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(user=Depends(get_current_user)):
    """
    Return the authenticated user's basic profile.
    """
    return MeOut(id=str(user["id"]), email=user["email"], is_verified=bool(user.get("is_verified", False)))


# ------------------------ Password Reset Flow ------------------------
class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: SecretStr


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """
    Request a password reset. Always returns 200 to prevent user enumeration.
    """
    await request_password_reset(payload.email)
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn):
    """
    Use a valid token to set a new password and revoke all sessions.
    """
    try:
        await perform_password_reset(
            raw_token=payload.token,
            new_password=payload.new_password.get_secret_value(),
        )
    except ValueError as e:
        # Invalid/expired token -> 400
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}
