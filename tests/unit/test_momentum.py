"""Unit tests for momentum trading strategy."""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator

import pytest
from sqlalchemy.orm import Session

from tradingbot.app.db.session import get_tenant_session, tenant_session
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.models.trading import Strategy, StrategyType, Trade, TradeStatus, Wallet
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.shared.strategies.momentum import MomentumStrategy

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type="momentum",
        parameters={
            "rsi_period": 14,
            "rsi_overbought": 70,
            "rsi_oversold": 30,
            "sma_fast_period": 20,
            "sma_slow_period": 50,
            "min_volume": 10000,
            "position_size": 1.0,
        },
    )


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


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = MomentumStrategy(strategy_config)
    assert strategy.rsi_period == 14
    assert strategy.rsi_overbought == 70
    assert strategy.rsi_oversold == 30
    assert strategy.sma_fast_period == 20
    assert strategy.sma_slow_period == 50
    assert strategy.min_volume == 10000


async def test_signal_generation(strategy_config, mock_market_data):
    """Test trading signal generation."""
    strategy = MomentumStrategy(strategy_config)
    signal = await strategy.calculate_signals(mock_market_data)

    assert signal is not None
    assert "signal" in signal
    assert signal["signal"] in ["buy", "sell", "neutral"]
    assert "confidence" in signal
    assert 0 <= signal["confidence"] <= 1.0


async def test_insufficient_volume(strategy_config, mock_market_data):
    """Test behavior with insufficient volume."""
    strategy = MomentumStrategy(strategy_config)

    # Set volume below threshold
    for data in mock_market_data:
        data["volume"] = 5000

    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_volume" in signal["reason"]


async def test_insufficient_data(strategy_config):
    """Test behavior with insufficient data points."""
    strategy = MomentumStrategy(strategy_config)

    # Test with empty data
    signal = await strategy.calculate_signals([])
    assert signal["signal"] == "neutral"
    assert "insufficient_data" in signal["reason"]

    # Test with insufficient data points
    short_data = [
        {
            "pair": "TEST/USDT",
            "price": 1.0,
            "volume": 15000,
            "timestamp": datetime.utcnow().isoformat(),
        }
    ]
    signal = await strategy.calculate_signals(short_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_data" in signal["reason"]


async def test_trade_execution(
    strategy_config, mock_market_data, test_tenant, test_wallet
):
    """Test trade execution."""
    strategy = MomentumStrategy(strategy_config)

    # Generate signal
    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] in ["buy", "sell", "neutral"]

    if signal["signal"] != "neutral":
        # Execute trade
        trade = await strategy.execute_trade(
            tenant_id=test_tenant.id,
            wallet=test_wallet,
            market_data={"pair": "TEST/USDT", "price": 1.0, "amount": 1000},
            signal=signal,
        )

        assert trade is not None
        assert trade["status"] == TradeStatus.PENDING
        assert trade["side"] == signal["signal"]
        assert "momentum_metrics" in trade["trade_metadata"]
        assert "rsi" in trade["trade_metadata"]["momentum_metrics"]
        assert "sma_fast" in trade["trade_metadata"]["momentum_metrics"]
        assert "sma_slow" in trade["trade_metadata"]["momentum_metrics"]


async def test_position_management(
    strategy_config, mock_market_data, test_tenant, test_wallet
):
    """Test position management."""
    strategy = MomentumStrategy(strategy_config)

    # Test position updates
    await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[-1]
    )
    # Note: Actual position updates are tested through integration tests
    # Here we verify the method runs without errors


async def test_trend_reversal(strategy_config, mock_market_data):
    """Test trend reversal detection."""
    strategy = MomentumStrategy(strategy_config)

    # Create strong uptrend with RSI conditions
    base_price = 100.0
    for i, data in enumerate(mock_market_data[:30]):
        # Create oscillating prices with strong uptrend
        # Use moderate exponential growth for more realistic trend
        trend = (1.03**i) - 1  # More moderate exponential growth (3% per step)
        oscillation = 0.002 * (-1 if i % 2 == 0 else 1)  # 0.2% oscillation
        price = base_price * (1.0 + trend + oscillation)
        data["price"] = price
        logger.info(
            f"Generated price {i}: {price:.2f} (trend: +{trend*100:.1f}%, osc: {oscillation*100:+.1f}%)"
        )

    signal = await strategy.calculate_signals(mock_market_data[:30])
    logger.info(f"Signal metrics: {signal.get('momentum_metrics', {})}")
    assert (
        signal["signal"] == "buy"
    ), f"Expected buy signal, got {signal['signal']} with metrics {signal.get('momentum_metrics', {})}"
    assert (
        signal["confidence"] > 0.5
    ), f"Expected confidence > 0.5, got {signal['confidence']}"

    # Create strong downtrend with RSI conditions
    for i, data in enumerate(mock_market_data[30:]):
        # Create oscillating prices with strong downtrend
        # Use moderate exponential decay for more realistic trend
        trend = (0.97**i) - 1  # More moderate exponential decay (3% per step)
        oscillation = 0.002 * (-1 if i % 2 == 0 else 1)  # 0.2% oscillation
        price = base_price * (1.0 + trend + oscillation)
        data["price"] = price
        logger.info(
            f"Generated price {i}: {price:.2f} (trend: {trend*100:.1f}%, osc: {oscillation*100:+.1f}%)"
        )

    signal = await strategy.calculate_signals(mock_market_data)
    assert (
        signal["signal"] == "sell"
    ), f"Expected sell signal, got {signal['signal']} with metrics {signal.get('momentum_metrics', {})}"
    assert (
        signal["confidence"] > 0.5
    ), f"Expected confidence > 0.5, got {signal['confidence']}"
