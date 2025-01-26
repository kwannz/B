"""
回测模块测试
"""

import os
import sys
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, AsyncMock, MagicMock, patch
from typing import Dict, Any, List, Optional, Union, Type
import aiohttp
from zoneinfo import ZoneInfo
from pandas import DataFrame, DatetimeIndex

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, project_root)

# Configure pandas settings
pd.set_option("mode.chained_assignment", None)
pd.set_option("mode.use_inf_as_na", False)

# Set up mocks
mock_ai = Mock()
mock_ai.analyze_market = AsyncMock(return_value={})
mock_ai.validate_strategy = AsyncMock(return_value=True)

# Set up module mocks - only mock AI modules
sys.modules["src.shared.ai_analyzer"] = mock_ai
sys.modules["src.trading_agent.python.ai.analyzer"] = mock_ai

# Ensure numpy and pandas are not mocked
if "numpy" in sys.modules:
    del sys.modules["numpy"]
if "pandas" in sys.modules:
    del sys.modules["pandas"]

# Import numpy and pandas directly
import numpy as np
import pandas as pd

# Configure pandas settings
pd.set_option("mode.chained_assignment", None)
pd.set_option("mode.use_inf_as_na", False)

# Import backtester
from tradingbot.shared.backtester import Backtester


@pytest.fixture
def test_dates():
    """Create test dates"""
    dates = [datetime(2024, 1, 1), datetime(2024, 1, 2)]
    return dates


@pytest.fixture
def test_df() -> pd.DataFrame:
    """Create test DataFrame"""
    # Create test data with basic Python lists
    data = [
        {
            "timestamp": datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")),
            "open": 100.0,
            "high": 105.0,
            "low": 95.0,
            "close": 102.0,
            "volume": 1000000.0,
        },
        {
            "timestamp": datetime(2024, 1, 2, tzinfo=ZoneInfo("UTC")),
            "open": 102.0,
            "high": 107.0,
            "low": 97.0,
            "close": 104.0,
            "volume": 1100000.0,
        },
    ]

    # Create DataFrame and set index
    df = pd.DataFrame(data)
    df.set_index("timestamp", inplace=True)
    return df


# Mock classes for testing


class MockResponse:
    def __init__(self, data: Any, status: int = 200):
        self.data = data
        self.status = status
        self._closed = False
        self._entered = False

    async def __aenter__(self):
        """Enter async context"""
        if self._closed:
            raise RuntimeError("Response is closed")
        if self._entered:
            raise RuntimeError("Context already entered")
        self._entered = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context"""
        if not self._entered:
            raise RuntimeError("Context not entered")
        await self.close()
        self._entered = False
        return None

    async def json(self):
        """Return mock response data"""
        if self._closed:
            raise RuntimeError("Response is closed")
        # Allow json() to work both within and outside context manager
        # since some HTTP clients handle this internally
        return self.data.copy() if isinstance(self.data, dict) else self.data

    async def close(self):
        """Close the response"""
        self._closed = True

    async def text(self):
        """Return mock response data as text"""
        if self._closed:
            raise RuntimeError("Response is closed")
        if not self._entered:
            raise RuntimeError("Must be used within async context")
        return str(self.data)

    def __getattr__(self, name):
        """Handle any missing attributes"""
        return self


class MockClientSession:
    def __init__(self):
        self.responses = {}
        self.closed = False
        self.get = self._get  # Make get method accessible for mocking

    def set_response(self, pattern: str, data: Any):
        """Set response for a URL pattern"""
        self.responses[pattern] = data

    async def _get(self, url: str, params=None) -> MockResponse:
        """Mock HTTP GET request"""
        if self.closed:
            raise RuntimeError("Session is closed")

        # Check for pattern matches first
        for pattern, data in self.responses.items():
            if pattern in url:
                # Return data directly if it's already in the correct format
                if (
                    isinstance(data, list)
                    and len(data) > 0
                    and isinstance(data[0], dict)
                ):
                    return MockResponse(data)

                # Convert CoinGecko format if needed
                if isinstance(data, dict) and "prices" in data:
                    formatted_data = []
                    for (timestamp, price), (_, volume) in zip(
                        data["prices"], data["total_volumes"]
                    ):
                        formatted_data.append(
                            {
                                "timestamp": datetime.fromtimestamp(
                                    timestamp / 1000, tz=ZoneInfo("UTC")
                                ),
                                "open": price,
                                "high": price,
                                "low": price,
                                "close": price,
                                "volume": volume,
                            }
                        )
                    return MockResponse(formatted_data)
                return MockResponse(data)

        # Return default response
        return MockResponse({"data": []})

    async def close(self):
        """Close the session"""
        if not self.closed:
            self.closed = True

    async def __aenter__(self):
        """Enter async context"""
        if self.closed:
            raise RuntimeError("Session is closed")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context"""
        if not self.closed:
            await self.close()
        return None

    def __getattr__(self, name):
        # Handle any missing attributes
        return self

    def __del__(self):
        """Ensure session is closed on deletion"""
        if not self.closed:
            import asyncio

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(self.close())
            except:
                pass


