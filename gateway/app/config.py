# medical-ai-hospital/gateway/app/config.py
from __future__ import annotations

import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, EmailStr


class Settings(BaseSettings):
    # ---------------- App ----------------
    env: str = "dev"
    log_level: str = "INFO"

    # ---------------- Database ----------------
    database_url: str
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_timeout_sec: int = 10

    # ---------------- CORS / Frontend ----------------
    # Accepts CSV or JSON array in env (see validator below).
    allowed_origins: List[str] = ["http://localhost:3000"]
    allow_credentials: bool = True

    # ---------------- Sessions (cookie) ----------------
    session_cookie_name: str = "sid"
    session_ttl_seconds: int = 60 * 60 * 24 * 30  # 30d
    session_secure_cookies: bool = False
    session_samesite: str = "lax"  # lax | strict | none
    cookie_secret: str = "change-me-please-32B-minimum"

    # ---------------- MCP (medical-mcp-toolkit HTTP shim) ----------------
    mcp_base_url: str = "http://mcp:8080"
    mcp_bearer_token: str = "dev-token"
    mcp_connect_timeout: int = 10
    mcp_read_timeout: int = 120

    # ---------------- Frontend base URL (used for emailed links) ----------------
    frontend_base_url: str = "http://localhost:3000"

    # ---------------- SMTP (for password reset emails) ----------------
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = True
    mail_from: EmailStr | None = None

    # ---------------- Password reset TTL (seconds) ----------------
    password_reset_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, v):
        """
        Accept:
          - a real list (already parsed)
          - a JSON array string, e.g. '["http://a","http://b"]'
          - a CSV string, e.g. 'http://a,http://b'
        """
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            # JSON array?
            if s.startswith("[") and s.endswith("]"):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    # fall back to CSV if JSON parse fails
                    pass
            # CSV fallback
            return [s2.strip() for s2 in s.split(",") if s2.strip()]
        return v


settings = Settings()
