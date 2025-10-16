from pydantic import BaseModel
from typing import Any, Dict

class ChatSendIn(BaseModel):
    message: str | None = None
    args: Dict[str, Any] = {}
