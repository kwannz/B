import os
import sys
import pytest
import asyncio
import logging
from pathlib import Path
from unittest.mock import Mock, AsyncMock

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent)
sys.path.append(project_root)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class AsyncSessionMock:
    """Mock SQLAlchemy AsyncSession"""
    def __init__(self):
        self.add = Mock()
        self.query = self._create_query_mock()
        
        # Create mock engine
        self.engine = Mock()
        self.engine.url = Mock()
        self.engine.url.database = "test_db"
        self.bind = self.engine
        
        # Create sync methods that will be wrapped for async
        self._commit = Mock()
        self._rollback = Mock()
        
        # Create async wrappers
        async def async_commit():
            await asyncio.sleep(0)  # Simulate async operation
            self._commit()
            return None
            
        async def async_rollback():
            await asyncio.sleep(0)  # Simulate async operation
            self._rollback()
            return None
            
        self.commit = async_commit
        self.rollback = async_rollback
    
    def _create_query_mock(self):
        query_mock = Mock()
        query_mock.filter = Mock(return_value=query_mock)
        query_mock.all = AsyncMock(return_value=[])
        return Mock(return_value=query_mock)
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

@pytest.fixture
async def db_session():
    """Provide mock database session"""
    return AsyncSessionMock()

@pytest.fixture
def event_loop():
    """Create event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    
    # Cancel all running tasks
    pending = asyncio.all_tasks(loop)
    for task in pending:
        task.cancel()
    
    # Run loop to complete cancellation
    loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
    loop.close()

# Environment setup
@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    """Setup test environment variables"""
    original_env = dict(os.environ)
    
    os.environ.update({
        "TESTING": "true",
        "LOG_LEVEL": "DEBUG",
        "PYTHONPATH": "/home/ubuntu/repos/tradingbot",
        "USE_PROMETHEUS": "false",
        "DATABASE_URL": "sqlite:///:memory:"
    })
    
    yield
    
    os.environ.clear()
    os.environ.update(original_env)
