"""Unit tests for technical analysis strategy."""

import pytest
from unittest import mock

pytestmark = pytest.mark.asyncio
from datetime import datetime, timedelta
import numpy as np

from tradingbot.shared.strategies.technical_analysis import TechnicalAnalysisStrategy
from tradingbot.shared.config.tenant_config import StrategyConfig
from tradingbot.models.trading import TradeStatus


@pytest.fixture
def strategy_config():
    """Create test strategy configuration."""
    return StrategyConfig(
        strategy_type="technical_analysis",
        parameters={
            "rsi_period": 14,
            "rsi_overbought": 70,
            "rsi_oversold": 30,
            "ma_short_period": 10,
            "ma_long_period": 20,
            "timeframe": "30m",
            "min_volume": 1000,
        },
    )


@pytest.fixture
def market_data():
    """Create test market data."""
    base_time = datetime(2025, 1, 1, 0, 0, 0)  # Fixed time
    data = []
    price = 100.0

    # Generate data points from oldest to newest
    for i in range(50):
        timestamp = base_time + timedelta(minutes=30 * i)  # Increment by 30 minutes
        data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
        price *= 1 + np.random.normal(0, 0.02)  # 2% standard deviation

    return data  # Ordered from oldest to newest


@pytest.fixture
def minimal_market_data():
    """Create minimal market data for edge cases."""
    base_time = datetime(2025, 1, 1, 0, 0, 0)  # Fixed time
    data = []
    price = 100.0

    # Generate enough data points for indicators
    for i in range(30):  # Enough data points for indicators
        timestamp = base_time + timedelta(minutes=30 * i)
        data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 500,  # Below min_volume
                "pair": "TEST/USDT",
            }
        )
        price *= 1 + np.random.normal(0, 0.02)  # Add some price movement
    return data


async def test_strategy_initialization(strategy_config):
    """Test strategy initialization."""
    strategy = TechnicalAnalysisStrategy(strategy_config)
    assert strategy.rsi_period == 14
    assert strategy.rsi_overbought == 70
    assert strategy.rsi_oversold == 30
    assert strategy.ma_short_period == 10
    assert strategy.ma_long_period == 20
    assert strategy.timeframe == "30m"
    assert strategy.min_volume == 1000


async def test_strategy_initialization_invalid_config():
    """Test strategy initialization with invalid config."""
    invalid_config = StrategyConfig(
        strategy_type="technical_analysis",
        parameters={
            "rsi_period": -1,  # Invalid
            "rsi_overbought": 150,  # Invalid
            "rsi_oversold": -10,  # Invalid
            "ma_short_period": 0,  # Invalid
            "ma_long_period": 5,  # Invalid (shorter than short period)
            "timeframe": "invalid",
            "min_volume": -100,  # Invalid
        },
    )

    with pytest.raises(ValueError):
        TechnicalAnalysisStrategy(invalid_config)

    # Test with missing parameters
    empty_config = StrategyConfig(strategy_type="technical_analysis", parameters={})
    strategy = TechnicalAnalysisStrategy(empty_config)
    assert strategy.rsi_period == 14  # Default value

    # Test parameter validation errors
    with pytest.raises(ValueError, match="must be a positive integer"):
        strategy._validate_positive_int("abc", "test_param")
    with pytest.raises(ValueError, match="must be a positive integer"):
        strategy._validate_positive_int(0, "test_param")
    with pytest.raises(ValueError, match="must be a positive integer"):
        strategy._validate_positive_int(-1.5, "test_param")

    with pytest.raises(ValueError, match="must be a positive number"):
        strategy._validate_positive_float("abc", "test_param")
    with pytest.raises(ValueError, match="must be a positive number"):
        strategy._validate_positive_float(0, "test_param")
    with pytest.raises(ValueError, match="must be a positive number"):
        strategy._validate_positive_float(-1.5, "test_param")

    with pytest.raises(ValueError, match="must be between 0 and 100"):
        strategy._validate_rsi_level("abc", "test_param")
    with pytest.raises(ValueError, match="must be between 0 and 100"):
        strategy._validate_rsi_level(-1, "test_param")
    with pytest.raises(ValueError, match="must be between 0 and 100"):
        strategy._validate_rsi_level(None, "test_param")

    # Test with equal MA periods
    equal_ma_config = StrategyConfig(
        strategy_type="technical_analysis",
        parameters={"ma_short_period": 10, "ma_long_period": 10},
    )
    TechnicalAnalysisStrategy(equal_ma_config)  # Should not raise error


