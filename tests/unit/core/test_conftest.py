"""Test conftest.py fixtures"""

import pytest
from unittest.mock import MagicMock
from sqlalchemy.orm import Session
from datetime import datetime

from tradingbot.models.tenant import Tenant
from tradingbot.models.trading import Wallet, Strategy, StrategyType


def test_event_loop_policy(event_loop_policy):
    """Test event loop policy fixture"""
    assert event_loop_policy is not None
    assert hasattr(event_loop_policy, "get_event_loop")


def test_db_session(db_session):
    """Test database session fixture"""
    assert isinstance(db_session, MagicMock)
    assert (
        isinstance(db_session._mock_wraps, Session) or db_session._spec_class == Session
    )


def test_test_tenant(test_tenant):
    """Test tenant fixture"""
    assert isinstance(test_tenant, Tenant)
    assert test_tenant.name == "Test Tenant"
    assert test_tenant.api_key.startswith("test_api_key_")
    assert test_tenant.id == "test_tenant_id"


def test_test_wallet(test_wallet, test_tenant):
    """Test wallet fixture"""
    assert isinstance(test_wallet, Wallet)
    assert test_wallet.tenant_id == test_tenant.id
    assert test_wallet.chain == "solana"
    assert test_wallet.balance == 1000.0
    assert test_wallet.is_active is True
    assert test_wallet.address.startswith("test_wallet_")
    assert test_wallet.id.startswith("test_wallet_id_")


def test_test_strategy(test_strategy, test_tenant):
    """Test strategy fixture"""
    assert isinstance(test_strategy, Strategy)
    assert test_strategy.tenant_id == test_tenant.id
    assert test_strategy.name == "Test Strategy"
    assert test_strategy.strategy_type == StrategyType.TECHNICAL_ANALYSIS
    assert test_strategy.parameters == {"test": "value"}
    assert test_strategy.is_active is True
    assert test_strategy.id == "test_strategy_id"


def test_mock_session(mock_session):
    """Test mock session fixture"""
    assert isinstance(mock_session, MagicMock)


def test_tenant_session(tenant_session):
    """Test tenant session fixture"""
    assert isinstance(tenant_session, MagicMock)


def test_setup_test_environment(setup_test_environment):
    """Test setup test environment fixture"""
    assert setup_test_environment is None


def test_mock_market_data_aggregator(mock_market_data_aggregator):
    """Test market data aggregator fixture"""
    assert isinstance(mock_market_data_aggregator, MagicMock)


def test_mock_sentiment_analyzer(mock_sentiment_analyzer):
    """Test sentiment analyzer fixture"""
    assert isinstance(mock_sentiment_analyzer, MagicMock)


def test_mock_twitter_data(mock_twitter_data):
    """Test Twitter data fixture"""
    assert isinstance(mock_twitter_data, MagicMock)


def test_mock_discord_data(mock_discord_data):
    """Test Discord data fixture"""
    assert isinstance(mock_discord_data, MagicMock)