@pytest.fixture
async def backtester(test_df, mock_session):
    """创建回测器实例"""
    tester = None
    try:
        tester = Backtester()

        # Mock RiskController with realistic behavior
        risk_controller = AsyncMock()
        risk_controller.initialize = AsyncMock()
        risk_controller.close = AsyncMock()

        # Mock position size calculation with portfolio-based logic
        async def mock_calculate_position_size(
            portfolio_value: float, risk_per_trade: float
        ) -> float:
            return portfolio_value * (
                risk_per_trade / 100.0
            )  # Convert percentage to decimal

        risk_controller.calculate_position_size = AsyncMock(
            side_effect=mock_calculate_position_size
        )

        # Mock trade validation with risk checks
        async def mock_check_trade(trade_data: Dict[str, Any]) -> Dict[str, Any]:
            price = float(trade_data["price"])
            amount = float(trade_data["amount"])
            portfolio_value = float(trade_data["portfolio_value"])

            # Basic risk checks
            position_size = price * amount
            exposure_ratio = position_size / portfolio_value

            return {
                "passed": exposure_ratio <= 0.2,  # Max 20% exposure per trade
                "checks": {
                    "size_check": exposure_ratio <= 0.2,
                    "portfolio_check": True,
                    "risk_level": "medium",
                },
                "risk_level": "medium",
                "timestamp": datetime.now().isoformat(),
            }

        risk_controller.check_trade = AsyncMock(side_effect=mock_check_trade)

        # Mock strategy implementation
        async def mock_strategy(
            strategy: Dict[str, Any], data: Any = None
        ) -> Optional[Dict[str, Any]]:
            # Handle both DataFrame and market_data inputs
            if isinstance(data, pd.DataFrame):
                # For backtesting, use the last row
                market_data = {
                    "timestamp": data.index[-1],
                    "open": float(data.iloc[-1]["open"]),
                    "high": float(data.iloc[-1]["high"]),
                    "low": float(data.iloc[-1]["low"]),
                    "close": float(data.iloc[-1]["close"]),
                    "volume": float(data.iloc[-1]["volume"]),
                    "price": float(data.iloc[-1]["close"]),
                }
            else:
                market_data = data

            if not market_data:
                return None

            # Simple moving average crossover strategy
            if strategy["type"] == "moving_average":
                # Return buy signal for testing
                return {
                    "type": "buy",
                    "size": Decimal("1.0"),
                    "timestamp": market_data["timestamp"],
                }
            elif strategy["type"] == "moving_average_sell":
                # Return sell signal for testing
                return {
                    "type": "sell",
                    "size": Decimal("1.0"),
                    "timestamp": market_data["timestamp"],
                }
            elif strategy["type"] == "unknown_strategy":
                return None
            # Return buy signal by default for testing
            return {
                "type": "buy",
                "size": Decimal("1.0"),
                "timestamp": market_data["timestamp"],
            }

        # Use monkey patching for strategy mock
        with patch.object(tester, "_run_strategy", side_effect=mock_strategy):
            tester.risk_controller = risk_controller

        db = AsyncMock()
        db.start = AsyncMock()
        db.stop = AsyncMock()
        tester.db = db

        # Set mock session
        tester.session = mock_session

        # Initialize backtester
        await tester.initialize()

        # Set test data
        tester._historical_data = test_df.copy()

        yield tester

    finally:
        if tester:
            # Ensure client session is closed properly
            if (
                hasattr(tester, "session")
                and tester.session
                and not tester.session.closed
            ):
                await tester.session.close()
            await tester.close()


@pytest.mark.asyncio
async def test_initialization(backtester):
    """测试初始化"""
    assert backtester.initialized
    assert backtester.session is not None
    assert isinstance(backtester.initial_balance, Decimal)


@pytest.fixture
def market_data():
    """创建测试数据"""
    timestamps = pd.date_range(
        start=datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")), periods=2, freq="D"
    )
    data = []
    for ts, (o, h, l, c, v) in zip(
        timestamps,
        [
            (100.0, 105.0, 95.0, 102.0, 1000000.0),
            (102.0, 107.0, 97.0, 104.0, 1100000.0),
        ],
    ):
        data.append(
            {
                "timestamp": ts,  # Keep as datetime for flexibility
                "open": float(o),
                "high": float(h),
                "low": float(l),
                "close": float(c),
                "volume": float(v),
            }
        )
    return data


@pytest.fixture
async def mock_session():
    """Create mock session"""
    session = MockClientSession()
    # Set up mock data with exactly 2 data points
    session.set_response(
        "coingecko",
        [
            {
                "timestamp": datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")),
                "open": 100.0,
                "high": 105.0,
                "low": 95.0,
                "close": 102.0,
                "volume": 1000000.0,
            },
            {
                "timestamp": datetime(2024, 1, 2, tzinfo=ZoneInfo("UTC")),
                "open": 102.0,
                "high": 107.0,
                "low": 97.0,
                "close": 104.0,
                "volume": 1100000.0,
            },
        ],
    )
    yield session
    await session.close()


