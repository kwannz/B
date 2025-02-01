"""Unit tests for RollingDataFrame class."""

import pytest
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timedelta

from tradingbot.core.services.rolling_data import RollingDataFrame


@pytest.fixture
def sample_data():
    """Create sample market data for testing."""
    timestamps = [datetime.now() + timedelta(minutes=i) for i in range(10)]
    return [
        {"timestamp": ts.isoformat(), "price": 100 + i, "volume": 1000 + i * 100}
        for i, ts in enumerate(timestamps)
    ]


def test_init():
    """Test RollingDataFrame initialization."""
    df = RollingDataFrame(window_size=100, min_size=10)
    assert df.window_size == 100
    assert df.min_size == 10
    assert df.df is None
    assert not df.indicators_calculated


def test_update_single():
    """Test updating with single data point."""
    df = RollingDataFrame(window_size=100, min_size=1)
    data = {"timestamp": datetime.now().isoformat(), "price": 100.0, "volume": 1000}

    success = df.update(data)
    assert success
    assert df.df is not None
    assert len(df.df) == 1
    assert not df.indicators_calculated


def test_update_batch(sample_data):
    """Test updating with batch of data points."""
    df = RollingDataFrame(window_size=100, min_size=5)

    success = df.update_batch(sample_data)
    assert success
    assert df.df is not None
    assert len(df.df) == len(sample_data)
    assert not df.indicators_calculated


def test_window_size_limit():
    """Test that DataFrame maintains window size limit."""
    df = RollingDataFrame(window_size=5, min_size=2)

    # Add more data points than window size
    data = [
        {
            "timestamp": (datetime.now() + timedelta(minutes=i)).isoformat(),
            "price": 100 + i,
            "volume": 1000 + i,
        }
        for i in range(10)
    ]

    df.update_batch(data)
    assert len(df.df) == 5  # Should only keep last 5 points
    assert df.df.iloc[-1]["price"] == data[-1]["price"]  # Should have latest data


def test_get_dataframe_min_size():
    """Test minimum size requirement for getting DataFrame."""
    df = RollingDataFrame(window_size=100, min_size=5)

    # Add fewer points than min_size
    data = [{"timestamp": datetime.now().isoformat(), "price": 100, "volume": 1000}]

    df.update_batch(data)
    assert df.get_dataframe() is None  # Should return None if below min_size


def test_calculate_indicators(sample_data):
    """Test technical indicator calculation."""
    df = RollingDataFrame(window_size=100, min_size=5)
    df.update_batch(sample_data)

    success = df.calculate_indicators()
    assert success
    assert df.indicators_calculated

    # Verify indicators were calculated
    assert "RSI_14" in df.df.columns
    assert "MACD_12_26_9" in df.df.columns
    assert "BBU_20_2.0" in df.df.columns
    assert "SMA_20" in df.df.columns
    assert "VOLATILITY_10" in df.df.columns


def test_clear():
    """Test clearing the DataFrame."""
    df = RollingDataFrame(window_size=100, min_size=5)
    df.update_batch(
        [{"timestamp": datetime.now().isoformat(), "price": 100, "volume": 1000}]
    )

    df.clear()
    assert df.df is None
    assert not df.indicators_calculated


def test_error_handling():
    """Test error handling for invalid data."""
    df = RollingDataFrame(window_size=100, min_size=5)

    # Try updating with invalid data
    invalid_data = {"invalid": "data"}
    success = df.update(invalid_data)
    assert not success
    assert df.df is None


def test_indicator_recalculation():
    """Test that indicators are recalculated after updates."""
    df = RollingDataFrame(window_size=100, min_size=5)

    # Add initial data and calculate indicators
    initial_data = [
        {
            "timestamp": (datetime.now() + timedelta(minutes=i)).isoformat(),
            "price": 100 + i,
            "volume": 1000 + i,
        }
        for i in range(5)
    ]
    df.update_batch(initial_data)
    df.calculate_indicators()
    assert df.indicators_calculated

    # Add new data point
    new_data = {
        "timestamp": (datetime.now() + timedelta(minutes=5)).isoformat(),
        "price": 105,
        "volume": 1005,
    }
    df.update(new_data)
    assert not df.indicators_calculated  # Should be marked for recalculation
