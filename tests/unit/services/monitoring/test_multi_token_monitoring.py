"""Unit tests for multi-token monitoring strategy."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from tradingbot.models.trading import TradeStatus
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.shared.modules.solana_dex_integration import market_data_aggregator
from tradingbot.shared.strategies.multi_token_monitoring import (
    MultiTokenMonitoringStrategy,
)


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type="multi_token_monitoring",
        parameters={
            "volume_surge_threshold": 3.0,  # 300% increase in volume
            "price_surge_threshold": 0.2,  # 20% price increase
            "market_cap_threshold": 5000000,  # Maximum $5M market cap
            "min_liquidity": 5000,  # Minimum liquidity
            "max_tokens": 50,  # Maximum tokens to monitor
            "monitoring_interval": 5,  # Minutes between checks
            "alert_cooldown": 60,  # Minutes between alerts for same token
        },
    )


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    base_time = datetime.utcnow()
    return {
        "normal": {
            "token_address": "token123",
            "pair": "TOKEN/USDT",
            "price": 1.0,
            "volume": 10000,
            "market_cap": 100000,
            "timestamp": base_time.isoformat(),
            "previous_data": {
                "price": 0.95,
                "volume": 8000,
                "timestamp": (base_time - timedelta(minutes=5)).isoformat(),
            },
        },
        "surge": {
            "token_address": "surge456",
            "pair": "SURGE/USDT",
            "price": 1.5,  # 50% increase
            "volume": 40000,  # 400% increase
            "market_cap": 200000,
            "timestamp": base_time.isoformat(),
            "previous_data": {
                "price": 1.0,
                "volume": 8000,
                "timestamp": (base_time - timedelta(minutes=5)).isoformat(),
            },
        },
    }


@pytest.fixture
async def mock_market_data_aggregator(monkeypatch):
    """Mock market data aggregator."""

    async def mock_get_market_data(token_address: str) -> dict:
        data = {
            "token123": {
                "price": 1.0,
                "volume": 10000,
                "market_cap": 100000,
            },
            "surge456": {
                "price": 1.5,
                "volume": 40000,
                "market_cap": 200000,
            },
        }
        return data.get(token_address, {})

    monkeypatch.setattr(market_data_aggregator, "get_market_data", mock_get_market_data)


async def test_volume_surge_detection(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test volume surge detection."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Test normal volume
    normal_data = mock_market_data["normal"]
    has_surge = await strategy.detect_volume_surge(
        normal_data["token_address"],
        normal_data["volume"],
        normal_data["previous_data"]["volume"],
    )
    assert has_surge is False

    # Test volume surge
    surge_data = mock_market_data["surge"]
    has_surge = await strategy.detect_volume_surge(
        surge_data["token_address"],
        surge_data["volume"],
        surge_data["previous_data"]["volume"],
    )
    assert has_surge is True


async def test_price_surge_detection(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test price surge detection."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Test normal price movement
    normal_data = mock_market_data["normal"]
    has_surge = await strategy.detect_price_surge(
        normal_data["token_address"],
        normal_data["price"],
        normal_data["previous_data"]["price"],
    )
    assert has_surge is False

    # Test price surge
    surge_data = mock_market_data["surge"]
    has_surge = await strategy.detect_price_surge(
        surge_data["token_address"],
        surge_data["price"],
        surge_data["previous_data"]["price"],
    )
    assert has_surge is True


async def test_market_cap_thresholds(
    strategy_config, mock_market_data, mock_market_data_aggregator, monkeypatch
):
    """Test market cap threshold validation."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Test valid market cap
    is_valid = await strategy.is_valid_market_cap(
        mock_market_data["normal"]["token_address"]
    )
    assert is_valid is True

    # Test invalid market cap (mock different value)
    async def mock_low_market_cap(token_address: str) -> dict:
        return {"market_cap": 25000}  # Below minimum

    monkeypatch.setattr(market_data_aggregator, "get_market_data", mock_low_market_cap)

    is_valid = await strategy.is_valid_market_cap("low_cap_token")
    assert is_valid is False


async def test_alert_generation(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test alert generation for significant events."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Test alert for surge event
    surge_data = mock_market_data["surge"]
    alert = await strategy.generate_alert(
        token_address=surge_data["token_address"],
        current_data=surge_data,
        previous_data=surge_data["previous_data"],
    )

    assert alert is not None
    assert "volume_surge" in alert["triggers"]
    assert "price_surge" in alert["triggers"]
    assert alert["token_address"] == surge_data["token_address"]
    assert alert["timestamp"] is not None


async def test_alert_cooldown(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test alert cooldown mechanism."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Generate first alert
    surge_data = mock_market_data["surge"]
    alert1 = await strategy.generate_alert(
        token_address=surge_data["token_address"],
        current_data=surge_data,
        previous_data=surge_data["previous_data"],
    )
    assert alert1 is not None

    # Try to generate another alert immediately
    alert2 = await strategy.generate_alert(
        token_address=surge_data["token_address"],
        current_data=surge_data,
        previous_data=surge_data["previous_data"],
    )
    assert alert2 is None  # Should be blocked by cooldown


async def test_parallel_monitoring(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test parallel monitoring of multiple tokens."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Monitor multiple tokens
    tokens = [
        mock_market_data["normal"],
        mock_market_data["surge"],
    ]

    results = await strategy.monitor_tokens(tokens)
    assert len(results) == 2

    # Verify surge detection
    surge_result = next(
        r
        for r in results
        if r["token_address"] == mock_market_data["surge"]["token_address"]
    )
    assert surge_result["has_surge"] is True
    assert "volume_surge" in surge_result["triggers"]

    # Verify normal token
    normal_result = next(
        r
        for r in results
        if r["token_address"] == mock_market_data["normal"]["token_address"]
    )
    assert normal_result["has_surge"] is False


async def test_monitoring_capacity(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test monitoring capacity limits."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Create tokens exceeding max limit
    excess_tokens = [
        {
            "token_address": f"token{i}",
            "pair": f"TOKEN{i}/USDT",
            "price": 1.0,
            "volume": 10000,
            "market_cap": 100000,
            "timestamp": datetime.utcnow().isoformat(),
        }
        for i in range(strategy.max_monitored_tokens + 10)
    ]

    # Attempt to monitor excess tokens
    results = await strategy.monitor_tokens(excess_tokens)
    assert len(results) <= strategy.max_monitored_tokens


async def test_data_aggregation(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test market data aggregation."""
    strategy = MultiTokenMonitoringStrategy(strategy_config)

    # Aggregate data for multiple tokens
    tokens = [
        mock_market_data["normal"],
        mock_market_data["surge"],
    ]

    aggregated_data = await strategy.aggregate_market_data(tokens)
    assert len(aggregated_data) == 2

    # Verify data structure
    for token_data in aggregated_data:
        assert "token_address" in token_data
        assert "price" in token_data
        assert "volume" in token_data
        assert "market_cap" in token_data
        assert "timestamp" in token_data
