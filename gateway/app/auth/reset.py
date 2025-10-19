# medical-ai-hospital/gateway/app/auth/reset.py
from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any, Optional, Union

from pydantic import EmailStr

from ..config import settings
from .. import db
from ..repos.users import (
    get_user_by_email,
    update_password_hash,
    revoke_all_sessions_for_user,
)
from .passwords import hash_password

log = logging.getLogger(__name__)


# =============================================================================
# Helpers
# =============================================================================

def _utcnow() -> datetime:
    """Timezone-aware 'now' in UTC."""
    return datetime.now(timezone.utc)


def _hash_token(raw: str) -> str:
    """Stable SHA-256 hex digest of the provided token string."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _reset_link_from_token(raw_token: str) -> str:
    """Build a frontend reset URL from a raw (unhashed) token."""
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


# =============================================================================
# DB operations (password_resets)
# Schema: id (uuid), user_id (uuid), token_hash (text unique), requested_at (ts, default now),
#         expires_at (ts), used_at (ts nullable)
# =============================================================================

async def _insert_reset_token(user_id: str, token_hash: str, expires_at: datetime) -> None:
    """Insert a freshly generated reset token."""
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO password_resets (user_id, token_hash, expires_at)
                VALUES (%s, %s, %s)
                """,
                (user_id, token_hash, expires_at),
            )
        await conn.commit()


async def _consume_reset_token(token_hash: str) -> Optional[dict[str, Any]]:
    """
    Atomically fetch a valid reset token and mark it used.
    Returns {"id": <uuid>, "user_id": <uuid str>} if valid, else None.
    """
    pool = db.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            # Select valid token (unused + unexpired)
            await cur.execute(
                """
                SELECT id, user_id
                FROM password_resets
                WHERE token_hash = %s
                  AND used_at IS NULL
                  AND expires_at > now()
                LIMIT 1
                """,
                (token_hash,),
            )
            row = await cur.fetchone()
            if not row:
                return None

            reset_id, user_id = row[0], row[1]

            # Mark used
            await cur.execute(
                "UPDATE password_resets SET used_at = now() WHERE id = %s",
                (reset_id,),
            )
        await conn.commit()

    return {"id": reset_id, "user_id": str(user_id)}


# =============================================================================
# SMTP mailer (inline for resilience & clear error handling)
# =============================================================================

async def _send_email(*, to: str, subject: str, text: str, html: Optional[str] = None) -> None:
    """
    Send an email using SMTP settings. If SMTP is not configured, log and no-op.
    If sending fails, raise to caller (which will swallow/log appropriately).
    """
    if not settings.smtp_host or not settings.mail_from:
        log.warning(
            "Password reset email skipped: SMTP not configured (smtp_host/mail_from missing). "
            "Set SMTP_* and MAIL_FROM in your environment."
        )
        return  # No-op in dev/misconfigured envs

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = str(settings.mail_from)
    message["To"] = to
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")

    host = settings.smtp_host
    port = int(getattr(settings, "smtp_port", 587) or 587)
    username = getattr(settings, "smtp_username", None)
    password = getattr(settings, "smtp_password", None)
    use_starttls = bool(getattr(settings, "smtp_starttls", True))

    def _send_sync():
        if not use_starttls and port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(message)
        else:
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.ehlo()
                if use_starttls:
                    server.starttls(context=context)
                    server.ehlo()
                if username and password:
                    server.login(username, password)
                server.send_message(message)

    # Run blocking SMTP in a thread so we don't block the event loop
    await asyncio.to_thread(_send_sync)


# =============================================================================
# Public API
# =============================================================================

async def request_password_reset(email: Union[str, EmailStr]) -> None:
    """
    Idempotent: always return successfully (no user enumeration).
    If user exists, store a reset token and attempt to email it.
    Email delivery failures are logged and swallowed to keep UX clean.
    """
    # Look up user; on DB errors, log and return OK
    try:
        user = await get_user_by_email(str(email))
    except Exception:
        log.exception("Error looking up user by email")
        return

    if not user:
        # No user -> still return 200 to avoid enumeration
        return

    # Generate token and save hash
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    ttl = int(getattr(settings, "password_reset_ttl_seconds", 3600) or 3600)
    expires_at = _utcnow() + timedelta(seconds=ttl)

    try:
        await _insert_reset_token(user_id=str(user["id"]), token_hash=token_hash, expires_at=expires_at)
    except Exception:
        log.exception("Failed to insert password reset token")
        # Don't leak to caller
        return

    reset_link = _reset_link_from_token(raw_token)
    subject = "Reset your password"
    text = (
        "We received a request to reset your password.\n\n"
        f"Use this link to set a new password (valid for {ttl // 60} minutes):\n{reset_link}\n\n"
        "If you didn't request this, you can ignore this email."
    )
    html = f"""
    <p>We received a request to reset your password.</p>
    <p><a href="{reset_link}">Click here to set a new password</a></p>
    <p>This link will expire in {ttl // 60} minutes.</p>
    <p>If you didn't request this, you can ignore this email.</p>
    """

    try:
        # IMPORTANT: pass a plain string; do NOT call EmailStr(...) as a constructor.
        await _send_email(to=str(user["email"]), subject=subject, text=text, html=html)
    except Exception as e:
        # Log but do not fail the endpoint
        log.warning(
            "Password reset email failed to send. This is typically an SMTP configuration issue. "
            "Check SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD/MAIL_FROM. Error: %s",
            e,
        )
        # In non-prod, log the link to unblock local testing.
        if getattr(settings, "env", "dev").lower() != "prod":
            log.warning("DEV MODE: password reset link for %s: %s", user["email"], reset_link)


async def perform_password_reset(*, raw_token: str, new_password: str) -> None:
    """
    Validate and consume a reset token, update password, revoke sessions.
    Raises ValueError on invalid/expired token.
    """
    token_hash = _hash_token(raw_token)
    row = await _consume_reset_token(token_hash)
    if not row:
        raise ValueError("Invalid or expired reset link")

    user_id = row["user_id"]

    # Update password & revoke sessions
    try:
        new_hash = hash_password(new_password)
        await update_password_hash(user_id, new_hash)
        await revoke_all_sessions_for_user(user_id)
    except Exception:
        # Password changed, but session revocation could fail—log for operators.
        log.exception("Failed to set new password or revoke sessions for user_id=%s", user_id)
        # We do not re-raise to avoid confusing UX after successful password change.
