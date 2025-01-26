"""Test fixtures for strategy tests."""
import pytest
from unittest.mock import MagicMock

pytest.register_assert_rewrite('tests.strategies.test_technical_analysis')

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock()

@pytest.fixture
def tenant_session(mock_session):
    """Create a mock tenant session."""
    return mock_session
