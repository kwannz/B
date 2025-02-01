"""Unit tests for market making strategy."""

import pytest
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator
from sqlalchemy.orm import Session

from tradingbot.shared.strategies.market_making import MarketMakingStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import get_tenant_session, tenant_session

logger = logging.getLogger(__name__)


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type=StrategyType.MARKET_MAKING.value,
        parameters={
            "min_spread": 0.01,  # 1% minimum spread
            "max_spread": 0.05,  # 5% maximum spread
            "order_size": 100.0,
            "max_inventory": 1000.0,
            "rebalance_threshold": 0.8,  # 80% of max inventory
        },
    )


@pytest.fixture
def mock_market_data():
    """Create mock market data."""
    base_time = datetime.utcnow()
    return [
        {
            "pair": "TEST/USDT",
            "price": float(i),
            "volume": 15000,
            "timestamp": (base_time - timedelta(minutes=i)).isoformat(),
        }
        for i in range(100, 0, -1)
    ]


@pytest.fixture
def test_tenant(db_session: Session) -> Generator[Tenant, None, None]:
    """Create test tenant."""
    timestamp = int(datetime.utcnow().replace(tzinfo=None).timestamp())
    tenant = Tenant(
        name=f"Test Tenant {timestamp}",
        api_key=f"test_api_key_{timestamp}",
        status=TenantStatus.ACTIVE,
    )
    db_session.add(tenant)
    db_session.flush()  # Get ID without committing
    db_session.refresh(tenant)

    yield tenant

    try:
        db_session.delete(tenant)
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture
def test_wallet(
    db_session: Session, test_tenant: Tenant
) -> Generator[Wallet, None, None]:
    """Create test wallet."""
    timestamp = int(datetime.utcnow().replace(tzinfo=None).timestamp())
    wallet = Wallet(
        tenant_id=test_tenant.id,
        address=f"test_wallet_{timestamp}",
        chain="solana",
        balance=Decimal("1000.0"),
        is_active=True,
    )
    db_session.add(wallet)
    db_session.flush()  # Get ID without committing
    db_session.refresh(wallet)

    yield wallet

    try:
        db_session.delete(wallet)
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture
def test_strategy(test_tenant, strategy_config):
    """Create test strategy."""
    with get_tenant_session() as session:
        strategy = Strategy(
            tenant_id=test_tenant.id,
            name="Test Strategy",
            strategy_type=StrategyType.MARKET_MAKING,
            is_active=True,
        )
        strategy.config = strategy_config.parameters
        session.add(strategy)
        session.commit()
        return strategy


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = MarketMakingStrategy(strategy_config)
    assert strategy.min_spread == 0.01
    assert strategy.max_spread == 0.05
    assert strategy.order_size == 100.0
    assert strategy.max_inventory == 1000.0
    assert strategy.rebalance_threshold == 0.8


async def test_spread_calculation(strategy_config, mock_market_data):
    """Test spread calculation based on volatility."""
    strategy = MarketMakingStrategy(strategy_config)
    signal = await strategy.calculate_signals(mock_market_data)

    assert signal is not None
    assert "bid_price" in signal
    assert "ask_price" in signal
    assert "spread" in signal
    assert strategy.min_spread <= signal["spread"] <= strategy.max_spread


async def test_inventory_management(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test inventory management and rebalancing."""
    strategy = MarketMakingStrategy(strategy_config)

    # Create test trades to simulate inventory
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.id,
        "pair": mock_market_data[0]["pair"],
        "side": "buy",
        "amount": 800.0,  # Near rebalance threshold
        "price": mock_market_data[0]["price"],
        "status": TradeStatus.OPEN.value,
        "strategy_id": int(test_strategy.id),
    }

    with get_tenant_session() as session:
        trade = Trade(**trade_data)
        session.add(trade)
        session.flush()  # Ensure trade is persisted

        # Test rebalancing signal
        signal = await strategy.calculate_signals(mock_market_data)
        assert signal["signal"] == "sell"  # Should suggest selling to rebalance
        assert signal["confidence"] > 0.8  # High confidence due to inventory imbalance
        session.commit()


async def test_trade_execution(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test trade execution."""
    strategy = MarketMakingStrategy(strategy_config)

    # Generate signal
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] in ["buy", "sell", "neutral"]

    if signal["signal"] != "neutral":
        # Execute trade
        trade = await strategy.execute_trade(
            tenant_id=test_tenant.id,
            wallet=test_wallet,
            market_data=mock_market_data[-1],
            signal=signal,
        )

        assert trade is not None
        assert trade["status"] == TradeStatus.PENDING.value
        assert trade["side"] == signal["signal"]
        assert "bid_price" in trade["trade_metadata"]
        assert "ask_price" in trade["trade_metadata"]
        assert "spread" in trade["trade_metadata"]
        assert "inventory" in trade["trade_metadata"]


async def test_position_updates(
    strategy_config, mock_market_data, test_tenant, test_wallet, test_strategy
):
    """Test position updates and profit taking."""
    strategy = MarketMakingStrategy(strategy_config)

    # Create test trade
    entry_price = mock_market_data[0]["price"]
    trade_data = {
        "tenant_id": test_tenant.id,
        "wallet_id": test_wallet.id,
        "pair": mock_market_data[0]["pair"],
        "side": "buy",
        "amount": 100.0,
        "price": entry_price,
        "status": TradeStatus.OPEN.value,
        "strategy_id": test_strategy.id,
        "trade_metadata": {
            "entry_price": entry_price,
            "target_profit": strategy.max_spread,
        },
    }

    with get_tenant_session() as session:
        # Create initial trade
        trade = Trade(**trade_data)
        session.add(trade)
        session.flush()  # Ensure trade is created

        # Test profit taking
        mock_market_data[0]["price"] = entry_price * (1 + strategy.max_spread + 0.01)
        await strategy.update_positions(
            tenant_id=test_tenant.id, market_data=mock_market_data[0]
        )

        # Verify trade was closed with profit
        session.refresh(trade)  # Refresh to get latest state
        assert trade.status == TradeStatus.CLOSED.value
        assert float(trade.execution_price) > float(entry_price)

        session.commit()
