"""Unit tests for batch position management strategy."""

import pytest
from datetime import datetime

from tradingbot.shared.strategies.batch_position import BatchPositionStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import get_tenant_session


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type=StrategyType.BATCH_POSITION.value,
        parameters={
            "batch_targets": [
                {"multiplier": 2.0, "percentage": 0.20},  # Sell 20% at 2x
                {"multiplier": 3.0, "percentage": 0.25},  # Sell 25% at 3x
                {"multiplier": 5.0, "percentage": 0.20},  # Sell 20% at 5x
            ],
            "position_sizes": [1.0, 2.0],
            "stop_loss": 0.5,  # 50% stop loss
            "trailing_stop_pct": 0.2,  # 20% trailing stop
        },
    )


@pytest.fixture
def test_tenant():
    """Create test tenant."""
    with get_tenant_session() as session:
        tenant = Tenant(
            name="Test Tenant", api_key=f"test_api_key_{datetime.utcnow().isoformat()}"
        )
        session.add(tenant)
        session.commit()
        return tenant


@pytest.fixture
def test_wallet(test_tenant):
    """Create test wallet."""
    with get_tenant_session() as session:
        wallet = Wallet(
            tenant_id=test_tenant.id,
            address="test_wallet",
            chain="solana",
            balance=1000.0,
            is_active=True,
        )
        session.add(wallet)
        session.commit()
        return wallet


