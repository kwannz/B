import os
import sys

import pytest
from sqlalchemy.orm import Session

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
def db(test_db) -> Session:
    """Get database session"""
    db = next(get_db())
    try:
        yield db
    finally:
        db.close()
