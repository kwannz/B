"""
Tests for API schemas
"""

import pytest
from datetime import datetime
from decimal import Decimal
from pydantic import ValidationError
from tradingbot.src.trading_agent.api.schemas import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserInDB,
    APIKeyBase,
    APIKeyCreate,
    APIKeyUpdate,
    APIKeyInDB,
    StrategyBase,
    StrategyCreate,
    StrategyUpdate,
    StrategyInDB,
    PositionBase,
    PositionCreate,
    PositionUpdate,
    PositionInDB,
    TradeBase,
    TradeCreate,
    TradeUpdate,
    TradeInDB,
    MetricBase,
    MetricCreate,
    MetricUpdate,
    MetricInDB,
    SettingBase,
    SettingCreate,
    SettingUpdate,
    SettingInDB,
    Token,
    TokenData,
)


def test_user_schemas():
    """Test user-related schemas"""
    # Test UserBase
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "full_name": "Test User",
    }
    user = UserBase(**user_data)
    assert user.username == "testuser"
    assert user.email == "test@example.com"

    # Test UserCreate
    user_create_data = {**user_data, "password": "testpass"}
    user_create = UserCreate(**user_create_data)
    assert user_create.password == "testpass"

    # Test UserUpdate with optional fields
    user_update = UserUpdate(email="new@example.com")
    assert user_update.email == "new@example.com"
    assert user_update.password is None

    # Test UserInDB
    user_db_data = {
        **user_data,
        "id": 1,
        "is_active": True,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    user_db = UserInDB(**user_db_data)
    assert user_db.id == 1
    assert user_db.is_active is True


def test_api_key_schemas():
    """Test API key-related schemas"""
    # Test APIKeyBase
    key_data = {"name": "Test Key", "exchange": "binance"}
    api_key = APIKeyBase(**key_data)
    assert api_key.name == "Test Key"

    # Test APIKeyCreate
    key_create_data = {**key_data, "key": "testkey123", "secret": "testsecret"}
    api_key_create = APIKeyCreate(**key_create_data)
    assert api_key_create.key == "testkey123"

    # Test APIKeyUpdate
    api_key_update = APIKeyUpdate(name="Updated Key")
    assert api_key_update.name == "Updated Key"
    assert api_key_update.key is None


def test_strategy_schemas():
    """Test strategy-related schemas"""
    # Test StrategyBase
    strategy_data = {
        "name": "Test Strategy",
        "description": "Test Description",
        "type": "test_type",
        "config": {"param": "value"},
    }
    strategy = StrategyBase(**strategy_data)
    assert strategy.name == "Test Strategy"
    assert strategy.config == {"param": "value"}

    # Test StrategyCreate
    strategy_create = StrategyCreate(**strategy_data)
    assert strategy_create.name == strategy_data["name"]

    # Test StrategyUpdate
    strategy_update = StrategyUpdate(name="Updated Strategy")
    assert strategy_update.name == "Updated Strategy"
    assert strategy_update.config is None


def test_position_schemas():
    """Test position-related schemas"""
    # Test PositionBase
    position_data = {
        "symbol": "BTC/USD",
        "side": "long",
        "quantity": Decimal("1.0"),
        "entry_price": Decimal("50000.0"),
        "stop_loss": Decimal("49000.0"),
        "take_profit": Decimal("51000.0"),
    }
    position = PositionBase(**position_data)
    assert position.symbol == "BTC/USD"
    assert position.side == "long"

    # Test side validation
    with pytest.raises(ValidationError):
        PositionBase(**{**position_data, "side": "invalid"})

    # Test PositionCreate
    position_create_data = {**position_data, "strategy_id": 1}
    position_create = PositionCreate(**position_create_data)
    assert position_create.strategy_id == 1

    # Test PositionUpdate
    position_update = PositionUpdate(status="closed")
    assert position_update.status == "closed"

    with pytest.raises(ValidationError):
        PositionUpdate(status="invalid")


def test_trade_schemas():
    """Test trade-related schemas"""
    # Test TradeBase
    trade_data = {
        "symbol": "BTC/USD",
        "side": "buy",
        "type": "market",
        "quantity": Decimal("1.0"),
        "price": Decimal("50000.0"),
    }
    trade = TradeBase(**trade_data)
    assert trade.symbol == "BTC/USD"
    assert trade.side == "buy"

    # Test side validation
    with pytest.raises(ValidationError):
        TradeBase(**{**trade_data, "side": "invalid"})

    # Test type validation
    with pytest.raises(ValidationError):
        TradeBase(**{**trade_data, "type": "invalid"})

    # Test TradeCreate
    trade_create_data = {**trade_data, "strategy_id": 1}
    trade_create = TradeCreate(**trade_create_data)
    assert trade_create.strategy_id == 1

    # Test TradeUpdate
    trade_update = TradeUpdate(status="executed")
    assert trade_update.status == "executed"

    with pytest.raises(ValidationError):
        TradeUpdate(status="invalid")


def test_metric_schemas():
    """Test metric-related schemas"""
    # Test MetricBase
    metric_data = {
        "total_pnl": Decimal("1000.0"),
        "win_rate": 0.65,
        "sharpe_ratio": 2.1,
        "max_drawdown": 0.15,
        "total_trades": 100,
        "winning_trades": 65,
        "losing_trades": 35,
    }
    metric = MetricBase(**metric_data)
    assert metric.total_pnl == Decimal("1000.0")
    assert metric.win_rate == 0.65

    # Test MetricCreate
    metric_create_data = {**metric_data, "strategy_id": 1}
    metric_create = MetricCreate(**metric_create_data)
    assert metric_create.strategy_id == 1


def test_setting_schemas():
    """Test setting-related schemas"""
    # Test SettingBase
    setting_data = {"key": "theme", "value": {"mode": "dark"}}
    setting = SettingBase(**setting_data)
    assert setting.key == "theme"
    assert setting.value == {"mode": "dark"}

    # Test SettingCreate
    setting_create = SettingCreate(**setting_data)
    assert setting_create.key == setting_data["key"]

    # Test SettingUpdate
    setting_update = SettingUpdate(value={"mode": "light"})
    assert setting_update.value == {"mode": "light"}


def test_token_schemas():
    """Test token-related schemas"""
    # Test Token
    token_data = {"access_token": "test_token", "token_type": "bearer"}
    token = Token(**token_data)
    assert token.access_token == "test_token"
    assert token.token_type == "bearer"

    # Test TokenData
    token_data = TokenData(username="testuser")
    assert token_data.username == "testuser"

    # Test optional username
    token_data = TokenData()
    assert token_data.username is None


def test_orm_mode():
    """Test ORM mode functionality"""

    class Config:
        from_attributes = True

    # Create a mock ORM model-like object
    class MockUser:
        id = 1
        username = "testuser"
        email = "test@example.com"
        full_name = "Test User"
        is_active = True
        created_at = datetime.now()
        updated_at = datetime.now()

    # Update UserInDB config
    UserInDB.Config = Config

    # Test conversion from ORM to Pydantic model
    mock_user = MockUser()
    user_db = UserInDB.from_orm(mock_user)
    assert user_db.id == 1
    assert user_db.username == "testuser"