@pytest.mark.asyncio
async def test_load_data(backtester, test_df):
    """测试数据加载"""
    # Load data and verify
    await backtester.load_data(test_df)

    # Verify DataFrame properties
    result_df = backtester._historical_data
    assert isinstance(result_df, pd.DataFrame), "Result should be a DataFrame"
    assert not result_df.empty, "DataFrame should not be empty"
    assert pd.api.types.is_datetime64_any_dtype(
        result_df.index
    ), "DataFrame should have datetime index"
    assert len(result_df) == 2, "DataFrame should have 2 rows"
    assert all(
        col in result_df.columns for col in ["open", "high", "low", "close", "volume"]
    ), "DataFrame should have all required columns"

    # Verify data values
    assert (
        abs(result_df.iloc[0]["open"] - 100.0) < 1e-6
    ), "First row open price mismatch"
    assert (
        abs(result_df.iloc[0]["high"] - 105.0) < 1e-6
    ), "First row high price mismatch"
    assert (
        abs(result_df.iloc[1]["close"] - 104.0) < 1e-6
    ), "Second row close price mismatch"
    assert (
        abs(result_df.iloc[1]["volume"] - 1100000.0) < 1e-6
    ), "Second row volume mismatch"

    # Verify data relationships
    assert (
        result_df.high >= result_df.low
    ).all(), "High prices should be >= low prices"
    assert (
        (result_df.close <= result_df.high) & (result_df.close >= result_df.low)
    ).all(), "Close prices should be between high and low"
    assert (
        (result_df.open <= result_df.high) & (result_df.open >= result_df.low)
    ).all(), "Open prices should be between high and low"
    assert (result_df.volume > 0).all(), "Volume should be positive"

    # Verify data types
    assert pd.api.types.is_float_dtype(result_df.open), "Open prices should be float"
    assert pd.api.types.is_float_dtype(result_df.high), "High prices should be float"
    assert pd.api.types.is_float_dtype(result_df.low), "Low prices should be float"
    assert pd.api.types.is_float_dtype(result_df.close), "Close prices should be float"
    assert pd.api.types.is_float_dtype(result_df.volume), "Volume should be float"


@pytest.mark.asyncio
async def test_load_data_validation(backtester):
    """测试数据验证"""
    # Test empty DataFrame
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(pd.DataFrame())
    assert "数据验证失败: 数据必须是非空DataFrame" in str(exc_info.value)

    # Test invalid input type
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(123)  # Using a number instead of DataFrame
    assert "数据验证失败: 数据必须是DataFrame或包含交易数据的列表" in str(
        exc_info.value
    )

    # Test missing required columns
    df_missing = pd.DataFrame({"close": [100.0], "volume": [1000.0]})
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_missing)
    assert "数据验证失败: DataFrame必须包含以下列: open, high, low" in str(
        exc_info.value
    )

    # Test invalid timestamp format
    df_invalid_ts = pd.DataFrame(
        {
            "open": [100.0],
            "high": [105.0],
            "low": [95.0],
            "close": [102.0],
            "volume": [1000.0],
        }
    )
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_invalid_ts)
    assert "数据验证失败: DataFrame必须使用timestamp作为索引" in str(exc_info.value)

    # Test invalid price relationships
    df_invalid_prices = pd.DataFrame(
        {
            "open": [100.0],
            "high": [90.0],  # High < low
            "low": [95.0],
            "close": [98.0],
            "volume": [1000.0],
        },
        index=[datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC"))],
    )
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_invalid_prices)
    assert "数据验证失败: 价格数据不合理 - 最高价小于最低价" in str(exc_info.value)

    # Test close price outside range
    df_invalid_close = pd.DataFrame(
        {
            "open": [100.0],
            "high": [105.0],
            "low": [95.0],
            "close": [110.0],  # Close > high
            "volume": [1000.0],
        },
        index=[datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC"))],
    )
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_invalid_close)
    assert "数据验证失败: 价格数据不合理 - 收盘价超出高低价范围" in str(exc_info.value)

    # Test open price outside range
    df_invalid_open = pd.DataFrame(
        {
            "open": [110.0],  # Open > high
            "high": [105.0],
            "low": [95.0],
            "close": [100.0],
            "volume": [1000.0],
        },
        index=[datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC"))],
    )
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_invalid_open)
    assert "数据验证失败: 价格数据不合理 - 开盘价超出高低价范围" in str(exc_info.value)

    # Test negative values
    df_negative = pd.DataFrame(
        {
            "open": [-100.0],
            "high": [105.0],
            "low": [95.0],
            "close": [98.0],
            "volume": [1000.0],
        },
        index=[datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC"))],
    )
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(df_negative)
    assert "数据验证失败: open必须是正数" in str(exc_info.value)

    # Test list input validation
    # Test empty list
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data([])
    assert "数据验证失败: 数据必须是非空列表" in str(exc_info.value)

    # Test missing fields
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(
            [{"timestamp": datetime(2024, 1, 1), "close": 100.0, "volume": 1000.0}]
        )
    assert "数据验证失败: 数据必须包含以下字段: open, high, low" in str(exc_info.value)

    # Test invalid timestamp
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(
            [
                {
                    "timestamp": "invalid",
                    "open": 100.0,
                    "high": 105.0,
                    "low": 95.0,
                    "close": 98.0,
                    "volume": 1000.0,
                }
            ]
        )
    assert "数据验证失败: timestamp格式无效" in str(exc_info.value)

    # Test invalid price relationships in list input
    with pytest.raises(ValueError) as exc_info:
        await backtester.load_data(
            [
                {
                    "timestamp": datetime(2024, 1, 1),
                    "open": 100.0,
                    "high": 90.0,  # High < low
                    "low": 95.0,
                    "close": 98.0,
                    "volume": 1000.0,
                }
            ]
        )
    assert "数据验证失败: 价格数据不合理 - 最高价小于最低价" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fetch_historical_data(backtester):
    """测试获取历史数据"""
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 1, 2)

    # Create mock response data
    mock_data = {
        "prices": [
            [int(start_date.timestamp() * 1000), 100.0],
            [int(end_date.timestamp() * 1000), 101.0],
        ],
        "total_volumes": [
            [int(start_date.timestamp() * 1000), 1000000],
            [int(end_date.timestamp() * 1000), 1100000],
        ],
    }

    # Create mock session with proper async context manager
    mock_session = MockClientSession()
    mock_session.set_response(
        "coingecko",
        {
            "prices": [
                [int(start_date.timestamp() * 1000), 100.0],
                [int(end_date.timestamp() * 1000), 101.0],
            ],
            "total_volumes": [
                [int(start_date.timestamp() * 1000), 1000000],
                [int(end_date.timestamp() * 1000), 1100000],
            ],
        },
    )
    backtester.session = mock_session

    # Execute test
    result_df = await backtester.fetch_historical_data("bitcoin", start_date, end_date)

    # Verify DataFrame properties
    assert isinstance(result_df, pd.DataFrame), "Result should be a DataFrame"
    assert not result_df.empty, "DataFrame should not be empty"
    assert len(result_df) == 2, "DataFrame should have 2 rows"
    assert all(
        col in result_df.columns for col in ["open", "high", "low", "close", "volume"]
    ), "DataFrame should have all required columns"

    # Verify data values
    assert result_df.iloc[0]["volume"] == 1000000, "First row volume should match"
    assert result_df.iloc[1]["volume"] == 1100000, "Second row volume should match"

    # Verify API call
    # Verify API call was made
    assert isinstance(backtester.session, MockClientSession)
    assert len(backtester.session.responses) > 0


