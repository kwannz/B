"""
Tests for strategy log handler
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from ....strategy.context.strategy_context import StrategyContext
from ....strategy.handlers.log_handler import StrategyLogHandler


@pytest.fixture
def mock_db():
    """Mock database."""
    return AsyncMock()


@pytest.fixture
def mock_redis():
    """Mock Redis."""
    return AsyncMock()


@pytest.fixture
def mock_context(mock_db, mock_redis):
    """Create mock strategy context."""
    context = AsyncMock(spec=StrategyContext)
    context.user_id = "test_user"
    context.strategy_id = "test_strategy"
    context.start_time = datetime.utcnow()
    return context


@pytest.fixture
def mock_logger():
    """Create mock logger."""
    return Mock()


@pytest.fixture
def log_handler(mock_context, mock_db, mock_redis, mock_logger):
    """Create log handler fixture."""
    return StrategyLogHandler(
        context=mock_context, db=mock_db, redis=mock_redis, logger=mock_logger
    )


@pytest.mark.asyncio
async def test_log_strategy_start(log_handler, mock_db, mock_redis):
    """Test logging strategy start."""
    # Test config
    config = {
        "max_positions": 5,
        "position_size": 1000,
        "stop_loss": 0.02,
        "take_profit": 0.05,
    }

    # Log start
    await log_handler.log_strategy_start(config)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "STRATEGY_START"
    assert call_args["details"]["config"] == config


@pytest.mark.asyncio
async def test_log_signal_generation(log_handler, mock_db, mock_redis):
    """Test logging signal generation."""
    # Test signals
    signals = [
        {
            "symbol": "BTC/USDT",
            "type": "TREND",
            "strength": 0.8,
            "direction": 1,
            "metadata": {"trend": "BULLISH"},
        }
    ]

    # Log signals
    await log_handler.log_signal_generation(signals)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "SIGNAL_GENERATED"
    assert call_args["details"]["symbol"] == "BTC/USDT"
    assert call_args["details"]["strength"] == 0.8


@pytest.mark.asyncio
async def test_log_order_creation(log_handler, mock_db, mock_redis):
    """Test logging order creation."""
    # Test order
    order = {
        "order_id": "test_order",
        "symbol": "BTC/USDT",
        "side": "BUY",
        "type": "LIMIT",
        "quantity": 0.1,
        "price": 50000,
    }

    # Log order
    await log_handler.log_order_creation(order)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "ORDER_CREATED"
    assert call_args["details"]["order_id"] == "test_order"
    assert call_args["details"]["symbol"] == "BTC/USDT"


@pytest.mark.asyncio
async def test_log_order_update(log_handler, mock_db, mock_redis):
    """Test logging order update."""
    # Test data
    order = {"order_id": "test_order", "symbol": "BTC/USDT", "status": "NEW"}
    update = {"status": "FILLED", "filled_quantity": 0.1, "remaining_quantity": 0}

    # Log update
    await log_handler.log_order_update(order, update)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "ORDER_UPDATED"
    assert call_args["details"]["old_status"] == "NEW"
    assert call_args["details"]["new_status"] == "FILLED"


@pytest.mark.asyncio
async def test_log_position_update(log_handler, mock_db, mock_redis):
    """Test logging position update."""
    # Test data
    position = {"symbol": "BTC/USDT", "amount": 0.1, "current_price": 50000}
    update = {"amount": 0.2, "current_price": 51000, "unrealized_pnl": 100}

    # Log update
    await log_handler.log_position_update(position, update)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "POSITION_UPDATED"
    assert call_args["details"]["old_amount"] == 0.1
    assert call_args["details"]["new_amount"] == 0.2


@pytest.mark.asyncio
async def test_log_risk_check(log_handler, mock_db, mock_redis):
    """Test logging risk check."""
    # Test data
    check_type = "POSITION_LIMIT"
    result = False
    details = {"current_positions": 5, "max_positions": 5, "symbol": "BTC/USDT"}

    # Log check
    await log_handler.log_risk_check(check_type, result, details)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "RISK_CHECK"
    assert call_args["details"]["check_type"] == "POSITION_LIMIT"
    assert call_args["details"]["passed"] is False


@pytest.mark.asyncio
async def test_log_error(log_handler, mock_db, mock_redis, mock_logger):
    """Test logging error."""
    # Test data
    error_type = "VALIDATION_ERROR"
    error_message = "Invalid signal format"
    details = {"field": "strength"}

    # Log error
    await log_handler.log_error(error_type, error_message, details)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "ERROR"
    assert call_args["details"]["error_type"] == "VALIDATION_ERROR"

    # Verify logger call
    mock_logger.error.assert_called_once()


@pytest.mark.asyncio
async def test_log_performance_metrics(log_handler, mock_db, mock_redis):
    """Test logging performance metrics."""
    # Test metrics
    metrics = {"pnl": 1000, "win_rate": 0.6, "sharpe_ratio": 1.5}

    # Log metrics
    await log_handler.log_performance_metrics(metrics)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "PERFORMANCE_METRICS"
    assert call_args["details"] == metrics


@pytest.mark.asyncio
async def test_log_strategy_end(log_handler, mock_db, mock_redis):
    """Test logging strategy end."""
    # Test summary
    summary = {"total_trades": 10, "total_pnl": 1000, "win_rate": 0.6}

    # Log end
    await log_handler.log_strategy_end(summary)

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "STRATEGY_END"
    assert call_args["details"]["summary"] == summary
    assert "duration" in call_args["details"]


@pytest.mark.asyncio
async def test_get_recent_logs(log_handler, mock_redis):
    """Test getting recent logs."""
    # Mock Redis response
    mock_logs = [
        str({"event_type": "SIGNAL_GENERATED", "details": {"symbol": "BTC/USDT"}}),
        str({"event_type": "ORDER_CREATED", "details": {"order_id": "test_order"}}),
    ]
    mock_redis.lrange.return_value = mock_logs

    # Get logs
    logs = await log_handler.get_recent_logs(limit=2)

    # Verify results
    assert len(logs) == 2
    assert logs[0]["event_type"] == "SIGNAL_GENERATED"
    assert logs[1]["event_type"] == "ORDER_CREATED"


@pytest.mark.asyncio
async def test_get_logs_by_type(log_handler, mock_db):
    """Test getting logs by type."""
    # Mock database response
    mock_logs = [
        {
            "event_type": "ERROR",
            "timestamp": datetime.utcnow(),
            "details": {"error_type": "VALIDATION_ERROR"},
        }
    ]
    mock_db.strategy_logs.find.return_value.to_list.return_value = mock_logs

    # Get logs
    logs = await log_handler.get_logs_by_type(
        event_type="ERROR", start_time=datetime.utcnow(), limit=10
    )

    # Verify results
    assert len(logs) == 1
    assert logs[0]["event_type"] == "ERROR"
    assert "error_type" in logs[0]["details"]
