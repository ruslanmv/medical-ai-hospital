# gateway/app/auth/reset.py
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from pydantic import EmailStr

from ..config import settings
from ..email.sender import send_email
from ..repos import users as user_repo
from ..repos import password_resets as reset_repo
from .passwords import hash_password


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _build_reset_link(raw_token: str) -> str:
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


async def request_password_reset(email: EmailStr) -> None:
    """
    Create a reset token for the user and send an email.
    Always return successfully (to prevent user enumeration).
    """
    user = await user_repo.get_user_by_email(str(email))
    if not user:
        # Still return 200 even if user doesn't exist.
        return

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = _now_utc() + timedelta(seconds=settings.password_reset_ttl_seconds)

    await reset_repo.insert_reset_token(
        user_id=str(user["id"]),
        token_hash=token_hash,
        expires_at=expires_at,
    )

    link = _build_reset_link(raw_token)
    subject = "Reset your password"
    text = (
        "We received a request to reset your password.\n\n"
        f"Reset link (valid for {settings.password_reset_ttl_seconds // 60} minutes):\n{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = f"""
    <p>We received a request to reset your password.</p>
    <p><a href="{link}">Click here to reset your password</a></p>
    <p>This link will expire in {settings.password_reset_ttl_seconds // 60} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
    """

    await send_email(to=EmailStr(user["email"]), subject=subject, text=text, html=html)


async def perform_password_reset(*, raw_token: str, new_password: str) -> None:
    """
    Validate token, update the user's password, mark token used, and revoke sessions.
    """
    token_hash = _hash_token(raw_token)
    reset_row = await reset_repo.get_valid_reset_by_hash(token_hash)
    if not reset_row:
        raise ValueError("Invalid or expired reset token")

    user_id = str(reset_row["user_id"])

    new_hash = hash_password(new_password)
    await user_repo.update_password_hash(user_id=user_id, new_hash=new_hash)
    await reset_repo.mark_reset_used(token_hash)
    await user_repo.revoke_all_sessions_for_user(user_id)
