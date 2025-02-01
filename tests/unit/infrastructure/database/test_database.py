"""
Tests for database operations
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import Column, Integer, String, Boolean, Float
from tradingbot.src.trading_agent.api.database import (
    Base,
    get_db,
    CRUDBase,
    UserCRUD,
    StrategyCRUD,
    PositionCRUD,
    TradeCRUD,
    MetricCRUD,
    SettingCRUD,
)


# Test models
class TestUser(Base):
    __tablename__ = "test_users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)


class TestStrategy(Base):
    __tablename__ = "test_strategies"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    user_id = Column(Integer)
    is_active = Column(Boolean, default=True)


class TestPosition(Base):
    __tablename__ = "test_positions"
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer)
    status = Column(String)


class TestTrade(Base):
    __tablename__ = "test_trades"
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer)
    position_id = Column(Integer)


class TestMetric(Base):
    __tablename__ = "test_metrics"
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer)
    value = Column(Float)


class TestSetting(Base):
    __tablename__ = "test_settings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    key = Column(String)
    value = Column(String)


@pytest.fixture(scope="function")
def test_db():
    """Create a test database"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def user_crud():
    return UserCRUD(TestUser)


@pytest.fixture
def strategy_crud():
    return StrategyCRUD(TestStrategy)


@pytest.fixture
def position_crud():
    return PositionCRUD(TestPosition)


@pytest.fixture
def trade_crud():
    return TradeCRUD(TestTrade)


@pytest.fixture
def metric_crud():
    return MetricCRUD(TestMetric)


@pytest.fixture
def setting_crud():
    return SettingCRUD(TestSetting)


def test_crud_base_operations(test_db):
    crud = CRUDBase(TestUser)

    # Test create
    user_data = {
        "username": "test",
        "email": "test@example.com",
        "hashed_password": "hash",
    }
    user = crud.create(test_db, obj_in=user_data)
    assert user.username == "test"

    # Test get
    retrieved_user = crud.get(test_db, id=user.id)
    assert retrieved_user.email == "test@example.com"

    # Test get_multi
    users = crud.get_multi(test_db)
    assert len(users) == 1

    # Test update
    update_data = {"username": "updated"}
    updated_user = crud.update(test_db, db_obj=user, obj_in=update_data)
    assert updated_user.username == "updated"

    # Test delete
    deleted_user = crud.delete(test_db, id=user.id)
    assert deleted_user.id == user.id
    assert crud.get(test_db, id=user.id) is None


def test_user_crud_operations(test_db, user_crud):
    # Create test user
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "hashed_password": "hash",
    }
    user = user_crud.create(test_db, obj_in=user_data)

    # Test get_by_email
    found_user = user_crud.get_by_email(test_db, email="test@example.com")
    assert found_user.username == "testuser"

    # Test get_by_username
    found_user = user_crud.get_by_username(test_db, username="testuser")
    assert found_user.email == "test@example.com"


def test_strategy_crud_operations(test_db, strategy_crud):
    # Create test strategies
    strategy_data = {"name": "test_strategy", "user_id": 1, "is_active": True}
    strategy = strategy_crud.create(test_db, obj_in=strategy_data)

    # Test get_by_user
    strategies = strategy_crud.get_by_user(test_db, user_id=1)
    assert len(strategies) == 1
    assert strategies[0].name == "test_strategy"

    # Test get_active_strategies
    active_strategies = strategy_crud.get_active_strategies(test_db, user_id=1)
    assert len(active_strategies) == 1

    # Create inactive strategy
    inactive_strategy = strategy_crud.create(
        test_db, obj_in={"name": "inactive", "user_id": 1, "is_active": False}
    )
    active_strategies = strategy_crud.get_active_strategies(test_db, user_id=1)
    assert len(active_strategies) == 1


def test_position_crud_operations(test_db, position_crud):
    # Create test positions
    position_data = {"strategy_id": 1, "status": "open"}
    position = position_crud.create(test_db, obj_in=position_data)

    # Test get_by_strategy
    positions = position_crud.get_by_strategy(test_db, strategy_id=1)
    assert len(positions) == 1

    # Test get_open_positions
    open_positions = position_crud.get_open_positions(test_db, strategy_id=1)
    assert len(open_positions) == 1

    # Create closed position
    closed_position = position_crud.create(
        test_db, obj_in={"strategy_id": 1, "status": "closed"}
    )
    open_positions = position_crud.get_open_positions(test_db, strategy_id=1)
    assert len(open_positions) == 1


def test_trade_crud_operations(test_db, trade_crud):
    # Create test trades
    trade_data = {"strategy_id": 1, "position_id": 1}
    trade = trade_crud.create(test_db, obj_in=trade_data)

    # Test get_by_strategy
    trades = trade_crud.get_by_strategy(test_db, strategy_id=1)
    assert len(trades) == 1

    # Test get_by_position
    position_trades = trade_crud.get_by_position(test_db, position_id=1)
    assert len(position_trades) == 1


def test_metric_crud_operations(test_db, metric_crud):
    # Create test metric
    metric_data = {"strategy_id": 1, "value": 100.0}
    metric = metric_crud.create(test_db, obj_in=metric_data)

    # Test get_by_strategy
    found_metric = metric_crud.get_by_strategy(test_db, strategy_id=1)
    assert found_metric.value == 100.0


def test_setting_crud_operations(test_db, setting_crud):
    # Create test settings
    setting_data = {"user_id": 1, "key": "theme", "value": "dark"}
    setting = setting_crud.create(test_db, obj_in=setting_data)

    # Test get_by_user
    settings = setting_crud.get_by_user(test_db, user_id=1)
    assert len(settings) == 1
    assert settings[0].key == "theme"

    # Test get_by_key
    found_setting = setting_crud.get_by_key(test_db, user_id=1, key="theme")
    assert found_setting.value == "dark"


def test_db_context_manager():
    """Test the database context manager"""
    with get_db() as db:
        assert db is not None
    # Context manager should close the session after the block
