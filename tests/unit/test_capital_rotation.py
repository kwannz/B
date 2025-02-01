"""Test capital rotation strategy."""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
import numpy as np
from tradingbot.shared.strategies.capital_rotation import CapitalRotationStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import TradeStatus


@pytest.fixture
def valid_config():
    """Create a valid strategy configuration."""
    return StrategyConfig(
        strategy_type="capital_rotation",
        parameters={
            "performance_window": 30,
            "rotation_interval": 7,
            "num_top_assets": 3,
            "min_volume": 1000.0,
            "min_momentum": 0.01,
            "position_size": 0.1,
        },
    )


def test_init_valid_config(valid_config):
    """Test strategy initialization with valid config."""
    strategy = CapitalRotationStrategy(valid_config)
    assert strategy.performance_window == 30
    assert strategy.rotation_interval == 7
    assert strategy.num_top_assets == 3
    assert strategy.min_volume == 1000.0
    assert strategy.min_momentum == 0.01
    assert strategy.position_size == 0.1


def test_init_invalid_performance_window():
    """Test initialization with invalid performance window."""
    config = StrategyConfig(
        strategy_type="capital_rotation", parameters={"performance_window": -1}
    )
    with pytest.raises(
        ValueError, match="performance_window must be a positive integer"
    ):
        CapitalRotationStrategy(config)


def test_init_invalid_rotation_interval():
    """Test initialization with invalid rotation interval."""
    config = StrategyConfig(
        strategy_type="capital_rotation", parameters={"rotation_interval": 0}
    )
    with pytest.raises(
        ValueError, match="rotation_interval must be a positive integer"
    ):
        CapitalRotationStrategy(config)


def test_init_invalid_num_top_assets():
    """Test initialization with invalid number of top assets."""
    config = StrategyConfig(
        strategy_type="capital_rotation", parameters={"num_top_assets": "invalid"}
    )
    with pytest.raises(ValueError, match="num_top_assets must be a positive integer"):
        CapitalRotationStrategy(config)


def test_init_invalid_min_volume():
    """Test initialization with invalid minimum volume."""
    config = StrategyConfig(
        strategy_type="capital_rotation", parameters={"min_volume": -1000}
    )
    with pytest.raises(ValueError, match="min_volume must be a positive number"):
        CapitalRotationStrategy(config)


def test_init_invalid_min_momentum():
    """Test initialization with invalid minimum momentum."""
    config = StrategyConfig(
        strategy_type="capital_rotation", parameters={"min_momentum": 0}
    )
    with pytest.raises(ValueError, match="min_momentum must be a positive number"):
        CapitalRotationStrategy(config)


def test_init_invalid_position_size():
    """Test initialization with invalid position size."""
    config = StrategyConfig(
        strategy_type="capital_rotation",
        parameters={"position_size": 0.5, "num_top_assets": 3},
    )
    with pytest.raises(ValueError, match="Total position size cannot exceed 100%"):
        CapitalRotationStrategy(config)


def test_calculate_momentum_insufficient_data(valid_config):
    """Test momentum calculation with insufficient data."""
    strategy = CapitalRotationStrategy(valid_config)
    result = strategy._calculate_momentum([100.0])
    assert result is None


def test_calculate_momentum_valid_data(valid_config):
    """Test momentum calculation with valid data."""
    strategy = CapitalRotationStrategy(valid_config)
    prices = [100.0, 110.0, 120.0]
    result = strategy._calculate_momentum(prices)
    assert isinstance(result, float)
    assert result > 0


def test_calculate_relative_strength_no_valid_assets(valid_config):
    """Test relative strength calculation with no valid assets."""
    strategy = CapitalRotationStrategy(valid_config)
    asset_data = [
        {
            "pair": "BTC/USD",
            "history": [{"price": 100.0}, {"price": 99.0}],
            "volume": 500.0,  # Below min_volume
        }
    ]
    result = strategy._calculate_relative_strength(asset_data)
    assert len(result) == 0


def test_calculate_relative_strength_valid_assets(valid_config):
    """Test relative strength calculation with valid assets."""
    strategy = CapitalRotationStrategy(valid_config)
    asset_data = [
        {
            "pair": "BTC/USD",
            "history": [{"price": 100.0}, {"price": 110.0}, {"price": 120.0}],
            "volume": 2000.0,
        },
        {
            "pair": "ETH/USD",
            "history": [{"price": 200.0}, {"price": 220.0}, {"price": 240.0}],
            "volume": 1500.0,
        },
    ]
    result = strategy._calculate_relative_strength(asset_data)
    assert len(result) == 2
    assert all(asset["momentum"] > strategy.min_momentum for asset in result)


