"""Test tenant configuration models."""

import pytest
from tradingbot.shared.config.tenant_config import StrategyConfig, TenantConfig


def test_strategy_config_valid():
    """Test valid strategy configuration."""
    config = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    assert config.strategy_type == "momentum"
    assert config.parameters == {"param1": "value1"}


def test_strategy_config_invalid_type():
    """Test strategy configuration with invalid strategy_type."""
    with pytest.raises(ValueError, match="strategy_type must be a string"):
        StrategyConfig(
            strategy_type=123, parameters={"param1": "value1"}  # type: ignore
        )


def test_strategy_config_invalid_parameters():
    """Test strategy configuration with invalid parameters."""
    with pytest.raises(ValueError, match="parameters must be a dictionary"):
        StrategyConfig(strategy_type="momentum", parameters="invalid")  # type: ignore


def test_tenant_config_valid():
    """Test valid tenant configuration."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    config = TenantConfig(
        tenant_id="test_tenant",
        name="Test Tenant",
        api_key="test_key",
        strategies={"strategy1": strategy},
        settings={"setting1": "value1"},
    )
    assert config.tenant_id == "test_tenant"
    assert config.name == "Test Tenant"
    assert config.api_key == "test_key"
    assert isinstance(config.strategies, dict)
    assert len(config.strategies) == 1
    assert config.settings == {"setting1": "value1"}


def test_tenant_config_no_settings():
    """Test tenant configuration without settings."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    config = TenantConfig(
        tenant_id="test_tenant",
        name="Test Tenant",
        api_key="test_key",
        strategies={"strategy1": strategy},
    )
    assert config.settings is None


def test_tenant_config_invalid_tenant_id():
    """Test tenant configuration with invalid tenant_id."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    with pytest.raises(ValueError, match="tenant_id must be a string"):
        TenantConfig(
            tenant_id=123,  # type: ignore
            name="Test Tenant",
            api_key="test_key",
            strategies={"strategy1": strategy},
        )


def test_tenant_config_invalid_name():
    """Test tenant configuration with invalid name."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    with pytest.raises(ValueError, match="name must be a string"):
        TenantConfig(
            tenant_id="test_tenant",
            name=123,  # type: ignore
            api_key="test_key",
            strategies={"strategy1": strategy},
        )


def test_tenant_config_invalid_api_key():
    """Test tenant configuration with invalid api_key."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    with pytest.raises(ValueError, match="api_key must be a string"):
        TenantConfig(
            tenant_id="test_tenant",
            name="Test Tenant",
            api_key=123,  # type: ignore
            strategies={"strategy1": strategy},
        )


def test_tenant_config_invalid_strategies():
    """Test tenant configuration with invalid strategies."""
    with pytest.raises(ValueError, match="strategies must be a dictionary"):
        TenantConfig(
            tenant_id="test_tenant",
            name="Test Tenant",
            api_key="test_key",
            strategies="invalid",  # type: ignore
        )


def test_tenant_config_invalid_settings():
    """Test tenant configuration with invalid settings."""
    strategy = StrategyConfig(strategy_type="momentum", parameters={"param1": "value1"})
    with pytest.raises(ValueError, match="settings must be a dictionary"):
        TenantConfig(
            tenant_id="test_tenant",
            name="Test Tenant",
            api_key="test_key",
            strategies={"strategy1": strategy},
            settings="invalid",  # type: ignore
        )
