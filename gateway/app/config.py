from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List

class Settings(BaseSettings):
    # App
    env: str = "dev"
    log_level: str = "INFO"

    # Database
    database_url: str
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_timeout_sec: int = 10

    # CORS / Frontend
    allowed_origins: List[str] = ["http://localhost:3000"]
    allow_credentials: bool = True

    # Sessions (cookie)
    session_cookie_name: str = "sid"
    session_ttl_seconds: int = 60 * 60 * 24 * 30  # 30d
    session_secure_cookies: bool = False
    session_samesite: str = "lax"  # lax | strict | none
    cookie_secret: str = "change-me-please-32B-minimum"

    # MCP (medical-mcp-toolkit HTTP shim)
    mcp_base_url: str = "http://mcp:8080"
    mcp_bearer_token: str = "dev-token"
    mcp_connect_timeout: int = 10
    mcp_read_timeout: int = 120

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        # Accept CSV in env: "http://a,http://b"
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


settings = Settings()
