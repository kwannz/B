"""
Test rate limiter implementation
"""

import asyncio
from datetime import datetime

import pytest

from tradingbot.shared.rate_limiter import RateLimiter, SourceRateLimiter


@pytest.fixture
def rate_limiter():
    """Create rate limiter instance"""
    limiter = RateLimiter()
    limiter.add_bucket("test", capacity=10, rate=1)  # 10 tokens, 1 token/second
    return limiter


@pytest.fixture
def source_limiter():
    """Create source rate limiter instance"""
    return SourceRateLimiter()


@pytest.mark.asyncio
async def test_token_bucket(rate_limiter):
    """Test token bucket behavior"""
    # Should allow initial burst
    for _ in range(5):
        assert await rate_limiter.acquire("test")

    # Should be rate limited
    assert not await rate_limiter.acquire("test", tokens=6)

    # Wait for token replenishment
    await asyncio.sleep(2)
    assert await rate_limiter.acquire("test", tokens=2)


@pytest.mark.asyncio
async def test_wait_for_token(rate_limiter):
    """Test waiting for tokens"""
    # Consume all tokens
    for _ in range(10):
        assert await rate_limiter.acquire("test")

    # Start timer
    start = datetime.now()

    # Wait for 2 tokens
    await rate_limiter.wait_for_token("test", tokens=2)

    # Should take ~2 seconds
    elapsed = (datetime.now() - start).total_seconds()
    assert 1.8 <= elapsed <= 2.2


@pytest.mark.asyncio
async def test_source_rate_limits(source_limiter):
    """Test source-specific rate limits"""
    # Test news sources
    assert await source_limiter.acquire_for_source("coindesk")
    assert await source_limiter.acquire_for_source("cointelegraph")
    assert await source_limiter.acquire_for_source("decrypt")

    # Test social media
    assert await source_limiter.acquire_for_source("twitter")
    assert await source_limiter.acquire_for_source("reddit")
    assert await source_limiter.acquire_for_source("telegram")


if __name__ == "__main__":
    pytest.main(["-v", __file__])
