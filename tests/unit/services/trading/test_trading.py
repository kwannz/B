"""Test trading models."""

import time
from datetime import datetime, timedelta
from decimal import Decimal

from tradingbot.models.trading import Strategy, StrategyType, Trade, TradeStatus, Wallet


def test_trade_status_enum():
    """Test TradeStatus enum values."""
    assert TradeStatus.PENDING == "pending"
    assert TradeStatus.OPEN == "open"
    assert TradeStatus.CLOSED == "closed"
    assert TradeStatus.CANCELLED == "cancelled"
    assert TradeStatus.FAILED == "failed"

    # Test that all status values are strings
    for status in TradeStatus:
        assert isinstance(status, str)


def test_strategy_type_enum():
    """Test StrategyType enum values."""
    assert StrategyType.TECHNICAL_ANALYSIS == "technical_analysis"
    assert StrategyType.MEAN_REVERSION == "mean_reversion"
    assert StrategyType.MOMENTUM == "momentum"
    assert StrategyType.MARKET_MAKING == "market_making"
    assert StrategyType.EARLY_ENTRY == "early_entry"
    assert StrategyType.SOCIAL_SENTIMENT == "social_sentiment"
    assert StrategyType.CAPITAL_ROTATION == "capital_rotation"
    assert StrategyType.MULTI_TOKEN_MONITORING == "multi_token_monitoring"
    assert StrategyType.BATCH_POSITION == "batch_position"

    # Test that all strategy types are strings
    for strategy_type in StrategyType:
        assert isinstance(strategy_type, str)


def test_wallet_init():
    """Test wallet initialization."""
    tenant_id = "test_tenant"
    address = "0x123"
    chain = "ethereum"
    balance = Decimal("1.23")

    wallet = Wallet(tenant_id=tenant_id, address=address, chain=chain, balance=balance)

    assert wallet.id == f"{tenant_id}_{address}"
    assert wallet.tenant_id == tenant_id
    assert wallet.address == address
    assert wallet.chain == chain
    assert wallet.balance == balance
    assert wallet.is_active is True
    assert isinstance(wallet.created_at, datetime)
    assert isinstance(wallet.updated_at, datetime)
    # Verify timestamps are within 1 second
    assert abs(wallet.created_at - wallet.updated_at) < timedelta(seconds=1)


def test_wallet_init_inactive():
    """Test wallet initialization with inactive status."""
    wallet = Wallet(
        tenant_id="test",
        address="0x123",
        chain="ethereum",
        balance=Decimal("1.23"),
        is_active=False,
    )
    assert wallet.is_active is False


def test_strategy_init():
    """Test strategy initialization."""
    tenant_id = "test_tenant"
    name = "test_strategy"
    strategy_type = StrategyType.MOMENTUM
    parameters = {"param1": "value1"}

    strategy = Strategy(
        tenant_id=tenant_id,
        name=name,
        strategy_type=strategy_type,
        parameters=parameters,
    )

    assert strategy.id == f"{tenant_id}_{name}"
    assert strategy.tenant_id == tenant_id
    assert strategy.name == name
    assert strategy.strategy_type == strategy_type
    assert strategy.parameters == parameters
    assert strategy.is_active is True
    assert isinstance(strategy.created_at, datetime)
    assert isinstance(strategy.updated_at, datetime)
    # Verify timestamps are within 1 second
    assert abs(strategy.created_at - strategy.updated_at) < timedelta(seconds=1)


def test_strategy_init_no_parameters():
    """Test strategy initialization without parameters."""
    strategy = Strategy(
        tenant_id="test", name="test_strategy", strategy_type=StrategyType.MOMENTUM
    )
    assert strategy.parameters == {}


def test_strategy_init_inactive():
    """Test strategy initialization with inactive status."""
    strategy = Strategy(
        tenant_id="test",
        name="test_strategy",
        strategy_type=StrategyType.MOMENTUM,
        is_active=False,
    )
    assert strategy.is_active is False


def test_trade_init():
    """Test trade initialization."""
    tenant_id = "test_tenant"
    wallet_id = "test_wallet"
    pair = "BTC/USD"
    side = "buy"
    amount = Decimal("1.0")
    price = Decimal("50000.0")
    strategy_id = "test_strategy"
    trade_metadata = {"meta1": "value1"}

    trade = Trade(
        tenant_id=tenant_id,
        wallet_id=wallet_id,
        pair=pair,
        side=side,
        amount=amount,
        price=price,
        strategy_id=strategy_id,
        trade_metadata=trade_metadata,
    )

    assert trade.tenant_id == tenant_id
    assert trade.wallet_id == wallet_id
    assert trade.pair == pair
    assert trade.side == side
    assert trade.amount == amount
    assert trade.price == price
    assert trade.status == TradeStatus.PENDING
    assert trade.strategy_id == strategy_id
    assert trade.trade_metadata == trade_metadata
    assert isinstance(trade.created_at, datetime)
    assert isinstance(trade.updated_at, datetime)
    # Verify timestamps are within 1 second
    assert abs(trade.created_at - trade.updated_at) < timedelta(seconds=1)


def test_trade_init_no_metadata():
    """Test trade initialization without metadata."""
    trade = Trade(
        tenant_id="test",
        wallet_id="test_wallet",
        pair="BTC/USD",
        side="buy",
        amount=Decimal("1.0"),
        price=Decimal("50000.0"),
    )
    assert trade.trade_metadata == {}
    assert trade.strategy_id is None


def test_trade_init_with_status():
    """Test trade initialization with specific status."""
    trade = Trade(
        tenant_id="test",
        wallet_id="test_wallet",
        pair="BTC/USD",
        side="buy",
        amount=Decimal("1.0"),
        price=Decimal("50000.0"),
        status=TradeStatus.OPEN,
    )
    assert trade.status == TradeStatus.OPEN