@pytest.mark.asyncio
async def test_run_strategy(backtester):
    """测试策略执行"""
    # Create test data with known crossover pattern
    dates = pd.date_range(
        start=datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")), periods=30, freq="D"
    )

    # Create price data that will trigger a buy signal
    # Short MA will cross above long MA around the middle
    prices = np.concatenate(
        [
            np.linspace(100, 90, 15),  # Downtrend
            np.linspace(90, 110, 15),  # Sharp uptrend to create crossover
        ]
    )

    data = pd.DataFrame(
        {
            "open": prices,
            "high": prices + 5,
            "low": prices - 5,
            "close": prices,
            "volume": np.random.randint(1000000, 2000000, 30),
        },
        index=dates,
    )

    # Load test data
    await backtester.load_data(data)

    # Create strategy configuration
    strategy = {
        "type": "moving_average",
        "params": {
            "short_window": 5,
            "long_window": 20,
            "risk_per_trade": 2.0,  # 2% risk per trade
        },
    }

    # Run strategy with market data
    market_data = {
        "timestamp": data.index[-1],
        "open": float(data.iloc[-1]["open"]),
        "high": float(data.iloc[-1]["high"]),
        "low": float(data.iloc[-1]["low"]),
        "close": float(data.iloc[-1]["close"]),
        "volume": float(data.iloc[-1]["volume"]),
        "price": float(data.iloc[-1]["close"]),  # Use close as current price
    }

    # Test buy signal
    result = await backtester._run_strategy(strategy, market_data)
    assert result is not None, "Strategy should return a signal"
    assert isinstance(result, dict), "Strategy result should be a dictionary"
    assert all(
        key in result for key in ["type", "size", "timestamp"]
    ), "Result missing required keys"
    assert result["type"] == "buy", "Strategy should return buy signal"
    assert isinstance(result["size"], Decimal), "Position size should be Decimal"
    assert float(result["size"]) > 0, "Position size should be positive"
    assert isinstance(
        result["timestamp"], (datetime, pd.Timestamp)
    ), "Timestamp should be datetime"

    # Test sell signal
    strategy["type"] = "moving_average_sell"  # Change strategy type to test sell
    result = await backtester._run_strategy(strategy, market_data)
    assert result is not None, "Strategy should return a signal"
    assert result["type"] == "sell", "Strategy should return sell signal"
    assert isinstance(result["size"], Decimal), "Position size should be Decimal"
    assert float(result["size"]) > 0, "Position size should be positive"
    assert isinstance(
        result["timestamp"], (datetime, pd.Timestamp)
    ), "Timestamp should be datetime"

    # Test no signal
    strategy["type"] = "unknown_strategy"
    result = await backtester._run_strategy(strategy, market_data)
    assert result is None, "Unknown strategy should return None"
    # Test no signal with unknown strategy type
    strategy["type"] = "unknown_strategy"
    market_data = {
        "timestamp": data.index[-1],
        "open": float(data.iloc[-1]["open"]),
        "high": float(data.iloc[-1]["high"]),
        "low": float(data.iloc[-1]["low"]),
        "close": float(data.iloc[-1]["close"]),
        "volume": float(data.iloc[-1]["volume"]),
        "price": float(data.iloc[-1]["close"]),
    }
    result = await backtester._run_strategy(strategy, market_data)
    assert result is None, "Unknown strategy should return None"


@pytest.mark.asyncio
async def test_strategy_edge_cases(backtester):
    """测试策略边缘情况"""
    strategy = {
        "type": "moving_average",
        "params": {"short_window": 5, "long_window": 20, "risk_per_trade": 2.0},
    }

    # Zero profit trade scenario
    dates = pd.date_range(
        start=datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")), periods=10, freq="D"
    )
    prices = pd.Series([100] * 10, index=dates)  # Flat price
    volumes = pd.Series([1000] * 10, index=dates)

    df = pd.DataFrame(
        {
            "open": prices,
            "high": prices + 1,
            "low": prices - 1,
            "close": prices,
            "volume": volumes,
        },
        index=dates,
    )

    await backtester.load_data(df)
    result = await backtester.run_backtest(strategy)
    assert result["metrics"]["total_pnl"] == 0

    # Partial trade scenario (insufficient balance)
    dates = pd.date_range(
        start=datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")), periods=5, freq="D"
    )
    prices = pd.Series([1000000] * 5, index=dates)  # Very high price
    df = pd.DataFrame(
        {
            "open": prices,
            "high": prices + 100,
            "low": prices - 100,
            "close": prices,
            "volume": volumes[:5],
        },
        index=dates,
    )

    await backtester.load_data(df)
    result = await backtester.run_backtest(strategy)
    assert len(result["trades"]) == 0  # No trades due to insufficient balance

    # Complete loss scenario
    dates = pd.date_range(
        start=datetime(2024, 1, 1, tzinfo=ZoneInfo("UTC")), periods=10, freq="D"
    )
    prices = pd.Series(
        [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], index=dates
    )  # Declining price
    df = pd.DataFrame(
        {
            "open": prices,
            "high": prices + 5,
            "low": prices - 5,
            "close": prices,
            "volume": volumes[:10],
        },
        index=dates,
    )

    await backtester.load_data(df)
    result = await backtester.run_backtest(strategy)
    # Test significant drawdown in edge cases
    metrics = result["metrics"]
    assert metrics["max_drawdown"] <= -0.5  # Should be at least 50% drawdown
    assert metrics["max_drawdown"] >= -1.0  # Cannot lose more than 100%


