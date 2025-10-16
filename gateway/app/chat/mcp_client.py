import httpx
from ..config import settings

async def invoke_tool(name: str, args: dict):
    headers = {"Authorization": f"Bearer {settings.mcp_bearer_token}"}
    async with httpx.AsyncClient(base_url=settings.mcp_base_url, timeout=(settings.mcp_connect_timeout, settings.mcp_read_timeout)) as client:
        r = await client.post("/invoke", headers=headers, json={"tool": name, "args": args})
        r.raise_for_status()
        return r.json()


async def sse_iter():
    headers = {"Authorization": f"Bearer {settings.mcp_bearer_token}", "Accept": "text/event-stream"}
    async with httpx.AsyncClient(base_url=settings.mcp_base_url, timeout=None) as client:
        async with client.stream("GET", "/sse", headers=headers) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line:
                    yield line