async def test_rsi_calculation(strategy_config):
    """Test RSI calculation."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test with rising prices
    prices = [100.0 * (1.01**i) for i in range(20)]  # 1% increase each period
    rsi = strategy._calculate_rsi(prices)
    assert rsi > 70  # Should be overbought

    # Test with falling prices
    prices = [100.0 * (0.99**i) for i in range(20)]  # 1% decrease each period
    rsi = strategy._calculate_rsi(prices)
    assert rsi < 30  # Should be oversold

    # Test with flat prices
    prices = [100.0] * 20
    rsi = strategy._calculate_rsi(prices)
    assert 45 <= rsi <= 55  # Should be neutral

    # Test with insufficient data
    prices = [100.0] * 5  # Less than RSI period
    rsi = strategy._calculate_rsi(prices)
    assert rsi is None

    # Test with only gains
    prices = [100.0 + i for i in range(15)]
    rsi = strategy._calculate_rsi(prices)
    assert rsi == 100.0

    # Test with only losses
    prices = [100.0 - i for i in range(15)]
    rsi = strategy._calculate_rsi(prices)
    assert rsi is not None

    # Test with only losses (no gains)
    prices = [100.0 - i for i in range(20)]  # Continuously decreasing
    rsi = strategy._calculate_rsi(prices)
    assert rsi == 0.0  # Should be oversold

    # Test with mixed movements
    prices = [100.0 + (i % 2) * 0.1 for i in range(20)]  # Alternating movements
    rsi = strategy._calculate_rsi(prices)
    assert 0 < rsi < 100


async def test_ma_calculation(strategy_config):
    """Test Moving Average calculation."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test with linear price increase
    prices = [100.0 + i for i in range(30)]
    ma_short = strategy._calculate_ma(prices, strategy.ma_short_period)
    ma_long = strategy._calculate_ma(prices, strategy.ma_long_period)
    assert ma_short > ma_long  # Short MA should be higher in uptrend

    # Test with linear price decrease
    prices = [100.0 - i for i in range(30)]
    ma_short = strategy._calculate_ma(prices, strategy.ma_short_period)
    ma_long = strategy._calculate_ma(prices, strategy.ma_long_period)
    assert ma_short < ma_long  # Short MA should be lower in downtrend

    # Test with insufficient data
    prices = [100.0] * 5
    ma = strategy._calculate_ma(prices, 10)
    assert ma is None


async def test_signal_generation(strategy_config, market_data):
    """Test trading signal generation."""
    strategy = TechnicalAnalysisStrategy(strategy_config)
    signal = await strategy.calculate_signals(market_data)

    assert "signal" in signal
    assert "confidence" in signal
    assert "rsi" in signal
    assert "ma_short" in signal
    assert "ma_long" in signal
    assert signal["signal"] in ["buy", "sell", "neutral"]
    assert 0 <= signal["confidence"] <= 1.0


