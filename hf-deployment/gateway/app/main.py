# gateway/app/main.py — HuggingFace Spaces version
from __future__ import annotations

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .telemetry.middleware import RequestIDMiddleware
from .auth.routes import router as auth_router
from .me.routes import router as me_router
from .chat.routes import router as chat_router

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("gateway")


def create_app() -> FastAPI:
    app = FastAPI(title="Medical AI Hospital Gateway (HuggingFace)", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=settings.allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(RequestIDMiddleware)

    @app.on_event("startup")
    async def _startup():
        await init_db()
        log.info("SQLite database initialized")
        log.info("Cookie settings: secure=%s, samesite=%s, name=%s",
                 settings.session_secure_cookies, settings.session_samesite,
                 settings.session_cookie_name)
        log.info("CORS origins: %s", settings.allowed_origins)

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(me_router, prefix="/me", tags=["me"])
    app.include_router(chat_router, prefix="/chat", tags=["chat"])

    @app.get("/health", tags=["meta"])
    async def health():
        return {"ok": True, "backend": "langgraph-huggingface", "version": "2.0.0"}

    return app


app = create_app()
