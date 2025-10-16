from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from ..deps import get_current_user
from ..models.me import ChatSendIn
from .mcp_client import invoke_tool, sse_iter

router = APIRouter()

@router.post("/send")
async def chat_send(payload: ChatSendIn, user=Depends(get_current_user)):
    # Example intent routing; adapt to your NLU/orchestrator
    args = payload.dict().get("args", {})
    result = await invoke_tool("triageSymptoms", args)
    return result


@router.get("/events")
async def chat_events(user=Depends(get_current_user)):
    async def event_gen():
        async for line in sse_iter():
            yield f"{line}\n"
    return StreamingResponse(event_gen(), media_type="text/event-stream")
