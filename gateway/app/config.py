from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # Core
    env: str = "dev"
    log_level: str = "INFO"

    # Database
    database_url: str
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_timeout_sec: int = 10

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000"]
    allow_credentials: bool = True

    # Sessions
    session_cookie_name: str = "sid"
    session_ttl_seconds: int = 60 * 60 * 24 * 30
    session_secure_cookies: bool = False
    session_samesite: str = "lax"  # lax | strict | none
    cookie_secret: str

    # MCP
    mcp_base_url: str
    mcp_bearer_token: str
    mcp_connect_timeout: int = 10
    mcp_read_timeout: int = 120

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

settings = Settings()