async def test_signal_generation_edge_cases(strategy_config, minimal_market_data):
    """Test signal generation with edge cases."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test with insufficient volume
    signal = await strategy.calculate_signals(minimal_market_data)
    assert signal["signal"] == "neutral"
    assert "error: insufficient volume" in signal.get("reason")

    # Test with empty data
    signal = await strategy.calculate_signals([])
    assert signal["signal"] == "neutral"
    assert "error: no data" in signal.get("reason")

    # Test with None data
    signal = await strategy.calculate_signals(None)
    assert signal["signal"] == "neutral"
    assert "error: invalid data" in signal.get("reason")

    # Test with invalid data format
    signal = await strategy.calculate_signals([{"invalid": "data"}])
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test with general exception
    signal = await strategy.calculate_signals([None])
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test with invalid price type
    invalid_price_data = [
        {
            "timestamp": datetime(2025, 1, 1).isoformat(),
            "price": "not_a_number",
        }
    ]
    signal = await strategy.calculate_signals(invalid_price_data)
    assert "error:" in signal.get("reason")


async def test_timeframe_filtering(strategy_config):
    """Test timeframe filtering."""
    strategy = TechnicalAnalysisStrategy(strategy_config)
    base_time = datetime(2025, 1, 1, 0, 0, 0)  # Use fixed time
    data = []
    price = 100.0

    # Create data points with wrong interval but enough data
    for i in range(30):  # Enough data points for indicators
        timestamp = base_time + timedelta(minutes=15 * i)  # Wrong interval
        data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
        price *= 1 + np.random.normal(0, 0.02)  # Add some price movement

    signal = await strategy.calculate_signals(data)
    assert signal["signal"] == "neutral"
    assert "error: no data for timeframe" in signal.get("reason")

    # Test with invalid timestamp
    data[0]["timestamp"] = "invalid"
    signal = await strategy.calculate_signals(data)
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")


async def test_error_handling(strategy_config):
    """Test error handling scenarios."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test with invalid market data format
    invalid_data = [{"invalid": "data"}]
    signal = await strategy.calculate_signals(invalid_data)
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test with None in market data
    signal = await strategy.calculate_signals(None)
    assert signal["signal"] == "neutral"
    assert "error: invalid data" in signal.get("reason")

    # Test with invalid timestamp format
    invalid_timestamp_data = [
        {
            "timestamp": "invalid_time",
            "price": 100.0,
            "volume": 2000,
            "pair": "TEST/USDT",
        }
    ]
    signal = await strategy.calculate_signals(invalid_timestamp_data)
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test timeframe validation with invalid data
    assert not strategy._is_valid_timeframe([{"invalid": "data"}])
    assert not strategy._is_valid_timeframe([])

    # Test divergence detection with insufficient data
    assert strategy._check_divergence([1.0, 2.0], [50.0]) is None
    assert strategy._check_divergence([], []) is None

    # Test position management with invalid price
    with pytest.raises(ValueError, match="Market data cannot be None"):
        await strategy.update_positions("test_tenant", None)
    with pytest.raises(ValueError, match="Invalid price"):
        await strategy.update_positions("test_tenant", {"price": "invalid"})
    with pytest.raises(ValueError, match="Invalid price"):
        await strategy.update_positions("test_tenant", {"price": None})
    with pytest.raises(ValueError, match="Invalid price"):
        await strategy.update_positions("test_tenant", {})

    # Test with invalid timeframe data
    invalid_timeframe_data = [{"timestamp": "invalid_format"}]
    assert not strategy._is_valid_timeframe(invalid_timeframe_data)

    # Test timeframe conversion
    strategy.timeframe = "1m"
    assert strategy._timeframe_to_minutes() == 1
    assert strategy._get_timeframe_delta() == timedelta(minutes=1)

    strategy.timeframe = "1h"
    assert strategy._timeframe_to_minutes() == 60
    assert strategy._get_timeframe_delta() == timedelta(hours=1)

    strategy.timeframe = "1d"
    assert strategy._timeframe_to_minutes() == 1440
    assert strategy._get_timeframe_delta() == timedelta(days=1)

    # Test with invalid timeframe unit
    strategy.timeframe = "1w"  # Invalid unit
    assert strategy._timeframe_to_minutes() == 1440  # Default to daily if invalid unit


