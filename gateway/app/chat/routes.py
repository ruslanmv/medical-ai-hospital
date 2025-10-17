from __future__ import annotations

from fastapi import APIRouter, Depends
from ..deps import get_current_user
from ..models.me import ChatSendIn
from .mcp_client import invoke_tool

router = APIRouter()

@router.post("/send")
async def chat_send(payload: ChatSendIn, user=Depends(get_current_user)):
    # Simple demo: forward to triageSymptoms (or use payload.tool if you expand the model)
    args = payload.args or {}
    if payload.message:
        # many tools expect structured args; if you only have free text, pass as 'query' or 'symptoms'
        args.setdefault("query", payload.message)
    result = await invoke_tool("triageSymptoms", args)
    return result
