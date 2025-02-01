"""
Tests for strategy context
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, Mock

import pytest

from ....core.exceptions import ValidationError
from ....models.risk import RiskLimit, RiskMetrics
from ....models.trading import MarketType, Order, Position
from ....strategy.context.strategy_context import StrategyContext


@pytest.fixture
def mock_db():
    """Mock database."""
    return AsyncMock()


@pytest.fixture
def mock_redis():
    """Mock Redis."""
    return AsyncMock()


@pytest.fixture
def strategy_context(mock_db, mock_redis):
    """Create strategy context fixture."""
    config = {
        "max_positions": 5,
        "position_size": 1000,
        "stop_loss": 0.02,
        "take_profit": 0.05,
    }
    return StrategyContext(
        strategy_id="test_strategy",
        user_id="test_user",
        db=mock_db,
        redis=mock_redis,
        config=config,
    )


@pytest.mark.asyncio
async def test_load_positions(strategy_context, mock_db):
    """Test loading positions."""
    # Mock position data
    mock_positions = [
        {
            "user_id": "test_user",
            "strategy_id": "test_strategy",
            "symbol": "BTC/USDT",
            "amount": 0.1,
            "entry_price": 50000,
            "current_price": 51000,
            "status": "OPEN",
        }
    ]
    mock_db.positions.find.return_value.to_list.return_value = mock_positions

    # Load positions
    positions = await strategy_context.load_positions()

    # Verify results
    assert len(positions) == 1
    assert positions["BTC/USDT"].symbol == "BTC/USDT"
    assert positions["BTC/USDT"].amount == 0.1
    assert positions["BTC/USDT"].current_price == 51000


@pytest.mark.asyncio
async def test_load_orders(strategy_context, mock_db):
    """Test loading orders."""
    # Mock order data
    mock_orders = [
        {
            "user_id": "test_user",
            "strategy_id": "test_strategy",
            "order_id": "test_order",
            "symbol": "BTC/USDT",
            "side": "BUY",
            "type": "LIMIT",
            "quantity": 0.1,
            "price": 50000,
            "status": "NEW",
        }
    ]
    mock_db.orders.find.return_value.to_list.return_value = mock_orders

    # Load orders
    orders = await strategy_context.load_orders()

    # Verify results
    assert len(orders) == 1
    assert orders["test_order"].symbol == "BTC/USDT"
    assert orders["test_order"].quantity == 0.1
    assert orders["test_order"].status == "NEW"


@pytest.mark.asyncio
async def test_load_risk_metrics(strategy_context, mock_db):
    """Test loading risk metrics."""
    # Mock risk metrics data
    mock_metrics = {
        "user_id": "test_user",
        "strategy_id": "test_strategy",
        "var_95": 1000,
        "var_99": 1500,
        "volatility": 0.2,
        "sharpe_ratio": 1.5,
    }
    mock_db.risk_metrics.find_one.return_value = mock_metrics

    # Load risk metrics
    metrics = await strategy_context.load_risk_metrics()

    # Verify results
    assert metrics is not None
    assert metrics.var_95 == 1000
    assert metrics.volatility == 0.2


@pytest.mark.asyncio
async def test_update_metrics(strategy_context, mock_db):
    """Test updating metrics."""
    # Update metrics
    test_metrics = {"pnl": 1000, "win_rate": 0.6, "trade_count": 10}
    await strategy_context.update_metrics(test_metrics)

    # Verify database call
    mock_db.strategy_metrics.update_one.assert_called_once()
    call_args = mock_db.strategy_metrics.update_one.call_args[0]
    assert call_args[0]["strategy_id"] == "test_strategy"
    assert call_args[0]["user_id"] == "test_user"


@pytest.mark.asyncio
async def test_update_state(strategy_context, mock_redis):
    """Test updating state."""
    # Update state
    test_state = {
        "current_position": 0.1,
        "last_signal": "BUY",
        "signal_time": datetime.utcnow(),
    }
    await strategy_context.update_state(test_state)

    # Verify Redis call
    mock_redis.hset.assert_called_once()
    call_args = mock_redis.hset.call_args[0]
    assert "strategy_state:test_strategy" in call_args[0]


@pytest.mark.asyncio
async def test_add_signal(strategy_context, mock_db):
    """Test adding signal."""
    # Add signal
    await strategy_context.add_signal(
        symbol="BTC/USDT",
        signal_type="TREND",
        strength=0.8,
        metadata={"trend": "BULLISH"},
    )

    # Verify database call
    mock_db.strategy_signals.insert_one.assert_called_once()
    call_args = mock_db.strategy_signals.insert_one.call_args[0][0]
    assert call_args["symbol"] == "BTC/USDT"
    assert call_args["type"] == "TREND"
    assert call_args["strength"] == 0.8


@pytest.mark.asyncio
async def test_get_market_data(strategy_context, mock_redis, mock_db):
    """Test getting market data."""
    # Mock data
    mock_market_data = {
        "symbol": "BTC/USDT",
        "interval": "1m",
        "open": 50000,
        "high": 51000,
        "low": 49000,
        "close": 50500,
    }
    mock_redis.get.return_value = None
    mock_db.market_data.find_one.return_value = mock_market_data

    # Get market data
    data = await strategy_context.get_market_data(
        symbol="BTC/USDT", market_type=MarketType.SPOT, interval="1m"
    )

    # Verify results
    assert data is not None
    assert data["symbol"] == "BTC/USDT"
    assert data["interval"] == "1m"


def test_validate_config(strategy_context):
    """Test config validation."""
    # Valid config
    strategy_context.validate_config()

    # Invalid config
    invalid_context = StrategyContext(
        strategy_id="test_strategy",
        user_id="test_user",
        db=Mock(),
        redis=Mock(),
        config={},
    )
    with pytest.raises(ValidationError):
        invalid_context.validate_config()


@pytest.mark.asyncio
async def test_log_execution(strategy_context, mock_db):
    """Test logging execution."""
    # Log event
    await strategy_context.log_execution("TEST_EVENT", {"test": "data"})

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
    call_args = mock_db.strategy_logs.insert_one.call_args[0][0]
    assert call_args["event_type"] == "TEST_EVENT"
    assert call_args["details"]["test"] == "data"


@pytest.mark.asyncio
async def test_cleanup(strategy_context, mock_redis, mock_db):
    """Test context cleanup."""
    # Cleanup
    await strategy_context.cleanup()

    # Verify Redis call
    mock_redis.delete.assert_called_once_with("strategy_state:test_strategy")

    # Verify database call
    mock_db.strategy_logs.insert_one.assert_called_once()
