"""
Unit tests for caching system.
"""

import asyncio
import pytest
from typing import Dict, Any
from tradingbot.core.cache import (
    CacheKey,
    MemoryCache,
    RedisCache,
    MultiLevelCache,
    CacheManager,
    cached_response
)

@pytest.mark.asyncio
async def test_cache_key_generation():
    """Test cache key generation."""
    cache_key = CacheKey("test")
    
    # Test with different argument types
    key1 = cache_key.make_key("arg1", 123, keyword="value")
    key2 = cache_key.make_key("arg1", 123, keyword="value")
    key3 = cache_key.make_key("arg2", 456, keyword="other")
    
    # Same arguments should generate same key
    assert key1 == key2
    # Different arguments should generate different keys
    assert key1 != key3

@pytest.mark.asyncio
async def test_memory_cache():
    """Test in-memory cache operations."""
    cache = MemoryCache[str](maxsize=100, ttl=1)
    
    # Test set and get
    await cache.set("key1", "value1")
    value = await cache.get("key1")
    assert value == "value1"
    
    # Test TTL expiration
    await asyncio.sleep(1.1)
    value = await cache.get("key1")
    assert value is None
    
    # Test delete
    await cache.set("key2", "value2")
    await cache.delete("key2")
    value = await cache.get("key2")
    assert value is None
    
    # Test clear
    await cache.set("key3", "value3")
    await cache.clear()
    value = await cache.get("key3")
    assert value is None

@pytest.mark.asyncio
async def test_redis_cache(mocker):
    """Test Redis cache operations."""
    # Mock Redis client
    mock_redis = mocker.MagicMock()
    mock_redis.get.return_value = b'{"key": "value"}'
    mock_redis.set = mocker.AsyncMock()
    mock_redis.delete = mocker.AsyncMock()
    mock_redis.scan_iter = mocker.AsyncMock(return_value=[b'cache:key1'])
    
    cache = RedisCache(mock_redis)
    
    # Test set
    await cache.set("key1", {"key": "value"})
    mock_redis.set.assert_called_once()
    
    # Test get
    value = await cache.get("key1")
    assert value == {"key": "value"}
    
    # Test delete
    await cache.delete("key1")
    mock_redis.delete.assert_called_once_with("key1")
    
    # Test clear
    await cache.clear()
    mock_redis.delete.assert_called_with(b'cache:key1')

@pytest.mark.asyncio
async def test_multi_level_cache(mocker):
    """Test multi-level cache operations."""
    # Mock Redis client
    mock_redis = mocker.MagicMock()
    mock_redis.get.return_value = None
    mock_redis.set = mocker.AsyncMock()
    
    cache = MultiLevelCache(
        mock_redis,
        maxsize=100,
        memory_ttl=1,
        redis_ttl=5
    )
    
    # Test set propagates to both caches
    await cache.set("key1", "value1")
    value = await cache.get("key1")
    assert value == "value1"
    
    # Test memory cache hit
    mock_redis.get.assert_called_once()  # Only called once during first get
    value = await cache.get("key1")  # Should hit memory cache
    assert mock_redis.get.call_count == 1  # Redis not called again
    
    # Test memory cache miss, Redis hit
    await cache.memory_cache.clear()
    mock_redis.get.return_value = b'"value1"'
    value = await cache.get("key1")
    assert value == "value1"
    assert mock_redis.get.call_count == 2

@pytest.mark.asyncio
async def test_cache_manager():
    """Test cache manager functionality."""
    manager = CacheManager("redis://localhost:6379/0")
    
    # Get cache instances
    cache1 = manager.get_cache("namespace1")
    cache2 = manager.get_cache("namespace1")
    cache3 = manager.get_cache("namespace2")
    
    # Same namespace should return same instance
    assert cache1 is cache2
    # Different namespace should return different instance
    assert cache1 is not cache3

@pytest.mark.asyncio
async def test_cached_response_decorator():
    """Test cached_response decorator."""
    call_count = 0
    
    @cached_response(namespace="test", ttl=1)
    async def test_function(arg1: str, arg2: int) -> Dict[str, Any]:
        nonlocal call_count
        call_count += 1
        return {"arg1": arg1, "arg2": arg2}
    
    # First call should execute function
    result1 = await test_function("test", 123)
    assert call_count == 1
    assert result1 == {"arg1": "test", "arg2": 123}
    
    # Second call with same args should hit cache
    result2 = await test_function("test", 123)
    assert call_count == 1  # Function not called again
    assert result2 == result1
    
    # Different args should execute function
    result3 = await test_function("other", 456)
    assert call_count == 2
    assert result3 != result1
    
    # Wait for TTL expiration
    await asyncio.sleep(1.1)
    result4 = await test_function("test", 123)
    assert call_count == 3  # Function called again after TTL

@pytest.mark.asyncio
async def test_cache_error_handling():
    """Test cache error handling."""
    cache = MemoryCache[str]()
    
    # Test setting invalid value
    with pytest.raises(TypeError):
        await cache.set("key", object())  # object() is not JSON serializable
    
    # Test getting non-existent key
    value = await cache.get("nonexistent")
    assert value is None
    
    # Test deleting non-existent key
    await cache.delete("nonexistent")  # Should not raise error

@pytest.mark.asyncio
async def test_cache_concurrent_access():
    """Test concurrent cache access."""
    cache = MemoryCache[int]()
    
    async def increment(key: str, delay: float):
        value = await cache.get(key) or 0
        await asyncio.sleep(delay)  # Simulate work
        await cache.set(key, value + 1)
        return value + 1
    
    # Run concurrent increments
    tasks = [
        increment("counter", 0.1),
        increment("counter", 0.2),
        increment("counter", 0.3)
    ]
    
    results = await asyncio.gather(*tasks)
    final_value = await cache.get("counter")
    
    # Last write wins
    assert final_value == 1
    assert sorted(results) == [1, 1, 1]
