"""
Tests for database models
"""

import pytest
from datetime import datetime
from sqlalchemy import create_engine, String
from sqlalchemy.orm import sessionmaker
from tradingbot.src.trading_agent.api.models import (
    Base,
    User,
    APIKey,
    Strategy,
    Position,
    Trade,
    Metric,
    Setting,
    NewsArticle,
    SentimentRecord,
    SocialMediaPost,
)


@pytest.fixture(scope="function")
def engine():
    """Create test database engine"""
    return create_engine("sqlite:///:memory:")


@pytest.fixture(scope="function")
def TestingSessionLocal(engine):
    """Create database session"""
    # Create only the tables we need for testing
    tables = [
        User.__table__,
        APIKey.__table__,
        Strategy.__table__,
        Position.__table__,
        Trade.__table__,
        Metric.__table__,
        Setting.__table__,
    ]
    for table in tables:
        table.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal


@pytest.fixture
def db_session(TestingSessionLocal):
    """Database session for testing"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_user_model(db_session):
    """Test User model creation and relationships"""
    user = User(
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        hashed_password="hashedpass",
    )
    db_session.add(user)
    db_session.commit()

    assert user.id is not None
    assert user.username == "testuser"
    assert user.email == "test@example.com"
    assert user.is_active is True
    assert isinstance(user.created_at, datetime)
    assert isinstance(user.updated_at, datetime)


def test_api_key_model(db_session):
    """Test APIKey model"""
    user = User(username="testuser", email="test@example.com")
    db_session.add(user)
    db_session.commit()

    api_key = APIKey(
        user_id=user.id,
        name="Test Key",
        key="testkey123",
        secret="testsecret",
        exchange="binance",
    )
    db_session.add(api_key)
    db_session.commit()

    assert api_key.id is not None
    assert api_key.user_id == user.id
    assert api_key.is_active is True
    assert api_key.user.username == "testuser"


def test_strategy_model(db_session):
    """Test Strategy model and relationships"""
    user = User(username="testuser", email="test@example.com")
    db_session.add(user)
    db_session.commit()

    strategy = Strategy(
        user_id=user.id,
        name="Test Strategy",
        description="Test Description",
        type="test_type",
        config={"param": "value"},
    )
    db_session.add(strategy)
    db_session.commit()

    assert strategy.id is not None
    assert strategy.name == "Test Strategy"
    assert strategy.config == {"param": "value"}
    assert strategy.is_active is True
    assert strategy.user.username == "testuser"


def test_position_model(db_session):
    """Test Position model"""
    user = User(username="testuser", email="test@example.com")
    strategy = Strategy(user_id=user.id, name="Test Strategy", type="test_type")
    db_session.add_all([user, strategy])
    db_session.commit()

    position = Position(
        strategy_id=strategy.id,
        symbol="BTC/USD",
        side="long",
        quantity=1.0,
        entry_price=50000.0,
        current_price=51000.0,
        unrealized_pnl=1000.0,
        status="open",
    )
    db_session.add(position)
    db_session.commit()

    assert position.id is not None
    assert position.symbol == "BTC/USD"
    assert position.realized_pnl == 0
    assert position.strategy.name == "Test Strategy"


def test_trade_model(db_session):
    """Test Trade model"""
    user = User(username="testuser", email="test@example.com")
    strategy = Strategy(user_id=user.id, name="Test Strategy", type="test_type")
    position = Position(
        strategy_id=strategy.id,
        symbol="BTC/USD",
        side="long",
        quantity=1.0,
        entry_price=50000.0,
        current_price=51000.0,
        status="open",
    )
    db_session.add_all([user, strategy, position])
    db_session.commit()

    trade = Trade(
        strategy_id=strategy.id,
        position_id=position.id,
        symbol="BTC/USD",
        side="buy",
        type="market",
        quantity=1.0,
        price=50000.0,
        executed_price=50000.0,
        executed_quantity=1.0,
        fee=10.0,
        status="executed",
        meta_data={"note": "test trade"},
    )
    db_session.add(trade)
    db_session.commit()

    assert trade.id is not None
    assert trade.symbol == "BTC/USD"
    assert trade.meta_data == {"note": "test trade"}
    assert trade.strategy.name == "Test Strategy"
    assert trade.position.symbol == "BTC/USD"


def test_metric_model(db_session):
    """Test Metric model"""
    user = User(username="testuser", email="test@example.com")
    strategy = Strategy(user_id=user.id, name="Test Strategy", type="test_type")
    db_session.add_all([user, strategy])
    db_session.commit()

    metric = Metric(
        strategy_id=strategy.id,
        total_pnl=1000.0,
        win_rate=0.65,
        sharpe_ratio=2.1,
        max_drawdown=0.15,
        total_trades=100,
        winning_trades=65,
        losing_trades=35,
    )
    db_session.add(metric)
    db_session.commit()

    assert metric.id is not None
    assert metric.total_pnl == 1000.0
    assert metric.win_rate == 0.65


def test_setting_model(db_session):
    """Test Setting model"""
    user = User(username="testuser", email="test@example.com")
    db_session.add(user)
    db_session.commit()

    setting = Setting(user_id=user.id, key="theme", value={"mode": "dark"})
    db_session.add(setting)
    db_session.commit()

    assert setting.id is not None
    assert setting.key == "theme"
    assert setting.value == {"mode": "dark"}


# Skip UUID-based model tests for SQLite compatibility
@pytest.mark.skip(reason="UUID type not supported in SQLite")
def test_news_article_model(db_session):
    pass


@pytest.mark.skip(reason="UUID type not supported in SQLite")
def test_sentiment_record_model(db_session):
    pass


@pytest.mark.skip(reason="UUID type not supported in SQLite")
def test_social_media_post_model(db_session):
    pass
