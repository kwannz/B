"""Fixtures for model tests"""

import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4


# Base model fixtures
@pytest.fixture
def base_model_data():
    """Base data for model testing"""
    return {
        "id": str(uuid4()),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True,
    }


# Trading model fixtures
@pytest.fixture
def strategy_data(base_model_data):
    """Strategy model test data"""
    return {
        **base_model_data,
        "name": "Test Strategy",
        "description": "Test strategy description",
        "type": "momentum",
        "parameters": {"timeframe": "1h", "threshold": 0.5},
        "risk_parameters": {"max_position_size": 1.0, "stop_loss": 0.1},
    }


@pytest.fixture
def position_data(base_model_data, strategy_data):
    """Position model test data"""
    return {
        **base_model_data,
        "strategy_id": strategy_data["id"],
        "symbol": "BTC/USD",
        "side": "long",
        "size": Decimal("1.0"),
        "entry_price": Decimal("50000.0"),
        "current_price": Decimal("51000.0"),
        "unrealized_pnl": Decimal("1000.0"),
        "status": "open",
    }


# User model fixtures
@pytest.fixture
def user_data(base_model_data):
    """User model test data"""
    return {
        **base_model_data,
        "username": "test_user",
        "email": "test@example.com",
        "is_verified": True,
        "preferences": {"theme": "dark", "notifications": True},
    }


# Market data model fixtures
@pytest.fixture
def market_data(base_model_data):
    """Market data model test data"""
    return {
        **base_model_data,
        "symbol": "BTC/USD",
        "price": Decimal("50000.0"),
        "volume": Decimal("1000.0"),
        "timestamp": datetime.utcnow(),
        "source": "binance",
    }


# Schema validation fixtures
@pytest.fixture
def invalid_data():
    """Invalid data for schema validation testing"""
    return {
        "missing_required": {},
        "invalid_type": {"price": "not_a_number", "volume": "invalid"},
        "out_of_range": {"price": -1, "volume": -100},
    }