async def test_trade_execution(strategy_config, market_data):
    """Test trade execution."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test buy signal
    buy_signal = {
        "signal": "buy",
        "confidence": 0.8,
        "rsi": 25,
        "ma_short": 105,
        "ma_long": 100,
        "volume": 2000,
    }

    trade = await strategy.execute_trade(
        tenant_id="test_tenant",
        wallet={"address": "test_wallet"},
        market_data={"pair": "TEST/USDT", "price": 100.0, "amount": 1.0},
        signal=buy_signal,
    )

    assert trade is not None
    assert trade["side"] == "buy"
    assert trade["status"] == TradeStatus.PENDING
    assert trade["amount"] == 0.8  # Adjusted by confidence
    assert "trade_metadata" in trade
    assert trade["trade_metadata"]["rsi"] == 25

    # Test sell signal
    sell_signal = {
        "signal": "sell",
        "confidence": 0.9,
        "rsi": 75,
        "ma_short": 95,
        "ma_long": 100,
        "volume": 2000,
    }

    trade = await strategy.execute_trade(
        tenant_id="test_tenant",
        wallet={"address": "test_wallet"},
        market_data={"pair": "TEST/USDT", "price": 100.0, "amount": 1.0},
        signal=sell_signal,
    )

    assert trade is not None
    assert trade["side"] == "sell"
    assert trade["status"] == TradeStatus.PENDING
    assert trade["amount"] == 0.9  # Adjusted by confidence

    # Test neutral signal
    neutral_signal = {
        "signal": "neutral",
        "confidence": 0.5,
        "rsi": 50,
        "ma_short": 100,
        "ma_long": 100,
        "volume": 2000,
    }

    trade = await strategy.execute_trade(
        tenant_id="test_tenant",
        wallet={"address": "test_wallet"},
        market_data={"pair": "TEST/USDT", "price": 100.0, "amount": 1.0},
        signal=neutral_signal,
    )

    assert trade is None


async def test_position_management(strategy_config, market_data):
    """Test position management."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test strong uptrend
    market_data[-1]["price"] = 120.0
    await strategy.update_positions(
        tenant_id="test_tenant", market_data=market_data[-1]
    )

    # Test strong downtrend
    market_data[-1]["price"] = 80.0
    await strategy.update_positions(
        tenant_id="test_tenant", market_data=market_data[-1]
    )

    # Test with invalid market data
    with pytest.raises(ValueError):
        await strategy.update_positions(tenant_id="test_tenant", market_data=None)