@pytest.mark.asyncio
async def test_calculate_signals_no_data(valid_config):
    """Test signal calculation with no market data."""
    strategy = CapitalRotationStrategy(valid_config)
    result = await strategy.calculate_signals([])
    assert result["signal"] == "neutral"
    assert result["confidence"] == 0.0
    assert result["reason"] == "no_data"


@pytest.mark.asyncio
async def test_calculate_signals_no_valid_assets(valid_config):
    """Test signal calculation with no valid assets."""
    strategy = CapitalRotationStrategy(valid_config)
    market_data = [
        {
            "pair": "BTC/USD",
            "history": [{"price": 100.0}, {"price": 99.0}],
            "volume": 500.0,  # Below min_volume
        }
    ]
    result = await strategy.calculate_signals(market_data)
    assert result["signal"] == "neutral"
    assert result["confidence"] == 0.0
    assert result["reason"] == "no_valid_assets"


@pytest.mark.asyncio
async def test_calculate_signals_error(valid_config):
    """Test signal calculation with error."""
    strategy = CapitalRotationStrategy(valid_config)
    market_data = [
        {"invalid": "data"}
    ]  # This will cause an error in _calculate_relative_strength
    result = await strategy.calculate_signals(market_data)
    assert result["signal"] == "neutral"
    assert result["confidence"] == 0.0
    assert "error" in result["reason"]


@pytest.mark.asyncio
async def test_calculate_signals_valid_data(valid_config):
    """Test signal calculation with valid market data."""
    strategy = CapitalRotationStrategy(valid_config)
    market_data = [
        {
            "pair": "BTC/USD",
            "history": [{"price": 100.0}, {"price": 110.0}, {"price": 120.0}],
            "volume": 2000.0,
        },
        {
            "pair": "ETH/USD",
            "history": [{"price": 200.0}, {"price": 220.0}, {"price": 240.0}],
            "volume": 1500.0,
        },
    ]
    result = await strategy.calculate_signals(market_data)
    assert result["signal"] == "rotate"
    assert result["confidence"] == 1.0
    assert len(result["assets"]) <= strategy.num_top_assets
    assert "next_rotation" in result


@pytest.mark.asyncio
async def test_execute_trade_neutral_signal(valid_config):
    """Test trade execution with neutral signal."""
    strategy = CapitalRotationStrategy(valid_config)
    result = await strategy.execute_trade(
        tenant_id="test",
        wallet={"address": "0x123"},
        market_data={"amount": 1000.0},
        signal={"signal": "neutral"},
    )
    assert result is None


@pytest.mark.asyncio
async def test_execute_trade_valid_signal(valid_config):
    """Test trade execution with valid rotation signal."""
    strategy = CapitalRotationStrategy(valid_config)
    next_rotation = (datetime.utcnow() + timedelta(days=7)).isoformat()
    result = await strategy.execute_trade(
        tenant_id="test",
        wallet={"address": "0x123"},
        market_data={"amount": 1000.0},
        signal={
            "signal": "rotate",
            "confidence": 1.0,
            "position_size": 0.1,
            "next_rotation": next_rotation,
            "assets": [{"pair": "BTC/USD", "price": 50000.0, "momentum": 0.02}],
        },
    )
    assert result is not None
    assert len(result["trades"]) == 1
    assert result["trades"][0]["status"] == TradeStatus.PENDING
    assert result["trade_metadata"]["rotation_interval"] == strategy.rotation_interval
    assert result["trade_metadata"]["next_rotation"] == next_rotation


@pytest.mark.asyncio
async def test_update_positions_none_market_data(valid_config):
    """Test position update with None market data."""
    strategy = CapitalRotationStrategy(valid_config)
    with pytest.raises(ValueError, match="Market data cannot be None"):
        await strategy.update_positions("test", None)


@pytest.mark.asyncio
async def test_update_positions_needs_rotation(valid_config):
    """Test position update when rotation is needed."""
    strategy = CapitalRotationStrategy(valid_config)
    past_rotation = (datetime.utcnow() - timedelta(days=1)).isoformat()
    result = await strategy.update_positions(
        tenant_id="test",
        market_data={"trade_metadata": {"next_rotation": past_rotation}},
    )
    assert result["status"] == TradeStatus.CLOSED
    assert result["trade_metadata"]["exit_reason"] == "rotation"


@pytest.mark.asyncio
async def test_update_positions_no_rotation_needed(valid_config):
    """Test position update when no rotation is needed."""
    strategy = CapitalRotationStrategy(valid_config)
    future_rotation = (datetime.utcnow() + timedelta(days=1)).isoformat()
    result = await strategy.update_positions(
        tenant_id="test",
        market_data={"trade_metadata": {"next_rotation": future_rotation}},
    )
    assert result["status"] == TradeStatus.OPEN
    assert "current_time" in result["trade_metadata"]
