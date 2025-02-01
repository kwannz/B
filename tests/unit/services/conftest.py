"""Fixtures for service tests"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta


# Service mocks
@pytest.fixture
def mock_market_service():
    """Mock market data service"""
    service = MagicMock()
    service.get_price = AsyncMock(return_value=100.0)
    service.get_volume = AsyncMock(return_value=1000.0)
    service.get_market_cap = AsyncMock(return_value=1000000.0)
    return service


@pytest.fixture
def mock_trading_service():
    """Mock trading service"""
    service = MagicMock()
    service.place_order = AsyncMock(return_value={"order_id": "test_order"})
    service.cancel_order = AsyncMock(return_value=True)
    service.get_position = AsyncMock(return_value={"size": 1.0, "entry_price": 100.0})
    return service


@pytest.fixture
def mock_risk_service():
    """Mock risk management service"""
    service = MagicMock()
    service.check_risk = AsyncMock(return_value=True)
    service.calculate_position_size = AsyncMock(return_value=1.0)
    service.get_risk_metrics = AsyncMock(return_value={"var": 0.1, "sharpe": 2.0})
    return service


@pytest.fixture
def mock_alert_service():
    """Mock alert service"""
    service = MagicMock()
    service.send_alert = AsyncMock(return_value=True)
    service.get_alerts = AsyncMock(return_value=[])
    return service


# Data fixtures
@pytest.fixture
def sample_market_data():
    """Sample market data for testing"""
    return {
        "price": 100.0,
        "volume": 1000.0,
        "timestamp": datetime.utcnow(),
        "high": 105.0,
        "low": 95.0,
        "open": 98.0,
        "close": 100.0,
    }


@pytest.fixture
def sample_trade_data():
    """Sample trade data for testing"""
    return {
        "symbol": "BTC/USD",
        "side": "buy",
        "size": 1.0,
        "price": 100.0,
        "timestamp": datetime.utcnow(),
    }


# Time-related fixtures
@pytest.fixture
def time_range():
    """Time range for testing"""
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return start, end
