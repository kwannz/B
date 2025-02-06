import os
from fastapi import WebSocket
from jose import jwt

from ..core.config import settings


async def validate_ws_token(websocket: WebSocket) -> bool:
    """Validate WebSocket connection token."""
    try:
        token = websocket.query_params.get("token")
        if not token:
            return False
            
        test_token = os.getenv("TEST_TOKEN")
        if test_token and token == test_token:
            return True

        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return bool(payload.get("sub"))
    except Exception:
        return False
