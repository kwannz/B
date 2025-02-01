"""
Unit tests for concurrency utilities.
"""

import asyncio
import pytest
from tradingbot.core.concurrency import (
    TaskQueue,
    BatchProcessor,
    CircuitBreaker,
    RateLimiter,
)


@pytest.mark.asyncio
async def test_task_queue():
    """Test TaskQueue functionality."""
    queue = TaskQueue(max_size=10)
    await queue.start()

    # Test task execution
    async def test_task():
        await asyncio.sleep(0.1)

    # Add tasks
    for _ in range(5):
        await queue.add_task(test_task)

    # Wait for tasks to complete
    await asyncio.sleep(0.3)  # Give time for tasks to process
    await queue.stop()

    assert queue.tasks_completed == 5


@pytest.mark.asyncio
async def test_batch_processor():
    """Test BatchProcessor functionality."""

    class TestBatchProcessor(BatchProcessor):
        async def _process_batch(self, items):
            await asyncio.sleep(0.1)  # Simulate processing

    processor = TestBatchProcessor(batch_size=2)

    # Add items
    for i in range(5):
        await processor.add(i)

    await processor.flush()
    assert processor.processed_items == 5


@pytest.mark.asyncio
async def test_circuit_breaker():
    """Test CircuitBreaker functionality."""
    breaker = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)
    success_count = 0
    failure_count = 0

    async def test_func():
        nonlocal success_count, failure_count
        if failure_count < 2:
            failure_count += 1
            raise Exception("Test failure")
        success_count += 1
        return "success"

    # First two calls should fail
    with pytest.raises(Exception):
        await breaker.call(test_func)
    with pytest.raises(Exception):
        await breaker.call(test_func)

    # Circuit should be open
    assert breaker.state == "open"

    # Wait for reset timeout
    await asyncio.sleep(0.2)

    # Next call should succeed
    result = await breaker.call(test_func)
    assert result == "success"
    assert success_count == 1


@pytest.mark.asyncio
async def test_rate_limiter():
    """Test RateLimiter functionality."""
    limiter = RateLimiter(rate_limit=5, time_window=1.0)
    start_time = asyncio.get_event_loop().time()

    # Should allow 5 immediate acquisitions
    for _ in range(5):
        await limiter.acquire()

    # 6th acquisition should be delayed
    await limiter.acquire()
    duration = asyncio.get_event_loop().time() - start_time

    assert duration >= 0.2  # Should have waited at least 0.2 seconds


@pytest.mark.asyncio
async def test_concurrent_task_execution():
    """Test concurrent task execution."""
    queue = TaskQueue(max_size=100)
    await queue.start()

    results = []

    async def slow_task():
        await asyncio.sleep(0.1)
        results.append(1)

    # Add 10 tasks
    for _ in range(10):
        await queue.add_task(slow_task)

    # Wait for tasks to complete
    await asyncio.sleep(1.2)  # Give enough time for all tasks
    await queue.stop()

    assert len(results) == 10
    assert queue.tasks_completed == 10


@pytest.mark.asyncio
async def test_batch_processor_flush_interval():
    """Test BatchProcessor flush interval."""

    class TestBatchProcessor(BatchProcessor):
        async def _process_batch(self, items):
            await asyncio.sleep(0.1)  # Simulate processing

    processor = TestBatchProcessor(batch_size=10, flush_interval=0.5)

    # Add 5 items (less than batch_size)
    for i in range(5):
        await processor.add(i)

    # Wait for flush interval
    await asyncio.sleep(0.6)

    assert processor.processed_items == 5


@pytest.mark.asyncio
async def test_circuit_breaker_half_open():
    """Test CircuitBreaker half-open state."""
    breaker = CircuitBreaker(
        failure_threshold=2, reset_timeout=0.5, half_open_timeout=0.2
    )

    async def fail_then_succeed():
        if breaker.failures < 2:
            raise Exception("Test failure")
        return "success"

    # Cause circuit to open
    with pytest.raises(Exception):
        await breaker.call(fail_then_succeed)
    with pytest.raises(Exception):
        await breaker.call(fail_then_succeed)

    assert breaker.state == "open"

    # Wait for reset timeout
    await asyncio.sleep(0.5)

    # Should transition to half-open
    result = await breaker.call(fail_then_succeed)
    assert result == "success"
    assert breaker.state == "closed"


@pytest.mark.asyncio
async def test_rate_limiter_burst():
    """Test RateLimiter burst handling."""
    limiter = RateLimiter(rate_limit=10, time_window=1.0)
    start_time = asyncio.get_event_loop().time()

    # Burst of requests
    tasks = []
    for _ in range(20):
        tasks.append(asyncio.create_task(limiter.acquire()))

    await asyncio.gather(*tasks)
    duration = asyncio.get_event_loop().time() - start_time

    # Should have taken at least 1 second to process all requests
    assert duration >= 1.0
