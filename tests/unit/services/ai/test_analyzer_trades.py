"""Tests for analyzer-guided trade execution."""

import pytest
from decimal import Decimal
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from trading_agent.trading_bot.python.executor import (
    TradingExecutor,
    TradeOrder,
    OrderResult,
)
from shared.models.trading_factors import (
    TradingFactors,
    TradingAction,
    MarketRegime,
    RiskLevel,
    TechnicalAnalysis,
    MarketAnalysis,
    RiskAssessment,
)


@pytest.fixture
def executor():
    """Create trading executor instance."""
    return TradingExecutor()


@pytest.fixture
def mock_wallet_manager():
    """Mock wallet manager for testing."""
    with patch("trading_agent.trading_bot.python.executor.WalletManager") as mock:
        mock.return_value.transfer_tokens = AsyncMock(
            return_value={"signature": "mock_sig"}
        )
        yield mock.return_value


@pytest.fixture
def mock_trading_factors():
    """Create mock trading factors for testing."""
    return TradingFactors(
        timestamp=datetime.utcnow(),
        action=TradingAction.BUY,
        confidence=0.85,
        technical_analysis=TechnicalAnalysis(
            rsi=42.5,
            macd={"line": 0.0012, "signal": 0.0008, "histogram": 0.0004},
            moving_averages={"ma20": 50000, "ma50": 48000, "ma200": 45000},
            support_levels=[48000, 47000],
            resistance_levels=[52000, 53000],
        ),
        market_analysis=MarketAnalysis(
            regime=MarketRegime.TRENDING,
            volatility=0.02,
            liquidity=0.85,
            correlation=0.3,
            sentiment=0.7,
        ),
        risk_assessment=RiskAssessment(
            level=RiskLevel.MEDIUM,
            score=0.45,
            factors={"market_risk": 0.4, "volatility_risk": 0.5, "liquidity_risk": 0.3},
            max_position_size=1.0,
            stop_loss_pct=0.02,
        ),
        target_price=51000,
        stop_loss=49000,
        take_profit=53000,
    )


@pytest.mark.asyncio
async def test_trade_with_matching_analyzer_suggestion(
    executor, mock_wallet_manager, mock_trading_factors, caplog
):
    """Test trade execution when analyzer suggestion matches trade direction."""
    # Create order with matching direction
    order = TradeOrder(
        exchange="binance",
        symbol="BTC-USDT",
        side="buy",  # Matches mock_trading_factors.action
        type="limit",
        quantity=Decimal("2.0"),
        price=Decimal("50000"),
        leverage=None,
        stop_loss=None,
        take_profit=None,
        time_in_force="GTC",
        reduce_only=False,
        post_only=False,
        client_order_id="test123",
        metadata={
            "source": "market_maker",
            "analyzer_factors": mock_trading_factors.dict(),
        },
    )

    # Mock successful API response
    mock_response = {
        "orderId": "test123",
        "executedQty": "1.0",
        "price": "50000",
        "status": "FILLED",
    }

    with patch.object(executor, "session") as mock_session:
        mock_session.post = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value.status = 200
        mock_session.post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await executor.execute_order(order)

        # Verify trade was executed
        assert result.success is True
        assert result.order_id == "test123"
        # Verify quantity was adjusted based on max_position_size
        assert float(result.filled_quantity) == 1.0
        # Verify no warning logs about direction mismatch
        assert "differs from analyzer recommendation" not in caplog.text


@pytest.mark.asyncio
async def test_trade_with_conflicting_analyzer_suggestion(
    executor, mock_wallet_manager, mock_trading_factors, caplog
):
    """Test trade execution when analyzer suggestion conflicts with trade direction."""
    # Modify trading factors to recommend SELL
    mock_trading_factors.action = TradingAction.SELL

    order = TradeOrder(
        exchange="binance",
        symbol="BTC-USDT",
        side="buy",  # Conflicts with modified mock_trading_factors.action
        type="limit",
        quantity=Decimal("1.0"),
        price=Decimal("50000"),
        leverage=None,
        stop_loss=None,
        take_profit=None,
        time_in_force="GTC",
        reduce_only=False,
        post_only=False,
        client_order_id="test123",
        metadata={
            "source": "market_maker",
            "analyzer_factors": mock_trading_factors.dict(),
        },
    )

    # Mock successful API response
    mock_response = {
        "orderId": "test123",
        "executedQty": "1.0",
        "price": "50000",
        "status": "FILLED",
    }

    with patch.object(executor, "session") as mock_session:
        mock_session.post = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value.status = 200
        mock_session.post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await executor.execute_order(order)

        # Verify trade was still executed (warnings only)
        assert result.success is True
        assert result.order_id == "test123"
        # Verify warning was logged about direction mismatch
        assert "differs from analyzer recommendation" in caplog.text


@pytest.mark.asyncio
async def test_trade_with_low_confidence_suggestion(
    executor, mock_wallet_manager, mock_trading_factors, caplog
):
    """Test trade execution when analyzer confidence is below threshold."""
    # Modify trading factors to have low confidence
    mock_trading_factors.confidence = 0.5  # Below default 0.7 threshold

    order = TradeOrder(
        exchange="binance",
        symbol="BTC-USDT",
        side="buy",
        type="limit",
        quantity=Decimal("1.0"),
        price=Decimal("50000"),
        leverage=None,
        stop_loss=None,
        take_profit=None,
        time_in_force="GTC",
        reduce_only=False,
        post_only=False,
        client_order_id="test123",
        metadata={
            "source": "market_maker",
            "analyzer_factors": mock_trading_factors.dict(),
        },
    )

    # Mock successful API response
    mock_response = {
        "orderId": "test123",
        "executedQty": "1.0",
        "price": "50000",
        "status": "FILLED",
    }

    with patch.object(executor, "session") as mock_session:
        mock_session.post = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value.status = 200
        mock_session.post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await executor.execute_order(order)

        # Verify trade was still executed (warnings only)
        assert result.success is True
        assert result.order_id == "test123"
        # Verify warning was logged about low confidence
        assert "confidence" in caplog.text
        assert "below threshold" in caplog.text


@pytest.mark.asyncio
async def test_trade_quantity_adjustment_from_risk_assessment(
    executor, mock_wallet_manager, mock_trading_factors, caplog
):
    """Test trade quantity adjustment based on risk assessment max position size."""
    # Set max position size in risk assessment
    mock_trading_factors.risk_assessment.max_position_size = 0.5

    order = TradeOrder(
        exchange="binance",
        symbol="BTC-USDT",
        side="buy",
        type="limit",
        quantity=Decimal("1.0"),  # Above max_position_size
        price=Decimal("50000"),
        leverage=None,
        stop_loss=None,
        take_profit=None,
        time_in_force="GTC",
        reduce_only=False,
        post_only=False,
        client_order_id="test123",
        metadata={
            "source": "market_maker",
            "analyzer_factors": mock_trading_factors.dict(),
        },
    )

    # Mock successful API response
    mock_response = {
        "orderId": "test123",
        "executedQty": "0.5",  # Should be adjusted to max_position_size
        "price": "50000",
        "status": "FILLED",
    }

    with patch.object(executor, "session") as mock_session:
        mock_session.post = AsyncMock()
        mock_session.post.return_value.__aenter__.return_value.status = 200
        mock_session.post.return_value.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )

        result = await executor.execute_order(order)

        # Verify trade was executed with adjusted quantity
        assert result.success is True
        assert float(result.filled_quantity) == 0.5
        # Verify adjustment was logged
        assert "Adjusting quantity" in caplog.text
        assert "based on risk assessment" in caplog.text
