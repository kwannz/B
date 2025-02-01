"""
Dependency injection module for the Trading Bot API
"""

from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import aioredis
from prometheus_client import Counter, Histogram

from .config import Settings
from .exceptions import AuthenticationError, DatabaseError, CacheError
from ..models.user import User

# Load settings
settings = Settings()

# Initialize metrics
REQUEST_COUNT = Counter(
    "api_request_total",
    "Total number of API requests",
    ["endpoint", "method", "status"],
)

REQUEST_LATENCY = Histogram(
    "api_request_latency_seconds", "API request latency in seconds", ["endpoint"]
)

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


# Database connection
async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """Get database connection."""
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_NAME]
        yield db
    except Exception as e:
        raise DatabaseError(f"Failed to connect to database: {str(e)}")
    finally:
        client.close()


# Redis connection
async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """Get Redis connection."""
    try:
        redis = await aioredis.create_redis_pool(
            settings.REDIS_URL, minsize=1, maxsize=settings.REDIS_POOL_SIZE
        )
        yield redis
    except Exception as e:
        raise CacheError(f"Failed to connect to Redis: {str(e)}")
    finally:
        redis.close()
        await redis.wait_closed()


# User authentication
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> User:
    """Get current authenticated user."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Could not validate credentials")

        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
            raise AuthenticationError("Token has expired")

    except JWTError:
        raise AuthenticationError("Could not validate credentials")

    # Get user from database
    user_data = await db.users.find_one({"_id": user_id})
    if user_data is None:
        raise AuthenticationError("User not found")

    return User(**user_data)


# Admin user check
async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Get current admin user."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user


# Prometheus metrics middleware
async def track_metrics(request, call_next):
    """Track request metrics."""
    start_time = datetime.utcnow()
    response = await call_next(request)

    # Record metrics
    REQUEST_COUNT.labels(
        endpoint=request.url.path, method=request.method, status=response.status_code
    ).inc()

    REQUEST_LATENCY.labels(endpoint=request.url.path).observe(
        (datetime.utcnow() - start_time).total_seconds()
    )

    return response
