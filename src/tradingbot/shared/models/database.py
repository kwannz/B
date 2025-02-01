import os
from datetime import datetime
from typing import Any, Dict, Optional

import motor.motor_asyncio
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# PostgreSQL Configuration
POSTGRES_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://tradingbot:tradingbot@localhost:5432/tradingbot",
)
engine = create_async_engine(
    POSTGRES_URL,
    echo=True,
    future=True,
    pool_pre_ping=True,
    pool_timeout=30,
    pool_size=5,
    max_overflow=10,
)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, future=True
)

# MongoDB Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017")
mongodb_client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)
mongodb_db = mongodb_client.tradingbot
news_collection = mongodb_db.news_articles
market_data_collection = mongodb_db.market_data
market_metrics_collection = mongodb_db.market_metrics
trading_signals_collection = mongodb_db.trading_signals

# Redis Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
redis_client = redis.from_url(
    REDIS_URL, decode_responses=True, socket_timeout=5.0, encoding="utf-8"
)

# Initialize Redis cache prefixes
MARKET_PREFIX = "market:"
ORDERBOOK_PREFIX = "orderbook:"
TRADES_PREFIX = "trades:"
SENTIMENT_PREFIX = "sentiment:"


async def set_cache(key: str, value: str, expire: Optional[int] = None) -> None:
    """Set cache value with optional expiration."""
    await redis_client.set(key, value, ex=expire)


async def get_cache(key: str) -> Optional[str]:
    """Get cache value."""
    return await redis_client.get(key)


async def delete_cache(key: str) -> None:
    """Delete cache value."""
    await redis_client.delete(key)


async def scan_cache(pattern: str) -> list:
    """Scan cache keys by pattern."""
    return [key async for key in redis_client.scan_iter(pattern)]


async def get_db() -> AsyncSession:
    """Get PostgreSQL database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database connections."""
    # Test PostgreSQL connection
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    # Test MongoDB connection
    await mongodb_db.command("ping")

    # Test Redis connection
    await redis_client.ping()


async def close_db():
    """Close database connections."""
    await engine.dispose()
    mongodb_client.close()
    await redis_client.close()
