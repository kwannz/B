"""
Tests for strategy result handler
"""

import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import Mock, AsyncMock

from ....strategy.handlers.result_handler import StrategyResultHandler
from ....strategy.context.strategy_context import StrategyContext
from ....models.trading import Order, Trade, Position
from ....models.risk import RiskMetrics
from ....core.exceptions import ValidationError


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
    context.config = {"position_size": 1000, "max_positions": 5}
    return context


@pytest.fixture
def result_handler(mock_context, mock_db, mock_redis):
    """Create result handler fixture."""
    return StrategyResultHandler(context=mock_context, db=mock_db, redis=mock_redis)


@pytest.mark.asyncio
async def test_process_signals(result_handler, mock_context):
    """Test processing signals."""
    # Mock data
    mock_positions = {}
    mock_risk_metrics = RiskMetrics(
        var_95=1000, var_99=1500, volatility=0.2, sharpe_ratio=1.5
    )
    mock_risk_limits = {
        "max_positions": 5,
        "max_position_value": 10000,
        "max_var": 2000,
    }

    mock_context.load_positions.return_value = mock_positions
    mock_context.load_risk_metrics.return_value = mock_risk_metrics
    mock_context.load_risk_limits.return_value = mock_risk_limits

    # Test signals
    signals = [
        {
            "symbol": "BTC/USDT",
            "type": "TREND",
            "strength": 0.8,
            "direction": 1,
            "price": 50000,
        }
    ]

    # Process signals
    orders = await result_handler.process_signals(signals)

    # Verify results
    assert len(orders) == 1
    assert orders[0].symbol == "BTC/USDT"
    assert orders[0].side == "BUY"
    assert orders[0].order_type == "LIMIT"


@pytest.mark.asyncio
async def test_process_trades(result_handler, mock_db, mock_context):
    """Test processing trades."""
    # Mock trade
    trade = Trade(
        id="test_trade",
        user_id="test_user",
        strategy_id="test_strategy",
        symbol="BTC/USDT",
        side="BUY",
        amount=Decimal("0.1"),
        price=Decimal("50000"),
        entry_price=Decimal("49000"),
        timestamp=datetime.utcnow(),
    )

    # Mock position data
    mock_db.positions.find_one.return_value = {
        "user_id": "test_user",
        "strategy_id": "test_strategy",
        "symbol": "BTC/USDT",
        "amount": 0.2,
        "entry_price": 49000,
        "current_price": 50000,
        "status": "OPEN",
    }

    # Process trades
    await result_handler.process_trades([trade])

    # Verify database calls
    mock_db.positions.update_one.assert_called_once()
    mock_context.update_metrics.assert_called_once()
    mock_context.log_execution.assert_called_once()


@pytest.mark.asyncio
async def test_process_errors(result_handler, mock_context):
    """Test processing errors."""
    # Test errors
    errors = [
        {
            "type": "VALIDATION_ERROR",
            "message": "Invalid signal format",
            "details": {"field": "strength"},
        }
    ]

    # Process errors
    await result_handler.process_errors(errors)

    # Verify logging
    mock_context.log_execution.assert_called_once_with(
        "ERROR",
        {
            "error_type": "VALIDATION_ERROR",
            "error_message": "Invalid signal format",
            "error_details": {"field": "strength"},
        },
    )


def test_validate_signal(result_handler):
    """Test signal validation."""
    # Valid signal
    valid_signal = {
        "symbol": "BTC/USDT",
        "type": "TREND",
        "strength": 0.8,
        "direction": 1,
    }
    result_handler._validate_signal(valid_signal)

    # Invalid signal
    invalid_signal = {"symbol": "BTC/USDT", "type": "TREND"}
    with pytest.raises(ValidationError):
        result_handler._validate_signal(invalid_signal)


def test_check_risk_limits(result_handler):
    """Test risk limit checking."""
    # Mock data
    positions = {
        "BTC/USDT": Position(
            user_id="test_user",
            strategy_id="test_strategy",
            symbol="BTC/USDT",
            amount=Decimal("0.1"),
            entry_price=Decimal("50000"),
            current_price=Decimal("51000"),
            status="OPEN",
        )
    }
    risk_metrics = RiskMetrics(
        var_95=1000, var_99=1500, volatility=0.2, sharpe_ratio=1.5
    )
    risk_limits = {"max_positions": 5, "max_position_value": 10000, "max_var": 2000}

    # Test signal
    signal = {"symbol": "ETH/USDT", "type": "TREND", "strength": 0.8, "direction": 1}

    # Check limits
    result = result_handler._check_risk_limits(
        signal, positions, risk_metrics, risk_limits
    )
    assert result is True

    # Test with exceeded limits
    positions["ETH/USDT"] = Position(
        user_id="test_user",
        strategy_id="test_strategy",
        symbol="ETH/USDT",
        amount=Decimal("1"),
        entry_price=Decimal("3000"),
        current_price=Decimal("3100"),
        status="OPEN",
    )
    risk_metrics.var_95 = 2500

    result = result_handler._check_risk_limits(
        signal, positions, risk_metrics, risk_limits
    )
    assert result is False


@pytest.mark.asyncio
async def test_update_position(result_handler, mock_db):
    """Test position updating."""
    # Mock trade
    trade = Trade(
        id="test_trade",
        user_id="test_user",
        strategy_id="test_strategy",
        symbol="BTC/USDT",
        side="BUY",
        amount=Decimal("0.1"),
        price=Decimal("50000"),
        entry_price=Decimal("49000"),
        timestamp=datetime.utcnow(),
    )

    # Test new position
    mock_db.positions.find_one.return_value = None
    await result_handler._update_position(trade)
    mock_db.positions.insert_one.assert_called_once()

    # Test existing position
    mock_db.positions.find_one.return_value = {
        "user_id": "test_user",
        "strategy_id": "test_strategy",
        "symbol": "BTC/USDT",
        "amount": 0.1,
        "entry_price": 49000,
        "current_price": 50000,
        "status": "OPEN",
    }
    await result_handler._update_position(trade)
    mock_db.positions.update_one.assert_called_once()


@pytest.mark.asyncio
async def test_update_metrics(result_handler, mock_context):
    """Test metrics updating."""
    # Mock trade
    trade = Trade(
        id="test_trade",
        user_id="test_user",
        strategy_id="test_strategy",
        symbol="BTC/USDT",
        side="BUY",
        amount=Decimal("0.1"),
        price=Decimal("50000"),
        entry_price=Decimal("49000"),
        timestamp=datetime.utcnow(),
    )

    # Update metrics
    await result_handler._update_metrics(trade)

    # Verify metrics update
    mock_context.update_metrics.assert_called_once()
    call_args = mock_context.update_metrics.call_args[0][0]
    assert "trade_count_BTC/USDT" in call_args
    assert "volume_BTC/USDT" in call_args
    assert "pnl_BTC/USDT" in call_args
