"""Test fixtures and configuration."""

import pytest
from typing import Generator
from unittest.mock import MagicMock
from datetime import datetime
from sqlalchemy.orm import Session

from src.shared.models.tenant import Tenant
from src.shared.models.trading import Wallet, Strategy, StrategyType

# Configure pytest-asyncio
import pytest_asyncio

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch

def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "asyncio: mark test as async")

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def mock_deepseek_api():
    """Mock DeepSeek API responses."""
    async def mock_api_call(*args, **kwargs):
        return {
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "sentiment_score": 0.8,
                        "confidence": 0.9,
                        "model_used": "deepseek-v3",
                        "fallback_used": False,
                        "strategy_type": "momentum",
                        "parameters": {"lookback": 20},
                        "signals": ["MACD golden cross"],
                        "performance_metrics": {"sharpe": 1.5},
                        "risk_metrics": {"max_drawdown": 0.1},
                        "weights": {"momentum": 0.6},
                        "expected_performance": {"return": 0.15},
                        "total_returns": 0.2,
                        "trade_count": 10,
                        "win_rate": 0.7,
                        "profit_factor": 1.8,
                        "max_drawdown": 0.1,
                        "sharpe_ratio": 1.5
                    })
                }
            }]
        }
    return AsyncMock(side_effect=mock_api_call)

@pytest_asyncio.fixture
async def ai_analyzer(mock_deepseek_api):
    """Fixture for AI Analyzer instance."""
    from src.shared.ai_analyzer import AIAnalyzer
    analyzer = AIAnalyzer()
    analyzer._call_model = mock_deepseek_api
    await analyzer.start()
    try:
        yield analyzer
    finally:
        await analyzer.stop()


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
