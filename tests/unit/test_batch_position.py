"""Test batch position strategy."""

import pytest
from decimal import Decimal
from datetime import datetime
from tradingbot.shared.strategies.batch_position import BatchPositionStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import TradeStatus


@pytest.fixture
def valid_config():
    """Create a valid strategy configuration."""
    return StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"percentage": Decimal("0.3"), "multiplier": Decimal("1.5")},
                {"percentage": Decimal("0.4"), "multiplier": Decimal("2.0")},
            ],
            "stop_loss": Decimal("0.2"),
            "trailing_stop_pct": Decimal("0.1"),
            "position_sizes": [Decimal("0.5"), Decimal("1.0"), Decimal("1.5")],
        },
    )


def test_init_valid_config(valid_config):
    """Test strategy initialization with valid config."""
    strategy = BatchPositionStrategy(valid_config)
    assert len(strategy.batch_targets) == 2
    assert strategy.stop_loss == Decimal("0.2")
    assert strategy.trailing_stop_pct == Decimal("0.1")
    assert strategy.position_sizes == [Decimal("0.5"), Decimal("1.0"), Decimal("1.5")]


def test_init_invalid_batch_targets():
    """Test strategy initialization with invalid batch targets."""
    config = StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"percentage": Decimal("0.6"), "multiplier": Decimal("1.5")},
                {"percentage": Decimal("0.5"), "multiplier": Decimal("2.0")},
            ]
        },
    )
    with pytest.raises(
        ValueError, match="Total batch target percentages cannot exceed 100%"
    ):
        BatchPositionStrategy(config)


def test_init_invalid_stop_loss():
    """Test strategy initialization with invalid stop loss."""
    config = StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"percentage": Decimal("0.3"), "multiplier": Decimal("1.5")}
            ],
            "stop_loss": Decimal("1.5"),
        },
    )
    with pytest.raises(ValueError, match="Stop loss must be between 0 and 1"):
        BatchPositionStrategy(config)


def test_init_invalid_trailing_stop():
    """Test strategy initialization with invalid trailing stop."""
    config = StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"percentage": Decimal("0.3"), "multiplier": Decimal("1.5")}
            ],
            "trailing_stop_pct": Decimal("1.5"),
        },
    )
    with pytest.raises(
        ValueError, match="Trailing stop percentage must be between 0 and 1"
    ):
        BatchPositionStrategy(config)


def test_init_invalid_position_sizes():
    """Test strategy initialization with invalid position sizes."""
    config = StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"percentage": Decimal("0.3"), "multiplier": Decimal("1.5")}
            ],
            "position_sizes": [Decimal("-1.0"), Decimal("0.5")],
        },
    )
    with pytest.raises(ValueError, match="All position sizes must be positive"):
        BatchPositionStrategy(config)


@pytest.mark.asyncio
async def test_calculate_signals_no_data(valid_config):
    """Test signal calculation with no market data."""
    strategy = BatchPositionStrategy(valid_config)
    result = await strategy.calculate_signals([])
    assert result["signal"] == "neutral"
    assert result["confidence"] == Decimal("0.0")
    assert result["reason"] == "no_data"


@pytest.mark.asyncio
async def test_calculate_signals_valid_data(valid_config):
    """Test signal calculation with valid market data."""
    strategy = BatchPositionStrategy(valid_config)
    market_data = [{"price": Decimal("100"), "volume": Decimal("1000")}]
    result = await strategy.calculate_signals(market_data)
    assert result["signal"] == "neutral"
    assert result["confidence"] == Decimal("0.5")
    assert result["price"] == Decimal("100")
    assert result["volume"] == Decimal("1000")


@pytest.mark.asyncio
async def test_calculate_signals_error(valid_config):
    """Test signal calculation with invalid market data."""
    strategy = BatchPositionStrategy(valid_config)
    market_data = [{"invalid": "data"}]
    result = await strategy.calculate_signals(market_data)
    assert result["signal"] == "neutral"
    assert result["confidence"] == Decimal("0.0")
    assert "error" in result["reason"]


@pytest.mark.asyncio
async def test_execute_trade_neutral_signal(valid_config):
    """Test trade execution with neutral signal."""
    strategy = BatchPositionStrategy(valid_config)
    result = await strategy.execute_trade(
        tenant_id="test",
        wallet={"address": "0x123"},
        market_data={"price": Decimal("100")},
        signal={"signal": "neutral"},
    )
    assert result is None


@pytest.mark.asyncio
async def test_execute_trade_valid_signal(valid_config):
    """Test trade execution with valid signal."""
    strategy = BatchPositionStrategy(valid_config)
    result = await strategy.execute_trade(
        tenant_id="test",
        wallet={"address": "0x123"},
        market_data={
            "pair": "BTC/USD",
            "price": Decimal("100"),
            "amount": Decimal("1.0"),
        },
        signal={"signal": "buy", "confidence": Decimal("0.8")},
    )
    assert result is not None
    assert result["tenant_id"] == "test"
    assert result["wallet_address"] == "0x123"
    assert result["status"] == TradeStatus.PENDING
    assert len(result["trade_metadata"]["batch_targets"]) == 2


@pytest.mark.asyncio
async def test_update_positions_none_market_data(valid_config):
    """Test position update with None market data."""
    strategy = BatchPositionStrategy(valid_config)
    with pytest.raises(ValueError, match="Market data cannot be None"):
        await strategy.update_positions("test", None)


@pytest.mark.asyncio
async def test_update_positions_stop_loss(valid_config):
    """Test position update triggering stop loss."""
    strategy = BatchPositionStrategy(valid_config)
    market_data = {
        "price": Decimal("70"),
        "trade_metadata": {
            "batch_targets": [],
            "filled_targets": [],
            "remaining_amount": Decimal("1.0"),
            "entry_price": Decimal("100"),
            "highest_price": Decimal("100"),
        },
    }
    result = await strategy.update_positions("test", market_data)
    assert result["status"] == TradeStatus.CLOSED
    assert result["trade_metadata"]["exit_reason"] == "stop_loss"


@pytest.mark.asyncio
async def test_update_positions_trailing_stop(valid_config):
    """Test position update triggering trailing stop."""
    strategy = BatchPositionStrategy(valid_config)
    market_data = {
        "price": Decimal("85"),
        "trade_metadata": {
            "batch_targets": [],
            "filled_targets": [],
            "remaining_amount": Decimal("1.0"),
            "entry_price": Decimal("100"),
            "highest_price": Decimal("120"),
        },
    }
    result = await strategy.update_positions("test", market_data)
    assert result["status"] == TradeStatus.CLOSED
    assert result["trade_metadata"]["exit_reason"] == "trailing_stop"


@pytest.mark.asyncio
async def test_update_positions_new_high(valid_config):
    """Test position update with new high price."""
    strategy = BatchPositionStrategy(valid_config)
    market_data = {
        "price": Decimal("150"),
        "trade_metadata": {
            "batch_targets": [],
            "filled_targets": [],
            "remaining_amount": Decimal("1.0"),
            "entry_price": Decimal("100"),
            "highest_price": Decimal("120"),
        },
    }
    result = await strategy.update_positions("test", market_data)
    assert result["status"] == TradeStatus.OPEN
    assert result["trade_metadata"]["highest_price"] == Decimal("150")
