import os
import sys
from typing import Generator
import asyncio

import pytest
from sqlalchemy.orm import Session
from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))

from tradingbot.shared.models.database import init_db, get_db
from tradingbot.shared.config import settings


@pytest.fixture(scope="session")
def test_db():
    """Initialize test database"""
    init_db()
    yield
    # Cleanup after tests if needed


@pytest.fixture
def db(test_db) -> Generator[Session, None, None]:
    """Get database session"""
    db = next(get_db())
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
async def wallet_manager():
    """Get wallet manager instance"""
    wm = WalletManager()
    wm.initialize_wallet(os.environ.get("walletkey"))
    yield wm

@pytest.fixture
async def dex_client():
    """Get DEX client instance"""
    from tradingbot.shared.exchange.dex_client import DEXClient
    client = DEXClient()
    await client.start()
    try:
        yield client
    finally:
        await client.stop()
