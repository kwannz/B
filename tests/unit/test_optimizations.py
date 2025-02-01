"""
Performance tests for system optimizations.
Tests concurrent processing, caching, database, and network optimizations.
"""

import asyncio
import json
import random
import time
from typing import Any, Dict, List

import pytest

from tradingbot.core.cache import CacheManager, MultiLevelCache, init_cache
from tradingbot.core.concurrency import (
    BatchProcessor,
    CircuitBreaker,
    RateLimiter,
    TaskQueue,
)
from tradingbot.core.database import (
    BulkOperations,
    DatabaseConfig,
    DatabaseManager,
    DataLoader,
    QueryOptimizer,
    init_database,
)
from tradingbot.core.network import (
    HttpClient,
    NetworkConfig,
    WebSocketManager,
    init_network,
)


# Test data generation
def generate_test_data(size: int = 1000) -> List[Dict[str, Any]]:
    """Generate test data for performance testing."""
    return [
        {
            "id": i,
            "value": random.random(),
            "timestamp": time.time(),
            "data": "x" * random.randint(100, 1000),
        }
        for i in range(size)
    ]


# Concurrency Tests
@pytest.mark.asyncio
async def test_task_queue_performance():
    """Test TaskQueue performance under load."""
    queue = TaskQueue(max_size=10000)
    await queue.start()

    start_time = time.time()
    tasks_completed = 0

    async def dummy_task():
        nonlocal tasks_completed
        await asyncio.sleep(0.01)  # Simulate work
        tasks_completed += 1

    # Add 1000 tasks
    for _ in range(1000):
        await queue.add_task(dummy_task)

    await queue.stop()
    duration = time.time() - start_time

    assert tasks_completed == 1000
    assert duration < 5.0  # Should complete within 5 seconds


@pytest.mark.asyncio
async def test_batch_processor_performance():
    """Test BatchProcessor performance with large datasets."""

    class TestBatchProcessor(BatchProcessor):
        def __init__(self):
            super().__init__(batch_size=100)
            self.processed_items = 0

        async def _process_batch(self, items: List[Any]):
            await asyncio.sleep(0.1)  # Simulate processing
            self.processed_items += len(items)

    processor = TestBatchProcessor()
    test_data = generate_test_data(1000)

    start_time = time.time()
    for item in test_data:
        await processor.add(item)
    await processor.flush()

    duration = time.time() - start_time

    assert processor.processed_items == 1000
    assert duration < 3.0  # Should complete within 3 seconds


# Cache Tests
@pytest.mark.asyncio
async def test_cache_performance():
    """Test cache performance and hit rates."""
    cache_manager = await init_cache("redis://localhost:6379/0")
    cache = cache_manager.get_cache("test")

    # Test write performance
    start_time = time.time()
    test_data = generate_test_data(1000)
    for i, data in enumerate(test_data):
        await cache.set(f"key_{i}", data)
    write_duration = time.time() - start_time

    # Test read performance (cached)
    start_time = time.time()
    hit_count = 0
    for i in range(1000):
        value = await cache.get(f"key_{i}")
        if value is not None:
            hit_count += 1
    read_duration = time.time() - start_time

    assert write_duration < 2.0  # Write 1000 items within 2 seconds
    assert read_duration < 1.0  # Read 1000 items within 1 second
    assert hit_count > 950  # At least 95% cache hits


# Database Tests
@pytest.mark.asyncio
async def test_database_query_performance():
    """Test database query optimization performance."""
    config = DatabaseConfig("postgresql+asyncpg://user:pass@localhost/testdb")
    db = await init_database(config)

    # Test bulk insert performance
    bulk_ops = BulkOperations(db)
    test_data = generate_test_data(1000)

    start_time = time.time()
    await bulk_ops.bulk_insert("test_table", test_data)
    insert_duration = time.time() - start_time

    # Test optimized query performance
    query = QueryOptimizer.optimize_select("SELECT * FROM test_table WHERE value > 0.5")

    start_time = time.time()
    result = await db.execute_query(query)
    query_duration = time.time() - start_time

    assert insert_duration < 3.0  # Bulk insert within 3 seconds
    assert query_duration < 1.0  # Query execution within 1 second


@pytest.mark.asyncio
async def test_data_loader_performance():
    """Test DataLoader chunk processing performance."""
    config = DatabaseConfig("postgresql+asyncpg://user:pass@localhost/testdb")
    db = await init_database(config)
    loader = DataLoader(db)

    query = "SELECT * FROM large_table"
    chunk_count = 0
    total_records = 0

    start_time = time.time()
    async for chunk in loader.load_by_chunks(query, chunk_size=1000):
        chunk_count += 1
        total_records += len(chunk)
    duration = time.time() - start_time

    assert duration < 5.0  # Process large dataset within 5 seconds
    assert chunk_count > 0
    assert total_records > 0


# Network Tests
@pytest.mark.asyncio
async def test_http_client_performance():
    """Test HTTP client performance with optimizations."""
    config = NetworkConfig(
        base_url="http://api.example.com", pool_size=100, rate_limit=1000
    )
    client = await init_network(config)

    async with client:
        # Test concurrent requests
        start_time = time.time()
        tasks = []
        for _ in range(100):
            tasks.append(client.cached_get("/endpoint"))

        results = await asyncio.gather(*tasks)
        duration = time.time() - start_time

        assert duration < 2.0  # 100 concurrent requests within 2 seconds
        assert len(results) == 100


@pytest.mark.asyncio
async def test_websocket_performance():
    """Test WebSocket manager performance."""
    ws_manager = WebSocketManager("ws://localhost:8080/ws")
    message_count = 0

    async def message_handler(data: Dict[str, Any]):
        nonlocal message_count
        message_count += 1

    ws_manager.add_message_handler(message_handler)
    await ws_manager.connect()

    # Test message sending performance
    start_time = time.time()
    for i in range(1000):
        await ws_manager.send({"type": "test", "id": i})
    send_duration = time.time() - start_time

    await asyncio.sleep(1)  # Wait for messages to be processed
    await ws_manager.disconnect()

    assert send_duration < 2.0  # Send 1000 messages within 2 seconds
    assert message_count > 0  # Should receive some messages back


# System Load Tests
@pytest.mark.asyncio
async def test_system_load():
    """Test system performance under heavy load."""
    # Initialize components
    cache_manager = await init_cache("redis://localhost:6379/0")
    db_config = DatabaseConfig("postgresql+asyncpg://user:pass@localhost/testdb")
    db = await init_database(db_config)
    net_config = NetworkConfig("http://api.example.com")
    http = await init_network(net_config)

    # Create workload
    async def workload():
        # Simulate complex operation
        await cache_manager.get_cache("test").set("key", "value")
        await db.execute_query("SELECT 1")
        async with http:
            await http.cached_get("/test")

    # Run concurrent workloads
    start_time = time.time()
    tasks = [workload() for _ in range(100)]
    await asyncio.gather(*tasks)
    duration = time.time() - start_time

    assert duration < 5.0  # Complete 100 complex operations within 5 seconds


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
