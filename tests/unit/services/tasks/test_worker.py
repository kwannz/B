"""
Tests for Celery worker tasks and helper functions
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import numpy as np
from tradingbot.src.trading_agent.api.worker import (
    update_positions,
    update_metrics,
    check_strategy_health,
    get_strategy_instance,
    calculate_max_drawdown,
    calculate_sharpe_ratio,
    celery,
)


@pytest.fixture(autouse=True)
def mock_db_session(monkeypatch):
    """Mock database session with auto-use"""
    session = MagicMock()
    db_gen = MagicMock()
    db_gen.__iter__.return_value = iter([session])
    monkeypatch.setattr(
        "tradingbot.src.trading_agent.api.worker.get_db", lambda: db_gen
    )
    return session


@pytest.fixture
def mock_strategy():
    """Mock strategy instance"""
    strategy = MagicMock()
    strategy._update_position = MagicMock()
    strategy._check_exit_conditions = MagicMock()
    return strategy


@pytest.fixture
def sample_trades():
    """Create sample trades for testing"""
    trades = []
    base_time = datetime.utcnow()

    for i in range(10):
        trade = Mock(
            price=100 + i,
            executed_price=105 + i,
            executed_quantity=1.0,
            executed_at=base_time + timedelta(hours=i),
            status="executed",
        )
        trades.append(trade)

    return trades


def test_update_positions(mock_db_session, mock_strategy):
    """Test update_positions task"""
    position = Mock(id=1, strategy_id=1, status="open")
    mock_db_session.query.return_value.filter.return_value.all.return_value = [position]

    with patch(
        "tradingbot.src.trading_agent.api.worker.get_strategy_instance"
    ) as mock_get_strategy:
        mock_get_strategy.return_value = mock_strategy
        update_positions()

        mock_db_session.query.assert_called_once()
        mock_get_strategy.assert_called_once_with(1, mock_db_session)
        mock_strategy._update_position.assert_called_once()
        mock_strategy._check_exit_conditions.assert_called_once()


def test_update_metrics(mock_db_session, sample_trades):
    """Test update_metrics task"""
    strategy = Mock(id=1, is_active=True)
    mock_db_session.query.return_value.filter.return_value.all.return_value = [strategy]

    trade_query = mock_db_session.query.return_value
    trade_query.filter.return_value.filter.return_value.all.return_value = sample_trades

    update_metrics()

    mock_db_session.query.assert_called()
    mock_db_session.commit.assert_called()


def test_check_strategy_health(mock_db_session):
    """Test check_strategy_health task"""
    strategy = Mock(id=1, is_active=True)
    mock_db_session.query.return_value.filter.return_value.all.return_value = [strategy]

    recent_trades = [
        Mock(status="executed", created_at=datetime.utcnow()),
        Mock(status="failed", created_at=datetime.utcnow()),
        Mock(status="executed", created_at=datetime.utcnow()),
    ]
    trade_query = mock_db_session.query.return_value
    trade_query.filter.return_value.order_by.return_value.first.return_value = (
        recent_trades[0]
    )
    trade_query.filter.return_value.filter.return_value.all.return_value = recent_trades

    check_strategy_health()

    mock_db_session.query.assert_called()


def test_get_strategy_instance(mock_db_session):
    """Test get_strategy_instance function"""
    # Test solana_meme strategy
    strategy = Mock(type="solana_meme")
    mock_db_session.query.return_value.get.return_value = strategy
    instance = get_strategy_instance(1, mock_db_session)
    assert instance is not None

    # Test unknown strategy type
    strategy.type = "unknown"
    instance = get_strategy_instance(1, mock_db_session)
    assert instance is None

    # Test non-existent strategy
    mock_db_session.query.return_value.get.return_value = None
    instance = get_strategy_instance(1, mock_db_session)
    assert instance is None


def test_calculate_max_drawdown(sample_trades):
    """Test calculate_max_drawdown function"""
    # Test with sample trades
    max_dd = calculate_max_drawdown(sample_trades)
    assert isinstance(max_dd, float)
    assert 0 <= max_dd <= 1

    # Test empty trades list
    max_dd = calculate_max_drawdown([])
    assert max_dd == 0.0

    # Test single trade
    max_dd = calculate_max_drawdown([sample_trades[0]])
    assert max_dd == 0.0


def test_calculate_sharpe_ratio(sample_trades):
    """Test calculate_sharpe_ratio function"""
    # Test with sample trades
    sharpe = calculate_sharpe_ratio(sample_trades)
    assert isinstance(sharpe, float)

    # Test empty trades list
    sharpe = calculate_sharpe_ratio([])
    assert sharpe == 0.0

    # Test trades with same price
    same_price_trades = [
        Mock(price=100, executed_price=100, executed_quantity=1.0) for _ in range(5)
    ]
    sharpe = calculate_sharpe_ratio(same_price_trades)
    assert sharpe == 0.0


def test_update_positions_error_handling(mock_db_session):
    """Test error handling in update_positions task"""
    position = Mock(id=1, strategy_id=1, status="open")
    mock_db_session.query.return_value.filter.return_value.all.return_value = [position]

    mock_strategy = Mock()
    mock_strategy._update_position.side_effect = Exception("Test error")

    with patch(
        "tradingbot.src.trading_agent.api.worker.get_strategy_instance"
    ) as mock_get_strategy:
        mock_get_strategy.return_value = mock_strategy
        update_positions()
        mock_db_session.close.assert_called_once()


def test_update_metrics_error_handling(mock_db_session):
    """Test error handling in update_metrics task"""
    strategy = Mock(id=1, is_active=True)
    mock_db_session.query.return_value.filter.return_value.all.return_value = [strategy]

    mock_db_session.query.side_effect = Exception("Test error")
    update_metrics()
    mock_db_session.close.assert_called_once()


def test_celery_beat_schedule():
    """Test Celery beat schedule configuration"""
    assert "update-positions-every-minute" in celery.conf.beat_schedule
    assert "update-metrics-every-hour" in celery.conf.beat_schedule
    assert "check-strategy-health-every-5-minutes" in celery.conf.beat_schedule

    positions_schedule = celery.conf.beat_schedule["update-positions-every-minute"][
        "schedule"
    ]
    assert positions_schedule.minute == "*"

    metrics_schedule = celery.conf.beat_schedule["update-metrics-every-hour"][
        "schedule"
    ]
    assert metrics_schedule.hour == "*"

    health_schedule = celery.conf.beat_schedule[
        "check-strategy-health-every-5-minutes"
    ]["schedule"]
    assert health_schedule.minute == "*/5"
