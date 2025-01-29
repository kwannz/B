"""Test fixtures and configuration."""

import os
import pytest
<<<<<<< HEAD
import asyncio
from typing import Generator
from unittest.mock import MagicMock
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, Session

# Set up test environment variables
os.environ["DEEPSEEK_API_KEY"] = "sk-4ff47d34c52948edab6c9d0e7745b75b"
os.environ["DEEPSEEK_API_URL"] = "https://api.deepseek.com/v1/chat/completions"
os.environ["DEEPSEEK_MODEL"] = "deepseek-chat"
os.environ["DEEPSEEK_MODEL_R1"] = "deepseek-reasoner"
os.environ["DEEPSEEK_TEMPERATURE"] = "0.1"
os.environ["DEEPSEEK_MAX_TOKENS"] = "1000"
os.environ["DEEPSEEK_MIN_CONFIDENCE"] = "0.7"
os.environ["DEEPSEEK_MAX_RETRIES"] = "3"
os.environ["DEEPSEEK_RETRY_DELAY"] = "2.0"

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
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="function")
async def mock_deepseek_api():
    """Mock DeepSeek API responses."""
    async def mock_api_call(*args, **kwargs):
        messages = kwargs.get("json", {}).get("messages", [])
        prompt = messages[-1]["content"] if messages else ""
        
        if "sentiment" in prompt.lower():
            return {
                "choices": [{
                    "message": {
                        "content": "POSITIVE 0.85"
                    }
                }]
            }
        elif "validate_trade" in prompt.lower():
            if "{}" in prompt or '"type": "market"' in prompt:
                raise ValueError("Invalid trade parameters")
            elif "invalid" in prompt.lower():
                return {
                    "choices": [{
                        "message": {
                            "content": json.dumps({
                                "is_valid": False,
                                "confidence": 0.95,
                                "risk_assessment": {
                                    "risk_level": 0.9,
                                    "max_loss": 15.0,
                                    "position_size": 1.0,
                                    "volatility_exposure": 0.8
                                },
                                "validation_metrics": {
                                    "expected_return": -1.5,
                                    "risk_reward_ratio": 0.5,
                                    "market_conditions_alignment": 0.3
                                },
                                "recommendations": ["Avoid trade due to high risk"],
                                "reason": "Invalid market conditions and high risk exposure"
                            })
                        }
                    }]
                }
            else:
                return {
                    "choices": [{
                        "message": {
                            "content": json.dumps({
                                "is_valid": True,
                                "confidence": 0.85,
                                "risk_assessment": {
                                    "risk_level": 0.6,
                                    "max_loss": 5.0,
                                    "position_size": 1.5,
                                    "volatility_exposure": 0.4
                                },
                                "validation_metrics": {
                                    "expected_return": 2.5,
                                    "risk_reward_ratio": 2.0,
                                    "market_conditions_alignment": 0.8
                                },
                                "recommendations": ["Consider increasing position size"],
                                "reason": "Trade aligns with market conditions"
                            })
                        }
                    }]
                }
        else:
            return {
                "choices": [{
                    "message": {
                        "content": json.dumps({
                            "sentiment_score": 0.8,
                            "confidence": 0.9,
                            "model_used": "deepseek-reasoner",
                            "fallback_used": False,
                            "strategy_type": "momentum",
                            "parameters": {"lookback": 20},
                            "signals": ["MACD golden cross"],
                            "performance_metrics": {"sharpe": 1.5},
                            "risk_metrics": {"max_drawdown": 0.1},
                            "weights": {"momentum": 0.6},
                            "expected_performance": {"return": 0.15}
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
||||||| 8d442a778
from typing import Generator
from unittest.mock import MagicMock
from datetime import datetime
from sqlalchemy.orm import Session

from tradingbot.models.tenant import Tenant
from tradingbot.models.trading import Wallet, Strategy, StrategyType

# Configure pytest-asyncio
import pytest_asyncio

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch
from tradingbot.models.trading import Wallet, Strategy, StrategyType

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
    from tradingbot.shared.ai_analyzer import AIAnalyzer
    analyzer = AIAnalyzer()
    analyzer._call_model = mock_deepseek_api
    await analyzer.start()
    try:
        yield analyzer
    finally:
        await analyzer.stop()
=======
import os
import sys
>>>>>>> origin/main

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

<<<<<<< HEAD
@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(
        "postgresql+asyncpg://tradingbot:tradingbot@localhost:5432/tradingbot",
        echo=True,
        future=True,
        pool_pre_ping=True
    )
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def db_session(engine) -> AsyncSession:
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        future=True
    )
    
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


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
||||||| 8d442a778
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
=======
@pytest.fixture
def mock_model_config(monkeypatch):
    config = {
        "AI_MODEL_MODE": "LOCAL",
        "LOCAL_MODEL_NAME": "sentiment-analyzer:v1",
        "LOCAL_MODEL_ENDPOINT": "http://localhost:11434",
        "TEMPERATURE": 0.1
    }
    for key, value in config.items():
        monkeypatch.setenv(key, str(value))
    return config
>>>>>>> origin/main