async def test_signal_combination_scenarios(strategy_config):
    """Test all possible signal combination scenarios."""
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # RSI oversold + MA bullish cross
    prices = [100.0 * (0.99**i) for i in range(30)]  # Downtrend for RSI
    prices.extend([100.0 * (1.01**i) for i in range(10)])  # Recent uptrend for MA

    rsi = strategy._calculate_rsi(prices)
    ma_short = strategy._calculate_ma(prices[-15:], strategy.ma_short_period)
    ma_long = strategy._calculate_ma(prices, strategy.ma_long_period)

    assert rsi < strategy.rsi_oversold
    assert ma_short > ma_long

    # RSI overbought + MA bearish cross
    prices = [100.0 * (1.01**i) for i in range(30)]  # Uptrend for RSI
    prices.extend([100.0 * (0.99**i) for i in range(10)])  # Recent downtrend for MA

    rsi = strategy._calculate_rsi(prices)
    ma_short = strategy._calculate_ma(prices[-15:], strategy.ma_short_period)
    ma_long = strategy._calculate_ma(prices, strategy.ma_long_period)

    assert rsi > strategy.rsi_overbought
    assert ma_short < ma_long

    # Test signal generation with strong buy conditions
    base_time = datetime(2025, 1, 1, 0, 0, 0)
    data = []
    price = 100.0

    # Create price pattern for oversold conditions
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        if i < 20:  # First 20 points trend down
            price *= 0.99  # Strong downtrend to create oversold condition
        else:
            price *= 1.02  # Recent uptrend for bullish MA cross
        data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )

    # Test signal generation
    signal = await strategy.calculate_signals(data)

    # Verify signal properties
    assert "signal" in signal
    assert signal["signal"] in ["buy", "sell", "neutral"]
    assert "volume" in signal
    assert "rsi" in signal
    assert "ma_short" in signal
    assert "ma_long" in signal
    assert "confidence" in signal
    assert 0 <= signal["confidence"] <= 1.0

    # Test with invalid timeframe data
    invalid_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=15 * i)  # Wrong interval
        invalid_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": 100.0,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )

    # Test with invalid timeframe
    strategy.timeframe = "1x"  # Invalid unit
    signal = await strategy.calculate_signals(invalid_data)
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test with missing price
    invalid_data[0]["price"] = None
    signal = await strategy.calculate_signals(invalid_data)
    assert "error:" in signal.get("reason")

    # Test strong buy signal conditions
    buy_data = []
    price = 100.0
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        if i < 20:
            price *= 0.98  # Strong downtrend to create oversold condition
        else:
            price *= 1.03  # Recent uptrend for bullish MA cross
        buy_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )

    strategy.timeframe = "30m"  # Reset timeframe
    signal = await strategy.calculate_signals(buy_data)
    assert signal["signal"] == "buy"
    assert signal["confidence"] > 0.8

    # Test sell signal conditions
    sell_data = []
    price = 100.0
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        if i < 20:
            price *= 1.02  # Strong uptrend to create overbought condition
        else:
            price *= 0.98  # Recent downtrend for bearish MA cross
        sell_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": price,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(sell_data)
    assert signal["signal"] == "sell"

    # Test with long period greater than short period
    invalid_config = StrategyConfig(
        strategy_type="technical_analysis",
        parameters={
            "ma_short_period": 20,
            "ma_long_period": 10,  # Invalid: shorter than short period
        },
    )
    with pytest.raises(
        ValueError, match="Short MA period must be less than long MA period"
    ):
        TechnicalAnalysisStrategy(invalid_config)

    # Test with invalid timeframe
    invalid_config = StrategyConfig(
        strategy_type="technical_analysis", parameters={"timeframe": "invalid"}
    )
    with pytest.raises(ValueError, match="Invalid timeframe"):
        TechnicalAnalysisStrategy(invalid_config)

    # Test divergence detection
    strategy = TechnicalAnalysisStrategy(strategy_config)

    # Test bullish divergence
    prices = [100.0, 98.0, 99.0, 97.0]  # Lower lows in price
    rsi_values = [30.0, 25.0, 28.0, 29.0]  # Higher lows in RSI
    divergence = strategy._check_divergence(prices, rsi_values)
    assert divergence == "bullish"

    # Test bearish divergence
    prices = [100.0, 102.0, 101.0, 103.0]  # Higher highs in price
    rsi_values = [70.0, 75.0, 72.0, 71.0]  # Lower highs in RSI
    divergence = strategy._check_divergence(prices, rsi_values)
    assert divergence == "bearish"

    # Test no divergence
    prices = [100.0, 101.0, 102.0, 103.0]
    rsi_values = [50.0, 55.0, 60.0, 65.0]
    divergence = strategy._check_divergence(prices, rsi_values)
    assert divergence is None

    # Test with insufficient data for indicators
    insufficient_data = []
    for i in range(5):  # Less than required periods
        timestamp = base_time + timedelta(minutes=30 * i)
        insufficient_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": 100.0,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(insufficient_data)
    assert signal["signal"] == "neutral"
    assert "error: insufficient data" in signal.get("reason")

    # Test with general exception
    signal = await strategy.calculate_signals([{"timestamp": "invalid"}])
    assert "error:" in signal.get("reason")

    # Test with invalid data that raises exception
    invalid_data = [
        {
            "timestamp": datetime(2025, 1, 1).isoformat(),
            "price": float("inf"),  # This will cause numpy calculations to fail
            "volume": 2000,
            "pair": "TEST/USDT",
        }
    ]
    signal = await strategy.calculate_signals(invalid_data)
    assert signal["signal"] == "neutral"
    assert "error:" in signal.get("reason")

    # Test with data that raises exception during RSI calculation
    rsi_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        rsi_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("nan") if i == 15 else 100.0
                ),  # Insert NaN to cause RSI calculation error
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(rsi_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises exception during MA calculation
    ma_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        ma_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf") if i == 25 else 100.0
                ),  # Insert inf to cause MA calculation error
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(ma_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises unexpected exception
    error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    complex(1, 1) if i == 25 else 100.0
                ),  # Insert complex number to cause unexpected error
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises TypeError during calculation
    type_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        type_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    "invalid" if i == 25 else 100.0
                ),  # Insert string to cause TypeError
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(type_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises RuntimeError during calculation
    runtime_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        runtime_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf") if i == 15 else float("-inf") if i == 25 else 100.0
                ),  # Insert inf values to cause RuntimeError
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(runtime_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises ValueError during calculation
    value_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        value_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": None if i == 25 else 100.0,  # Insert None to cause ValueError
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(value_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception during calculation
    exception_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        exception_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 15
                    else (
                        float("-inf") if i == 20 else float("nan") if i == 25 else 100.0
                    )
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(exception_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _check_divergence
    divergence_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        divergence_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 25
                    else (
                        float("-inf") if i == 26 else float("nan") if i == 27 else 100.0
                    )
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(divergence_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in calculate_signals
    error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    None
                    if i == 15
                    else float("inf") if i == 25 else float("nan") if i == 27 else 100.0
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in calculate_signals with custom error
    custom_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        custom_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 15
                    else (
                        float("-inf") if i == 20 else float("nan") if i == 25 else 100.0
                    )
                ),
                "volume": None,  # This will cause a TypeError when trying to compare with min_volume
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(custom_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_rsi
    rsi_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        rsi_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 15
                    else (
                        float("-inf") if i == 16 else float("nan") if i == 17 else 100.0
                    )
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(rsi_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma
    ma_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        ma_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 15
                    else (
                        float("-inf")
                        if i == 16
                        else float("nan") if i == 17 else None if i == 18 else 100.0
                    )
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(ma_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with empty data
    empty_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        empty_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": None if i < 20 else 100.0,  # First 20 points are None
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(empty_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with invalid data
    invalid_ma_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        invalid_ma_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i < 15
                    else float("-inf") if i < 25 else float("nan")
                ),  # All invalid data
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(invalid_ma_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with zero values
    zero_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        zero_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": 0.0,  # All zero values will cause division by zero in MA calculation
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(zero_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with mixed invalid data
    mixed_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        mixed_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    float("inf")
                    if i == 15
                    else (
                        float("-inf")
                        if i == 16
                        else (
                            float("nan")
                            if i == 17
                            else 0.0 if i == 18 else None if i == 19 else 100.0
                        )
                    )
                ),
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(mixed_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with invalid timestamps
    invalid_time_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        invalid_time_data.append(
            {
                "timestamp": "invalid" if i == 15 else timestamp.isoformat(),
                "price": 100.0,
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(invalid_time_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with missing data
    missing_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        missing_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": None if i < 29 else 100.0,  # All but last point are None
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(missing_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with empty list
    empty_list_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        empty_list_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": [] if i == 15 else 100.0,  # Invalid price type
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(empty_list_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with invalid price type
    invalid_price_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        invalid_price_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    {"value": 100.0} if i == 15 else 100.0
                ),  # Invalid price type (dict)
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(invalid_price_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with recursive error
    recursive_error_data = []
    for i in range(30):
        timestamp = base_time + timedelta(minutes=30 * i)
        recursive_error_data.append(
            {
                "timestamp": timestamp.isoformat(),
                "price": (
                    recursive_error_data if i == 15 else 100.0
                ),  # Recursive reference to cause error
                "volume": 2000,
                "pair": "TEST/USDT",
            }
        )
    signal = await strategy.calculate_signals(recursive_error_data)
    assert signal["signal"] == "neutral"

    # Test with data that raises Exception in _calculate_ma with custom error
    class CustomError(Exception):
        pass

    def raise_error():
        raise CustomError("Test error")

    # Mock the numpy.mean function to raise our custom error
    with mock.patch("numpy.mean", side_effect=raise_error):
        signal = await strategy.calculate_signals(data)
        assert signal["signal"] == "neutral"
        assert "error:" in signal.get("reason", "")

    # Test exception handling
    # Mock numpy.mean to raise an error during divergence check
    with mock.patch("numpy.mean", side_effect=lambda x: float("inf")):
        signal = await strategy.calculate_signals(
            [
                {
                    "timestamp": datetime(2025, 1, 1).isoformat(),
                    "price": 100.0,
                    "volume": 2000,
                    "pair": "TEST/USDT",
                }
            ]
        )
        assert signal["signal"] == "neutral"
        assert "error:" in signal.get("reason", "")

    # Mock numpy.mean to raise an error during RSI calculation
    with mock.patch("numpy.mean", side_effect=lambda x: x[0] if len(x) > 0 else 0):
        signal = await strategy.calculate_signals(
            [
                {
                    "timestamp": datetime(2025, 1, 1).isoformat(),
                    "price": float("inf"),  # This will cause RSI calculation to fail
                    "volume": 2000,
                    "pair": "TEST/USDT",
                }
            ]
        )
        assert signal["signal"] == "neutral"
        assert "error:" in signal.get("reason", "")

    # Test general exception handling
    with mock.patch("numpy.mean", side_effect=Exception("Unexpected error")):
        signal = await strategy.calculate_signals(
            [
                {
                    "timestamp": datetime(2025, 1, 1).isoformat(),
                    "price": 100.0,
                    "volume": 2000,
                    "pair": "TEST/USDT",
                }
            ]
        )
        assert signal["signal"] == "neutral"
        assert "error:" in signal.get("reason", "")
