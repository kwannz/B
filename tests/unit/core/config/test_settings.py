"""
Tests for unified settings module.
"""

import json
import os

import pytest

from tradingbot.core.config.monitoring import AlertChannel, AlertLevel
from tradingbot.core.config.settings import Settings
from tradingbot.core.config.trading import RiskLevel, TradingMode


def test_settings_inheritance(settings):
    """Test settings class inherits all configurations."""
    # Test base config inheritance
    assert hasattr(settings, "ENV")
    assert hasattr(settings, "DEBUG")
    assert hasattr(settings, "APP_NAME")

    # Test database config inheritance
    assert hasattr(settings, "MONGODB_URI")
    assert hasattr(settings, "REDIS_URL")

    # Test API config inheritance
    assert hasattr(settings, "DEEPSEEK_API_KEY")
    assert hasattr(settings, "BINANCE_API_KEY")

    # Test trading config inheritance
    assert hasattr(settings, "TRADING_MODE")
    assert hasattr(settings, "RISK_LEVEL")

    # Test monitoring config inheritance
    assert hasattr(settings, "USE_PROMETHEUS")
    assert hasattr(settings, "ALERT_CHANNELS")


def test_settings_singleton(env_vars):
    """Test settings singleton pattern."""
    settings1 = Settings.get_settings()
    settings2 = Settings.get_settings()
    assert settings1 is settings2


def test_get_all_settings(settings):
    """Test comprehensive settings getter."""
    all_settings = settings.get_all_settings()

    # Test app section
    assert "app" in all_settings
    assert all_settings["app"]["name"] == settings.APP_NAME
    assert all_settings["app"]["version"] == settings.APP_VERSION

    # Test database section
    assert "database" in all_settings
    assert "mongodb" in all_settings["database"]
    assert "redis" in all_settings["database"]

    # Test API section
    assert "api" in all_settings
    assert "deepseek" in all_settings["api"]
    assert "binance" in all_settings["api"]

    # Test trading section
    assert "trading" in all_settings
    assert "risk" in all_settings["trading"]
    assert "strategy" in all_settings["trading"]

    # Test monitoring section
    assert "monitoring" in all_settings
    assert "prometheus" in all_settings["monitoring"]
    assert "alerts" in all_settings["monitoring"]


def test_update_settings(settings):
    """Test dynamic settings update."""
    updates = {
        "ENV": "production",
        "DEBUG": False,
        "TRADING_MODE": "spot",
        "RISK_LEVEL": "high",
        "ALERT_CHANNELS": ["email", "slack"],
        "MIN_ALERT_LEVEL": "error",
    }

    settings.update_settings(updates)

    assert settings.ENV == "production"
    assert settings.DEBUG is False
    assert settings.TRADING_MODE == TradingMode.SPOT
    assert settings.RISK_LEVEL == RiskLevel.HIGH
    assert set(settings.ALERT_CHANNELS) == {AlertChannel.EMAIL, AlertChannel.SLACK}
    assert settings.MIN_ALERT_LEVEL == AlertLevel.ERROR

    # Test invalid setting update
    with pytest.raises(ValueError, match="Unknown setting"):
        settings.update_settings({"INVALID_SETTING": "value"})


def test_validate_all(settings):
    """Test comprehensive settings validation."""
    # Test valid settings
    settings.validate_all()  # Should not raise

    # Test invalid MongoDB settings
    with pytest.raises(ValueError, match="MongoDB settings are required"):
        invalid_settings = Settings(MONGODB_URI="")
        invalid_settings.validate_all()

    # Test invalid Redis settings
    with pytest.raises(ValueError, match="Redis URL is required"):
        invalid_settings = Settings(USE_REDIS=True, REDIS_URL="")
        invalid_settings.validate_all()

    # Test invalid API settings
    with pytest.raises(ValueError, match="DeepSeek API key is required"):
        invalid_settings = Settings(DEEPSEEK_API_KEY="")
        invalid_settings.validate_all()

    # Test invalid futures trading settings
    with pytest.raises(ValueError, match="Binance API credentials required"):
        invalid_settings = Settings(
            TRADING_MODE=TradingMode.FUTURES, BINANCE_API_KEY=""
        )
        invalid_settings.validate_all()

    # Test invalid monitoring settings
    with pytest.raises(ValueError, match="Prometheus pushgateway required"):
        invalid_settings = Settings(USE_PROMETHEUS=True, PROMETHEUS_PUSHGATEWAY="")
        invalid_settings.validate_all()

    # Test invalid alert settings
    with pytest.raises(ValueError, match="Email alert settings incomplete"):
        invalid_settings = Settings(
            ALERT_CHANNELS=[AlertChannel.EMAIL],
            SMTP_USERNAME="",
            SMTP_PASSWORD="",
            ALERT_EMAIL_TO=[],
        )
        invalid_settings.validate_all()


def test_export_env_file(settings, tmp_path):
    """Test environment file export."""
    env_file = tmp_path / ".env.test"
    settings.export_env_file(str(env_file))

    assert env_file.exists()
    content = env_file.read_text()

    # Test basic settings export
    assert "ENV=" in content
    assert "DEBUG=" in content
    assert "APP_NAME=" in content

    # Test enum value export
    assert f"TRADING_MODE={settings.TRADING_MODE.value}" in content
    assert f"RISK_LEVEL={settings.RISK_LEVEL.value}" in content

    # Test list export
    alert_channels = ",".join(c.value for c in settings.ALERT_CHANNELS)
    assert f"ALERT_CHANNELS={alert_channels}" in content


def test_environment_override(env_vars):
    """Test environment variable override."""
    settings = Settings()

    assert settings.ENV == "test"
    assert settings.APP_NAME == "TradingBot-Test"
    assert settings.MONGODB_DATABASE == "tradingbot_test"
    assert settings.TRADING_MODE == TradingMode.SPOT
    assert settings.RISK_LEVEL == RiskLevel.LOW


def test_logging_configuration(settings):
    """Test logging configuration."""
    logging_config = settings.get_logging_config()

    assert logging_config["version"] == 1
    assert not logging_config["disable_existing_loggers"]
    assert "default" in logging_config["formatters"]
    assert "default" in logging_config["handlers"]
    assert logging_config["root"]["level"] == settings.LOG_LEVEL
