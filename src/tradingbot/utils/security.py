from fastapi import WebSocket
from typing import Optional
import jwt
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# 用于签名的密钥
SECRET_KEY = "your-secret-key"  # 在生产环境中应该使用环境变量
ALGORITHM = "HS256"


def create_ws_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建WebSocket连接的JWT token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_ws_token(token: str) -> Optional[dict]:
    """
    解码并验证WebSocket token
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return None
    except jwt.JWTError as e:
        logger.error(f"Invalid token: {str(e)}")
        return None


async def validate_ws_token(websocket: WebSocket) -> bool:
    """
    验证WebSocket连接的token
    """
    try:
        token = websocket.query_params.get("token")
        if not token:
            logger.error("No token provided")
            raise Exception("No token provided")

        payload = decode_ws_token(token)
        if not payload:
            raise Exception("Invalid token")

        # 验证token中的权限
        if "permissions" not in payload:
            raise Exception("No permissions in token")

        # 验证频道访问权限
        channel = websocket.query_params.get("channel")
        if channel and channel not in payload["permissions"]:
            raise Exception(f"No permission for channel: {channel}")

        return True
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        raise Exception(f"Token validation failed: {str(e)}")
