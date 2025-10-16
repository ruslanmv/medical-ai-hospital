import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.time()
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        response.headers["X-Response-Time-ms"] = str(int((time.time() - start) * 1000))
        return response
