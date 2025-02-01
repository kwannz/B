"""Unit tests for mean reversion trading strategy."""

import pytest
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator
from sqlalchemy.orm import Session

from tradingbot.shared.strategies.mean_reversion import MeanReversionStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import Trade, TradeStatus, Strategy, StrategyType, Wallet
from tradingbot.models.tenant import Tenant, TenantStatus
from tradingbot.app.db.session import get_tenant_session, tenant_session

logger = logging.getLogger(__name__)


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type="mean_reversion",
        parameters={
            "bollinger_period": 20,
            "bollinger_std": 2.0,
            "min_volume": 10000,
            "position_size": 1.0,
            "profit_target": 0.02,  # 2%
            "stop_loss": 0.01,  # 1%
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
    strategy = MeanReversionStrategy(strategy_config)
    assert strategy.window_size == 20
    assert strategy.num_std == 2.0
    assert strategy.min_volume == 10000
    assert strategy.position_size == 1.0


async def test_signal_generation(strategy_config, mock_market_data):
    """Test trading signal generation."""
    strategy = MeanReversionStrategy(strategy_config)
    signal = await strategy.calculate_signals(mock_market_data)

    assert signal is not None
    assert "signal" in signal
    assert signal["signal"] in ["buy", "sell", "neutral"]
    assert "confidence" in signal
    assert 0 <= signal["confidence"] <= 1.0


async def test_insufficient_volume(strategy_config, mock_market_data):
    """Test behavior with insufficient volume."""
    strategy = MeanReversionStrategy(strategy_config)

    # Set volume below threshold
    for data in mock_market_data:
        data["volume"] = 5000

    signal = await strategy.calculate_signals(mock_market_data)
    assert signal["signal"] == "neutral"
    assert "insufficient_volume" in signal["reason"]


async def test_insufficient_data(strategy_config):
    """Test behavior with insufficient data points."""
    strategy = MeanReversionStrategy(strategy_config)

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
    strategy = MeanReversionStrategy(strategy_config)

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
        assert "mean_reversion_metrics" in trade["trade_metadata"]
        assert "upper_band" in trade["trade_metadata"]["mean_reversion_metrics"]
        assert "lower_band" in trade["trade_metadata"]["mean_reversion_metrics"]
        assert "middle_band" in trade["trade_metadata"]["mean_reversion_metrics"]


async def test_position_management(
    strategy_config, mock_market_data, test_tenant, test_wallet
):
    """Test position management."""
    strategy = MeanReversionStrategy(strategy_config)

    # Test position updates
    await strategy.update_positions(
        tenant_id=test_tenant.id, market_data=mock_market_data[-1]
    )
    # Note: Actual position updates are tested through integration tests
    # Here we verify the method runs without errors


async def test_mean_reversion_signals(strategy_config, mock_market_data):
    """Test mean reversion signal generation."""
    strategy = MeanReversionStrategy(strategy_config)

    # Create price history with clear trend
    base_price = 100.0
    prices = []

    # First establish a stable baseline (20 periods)
    for i in range(20):
        prices.append(base_price + (i * 0.5))  # Slight upward drift

    # Create initial uptrend (5 periods)
    trend_start = prices[-1]
    for i in range(5):
        trend = 0.2 * (i + 1)  # 20-100% increases
        prices.append(trend_start * (1 + trend))

    # Create extreme surge (3 periods)
    surge_start = prices[-1]
    for i in range(3):
        # Create more extreme exponential surge
        surge = 3.0 ** (i + 1)  # 300%, 900%, 2700% increases
        prices.append(surge_start * (1 + surge))

    # Log the final prices for debugging
    logger.info(f"Price sequence: {[round(p, 2) for p in prices[-10:]]}")
    logger.info(
        f"Final price increase: {((prices[-1] - base_price) / base_price * 100):.2f}%"
    )

    # Create test data
    test_data = []
    base_time = datetime.utcnow()
    for i, price in enumerate(prices):
        test_data.append(
            {
                "pair": "TEST/USDT",
                "price": price,
                "volume": 50000,  # Sufficient volume
                "timestamp": (
                    base_time - timedelta(minutes=len(prices) - i)
                ).isoformat(),
            }
        )

    # Log the test data for debugging
    logger.info(f"Test data prices: {[round(p, 2) for p in prices[-10:]]}")

    # Test overbought condition
    signal = await strategy.calculate_signals(test_data)
    assert (
        signal["signal"] == "sell"
    ), f"Expected 'sell' signal but got '{signal['signal']}' with price {test_data[-1]['price']}"
    assert (
        signal["confidence"] > 0.5
    ), f"Expected confidence > 0.5 but got {signal['confidence']}"

    # Create oversold condition
    oversold_data = test_data.copy()
    for i in range(5):
        oversold_data.append(
            {
                "pair": "TEST/USDT",
                "price": test_data[-1]["price"] * (0.8 - 0.02 * i),  # Sharp decline
                "volume": 50000,
                "timestamp": (base_time + timedelta(minutes=i + 1)).isoformat(),
            }
        )

    signal = await strategy.calculate_signals(oversold_data)
    assert (
        signal["signal"] == "buy"
    ), f"Expected 'buy' signal but got '{signal['signal']}' with price {oversold_data[-1]['price']}"
    assert (
        signal["confidence"] > 0.5
    ), f"Expected confidence > 0.5 but got {signal['confidence']}"


async def test_profit_target_stop_loss(strategy_config, mock_market_data):
    """Test profit target and stop loss handling."""
    strategy = MeanReversionStrategy(strategy_config)

    # Create trade at price 100
    initial_price = 100.0
    mock_market_data[-1]["price"] = initial_price

    signal = await strategy.calculate_signals(mock_market_data)
    if signal["signal"] != "neutral":
        trade = await strategy.execute_trade(
            tenant_id=test_tenant.id,
            wallet=test_wallet,
            market_data={"pair": "TEST/USDT", "price": initial_price, "amount": 1000},
            signal=signal,
        )

        # Test profit target
        mock_market_data[-1]["price"] = initial_price * (
            1 + strategy.profit_target + 0.01
        )
        await strategy.update_positions(
            test_tenant.id, market_data=mock_market_data[-1]
        )

        # Test stop loss
        mock_market_data[-1]["price"] = initial_price * (1 - strategy.stop_loss - 0.01)
        await strategy.update_positions(
            test_tenant.id, market_data=mock_market_data[-1]
        )