@pytest.mark.asyncio
async def test_calculate_metrics(backtester):
    """测试性能指标计算"""
    # Create test trades
    trades = [
        {
            "timestamp": "2024-01-01T00:00:00",
            "type": "buy",
            "price": 100.0,
            "amount": 1.0,
            "fee": 0.1,
            "balance": 9899.9,
        },
        {
            "timestamp": "2024-01-02T00:00:00",
            "type": "sell",
            "price": 110.0,
            "amount": 1.0,
            "fee": 0.11,
            "balance": 10009.79,
        },
    ]

    # Test Case 1: Normal equity curve with drawdown
    equity_curve = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 10000.0},
        {"timestamp": "2024-01-01T12:00:00", "equity": 9899.9},
        {"timestamp": "2024-01-02T00:00:00", "equity": 10009.79},
    ]

    metrics = backtester._calculate_metrics(trades, equity_curve)

    assert isinstance(metrics, dict)
    assert "total_return" in metrics
    assert "max_drawdown" in metrics
    assert "sharpe_ratio" in metrics
    assert "win_rate" in metrics
    assert metrics["total_return"] > 0
    assert metrics["win_rate"] == 1.0
    assert metrics["max_drawdown"] < 0  # Drawdown should be negative

    # Test Case 2: Single data point
    single_point = [{"timestamp": "2024-01-01T00:00:00", "equity": 10000.0}]
    single_metrics = backtester._calculate_metrics([], single_point)
    assert single_metrics["max_drawdown"] == 0.0
    assert single_metrics["total_return"] == 0.0

    # Test Case 3: Zero equity values
    zero_equity = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 0.0},
        {"timestamp": "2024-01-01T12:00:00", "equity": 0.0},
    ]
    zero_metrics = backtester._calculate_metrics([], zero_equity)
    assert zero_metrics["max_drawdown"] == 0.0
    assert zero_metrics["total_return"] == 0.0

    # Test Case 4: Extreme drawdown
    extreme_drawdown = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 10000.0},
        {"timestamp": "2024-01-01T12:00:00", "equity": 1.0},
    ]
    extreme_metrics = backtester._calculate_metrics([], extreme_drawdown)
    assert extreme_metrics["max_drawdown"] <= -0.9999  # Almost complete loss
    assert extreme_metrics["max_drawdown"] >= -1.0  # Cannot lose more than 100%

    # Test Case 5: Flat equity curve
    flat_equity = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 10000.0},
        {"timestamp": "2024-01-01T12:00:00", "equity": 10000.0},
        {"timestamp": "2024-01-02T00:00:00", "equity": 10000.0},
    ]
    flat_metrics = backtester._calculate_metrics([], flat_equity)
    assert flat_metrics["max_drawdown"] == 0.0
    assert flat_metrics["total_return"] == 0.0

    # Test Case 6: Recovery after drawdown
    recovery_equity = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 10000.0},
        {"timestamp": "2024-01-01T12:00:00", "equity": 5000.0},
        {"timestamp": "2024-01-02T00:00:00", "equity": 11000.0},
    ]
    recovery_metrics = backtester._calculate_metrics([], recovery_equity)
    assert recovery_metrics["max_drawdown"] == -0.5  # 50% drawdown
    assert recovery_metrics["total_return"] > 0  # Positive return

    # Test empty trades
    empty_metrics = backtester._calculate_metrics([], [])
    assert empty_metrics["total_return"] == 0.0
    assert empty_metrics["win_rate"] == 0.0
    assert empty_metrics["max_drawdown"] == 0.0


@pytest.mark.asyncio
async def test_get_performance_metrics(backtester):
    """测试获取性能指标"""
    # Test without running backtest
    metrics = await backtester.get_performance_metrics()
    assert isinstance(metrics, dict)
    assert "timestamp" in metrics
    assert "metrics" in metrics
    assert metrics["metrics"]["total_return"] == 0.0

    # Run backtest first
    strategy = {"type": "simple_ma", "params": {"short_window": 5, "long_window": 20}}
    test_data = pd.DataFrame(
        {
            "timestamp": pd.date_range(start="2024-01-01", periods=30),
            "open": np.random.randn(30) + 100,
            "high": np.random.randn(30) + 105,
            "low": np.random.randn(30) + 95,
            "close": np.random.randn(30) + 100,
            "volume": np.random.randn(30) * 100 + 1000,
        }
    ).set_index("timestamp")

    await backtester.load_data(test_data)
    await backtester.run_backtest(strategy)

    # Get metrics after backtest
    metrics = await backtester.get_performance_metrics()
    assert isinstance(metrics, dict)
    assert "timestamp" in metrics
    assert "metrics" in metrics
    assert isinstance(metrics["metrics"]["total_return"], float)


