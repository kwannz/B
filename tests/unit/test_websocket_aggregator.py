"""
WebSocket数据聚合器测试
"""

import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from tradingbot.shared.websocket_aggregator import WebSocketAggregator
from tradingbot.shared.models.database import (
    WebSocketMessage,
    AggregatedData,
    ExchangeMetrics,
)


@pytest.fixture
async def aggregator(db_session):
    """创建WebSocket聚合器实例"""
    agg = WebSocketAggregator(db_session)
    await agg.initialize()
    yield agg
    await agg.close()


@pytest.fixture
def sample_messages():
    """创建示例WebSocket消息"""
    now = datetime.utcnow()
    return [
        WebSocketMessage(
            exchange="binance",
            message_type="trade",
            symbol="BTC/USDT",
            message={"price": "50000", "amount": "1.0"},
            timestamp=now - timedelta(minutes=i),
            latency=0.1,
            is_error=False,
        )
        for i in range(10)
    ]


@pytest.mark.asyncio
async def test_initialization(aggregator):
    """测试初始化"""
    assert aggregator.initialized is True
    assert aggregator.aggregation_interval == 300
    assert aggregator.retention_days == 7


@pytest.mark.asyncio
async def test_aggregate_data(aggregator, db_session, sample_messages):
    """测试数据聚合"""
    # 准备测试数据
    for msg in sample_messages:
        db_session.add(msg)
    await db_session.commit()

    # 执行聚合
    await aggregator.aggregate_data()

    # 验证聚合结果
    query = await db_session.execute(select(AggregatedData))
    aggregations = query.scalars().all()
    assert len(aggregations) > 0

    agg = aggregations[0]
    assert agg.exchange == "binance"
    assert agg.message_type == "trade"
    assert agg.message_count == 10
    assert agg.unique_symbols == 1
    assert agg.error_count == 0
    assert abs(agg.average_latency - 0.1) < 0.001


@pytest.mark.asyncio
async def test_cleanup_old_data(aggregator, db_session, sample_messages):
    """测试数据清理"""
    # 准备旧数据
    old_date = datetime.utcnow() - timedelta(days=10)
    for msg in sample_messages:
        msg.timestamp = old_date
        db_session.add(msg)
    await db_session.commit()

    # 执行清理
    await aggregator.cleanup_old_data()

    # 验证清理结果
    query = await db_session.execute(select(WebSocketMessage))
    messages = query.scalars().all()
    assert len(messages) == 0


@pytest.mark.asyncio
async def test_exchange_metrics_update(aggregator, db_session, sample_messages):
    """测试交易所指标更新"""
    # 准备测试数据
    for msg in sample_messages:
        db_session.add(msg)
    await db_session.commit()

    # 执行聚合（会更新指标）
    await aggregator.aggregate_data()

    # 验证指标
    query = await db_session.execute(select(ExchangeMetrics))
    metrics = query.scalars().all()
    assert len(metrics) > 0

    metric = metrics[0]
    assert metric.exchange == "binance"
    assert metric.message_count == 10
    assert metric.error_count == 0
    assert metric.error_rate == 0
    assert abs(metric.average_latency - 0.1) < 0.001


@pytest.mark.asyncio
async def test_error_handling(aggregator, db_session):
    """测试错误处理"""
    # 模拟数据库错误
    db_session.commit = AsyncMock(side_effect=Exception("Database error"))

    # 验证错误被正确处理
    await aggregator.aggregate_data()  # 不应该抛出异常

    # 验证回滚被调用
    db_session.rollback.assert_called_once()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
