import pytest
from tradingbot.shared.errors import AIError, ConfigError


def test_ai_error():
    """Test AIError exception"""
    # Test raising AIError with message
    error_msg = "AI model failed to respond"
    with pytest.raises(AIError) as exc_info:
        raise AIError(error_msg)
    assert str(exc_info.value) == error_msg

    # Test that AIError is an Exception
    assert isinstance(AIError(), Exception)

    # Test empty AIError
    error = AIError()
    assert str(error) == ""


def test_config_error():
    """Test ConfigError exception"""
    # Test raising ConfigError with message
    error_msg = "Invalid configuration"
    with pytest.raises(ConfigError) as exc_info:
        raise ConfigError(error_msg)
    assert str(exc_info.value) == error_msg

    # Test that ConfigError is an Exception
    assert isinstance(ConfigError(), Exception)

    # Test empty ConfigError
    error = ConfigError()
    assert str(error) == ""


def test_error_inheritance():
    """Test exception inheritance"""
    # Test that both errors inherit from Exception
    assert issubclass(AIError, Exception)
    assert issubclass(ConfigError, Exception)

    # Test that errors are different types
    assert not issubclass(AIError, ConfigError)
    assert not issubclass(ConfigError, AIError)
