"""
Tests for trading configuration module.
"""

import pytest

from tradingbot.core.config.trading import RiskLevel, TradingConfig, TradingMode


def test_trading_config_defaults():
    """Test trading configuration default values."""
    config = TradingConfig()

    assert config.TRADING_MODE == TradingMode.BOTH
    assert config.TRADING_ENABLED is True
    assert config.PAPER_TRADING is True

    assert config.CONFIDENCE_THRESHOLD == 0.7
    assert config.MAX_RETRIES == 3
    assert config.RETRY_DELAY == 1
    assert config.MIN_ORDER_SIZE == 10.0
    assert config.MAX_ORDER_SIZE == 10000.0

    assert config.RISK_LEVEL == RiskLevel.MEDIUM
    assert config.MAX_LOSS_PERCENTAGE == 2.0
    assert config.POSITION_SIZE_PERCENTAGE == 10.0
    assert config.MAX_EXPOSURE_PERCENTAGE == 50.0
    assert config.STOP_LOSS_PERCENTAGE == 5.0
    assert config.TAKE_PROFIT_PERCENTAGE == 10.0

    assert config.STRATEGY_UPDATE_INTERVAL == 60
    assert len(config.INDICATORS) > 0

    assert config.INITIAL_BALANCE == 10000.0
    assert config.TRADING_FEE == 0.001
    assert config.MIN_DATA_POINTS == 100


def test_trading_mode_enum():
    """Test trading mode enumeration."""
    assert TradingMode.SPOT == "spot"
    assert TradingMode.FUTURES == "futures"
    assert TradingMode.BOTH == "both"

    config = TradingConfig(TRADING_MODE=TradingMode.SPOT)
    assert config.TRADING_MODE == TradingMode.SPOT


def test_risk_level_enum():
    """Test risk level enumeration."""
    assert RiskLevel.LOW == "low"
    assert RiskLevel.MEDIUM == "medium"
    assert RiskLevel.HIGH == "high"

    config = TradingConfig(RISK_LEVEL=RiskLevel.LOW)
    assert config.RISK_LEVEL == RiskLevel.LOW


def test_position_size_validation():
    """Test position size validation."""
    # Test valid position size
    config = TradingConfig(POSITION_SIZE_PERCENTAGE=20.0, MAX_EXPOSURE_PERCENTAGE=50.0)
    assert config.POSITION_SIZE_PERCENTAGE == 20.0

    # Test invalid position size
    with pytest.raises(ValueError, match="Position size .* cannot exceed max exposure"):
        TradingConfig(POSITION_SIZE_PERCENTAGE=60.0, MAX_EXPOSURE_PERCENTAGE=50.0)


def test_take_profit_validation():
    """Test take profit validation."""
    # Test valid take profit
    config = TradingConfig(STOP_LOSS_PERCENTAGE=5.0, TAKE_PROFIT_PERCENTAGE=10.0)
    assert config.TAKE_PROFIT_PERCENTAGE == 10.0

    # Test invalid take profit
    with pytest.raises(
        ValueError, match="Take profit .* must be greater than stop loss"
    ):
        TradingConfig(STOP_LOSS_PERCENTAGE=5.0, TAKE_PROFIT_PERCENTAGE=3.0)


def test_get_risk_settings():
    """Test risk settings getter."""
    config = TradingConfig(
        RISK_LEVEL=RiskLevel.HIGH,
        MAX_LOSS_PERCENTAGE=3.0,
        POSITION_SIZE_PERCENTAGE=15.0,
        MAX_EXPOSURE_PERCENTAGE=70.0,
        STOP_LOSS_PERCENTAGE=7.0,
        TAKE_PROFIT_PERCENTAGE=14.0,
    )

    settings = config.get_risk_settings()
    assert settings["level"] == RiskLevel.HIGH
    assert settings["max_loss"] == 3.0
    assert settings["position_size"] == 15.0
    assert settings["max_exposure"] == 70.0
    assert settings["stop_loss"] == 7.0
    assert settings["take_profit"] == 14.0


def test_get_strategy_settings():
    """Test strategy settings getter."""
    config = TradingConfig(
        STRATEGY_UPDATE_INTERVAL=120,
        INDICATORS=["RSI", "MACD", "BB"],
        CONFIDENCE_THRESHOLD=0.8,
    )

    settings = config.get_strategy_settings()
    assert settings["update_interval"] == 120
    assert settings["indicators"] == ["RSI", "MACD", "BB"]
    assert settings["confidence_threshold"] == 0.8


def test_get_backtesting_settings():
    """Test backtesting settings getter."""
    config = TradingConfig(
        INITIAL_BALANCE=20000.0, TRADING_FEE=0.002, MIN_DATA_POINTS=200
    )

    settings = config.get_backtesting_settings()
    assert settings["initial_balance"] == 20000.0
    assert settings["trading_fee"] == 0.002
    assert settings["min_data_points"] == 200


def test_adjust_risk_parameters():
    """Test risk parameters adjustment."""
    config = TradingConfig()

    # Test low risk profile
    config.adjust_risk_parameters(RiskLevel.LOW)
    assert config.RISK_LEVEL == RiskLevel.LOW
    assert config.POSITION_SIZE_PERCENTAGE == 5.0
    assert config.MAX_EXPOSURE_PERCENTAGE == 30.0
    assert config.STOP_LOSS_PERCENTAGE == 3.0
    assert config.TAKE_PROFIT_PERCENTAGE == 6.0

    # Test medium risk profile
    config.adjust_risk_parameters(RiskLevel.MEDIUM)
    assert config.RISK_LEVEL == RiskLevel.MEDIUM
    assert config.POSITION_SIZE_PERCENTAGE == 10.0
    assert config.MAX_EXPOSURE_PERCENTAGE == 50.0
    assert config.STOP_LOSS_PERCENTAGE == 5.0
    assert config.TAKE_PROFIT_PERCENTAGE == 10.0

    # Test high risk profile
    config.adjust_risk_parameters(RiskLevel.HIGH)
    assert config.RISK_LEVEL == RiskLevel.HIGH
    assert config.POSITION_SIZE_PERCENTAGE == 15.0
    assert config.MAX_EXPOSURE_PERCENTAGE == 70.0
    assert config.STOP_LOSS_PERCENTAGE == 7.0
    assert config.TAKE_PROFIT_PERCENTAGE == 14.0


def test_field_validations():
    """Test field validations."""
    # Test confidence threshold bounds
    with pytest.raises(ValueError):
        TradingConfig(CONFIDENCE_THRESHOLD=-0.1)
    with pytest.raises(ValueError):
        TradingConfig(CONFIDENCE_THRESHOLD=1.1)

    # Test max retries minimum
    with pytest.raises(ValueError):
        TradingConfig(MAX_RETRIES=0)

    # Test retry delay minimum
    with pytest.raises(ValueError):
        TradingConfig(RETRY_DELAY=0)

    # Test percentage bounds
    with pytest.raises(ValueError):
        TradingConfig(MAX_LOSS_PERCENTAGE=101.0)
    with pytest.raises(ValueError):
        TradingConfig(POSITION_SIZE_PERCENTAGE=-1.0)
    with pytest.raises(ValueError):
        TradingConfig(MAX_EXPOSURE_PERCENTAGE=101.0)

    # Test trading fee bounds
    with pytest.raises(ValueError):
        TradingConfig(TRADING_FEE=-0.001)
    with pytest.raises(ValueError):
        TradingConfig(TRADING_FEE=1.1)

    # Test min data points minimum
    with pytest.raises(ValueError):
        TradingConfig(MIN_DATA_POINTS=9)
