"""
Dependencies for FastAPI application
"""

from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from prometheus_client import CollectorRegistry
from pymongo import MongoClient
from redis import Redis

from .core.config import settings
from .core.exceptions import AuthenticationError, DatabaseError
from .models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


# Database connection
def get_db() -> Generator:
    """Get database connection."""
    try:
        client = MongoClient(settings.MONGODB_URL)
        db = client[settings.DATABASE_NAME]
        yield db
    except Exception as e:
        raise DatabaseError(
            message="Database connection failed", details={"error": str(e)}
        )
    finally:
        client.close()


# Redis connection
def get_redis() -> Generator:
    """Get Redis connection."""
    try:
        redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        yield redis
    except Exception as e:
        raise DatabaseError(
            message="Redis connection failed", details={"error": str(e)}
        )
    finally:
        redis.close()


# Prometheus registry
def get_metrics_registry() -> CollectorRegistry:
    """Get Prometheus metrics registry."""
    return CollectorRegistry()


# Current user dependency
async def get_current_user(
    db=Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """Get current authenticated user."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise AuthenticationError(message="Could not validate credentials")
    except JWTError:
        raise AuthenticationError(message="Could not validate credentials")

    user = db.users.find_one({"_id": user_id})
    if user is None:
        raise AuthenticationError(message="User not found")

    return User(**user)


# Active user dependency
async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise AuthenticationError(message="Inactive user")
    return current_user


# Admin user dependency
async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get current admin user."""
    if not current_user.is_admin:
        raise AuthenticationError(message="Not enough privileges")
    return current_user


# Rate limiting dependency
async def check_rate_limit(
    redis: Redis = Depends(get_redis), current_user: User = Depends(get_current_user)
) -> None:
    """Check rate limiting for current user."""
    key = f"rate_limit:{current_user.id}"
    requests = redis.get(key)

    if requests and int(requests) > 100:  # 100 requests per minute
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded"
        )

    pipe = redis.pipeline()
    pipe.incr(key)
    pipe.expire(key, 60)  # 1 minute expiry
    pipe.execute()
