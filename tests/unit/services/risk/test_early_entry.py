"""Unit tests for early entry strategy."""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal

from tradingbot.shared.strategies.early_entry import EarlyEntryStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import get_tenant_session
from tradingbot.shared.modules.solana_dex_integration import market_data_aggregator


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type=StrategyType.EARLY_ENTRY.value,
        parameters={
            "max_market_cap": 30000,  # $30k threshold
            "min_liquidity": 5000,
            "max_age_hours": 24,
            "min_volume": 1000,
            "profit_target": 0.05,  # 5% profit target
            "stop_loss": 0.02,  # 2% stop loss
            "position_size": 0.1,  # 10% position size
            "confidence_threshold": 0.7,  # 70% confidence threshold
        },
    )


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    base_time = datetime.utcnow()
    listing_time = base_time - timedelta(hours=1)  # Listed 1 hour ago
    return [
        {
            "timestamp": base_time.isoformat(),
            "listing_time": listing_time.isoformat(),
            "pair": "TEST/USDT",
            "price": 0.001,
            "volume": 10000,
            "liquidity": 8000,
            "token_address": "test123",
            "market_cap": 25000,  # Below threshold
        }
    ]


@pytest.fixture
async def mock_market_data_aggregator(monkeypatch):
    """Mock market data aggregator."""

    async def mock_get_market_cap(token_address: str) -> float:
        # Return different market caps for testing
        caps = {
            "test123": 25000,  # Below threshold
            "test456": 35000,  # Above threshold
            "test789": 15000,  # Well below threshold
        }
        return caps.get(token_address, 50000)

    monkeypatch.setattr(market_data_aggregator, "get_market_cap", mock_get_market_cap)
    return mock_get_market_cap


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = EarlyEntryStrategy(strategy_config)
    assert strategy.max_market_cap == 30000
    assert strategy.min_liquidity == 5000
    assert strategy.max_age_hours == 24
    assert strategy.min_volume == 1000
    assert strategy.profit_target == 0.05
    assert strategy.stop_loss == 0.02
    assert strategy.position_size == 0.1
    assert strategy.confidence_threshold == 0.7


async def test_strategy_initialization_invalid_params():
    """Test strategy initialization with invalid parameters."""
    # Test negative market cap
    with pytest.raises(ValueError, match="max_market_cap must be positive"):
        EarlyEntryStrategy(
            StrategyConfig(
                strategy_type=StrategyType.EARLY_ENTRY.value,
                parameters={"max_market_cap": -1000},
            )
        )

    # Test negative liquidity
    with pytest.raises(ValueError, match="min_liquidity must be positive"):
        EarlyEntryStrategy(
            StrategyConfig(
                strategy_type=StrategyType.EARLY_ENTRY.value,
                parameters={"min_liquidity": -100},
            )
        )

    # Test invalid age hours
    with pytest.raises(ValueError, match="max_age_hours must be positive"):
        EarlyEntryStrategy(
            StrategyConfig(
                strategy_type=StrategyType.EARLY_ENTRY.value,
                parameters={"max_age_hours": 0},
            )
        )


async def test_market_cap_threshold(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test market cap threshold checks."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with market cap below threshold
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] > 0
    assert "market_cap" in signal
    assert signal["market_cap"] < strategy.max_market_cap

    # Test with market cap above threshold
    mock_market_data[0]["token_address"] = "test456"
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "market_cap_too_high" in signal["reason"]

    # Test with no market data
    signal = await strategy.calculate_signals([])
    assert signal["signal"] == "neutral"
    assert "no_data" in signal["reason"]

    # Test with invalid market data
    signal = await strategy.calculate_signals([{}])
    assert signal["signal"] == "neutral"
    assert "invalid_data" in signal["reason"]