@pytest.fixture
def test_strategy(test_tenant, strategy_config):
    """Create test strategy."""
    with get_tenant_session() as session:
        strategy = Strategy(
            tenant_id=test_tenant.id,
            name="Test Strategy",
            strategy_type=StrategyType.BATCH_POSITION,
            is_active=True,
        )
        strategy.config = strategy_config.parameters
        session.add(strategy)
        session.commit()
        return strategy


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    return {
        "pair": "TEST/USDT",
        "price": 1.0,
        "volume": 10000,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = BatchPositionStrategy(strategy_config)
    assert len(strategy.batch_targets) == 3
    assert strategy.batch_targets[0]["multiplier"] == 2.0
    assert strategy.batch_targets[1]["percentage"] == 0.25
    assert strategy.stop_loss == 0.5
    assert strategy.trailing_stop_pct == 0.2


async def test_batch_target_validation(strategy_config):
    """Test batch target validation."""
    # Test valid configuration
    strategy = BatchPositionStrategy(strategy_config)
    total_percentage = sum(target["percentage"] for target in strategy.batch_targets)
    assert total_percentage <= 1.0  # Should leave some for final exit

    # Test invalid total percentage
    invalid_config = StrategyConfig(
        strategy_type="batch_position",
        parameters={
            "batch_targets": [
                {"multiplier": 2.0, "percentage": 0.5},
                {"multiplier": 3.0, "percentage": 0.6},  # Total > 100%
            ],
            "stop_loss": 0.5,
            "trailing_stop_pct": 0.2,
        },
    )
    with pytest.raises(ValueError):
        BatchPositionStrategy(invalid_config)


async def test_partial_profit_taking(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test partial profit taking at different price levels."""
    strategy = BatchPositionStrategy(strategy_config)

    # Initial trade setup
    initial_amount = 100.0
    entry_price = 1.0
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.address,
        "pair": mock_market_data["pair"],
        "side": "buy",
        "amount": initial_amount,
        "price": entry_price,
        "status": TradeStatus.OPEN.value,
        "strategy_id": test_strategy.id,
        "trade_metadata": {
            "batch_targets": [
                {
                    "multiplier": target["multiplier"],
                    "percentage": target["percentage"],
                    "status": TradeStatus.PENDING.value,
                }
                for target in strategy.batch_targets
            ],
            "filled_targets": [],
            "remaining_amount": initial_amount,
            "entry_price": entry_price,
            "highest_price": entry_price,
        },
    }

    # Create trade in database
    with get_tenant_session() as session:
        # Create initial trade
        trade = Trade(**trade_data)
        session.add(trade)
        session.flush()  # Ensure trade is persisted

        # Test first target (2x)
        mock_market_data["price"] = 2.0  # Price reaches 2x
        result = await strategy.update_positions(
            tenant_id=test_tenant.id, market_data=mock_market_data
        )
        assert result is not None
        assert (
            result["trade_metadata"]["batch_targets"][0]["status"]
            == TradeStatus.CLOSED.value
        )
        assert result["trade_metadata"]["remaining_amount"] == initial_amount * 0.8
        session.commit()
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert (
        result["trade_metadata"]["batch_targets"][0]["status"]
        == TradeStatus.CLOSED.value
    )
    assert result["trade_metadata"]["remaining_amount"] == initial_amount * 0.8

    # Test second target (3x)
    mock_market_data["price"] = 3.0  # Price reaches 3x
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert (
        result["trade_metadata"]["batch_targets"][1]["status"]
        == TradeStatus.CLOSED.value
    )
    assert result["trade_metadata"]["remaining_amount"] == initial_amount * 0.55


async def test_stop_loss_trigger(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test stop loss triggering."""
    strategy = BatchPositionStrategy(strategy_config)

    # Create trade with entry at $1.0
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.address,
        "pair": mock_market_data["pair"],
        "side": "buy",
        "amount": 100.0,
        "price": 1.0,
        "status": TradeStatus.OPEN.value,
        "strategy_id": test_strategy.id,
        "trade_metadata": {
            "batch_targets": [
                {
                    "multiplier": target["multiplier"],
                    "percentage": target["percentage"],
                    "status": TradeStatus.PENDING.value,
                }
                for target in strategy.batch_targets
            ],
            "filled_targets": [],
            "remaining_amount": 100.0,
            "entry_price": 1.0,
            "highest_price": 1.0,
        },
    }

    # Create trade in database
    with get_tenant_session() as session:
        trade = Trade(**trade_data)
        session.add(trade)
        session.commit()

    # Price drops below stop loss
    mock_market_data["price"] = 0.45  # 55% drop
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert result["status"] == TradeStatus.CLOSED.value
    assert result["trade_metadata"].get("exit_reason") == "stop_loss"


async def test_trailing_stop_trigger(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test trailing stop triggering."""
    strategy = BatchPositionStrategy(strategy_config)

    # Create trade with entry at $1.0
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.address,
        "pair": mock_market_data["pair"],
        "side": "buy",
        "amount": 100.0,
        "price": 1.0,
        "status": TradeStatus.OPEN.value,
        "strategy_id": test_strategy.id,
        "trade_metadata": {
            "batch_targets": [
                {
                    "multiplier": target["multiplier"],
                    "percentage": target["percentage"],
                    "status": TradeStatus.PENDING.value,
                }
                for target in strategy.batch_targets
            ],
            "filled_targets": [],
            "remaining_amount": 100.0,
            "entry_price": 1.0,
            "highest_price": 1.0,
        },
    }

    # Create trade in database
    with get_tenant_session() as session:
        trade = Trade(**trade_data)
        session.add(trade)
        session.commit()

    # Price rises to $2.0
    mock_market_data["price"] = 2.0
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert result["trade_metadata"]["highest_price"] == 2.0

    # Price drops more than trailing stop percentage
    mock_market_data["price"] = 1.5  # 25% drop from high
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert result["status"] == TradeStatus.CLOSED.value
    assert result["trade_metadata"].get("exit_reason") == "trailing_stop"


async def test_final_target_exit(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test final target completion."""
    strategy = BatchPositionStrategy(strategy_config)

    # Create trade with entry at $1.0
    initial_amount = 100.0
    _ = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.id,
        "pair": mock_market_data["pair"],
        "side": "buy",
        "amount": initial_amount,
        "price": 1.0,
        "status": TradeStatus.OPEN.value,
        "trade_metadata": {
            "batch_targets": [
                {
                    "multiplier": target["multiplier"],
                    "percentage": target["percentage"],
                    "status": TradeStatus.PENDING.value,
                }
                for target in strategy.batch_targets
            ],
            "remaining_amount": initial_amount,
            "entry_price": 1.0,
        },
    }

    # Price reaches final target (5x)
    mock_market_data["price"] = 5.0
    result = await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data
    )
    assert result is not None
    assert all(
        target["status"] == TradeStatus.CLOSED.value
        for target in result["trade_metadata"]["batch_targets"]
    )
    assert (
        result["trade_metadata"]["remaining_amount"] == initial_amount * 0.35
    )  # After all partial fills
