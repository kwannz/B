"""Test fixtures and configuration."""

import pytest
from typing import Generator
from unittest.mock import MagicMock
from datetime import datetime
from sqlalchemy.orm import Session

from tradingbot.models.tenant import Tenant
from tradingbot.models.trading import Wallet, Strategy, StrategyType

# Configure pytest-asyncio
pytest.register_assert_rewrite('pytest_asyncio')
pytestmark = pytest.mark.asyncio

# Configure event loop policy for all tests
@pytest.fixture(scope="session")
def event_loop_policy():
    """Configure the event loop policy."""
    import asyncio
    policy = asyncio.get_event_loop_policy()
    return policy


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Create a mock database session."""
    session = MagicMock(spec=Session)
    yield session


@pytest.fixture
def test_tenant(db_session: Session) -> Generator[Tenant, None, None]:
    """Create test tenant."""
    tenant = Tenant(
        name="Test Tenant",
        api_key=f"test_api_key_{datetime.utcnow().isoformat()}"
    )
    tenant.id = "test_tenant_id"  # Set mock ID
    yield tenant


@pytest.fixture
def test_wallet(db_session: Session, test_tenant: Tenant) -> Generator[Wallet, None, None]:
    """Create test wallet."""
    timestamp = int(datetime.utcnow().timestamp())
    wallet = Wallet(
        tenant_id=test_tenant.id,
        address=f"test_wallet_{timestamp}",
        chain="solana",
        balance=1000.0,
        is_active=True
    )
    wallet.id = f"test_wallet_id_{timestamp}"  # Set mock ID
    yield wallet


@pytest.fixture
def test_strategy(db_session: Session, test_tenant: Tenant) -> Generator[Strategy, None, None]:
    """Create test strategy."""
    strategy = Strategy(
        tenant_id=test_tenant.id,
        name="Test Strategy",
        strategy_type=StrategyType.TECHNICAL_ANALYSIS,
        parameters={"test": "value"},
        is_active=True
    )
    strategy.id = "test_strategy_id"  # Set mock ID
    yield strategy


@pytest.fixture
def mock_session() -> Generator[MagicMock, None, None]:
    """Create a mock session."""
    session = MagicMock()
    yield session


@pytest.fixture
def tenant_session(mock_session: MagicMock) -> Generator[MagicMock, None, None]:
    """Create a mock tenant session."""
    yield mock_session


@pytest.fixture(autouse=True)
def setup_test_environment() -> None:
    """Set up test environment."""
    # This fixture runs automatically before each test
    pass


@pytest.fixture
def mock_market_data_aggregator() -> Generator[MagicMock, None, None]:
    """Create a mock market data aggregator."""
    aggregator = MagicMock()
    yield aggregator


@pytest.fixture
def mock_sentiment_analyzer() -> Generator[MagicMock, None, None]:
    """Create a mock sentiment analyzer."""
    analyzer = MagicMock()
    yield analyzer


@pytest.fixture
def mock_twitter_data() -> Generator[MagicMock, None, None]:
    """Create mock Twitter data."""
    data = MagicMock()
    yield data


@pytest.fixture
def mock_discord_data() -> Generator[MagicMock, None, None]:
    """Create mock Discord data."""
    data = MagicMock()
    yield data
