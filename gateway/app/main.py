from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse

APP_NAME = os.getenv("APP_NAME", "Gateway API")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")

# Parse comma-separated origins
_allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins: List[str] = [o.strip() for o in _allowed.split(",") if o.strip()]
allow_credentials = os.getenv("ALLOW_CREDENTIALS", "true").lower() == "true"

app = FastAPI(title=APP_NAME, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_class=PlainTextResponse)
def health() -> str:
    """Simple health probe for Docker/Compose."""
    return "ok"


@app.get("/")
def root():
    return JSONResponse(
        {
            "service": "gateway",
            "status": "running",
            "mcp_base_url": os.getenv("MCP_BASE_URL", "unset"),
        }
    )
