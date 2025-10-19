# gateway/app/email/sender.py
from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

from pydantic import EmailStr

from ..config import settings

log = logging.getLogger("gateway.email")


def _send_sync_email(
    *,
    to: str,
    subject: str,
    text: str,
    html: Optional[str] = None,
) -> None:
    msg = EmailMessage()
    msg["From"] = settings.mail_from or settings.smtp_username or "no-reply@example.com"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    if not settings.smtp_host:
        # Dev fallback: no SMTP configured — log the message and return
        log.warning("SMTP not configured. Email content below:\nTo: %s\nSubject: %s\n\n%s\n", to, subject, text)
        if html:
            log.warning("HTML:\n%s", html)
        return

    context = ssl.create_default_context()
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_starttls:
            server.starttls(context=context)
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


async def send_email(
    *,
    to: EmailStr,
    subject: str,
    text: str,
    html: Optional[str] = None,
) -> None:
    """Async wrapper around a sync SMTP send (runs in a thread)."""
    await asyncio.to_thread(
        _send_sync_email,
        to=str(to),
        subject=subject,
        text=text,
        html=html,
    )
