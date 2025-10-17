from __future__ import annotations

import httpx
from ..config import settings

async def invoke_tool(name: str, args: dict):
    headers = {
        "Authorization": f"Bearer {settings.mcp_bearer_token}",
        "Accept": "application/json",
    }
    timeout = httpx.Timeout(
        connect=settings.mcp_connect_timeout,
        read=settings.mcp_read_timeout,
    )
    async with httpx.AsyncClient(base_url=settings.mcp_base_url, timeout=timeout) as client:
        r = await client.post("/invoke", headers=headers, json={"tool": name, "args": args})
        r.raise_for_status()
        return r.json()