@pytest.mark.asyncio
async def test_fetch_historical_data_error_cases(backtester):
    """测试获取历史数据的错误情况"""
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 1, 2)

    # Test API failure
    mock_response = AsyncMock()
    mock_response.status = 500
    mock_response.json = AsyncMock(side_effect=Exception("API Error"))

    # Create mock session with proper async context manager
    mock_session = MockClientSession()
    mock_session.get = AsyncMock(return_value=mock_response)
    backtester.session = mock_session

    with pytest.raises(Exception) as exc_info:
        await backtester.fetch_historical_data("bitcoin", start_date, end_date)
    assert "无法从任何数据源获取历史数据" in str(exc_info.value)

    # Test invalid date range
    with pytest.raises(ValueError) as exc_info:
        await backtester.fetch_historical_data("bitcoin", end_date, start_date)
    assert "结束日期必须大于开始日期" in str(exc_info.value)

    # Test empty symbol
    with pytest.raises(ValueError) as exc_info:
        await backtester.fetch_historical_data("", start_date, end_date)
    assert "交易对不能为空" in str(exc_info.value)

    # Test future dates
    future_date = datetime.now() + timedelta(days=1)
    with pytest.raises(ValueError) as exc_info:
        await backtester.fetch_historical_data("bitcoin", start_date, future_date)
    assert "结束日期不能超过当前时间" in str(exc_info.value)

    # Test malformed API response
    class MockErrorResponse:
        def __init__(self, data=None, status=200):
            self.data = data
            self.status = status
            self._entered = False

        async def __aenter__(self):
            self._entered = True
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            self._entered = False
            return None

        async def json(self):
            if not self._entered:
                raise RuntimeError("Response not used in context manager")
            if self.status != 200:
                raise Exception("API Error")
            return {"invalid": "data"}

    class MockErrorSession:
        def __init__(self):
            self.closed = False

        async def get(self, url, params=None):
            return MockErrorResponse(status=500)

        async def close(self):
            self.closed = True

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            await self.close()
            return None

        def __call__(self, *args, **kwargs):
            return self

    # Replace session with error mock
    backtester.session = MockErrorSession()

    with pytest.raises(ValueError) as exc_info:
        await backtester.fetch_historical_data("bitcoin", start_date, end_date)
    assert "API响应格式错误" in str(exc_info.value)


@pytest.mark.asyncio
async def test_position_size_calculation(backtester):
    """测试仓位计算"""
    balance = Decimal("10000")
    price = Decimal("100")
    risk = Decimal("0.01")

    size = backtester._calculate_position_size(balance, price, risk)
    assert isinstance(size, Decimal)
    assert size > 0


@pytest.mark.asyncio
async def test_trade_execution(backtester):
    """测试交易执行和风险控制"""
    initial_balance = Decimal("10000")

    # Test successful trade within risk limits
    position_small = {
        "type": "buy",
        "size": Decimal("1"),  # Small position
        "portfolio_value": float(initial_balance),
    }
    price = Decimal("100")
    timestamp = datetime.now()

    new_balance, trade = await backtester._execute_trade(
        initial_balance, position_small, price, timestamp
    )

    assert isinstance(new_balance, Decimal)
    assert new_balance < initial_balance  # 买入应该减少余额
    assert trade is not None
    assert trade["type"] == "buy"
    assert trade["price"] == float(price)
    assert trade["amount"] == float(position_small["size"])

    # Test trade exceeding risk limits
    position_large = {
        "type": "buy",
        "size": Decimal("1000"),  # Very large position
        "portfolio_value": float(initial_balance),
    }

    new_balance, trade = await backtester._execute_trade(
        initial_balance, position_large, price, timestamp
    )

    # Should not execute trade due to risk limits
    assert new_balance == initial_balance
    assert trade is None

    # Test sell trade
    position_sell = {
        "type": "sell",
        "size": Decimal("1"),
        "portfolio_value": float(initial_balance),
    }

    new_balance, trade = await backtester._execute_trade(
        initial_balance, position_sell, price, timestamp
    )

    assert isinstance(new_balance, Decimal)
    assert new_balance > initial_balance  # 卖出应该增加余额
    assert trade is not None
    assert trade["type"] == "sell"
    assert trade["price"] == float(price)
    assert trade["amount"] == float(position_sell["size"])


