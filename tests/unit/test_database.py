"""
Unit tests for database optimizations.
"""

import pytest
import asyncio
from typing import List, Dict, Any
from sqlalchemy import text
from tradingbot.core.database import (
    DatabaseConfig,
    DatabaseManager,
    QueryOptimizer,
    BulkOperations,
    DataLoader,
    QueryBuilder,
    DatabaseMetrics
)

@pytest.fixture
async def db_config():
    """Database configuration fixture."""
    return DatabaseConfig(
        url="postgresql+asyncpg://test:test@localhost/testdb",
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        echo=False
    )

@pytest.fixture
async def db_manager(db_config):
    """Database manager fixture."""
    manager = await DatabaseManager(db_config)
    yield manager
    await manager.engine.dispose()

@pytest.mark.asyncio
async def test_database_connection(db_manager):
    """Test database connection and basic query."""
    async with db_manager.get_session() as session:
        result = await session.execute(text("SELECT 1"))
        value = result.scalar()
        assert value == 1

@pytest.mark.asyncio
async def test_query_optimizer():
    """Test query optimization utilities."""
    # Test SELECT optimization
    query = text("SELECT * FROM test_table")
    optimized = QueryOptimizer.optimize_select(query)
    
    # Verify optimization options
    assert optimized.execution_options.get('stream_results') is True
    assert optimized.execution_options.get('max_row_buffer') == 100
    
    # Test query hints
    query_with_hints = QueryOptimizer.add_query_hints(query)
    assert "INDEX_MERGE" in str(query_with_hints)
    assert "ORDERED" in str(query_with_hints)
    
    # Test pagination
    paginated = QueryOptimizer.paginate_query(query, page=2, page_size=10)
    assert "LIMIT 10 OFFSET 10" in str(paginated).upper()

@pytest.mark.asyncio
async def test_bulk_operations(db_manager):
    """Test bulk database operations."""
    bulk_ops = BulkOperations(db_manager)
    
    # Generate test data
    test_data = [
        {"id": i, "value": f"test_{i}"}
        for i in range(100)
    ]
    
    # Test bulk insert
    inserted = await bulk_ops.bulk_insert("test_table", test_data)
    assert inserted == 100
    
    # Verify inserted data
    async with db_manager.get_session() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM test_table")
        )
        count = result.scalar()
        assert count == 100

@pytest.mark.asyncio
async def test_data_loader(db_manager):
    """Test data loader functionality."""
    loader = DataLoader(db_manager)
    
    # Create test data
    async with db_manager.get_session() as session:
        await session.execute(
            text("""
                CREATE TEMPORARY TABLE test_data (
                    id SERIAL PRIMARY KEY,
                    value TEXT
                )
            """)
        )
        # Insert test rows
        for i in range(1000):
            await session.execute(
                text("INSERT INTO test_data (value) VALUES (:value)"),
                {"value": f"value_{i}"}
            )
        await session.commit()
    
    # Test chunk loading
    total_rows = 0
    async for chunk in loader.load_by_chunks(
        text("SELECT * FROM test_data"),
        chunk_size=100
    ):
        total_rows += len(chunk)
        assert len(chunk) <= 100  # Verify chunk size
    
    assert total_rows == 1000

@pytest.mark.asyncio
async def test_query_builder():
    """Test query builder functionality."""
    # Test filter query building
    filters = {
        "status": "active",
        "type": ["type1", "type2"],
        "value": 100
    }
    
    order_by = [
        ("created_at", "DESC"),
        ("id", "ASC")
    ]
    
    query = QueryBuilder.build_filter_query(
        "test_table",
        filters,
        order_by
    )
    
    query_str = str(query)
    
    # Verify WHERE clauses
    assert "status = :status" in query_str
    assert "type IN :type" in query_str
    assert "value = :value" in query_str
    
    # Verify ORDER BY
    assert "ORDER BY created_at DESC, id ASC" in query_str.upper()

@pytest.mark.asyncio
async def test_database_metrics():
    """Test database metrics collection."""
    metrics = DatabaseMetrics()
    
    # Record some metrics
    await metrics.record_query_time(0.1)
    await metrics.record_query_time(0.2)
    await metrics.record_query_time(0.3)
    await metrics.record_error()
    await metrics.record_error()
    
    # Test average query time
    avg_time = metrics.get_average_query_time()
    assert avg_time == 0.2  # (0.1 + 0.2 + 0.3) / 3
    
    # Test error rate
    error_rate = metrics.get_error_rate()
    assert error_rate == 0.4  # 2 errors out of 5 total operations

@pytest.mark.asyncio
async def test_concurrent_database_access(db_manager):
    """Test concurrent database access."""
    async def insert_record(i: int):
        async with db_manager.get_session() as session:
            await session.execute(
                text("INSERT INTO test_table (value) VALUES (:value)"),
                {"value": f"value_{i}"}
            )
            await session.commit()
    
    # Run concurrent inserts
    tasks = [insert_record(i) for i in range(10)]
    await asyncio.gather(*tasks)
    
    # Verify all records were inserted
    async with db_manager.get_session() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM test_table")
        )
        count = result.scalar()
        assert count == 10

@pytest.mark.asyncio
async def test_database_retry_mechanism(db_manager):
    """Test database retry mechanism."""
    fail_count = 0
    
    async def failing_query():
        nonlocal fail_count
        if fail_count < 2:
            fail_count += 1
            raise Exception("Temporary failure")
        return "success"
    
    # Should succeed after retries
    result = await db_manager.execute_query(failing_query)
    assert result == "success"
    assert fail_count == 2

@pytest.mark.asyncio
async def test_query_timeout(db_manager):
    """Test query timeout handling."""
    async def slow_query():
        await asyncio.sleep(2)  # Simulate slow query
        return "result"
    
    # Should timeout
    with pytest.raises(asyncio.TimeoutError):
        await db_manager.execute_query(
            slow_query,
            timeout=1
        )

@pytest.mark.asyncio
async def test_connection_pool_limits(db_manager):
    """Test connection pool limits."""
    async def get_connection():
        async with db_manager.get_session() as session:
            await session.execute(text("SELECT pg_sleep(0.5)"))
    
    # Try to exceed pool size
    tasks = [get_connection() for _ in range(10)]
    
    # Should not raise connection pool errors
    await asyncio.gather(*tasks, return_exceptions=True)
