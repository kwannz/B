"""
Tests for monitoring configuration module.
"""

import pytest
from tradingbot.core.config.monitoring import MonitoringConfig, AlertLevel, AlertChannel


def test_monitoring_config_defaults():
    """Test monitoring configuration default values."""
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",  # Required field
        SMTP_PASSWORD="test_password",  # Required field
    )

    assert config.USE_PROMETHEUS is True
    assert config.PROMETHEUS_PUSHGATEWAY == "localhost:9091"
    assert config.METRICS_INTERVAL == 60

    assert config.ERROR_THRESHOLD == 0.1
    assert config.LATENCY_THRESHOLD == 1.0
    assert config.ALERT_COOLDOWN == 300

    assert config.MEMORY_THRESHOLD == 85.0
    assert config.CPU_THRESHOLD == 80.0
    assert config.DISK_THRESHOLD == 90.0

    assert config.PROFIT_TARGET == 5.0
    assert config.DRAWDOWN_THRESHOLD == 10.0
    assert config.VOLATILITY_THRESHOLD == 2.0

    assert config.CHART_THEME == "plotly_dark"
    assert config.CHART_UPDATE_INTERVAL == 5
    assert config.MAX_DATA_POINTS == 1000

    assert config.MIN_ALERT_LEVEL == AlertLevel.WARNING
    assert AlertChannel.EMAIL in config.ALERT_CHANNELS


def test_alert_level_enum():
    """Test alert level enumeration."""
    assert AlertLevel.INFO == "info"
    assert AlertLevel.WARNING == "warning"
    assert AlertLevel.ERROR == "error"
    assert AlertLevel.CRITICAL == "critical"

    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        MIN_ALERT_LEVEL=AlertLevel.ERROR,
    )
    assert config.MIN_ALERT_LEVEL == AlertLevel.ERROR


def test_alert_channel_enum():
    """Test alert channel enumeration."""
    assert AlertChannel.EMAIL == "email"
    assert AlertChannel.SLACK == "slack"
    assert AlertChannel.TELEGRAM == "telegram"
    assert AlertChannel.DISCORD == "discord"


def test_alert_channels_validation():
    """Test alert channels validation."""
    # Test valid email configuration
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        ALERT_EMAIL_TO=["alerts@example.com"],
        ALERT_CHANNELS=[AlertChannel.EMAIL],
    )
    assert AlertChannel.EMAIL in config.ALERT_CHANNELS

    # Test invalid email configuration
    with pytest.raises(
        ValueError, match="Email alerts enabled but no recipient emails configured"
    ):
        MonitoringConfig(
            SMTP_USERNAME="test@example.com",
            SMTP_PASSWORD="test_password",
            ALERT_CHANNELS=[AlertChannel.EMAIL],
            ALERT_EMAIL_TO=[],
        )

    # Test Slack configuration
    with pytest.raises(
        ValueError, match="Slack alerts enabled but no webhook URL configured"
    ):
        MonitoringConfig(
            SMTP_USERNAME="test@example.com",
            SMTP_PASSWORD="test_password",
            ALERT_CHANNELS=[AlertChannel.SLACK],
        )

    # Test Telegram configuration
    with pytest.raises(
        ValueError, match="Telegram alerts enabled but missing bot token or chat ID"
    ):
        MonitoringConfig(
            SMTP_USERNAME="test@example.com",
            SMTP_PASSWORD="test_password",
            ALERT_CHANNELS=[AlertChannel.TELEGRAM],
        )

    # Test Discord configuration
    with pytest.raises(
        ValueError, match="Discord alerts enabled but no webhook URL configured"
    ):
        MonitoringConfig(
            SMTP_USERNAME="test@example.com",
            SMTP_PASSWORD="test_password",
            ALERT_CHANNELS=[AlertChannel.DISCORD],
        )


