"""Unit tests for capital rotation strategy."""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal

from tradingbot.shared.strategies.capital_rotation import CapitalRotationStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import tenant_session
from tradingbot.shared.modules.solana_dex_integration import market_data_aggregator


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type=StrategyType.CAPITAL_ROTATION.value,
        parameters={
            "small_cap_threshold": 100000,  # $100k threshold for small caps
            "mid_cap_threshold": 500000,  # $500k threshold for mid caps
            "large_cap_threshold": 1000000,  # $1M threshold for large caps
            "volume_threshold": 50000,  # Minimum 24h volume
            "profit_threshold": 0.5,  # 50% profit target for rotation
            "max_holdings": 5,  # Maximum number of tokens to hold
            "rebalance_interval": 24,  # Hours between rebalances
            "target_tokens": [  # List of target tokens for rotation
                "CHUNKY/USDT",
                "NPC/USDT",
                "BOME/USDT",
            ],
        },
    )


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    return {
        "small_cap": {
            "token_address": "small123",
            "pair": "SMALL/USDT",
            "price": 0.1,
            "volume": 75000,
            "market_cap": 50000,
            "timestamp": datetime.utcnow().isoformat(),
        },
        "large_cap": {
            "token_address": "large456",
            "pair": "LARGE/USDT",
            "price": 1.0,
            "volume": 500000,
            "market_cap": 2000000,
            "timestamp": datetime.utcnow().isoformat(),
        },
    }


@pytest.fixture
async def mock_market_data_aggregator(monkeypatch):
    """Mock market data aggregator."""

    async def mock_get_market_cap(token_address: str) -> float:
        caps = {
            "small123": 50000,  # Small cap
            "medium789": 500000,  # Medium cap
            "large456": 2000000,  # Large cap
        }
        return caps.get(token_address, 0)

    async def mock_get_volume(token_address: str) -> float:
        volumes = {
            "small123": 75000,
            "medium789": 200000,
            "large456": 500000,
        }
        return volumes.get(token_address, 0)

    monkeypatch.setattr(market_data_aggregator, "get_market_cap", mock_get_market_cap)
    monkeypatch.setattr(market_data_aggregator, "get_volume", mock_get_volume)


async def test_market_cap_classification(
    strategy_config, mock_market_data, mock_market_data_aggregator
):
    """Test market cap classification logic."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Test small cap classification
    small_cap_data = mock_market_data["small_cap"]
    is_small = await strategy.is_small_cap(small_cap_data["token_address"])
    assert is_small is True

    # Test large cap classification
    large_cap_data = mock_market_data["large_cap"]
    is_large = await strategy.is_large_cap(large_cap_data["token_address"])
    assert is_large is True


async def test_volume_threshold(
    strategy_config, mock_market_data, mock_market_data_aggregator, monkeypatch
):
    """Test volume threshold validation."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Test sufficient volume
    has_volume = await strategy.has_sufficient_volume(
        mock_market_data["small_cap"]["token_address"]
    )
    assert has_volume is True

    # Test insufficient volume
    async def mock_low_volume(token_address: str) -> float:
        return 25000  # Below threshold

    monkeypatch.setattr(market_data_aggregator, "get_volume", mock_low_volume)
    has_volume = await strategy.has_sufficient_volume(
        mock_market_data["small_cap"]["token_address"]
    )
    assert has_volume is False


async def test_rotation_trigger(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    db_session,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test rotation trigger conditions."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Create small cap position
    initial_trade = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.id,
        "pair": mock_market_data["small_cap"]["pair"],
        "side": "buy",
        "amount": 1000,
        "price": mock_market_data["small_cap"]["price"],
        "status": TradeStatus.OPEN,
        "trade_metadata": {
            "entry_price": mock_market_data["small_cap"]["price"],
            "token_address": mock_market_data["small_cap"]["token_address"],
            "market_cap_entry": mock_market_data["small_cap"]["market_cap"],
            "last_rebalance": (datetime.utcnow() - timedelta(hours=25)).isoformat(),
        },
    }

    # Test profit target trigger
    mock_market_data["small_cap"]["price"] = 0.15  # 50% increase
    rotation_result = await strategy.should_rotate_position(
        initial_trade, mock_market_data["small_cap"]
    )
    assert rotation_result["should_rotate"] is True
    assert "profit_target_reached" in rotation_result["reasons"]


async def test_portfolio_rebalancing(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    db_session,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test portfolio rebalancing logic."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Create current portfolio
    portfolio = [
        {
            "tenant_id": test_tenant.id,
            "wallet_id": test_wallet.id,
            "pair": "TOKEN1/USDT",
            "amount": 1000,
            "price": 0.1,
            "status": TradeStatus.OPEN,
            "trade_metadata": {
                "token_address": "small123",
                "market_cap_entry": 40000,
            },
        },
        {
            "tenant_id": "test_tenant",
            "wallet_id": "test_wallet",
            "pair": "TOKEN2/USDT",
            "amount": 500,
            "price": 0.2,
            "status": TradeStatus.OPEN,
            "trade_metadata": {
                "token_address": "medium789",
                "market_cap_entry": 400000,
            },
        },
    ]

    # Test rebalancing recommendations
    rebalance_actions = await strategy.get_rebalance_actions(portfolio)
    assert len(rebalance_actions) > 0
    assert all(
        action["action"] in ["hold", "rotate", "exit"] for action in rebalance_actions
    )


async def test_risk_limits(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    db_session,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test risk management limits."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Test max holdings limit
    portfolio = [
        {
            "tenant_id": test_tenant.id,
            "wallet_id": test_wallet.id,
            "pair": f"TOKEN{i}/USDT",
            "amount": 1000,
            "price": 0.1,
            "status": TradeStatus.OPEN,
            "trade_metadata": {
                "token_address": f"token{i}",
                "market_cap_entry": 50000,
            },
        }
        for i in range(strategy.max_holdings + 1)
    ]

    can_add = await strategy.can_add_position(portfolio)
    assert can_add is False

    # Test with room for more positions
    portfolio = portfolio[:-2]  # Remove two positions
    can_add = await strategy.can_add_position(portfolio)
    assert can_add is True


async def test_trade_execution(
    strategy_config,
    mock_market_data,
    mock_market_data_aggregator,
    db_session,
    test_tenant,
    test_wallet,
    test_strategy,
):
    """Test trade execution for rotation."""
    strategy = CapitalRotationStrategy(strategy_config)

    # Test rotation from small to large cap
    signal = await strategy.calculate_signals(mock_market_data["large_cap"])
    assert signal["signal"] == "rotate"
    assert "target_token" in signal
    assert signal["confidence"] > 0

    # Execute rotation trade
    trade = await strategy.execute_trade(
        tenant_id=test_tenant.id,
        wallet=test_wallet,
        market_data=mock_market_data["large_cap"],
        signal=signal,
    )

    assert trade is not None
    assert trade["status"] == TradeStatus.PENDING
    assert trade["side"] == "buy"
    assert "rotation_source" in trade["trade_metadata"]
    assert "target_market_cap" in trade["trade_metadata"]