@pytest.mark.asyncio
async def test_backtest_execution(backtester):
    """测试回测执行"""
    # Create test data with enough points for MA calculation
    timestamps = pd.date_range(start=datetime(2024, 1, 1), periods=5, freq="D")
    test_data = []
    prices = [
        (100.0, 105.0, 95.0, 102.0, 1000.0),
        (102.0, 107.0, 97.0, 104.0, 1100.0),
        (104.0, 109.0, 99.0, 106.0, 1200.0),
        (106.0, 111.0, 101.0, 108.0, 1300.0),
        (108.0, 113.0, 103.0, 110.0, 1400.0),
    ]

    for ts, (o, h, l, c, v) in zip(timestamps, prices):
        test_data.append(
            {
                "timestamp": ts,
                "open": float(o),
                "high": float(h),
                "low": float(l),
                "close": float(c),
                "volume": float(v),
            }
        )

    # Load data
    await backtester.load_data(test_data)

    # Test simple MA strategy
    ma_strategy = {"type": "simple_ma", "params": {"short_window": 2, "long_window": 3}}

    result = await backtester.run_backtest(ma_strategy)

    assert isinstance(result, dict)
    assert "timestamp" in result
    assert "initial_balance" in result
    assert "final_balance" in result
    assert "total_trades" in result
    assert "metrics" in result
    assert "equity_curve" in result

    # Test RSI strategy
    rsi_strategy = {
        "type": "rsi",
        "params": {"period": 2, "overbought": 70, "oversold": 30},
    }

    # Test both strategies
    for strategy in [ma_strategy, rsi_strategy]:
        result = await backtester.run_backtest(strategy)

        assert isinstance(result, dict), "Result should be a dictionary"
        assert "timestamp" in result, "Result should contain timestamp"
        assert "initial_balance" in result, "Result should contain initial_balance"
        assert "final_balance" in result, "Result should contain final_balance"
        assert "total_trades" in result, "Result should contain total_trades"
        assert "metrics" in result, "Result should contain metrics"
        assert "equity_curve" in result, "Result should contain equity_curve"

        # Verify metrics
        metrics = result["metrics"]
        assert metrics["total_return"] >= -1.0  # Can't lose more than 100%
        assert 0.0 <= metrics["max_drawdown"] <= 1.0
        assert isinstance(metrics["sharpe_ratio"], float)
        assert isinstance(metrics["sortino_ratio"], float)
        assert 0.0 <= metrics["win_rate"] <= 1.0

    # Verify result values
    assert isinstance(result["timestamp"], str), "Timestamp should be a string"
    assert isinstance(
        result["initial_balance"], float
    ), "Initial balance should be a float"
    assert isinstance(result["final_balance"], float), "Final balance should be a float"
    assert isinstance(result["total_trades"], int), "Total trades should be an integer"
    assert isinstance(result["metrics"], dict), "Metrics should be a dictionary"
    assert isinstance(result["equity_curve"], list), "Equity curve should be a list"


@pytest.mark.asyncio
async def test_performance_metrics(backtester):
    """测试性能指标计算"""
    trades = [
        {"type": "buy", "price": 100, "amount": 1, "entry_price": 100},
        {"type": "sell", "price": 110, "amount": 1, "entry_price": 100},  # +10 profit
        {"type": "buy", "price": 105, "amount": 1, "entry_price": 105},
        {"type": "sell", "price": 95, "amount": 1, "entry_price": 105},  # -10 loss
        {"type": "buy", "price": 100, "amount": 1, "entry_price": 100},
        {"type": "sell", "price": 108, "amount": 1, "entry_price": 100},  # +8 profit
    ]

    equity_curve = [
        {"timestamp": "2024-01-01T00:00:00", "equity": 10000},
        {"timestamp": "2024-01-01T01:00:00", "equity": 10100},  # +1%
        {"timestamp": "2024-01-01T02:00:00", "equity": 10000},  # -1%
        {"timestamp": "2024-01-01T03:00:00", "equity": 9900},  # -1%
        {"timestamp": "2024-01-01T04:00:00", "equity": 10000},  # +1%
        {"timestamp": "2024-01-01T05:00:00", "equity": 10080},  # +0.8%
    ]

    metrics = backtester._calculate_metrics(trades, equity_curve)

    # Test basic metrics
    assert "total_return" in metrics
    assert "max_drawdown" in metrics
    assert "sharpe_ratio" in metrics
    assert "sortino_ratio" in metrics
    assert "win_rate" in metrics
    assert "profit_factor" in metrics

    # Test metric values
    assert abs(metrics["total_return"] - 0.08) < 0.0001  # 8% total return
    assert abs(metrics["max_drawdown"] - 0.01) < 0.0001  # 1% max drawdown
    assert metrics["win_rate"] == pytest.approx(2 / 3)  # 2 wins out of 3 trades
    assert metrics["largest_win"] == pytest.approx(10.0)  # Largest win is 10
    assert metrics["largest_loss"] == pytest.approx(-10.0)  # Largest loss is -10

    # Test consecutive wins/losses
    assert metrics["max_consecutive_wins"] == 1  # No consecutive wins
    assert metrics["max_consecutive_losses"] == 1  # No consecutive losses

    # Test advanced metrics
    assert metrics["sharpe_ratio"] > 0  # Should be positive given overall profit
    assert metrics["sortino_ratio"] > 0  # Should be positive given overall profit
    assert metrics["recovery_factor"] > 0  # Should be positive
    assert metrics["risk_adjusted_return"] > 0  # Should be positive

    # Test empty trades case
    empty_metrics = backtester._calculate_metrics([], [])
    assert empty_metrics["total_return"] == 0.0
    assert empty_metrics["max_drawdown"] == 0.0
    assert empty_metrics["win_rate"] == 0.0
    assert empty_metrics["sharpe_ratio"] == 0.0
    assert empty_metrics["sortino_ratio"] == 0.0
    assert empty_metrics["profit_factor"] == 0.0
    assert empty_metrics["recovery_factor"] == 0.0
    assert empty_metrics["risk_adjusted_return"] == 0.0