async def test_liquidity_threshold(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test liquidity threshold checks."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with sufficient liquidity
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"

    # Test with insufficient liquidity
    mock_market_data[0]["liquidity"] = 3000  # Below min_liquidity threshold
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_liquidity" in signal["reason"]

    # Test with zero liquidity
    mock_market_data[0]["liquidity"] = 0
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_liquidity" in signal["reason"]


async def test_volume_threshold(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test volume threshold checks."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with sufficient volume
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] > 0

    # Test with insufficient volume
    mock_market_data[0]["volume"] = 500  # Below min_volume threshold
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_volume" in signal["reason"]

    # Test with zero volume
    mock_market_data[0]["volume"] = 0
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_volume" in signal["reason"]


async def test_age_threshold(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test token age threshold checks."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with recent token
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"

    # Test with old token
    current_time = datetime.utcnow()
    old_time = current_time - timedelta(hours=25)  # Listed 25 hours ago
    mock_market_data[0].update(
        {
            "timestamp": current_time.isoformat(),
            "listing_time": old_time.isoformat(),
        }
    )
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "token_too_old" in signal["reason"]


async def test_confidence_calculation(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test confidence score calculation."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with optimal conditions
    mock_market_data[0].update(
        {
            "market_cap": 15000,  # Well below threshold
            "liquidity": 10000,  # Well above minimum
            "volume": 15000,  # Well above minimum
        }
    )
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] > 0.8

    # Test with borderline conditions
    mock_market_data[0].update(
        {
            "market_cap": 29000,  # Near threshold
            "liquidity": 6000,  # Just above minimum
            "volume": 2000,  # Just above minimum
        }
    )
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] < 0.8


async def test_trade_execution(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test trade execution."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Generate buy signal
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "buy"

    # Execute trade
    trade = await strategy.execute_trade(
        tenant_id=test_tenant.id,
        wallet=test_wallet,
        market_data={"pair": "TEST/USDT", "price": 0.001, "amount": 1000},
        signal=signal,
    )

    assert trade is not None
    assert trade["status"] == TradeStatus.PENDING.value
    assert trade["side"] == "buy"
    assert "market_cap" in trade["trade_metadata"]
    assert trade["trade_metadata"]["market_cap"] < strategy.max_market_cap


async def test_position_management(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test position management."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Create test trade
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.id,
        "pair": mock_market_data[0]["pair"],
        "side": "buy",
        "amount": 1000.0,
        "price": mock_market_data[0]["price"],
        "status": TradeStatus.OPEN.value,
        "strategy_id": test_strategy.id,
        "trade_metadata": {
            "market_cap": 25000,
            "liquidity": 8000,
            "age_hours": 1,
            "confidence": 0.9,
            "entry_price": mock_market_data[0]["price"],
        },
    }

    with get_tenant_session() as session:
        # Create initial trade
        trade = Trade(**trade_data)
        session.add(trade)
        session.flush()

        # Test profit target exit
        mock_market_data[0]["price"] = trade_data["price"] * (
            1 + strategy.profit_target + 0.01
        )
        await strategy.update_positions(
            tenant_id=test_tenant.id, market_data=mock_market_data[0]
        )
        session.refresh(trade)
        assert trade.status == TradeStatus.CLOSED.value
        assert "profit_target_reached" in trade.trade_metadata.get("exit_reason", "")

        # Test stop loss exit
        new_trade = Trade(**{**trade_data, "status": TradeStatus.OPEN})
        session.add(new_trade)
        session.flush()

        mock_market_data[0]["price"] = trade_data["price"] * (
            1 - strategy.stop_loss - 0.01
        )
        await strategy.update_positions(
            tenant_id=test_tenant.id, market_data=mock_market_data[0]
        )
        session.refresh(new_trade)
        assert new_trade.status == TradeStatus.CLOSED.value
        assert "stop_loss_triggered" in new_trade.trade_metadata.get("exit_reason", "")

        # Test market cap increase exit
        another_trade = Trade(**{**trade_data, "status": TradeStatus.OPEN})
        session.add(another_trade)
        session.flush()

        mock_market_data[0]["token_address"] = "test456"  # Above threshold
        await strategy.update_positions(
            tenant_id=test_tenant.id, market_data=mock_market_data[0]
        )
        session.refresh(another_trade)
        assert another_trade.status == TradeStatus.CLOSED.value
        assert "market_cap_increase" in another_trade.trade_metadata.get(
            "exit_reason", ""
        )

        session.commit()


async def test_error_handling(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test error handling scenarios."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test with missing required data
    invalid_data = [{"price": 0.001}]  # Missing required fields
    signal = await strategy.calculate_signals(invalid_data)
    assert signal["signal"] == "neutral"
    assert "error" in signal["reason"]

    # Test with invalid price
    mock_market_data[0]["price"] = -1
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "error" in signal["reason"]

    # Test with None market data
    with pytest.raises(ValueError, match="Market data cannot be None"):
        await strategy.update_positions(tenant_id="test", market_data=None)


async def test_rsi_calculation(strategy_config):
    """Test RSI calculation."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test insufficient data
    prices = [1.0, 2.0]  # Less than RSI period
    rsi = strategy._calculate_rsi(prices)
    assert rsi is None

    # Test all gains (RSI should be 100)
    prices = [1.0, 2.0, 3.0, 4.0, 5.0] * 3
    rsi = strategy._calculate_rsi(prices)
    assert rsi == 100.0

    # Test mixed movements
    prices = [10.0, 10.5, 10.2, 10.8, 10.3] * 3
    rsi = strategy._calculate_rsi(prices)
    assert 0 <= rsi <= 100


async def test_volume_surge(strategy_config):
    """Test volume surge detection."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test insufficient data
    volumes = [1000.0, 1200.0]  # Less than required periods
    assert not strategy._check_volume_surge(volumes)

    # Test no surge
    volumes = [1000.0] * 10
    assert not strategy._check_volume_surge(volumes)

    # Test clear surge
    volumes = [1000.0] * 9 + [3000.0]  # 3x surge
    assert strategy._check_volume_surge(volumes)


async def test_divergence_detection(strategy_config):
    """Test price/RSI divergence detection."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test insufficient data
    prices = [1.0, 2.0]
    rsi_values = [40.0, 45.0]
    assert strategy._check_divergence(prices, rsi_values) is None

    # Test bullish divergence
    prices = list(range(20, 0, -1))  # Decreasing prices
    rsi_values = list(range(30, 50))  # Increasing RSI
    assert strategy._check_divergence(prices, rsi_values) == "bullish"

    # Test bearish divergence
    prices = list(range(20))  # Increasing prices
    rsi_values = list(range(70, 50, -1))  # Decreasing RSI
    assert strategy._check_divergence(prices, rsi_values) == "bearish"

    # Test no divergence
    prices = list(range(20))
    rsi_values = list(range(20))
    assert strategy._check_divergence(prices, rsi_values) is None


async def test_signal_generation_scenarios(strategy_config, mock_market_data):
    """Test various signal generation scenarios."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Generate price data for bullish scenario
    prices = list(range(20, 0, -1))  # Decreasing prices
    volumes = [1000.0] * 19 + [3000.0]  # Volume surge at end

    market_data = [
        {
            "price": p,
            "volume": v,
            "timestamp": mock_market_data[0]["timestamp"],
            "pair": "TEST/USDT",
        }
        for p, v in zip(prices, volumes)
    ]

    signal = await strategy.calculate_signals(market_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] > 0.7
    assert signal["volume_surge"]

    # Generate price data for bearish scenario
    prices = list(range(20))  # Increasing prices
    market_data = [
        {
            "price": p,
            "volume": v,
            "timestamp": mock_market_data[0]["timestamp"],
            "pair": "TEST/USDT",
        }
        for p, v in zip(prices, volumes)
    ]

    signal = await strategy.calculate_signals(market_data)
    assert signal["signal"] == "sell"
    assert signal["confidence"] > 0.7
    assert signal["volume_surge"]


async def test_position_updates_scenarios(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test various position update scenarios."""
    strategy = EarlyEntryStrategy(strategy_config)

    # Test profit target hit
    entry_price = 100.0
    mock_market_data[0]["price"] = entry_price * (1 + strategy.profit_target + 0.01)
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[0]
    )
    assert result["status"] == TradeStatus.CLOSED
    assert result["trade_metadata"]["exit_reason"] == "profit_target"

    # Test stop loss hit
    mock_market_data[0]["price"] = entry_price * (1 - strategy.stop_loss - 0.01)
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[0]
    )
    assert result["status"] == TradeStatus.CLOSED
    assert result["trade_metadata"]["exit_reason"] == "stop_loss"

    # Test position still open
    mock_market_data[0]["price"] = entry_price * 1.01  # Small profit
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[0]
    )
    assert result["status"] == TradeStatus.OPEN
