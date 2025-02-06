from fastapi import WebSocket
from jose import jwt

from ..core.config import settings


async def validate_ws_token(websocket: WebSocket) -> bool:
    """Validate WebSocket connection token."""
    try:
        token = websocket.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return False

        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return bool(payload.get("sub"))
    except Exception:
        return False
