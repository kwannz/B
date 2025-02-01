"""
预定义调度任务测试
"""

import asyncio
import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import pytest

from tradingbot.shared.models.database import (
    AIAnalysis,
    ErrorLog,
    MarketData,
    PerformanceMetric,
    Position,
    SystemStatus,
    Trade,
)
from tradingbot.shared.scheduled_tasks import setup_scheduled_tasks
from tradingbot.shared.task_scheduler import TaskScheduler


@pytest.fixture
def mock_db_session():
    """模拟数据库会话"""
    session = AsyncMock()
    session.query = Mock()
    session.add = Mock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
async def scheduler():
    """创建调度器实例"""
    scheduler = TaskScheduler()
    await scheduler.initialize()
    yield scheduler
    await scheduler.close()


@pytest.mark.asyncio
async def test_performance_metrics_aggregation(scheduler, mock_db_session):
    """测试性能指标聚合"""
    # 模拟交易数据
    trades = [Mock(profit=100), Mock(profit=50), Mock(profit=-30), Mock(profit=80)]
    mock_db_session.query.return_value.filter.return_value.all.return_value = trades

    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 等待任务执行
    await asyncio.sleep(1)

    # 验证指标计算
    calls = mock_db_session.add.call_args_list
    assert len(calls) > 0

    metric = calls[0][0][0]
    assert isinstance(metric, PerformanceMetric)
    assert metric.total_trades == 4
    assert metric.winning_trades == 3
    assert metric.total_profit == 200


@pytest.mark.asyncio
async def test_data_cleanup(scheduler, mock_db_session):
    """测试数据清理"""
    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 等待任务执行
    await asyncio.sleep(1)

    # 验证清理操作
    cutoff_date = datetime.utcnow() - timedelta(days=30)

    # 验证每个表的清理调用
    mock_db_session.query.assert_any_call(MarketData)
    mock_db_session.query.assert_any_call(ErrorLog)
    mock_db_session.query.assert_any_call(SystemStatus)
    mock_db_session.query.assert_any_call(AIAnalysis)

    # 验证过滤条件
    filter_calls = mock_db_session.query.return_value.filter.call_args_list
    assert len(filter_calls) > 0


@pytest.mark.asyncio
async def test_health_check(scheduler, mock_db_session):
    """测试健康检查"""
    # 模拟数据库查询
    mock_db_session.execute = AsyncMock()
    mock_db_session.query.return_value.filter.return_value.count.return_value = 5

    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 等待任务执行
    await asyncio.sleep(1)

    # 验证健康检查
    mock_db_session.execute.assert_called_with("SELECT 1")

    # 验证状态记录
    calls = mock_db_session.add.call_args_list
    assert len(calls) > 0

    status = calls[0][0][0]
    assert isinstance(status, SystemStatus)
    assert status.component == "scheduler"
    assert status.status == "running"
    assert "active_positions" in status.metadata


@pytest.mark.asyncio
async def test_error_handling(scheduler, mock_db_session):
    """测试错误处理"""
    # 模拟数据库错误
    mock_db_session.commit.side_effect = Exception("数据库错误")

    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 等待任务执行
    await asyncio.sleep(1)

    # 验证错误处理
    mock_db_session.rollback.assert_called()


@pytest.mark.asyncio
async def test_task_scheduling(scheduler, mock_db_session):
    """测试任务调度"""
    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 验证任务添加
    tasks = scheduler.get_all_tasks()
    assert "aggregate_metrics" in tasks
    assert "cleanup_data" in tasks
    assert "health_check" in tasks

    # 验证任务配置
    assert tasks["aggregate_metrics"]["interval"] == 300  # 5分钟
    assert tasks["cleanup_data"]["interval"] == 86400  # 24小时
    assert tasks["health_check"]["interval"] == 60  # 1分钟


@pytest.mark.asyncio
async def test_concurrent_execution(scheduler, mock_db_session):
    """测试并发执行"""
    # 设置任务
    await setup_scheduled_tasks(scheduler, mock_db_session)

    # 模拟多个任务同时执行
    await asyncio.gather(
        scheduler.tasks["aggregate_metrics"]["func"](),
        scheduler.tasks["health_check"]["func"](),
    )

    # 验证所有任务都执行了
    assert mock_db_session.add.call_count >= 2


if __name__ == "__main__":
    pytest.main(["-v", __file__])
