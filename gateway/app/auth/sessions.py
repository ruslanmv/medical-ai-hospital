import base64
import os
import hashlib
import datetime as dt
from fastapi import Request, Response
from itsdangerous import TimestampSigner, BadSignature
from pydantic import BaseModel
from ..config import settings
from ..repos.users import (
    insert_session,
    get_session_by_token_hash,
    delete_session_by_token_hash,
)

signer = TimestampSigner(settings.cookie_secret)

class Session(BaseModel):
    session_id: int
    user_id: str
    expires_at: dt.datetime


def _make_token() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(user_id: str, response: Response) -> Session:
    token = _make_token()
    token_signed = signer.sign(token).decode()
    expires = dt.datetime.utcnow() + dt.timedelta(seconds=settings.session_ttl_seconds)
    token_hash = _hash_token(token)
    sess = await insert_session(user_id, token_hash, expires)
    response.set_cookie(
        settings.session_cookie_name,
        token_signed,
        max_age=settings.session_ttl_seconds,
        secure=settings.session_secure_cookies,
        httponly=True,
        samesite=settings.session_samesite,
        path="/",
    )
    return Session(session_id=sess["id"], user_id=user_id, expires_at=expires)


async def read_session(request: Request) -> Session | None:
    raw = request.cookies.get(settings.session_cookie_name)
    if not raw:
        return None
    try:
        token = signer.unsign(raw, max_age=settings.session_ttl_seconds).decode()
    except BadSignature:
        return None
    token_hash = _hash_token(token)
    row = await get_session_by_token_hash(token_hash)
    if not row:
        return None
    return Session(session_id=row["id"], user_id=row["user_id"], expires_at=row["expires_at"])


async def revoke_session(request: Request, response: Response | None = None):
    raw = request.cookies.get(settings.session_cookie_name)
    if raw:
        try:
            token = signer.unsign(raw, max_age=settings.session_ttl_seconds).decode()
            await delete_session_by_token_hash(_hash_token(token))
        except BadSignature:
            pass
    if response:
        response.delete_cookie(settings.session_cookie_name, path="/")