def test_get_prometheus_settings():
    """Test Prometheus settings getter."""
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        USE_PROMETHEUS=True,
        PROMETHEUS_PUSHGATEWAY="custom:9091",
        METRICS_INTERVAL=30,
    )

    settings = config.get_prometheus_settings()
    assert settings["enabled"] is True
    assert settings["pushgateway"] == "custom:9091"
    assert settings["interval"] == 30


def test_get_alert_thresholds():
    """Test alert thresholds getter."""
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        ERROR_THRESHOLD=0.2,
        LATENCY_THRESHOLD=2.0,
        MEMORY_THRESHOLD=90.0,
        CPU_THRESHOLD=85.0,
        DISK_THRESHOLD=95.0,
        PROFIT_TARGET=6.0,
        DRAWDOWN_THRESHOLD=15.0,
        VOLATILITY_THRESHOLD=3.0,
    )

    thresholds = config.get_alert_thresholds()
    assert thresholds["error"] == 0.2
    assert thresholds["latency"] == 2.0
    assert thresholds["memory"] == 90.0
    assert thresholds["cpu"] == 85.0
    assert thresholds["disk"] == 95.0
    assert thresholds["profit"] == 6.0
    assert thresholds["drawdown"] == 15.0
    assert thresholds["volatility"] == 3.0


def test_get_chart_settings():
    """Test chart settings getter."""
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        CHART_THEME="custom_theme",
        CHART_UPDATE_INTERVAL=10,
        MAX_DATA_POINTS=2000,
    )

    settings = config.get_chart_settings()
    assert settings["theme"] == "custom_theme"
    assert settings["update_interval"] == 10
    assert settings["max_points"] == 2000


def test_get_alert_settings():
    """Test alert settings getter."""
    config = MonitoringConfig(
        SMTP_USERNAME="test@example.com",
        SMTP_PASSWORD="test_password",
        ALERT_EMAIL_TO=["alerts@example.com"],
        SLACK_WEBHOOK_URL="https://slack.webhook",
        SLACK_CHANNEL="#alerts",
        TELEGRAM_BOT_TOKEN="bot_token",
        TELEGRAM_CHAT_ID="chat_id",
        DISCORD_WEBHOOK_URL="https://discord.webhook",
        ALERT_CHANNELS=[
            AlertChannel.EMAIL,
            AlertChannel.SLACK,
            AlertChannel.TELEGRAM,
            AlertChannel.DISCORD,
        ],
        MIN_ALERT_LEVEL=AlertLevel.ERROR,
        ALERT_COOLDOWN=600,
    )

    settings = config.get_alert_settings()
    assert "email" in settings
    assert settings["email"]["smtp_server"] == "smtp.gmail.com"
    assert settings["email"]["smtp_port"] == 587
    assert settings["email"]["username"] == "test@example.com"
    assert settings["email"]["recipients"] == ["alerts@example.com"]

    assert "slack" in settings
    assert settings["slack"]["webhook_url"] == "https://slack.webhook"
    assert settings["slack"]["channel"] == "#alerts"

    assert "telegram" in settings
    assert settings["telegram"]["bot_token"] == "bot_token"
    assert settings["telegram"]["chat_id"] == "chat_id"

    assert "discord" in settings
    assert settings["discord"]["webhook_url"] == "https://discord.webhook"

    assert settings["min_level"] == AlertLevel.ERROR.value
    assert settings["cooldown"] == 600


def test_field_validations():
    """Test field validations."""
    base_config = {
        "SMTP_USERNAME": "test@example.com",
        "SMTP_PASSWORD": "test_password",
    }

    # Test metrics interval minimum
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, METRICS_INTERVAL=0)

    # Test threshold bounds
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, ERROR_THRESHOLD=-0.1)
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, ERROR_THRESHOLD=1.1)
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, MEMORY_THRESHOLD=101.0)
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, CPU_THRESHOLD=-1.0)

    # Test alert cooldown minimum
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, ALERT_COOLDOWN=59)

    # Test chart update interval minimum
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, CHART_UPDATE_INTERVAL=0)

    # Test max data points minimum
    with pytest.raises(ValueError):
        MonitoringConfig(**base_config, MAX_DATA_POINTS=99)