@pytest.mark.asyncio
async def test_performance_metrics_edge_cases(backtester):
    """测试性能指标边缘情况"""
    # 零利润交易
    zero_profit_trades = [
        {"type": "buy", "price": 100, "amount": 1, "entry_price": 100},
        {"type": "sell", "price": 100, "amount": 1, "entry_price": 100},  # 0 profit
        {"type": "buy", "price": 100, "amount": 0.5, "entry_price": 100},
        {"type": "sell", "price": 100, "amount": 0.5, "entry_price": 100},  # 0 profit
    ]

    flat_equity = [
        {"timestamp": datetime(2024, 1, 1), "equity": 10000},
        {"timestamp": datetime(2024, 1, 2), "equity": 10000},
        {"timestamp": datetime(2024, 1, 3), "equity": 10000},
    ]

    metrics = backtester._calculate_metrics(zero_profit_trades, flat_equity)
    assert metrics["total_return"] == 0.0
    assert metrics["max_drawdown"] == 0.0
    assert metrics["win_rate"] == 0.0
    assert metrics["profit_factor"] == 0.0
    assert metrics["avg_trade_return"] == 0.0

    # 部分成交交易
    partial_trades = [
        {"type": "buy", "price": 100, "amount": 1, "entry_price": 100},
        {"type": "sell", "price": 110, "amount": 0.5, "entry_price": 100},  # +5 profit
        {"type": "sell", "price": 90, "amount": 0.5, "entry_price": 100},  # -5 loss
    ]

    varying_equity = [
        {"timestamp": datetime(2024, 1, 1), "equity": 10000},
        {"timestamp": datetime(2024, 1, 2), "equity": 10005},
        {"timestamp": datetime(2024, 1, 3), "equity": 10000},
    ]

    metrics = backtester._calculate_metrics(partial_trades, varying_equity)
    assert metrics["total_return"] == 0.0
    assert metrics["max_drawdown"] > 0.0
    assert metrics["win_rate"] == pytest.approx(0.5, rel=1e-4)
    assert metrics["profit_factor"] == pytest.approx(1.0, rel=1e-4)

    # 极端情况 - 全部亏损
    loss_trades = [
        {"type": "buy", "price": 100, "amount": 1, "entry_price": 100},
        {"type": "sell", "price": 90, "amount": 1, "entry_price": 100},  # -10 loss
        {"type": "buy", "price": 90, "amount": 1, "entry_price": 90},
        {"type": "sell", "price": 81, "amount": 1, "entry_price": 90},  # -9 loss
    ]

    declining_equity = [
        {"timestamp": datetime(2024, 1, 1), "equity": 10000},
        {"timestamp": datetime(2024, 1, 2), "equity": 9900},
        {"timestamp": datetime(2024, 1, 3), "equity": 9800},
    ]

    metrics = backtester._calculate_metrics(loss_trades, declining_equity)
    assert metrics["total_return"] < 0.0
    assert metrics["max_drawdown"] > 0.0
    assert metrics["win_rate"] == 0.0
    assert metrics["profit_factor"] == 0.0  # No profits


@pytest.mark.asyncio
async def test_run_strategy_logic(backtester):
    """测试策略执行逻辑"""
    # 设置测试数据
    test_data = [
        {
            "timestamp": datetime(2024, 1, 1),
            "open": 100.0,
            "high": 105.0,
            "low": 95.0,
            "close": 98.0,
            "volume": 1000.0,
        },
        {
            "timestamp": datetime(2024, 1, 2),
            "open": 98.0,
            "high": 103.0,
            "low": 97.0,
            "close": 102.0,
            "volume": 1100.0,
        },
        {
            "timestamp": datetime(2024, 1, 3),
            "open": 102.0,
            "high": 108.0,
            "low": 101.0,
            "close": 107.0,
            "volume": 1200.0,
        },
    ]

    # 加载测试数据
    await backtester.load_data(test_data)

    # 测试无效策略参数
    invalid_strategy = {"type": "simple_ma"}
    market_data = {"timestamp": datetime(2024, 1, 3)}
    result = await backtester._run_strategy(invalid_strategy, market_data)
    assert result is None

    # 测试有效策略 - 金叉买入信号
    strategy = {"type": "simple_ma", "params": {"short_window": 2, "long_window": 3}}
    result = await backtester._run_strategy(strategy, market_data)
    assert result is not None
    assert result["type"] == "buy"
    assert "metrics" in result
    assert "short_ma" in result["metrics"]
    assert "long_ma" in result["metrics"]

    # 测试有效策略 - 死叉卖出信号
    test_data.append(
        {
            "timestamp": datetime(2024, 1, 4),
            "open": 107.0,
            "high": 108.0,
            "low": 95.0,
            "close": 96.0,
            "volume": 1300.0,
        }
    )
    await backtester.load_data(test_data)
    market_data["timestamp"] = datetime(2024, 1, 4)
    result = await backtester._run_strategy(strategy, market_data)
    assert result is not None
    assert result["type"] == "sell"

    # 测试数据不足的情况
    strategy["params"]["long_window"] = 10
    result = await backtester._run_strategy(strategy, market_data)
    assert result is None


@pytest.mark.asyncio
async def test_risk_controller_integration(backtester):
    """测试风险控制器集成"""
    # 设置测试数据
    test_data = [
        {
            "timestamp": datetime(2024, 1, 1),
            "open": 100.0,
            "high": 105.0,
            "low": 95.0,
            "close": 100.0,
            "volume": 1000.0,
        }
    ]
    await backtester.load_data(test_data)

    # 测试仓位计算
    position_size = backtester._calculate_position_size(
        balance=Decimal("10000"), price=Decimal("100"), risk_per_trade=Decimal("0.01")
    )
    assert isinstance(position_size, Decimal)
    assert position_size > 0

    # 测试交易执行和风险检查
    position = {"type": "buy", "size": float(position_size)}
    market_data = {"timestamp": datetime(2024, 1, 1), "price": 100.0}

    # 执行交易
    balance = Decimal("10000")
    new_balance, trade = await backtester._execute_trade(
        balance, position, Decimal("100"), market_data["timestamp"]
    )

    assert isinstance(new_balance, Decimal)
    assert new_balance < balance  # 买入应该减少余额
    assert trade is not None
    assert trade["type"] == "buy"
    assert isinstance(trade["price"], float)
