"""
Tests for API configuration module.
"""

import pytest
from pydantic import SecretStr
from tradingbot.core.config.api import APIConfig


def test_api_config_defaults():
    """Test API configuration default values."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",  # Required field
        BINANCE_API_KEY="test_key",  # Required field
        BINANCE_API_SECRET="test_secret",  # Required field
        OKEX_API_KEY="test_key",  # Required field
        OKEX_API_SECRET="test_secret",  # Required field
        NEWS_API_KEY="test_key",  # Required field
        TWITTER_API_KEY="test_key",  # Required field
        REDDIT_API_KEY="test_key",  # Required field
    )

    assert config.DEEPSEEK_API_URL == "https://api.deepseek.com/v1"
    assert config.DEEPSEEK_MODEL == "deepseek-chat"
    assert config.DEEPSEEK_TIMEOUT == 30
    assert config.DEEPSEEK_MAX_RETRIES == 3
    assert config.DEEPSEEK_RETRY_DELAY == 1

    assert config.BINANCE_TESTNET is True
    assert config.OKEX_TESTNET is True

    assert config.NEWS_UPDATE_INTERVAL == 300

    assert config.RATE_LIMIT_ENABLED is True
    assert config.RATE_LIMIT_REQUESTS == 100
    assert config.RATE_LIMIT_PERIOD == 60


def test_deepseek_url_validation():
    """Test DeepSeek API URL validation."""
    # Test valid URLs
    valid_urls = [
        "http://api.deepseek.com",
        "https://api.deepseek.com",
        "https://custom.deepseek.com/v2",
    ]
    for url in valid_urls:
        config = APIConfig(
            DEEPSEEK_API_KEY="test_key",
            DEEPSEEK_API_URL=url,
            BINANCE_API_KEY="test_key",
            BINANCE_API_SECRET="test_secret",
            OKEX_API_KEY="test_key",
            OKEX_API_SECRET="test_secret",
            NEWS_API_KEY="test_key",
            TWITTER_API_KEY="test_key",
            REDDIT_API_KEY="test_key",
        )
        assert config.DEEPSEEK_API_URL == url

    # Test invalid URLs
    invalid_urls = ["ftp://api.deepseek.com", "ws://api.deepseek.com", "invalid_url"]
    for url in invalid_urls:
        with pytest.raises(ValueError, match="Invalid DeepSeek API URL format"):
            APIConfig(
                DEEPSEEK_API_KEY="test_key",
                DEEPSEEK_API_URL=url,
                BINANCE_API_KEY="test_key",
                BINANCE_API_SECRET="test_secret",
                OKEX_API_KEY="test_key",
                OKEX_API_SECRET="test_secret",
                NEWS_API_KEY="test_key",
                TWITTER_API_KEY="test_key",
                REDDIT_API_KEY="test_key",
            )


def test_rate_limit_validation():
    """Test rate limit validation."""
    # Test valid rate limit
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        RATE_LIMIT_REQUESTS=50,
        BINANCE_API_KEY="test_key",
        BINANCE_API_SECRET="test_secret",
        OKEX_API_KEY="test_key",
        OKEX_API_SECRET="test_secret",
        NEWS_API_KEY="test_key",
        TWITTER_API_KEY="test_key",
        REDDIT_API_KEY="test_key",
    )
    assert config.RATE_LIMIT_REQUESTS == 50

    # Test invalid rate limit
    with pytest.raises(ValueError, match="Rate limit requests must be at least 1"):
        APIConfig(
            DEEPSEEK_API_KEY="test_key",
            RATE_LIMIT_REQUESTS=0,
            BINANCE_API_KEY="test_key",
            BINANCE_API_SECRET="test_secret",
            OKEX_API_KEY="test_key",
            OKEX_API_SECRET="test_secret",
            NEWS_API_KEY="test_key",
            TWITTER_API_KEY="test_key",
            REDDIT_API_KEY="test_key",
        )


def test_get_deepseek_settings():
    """Test DeepSeek settings getter."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        DEEPSEEK_API_URL="https://custom.deepseek.com",
        DEEPSEEK_MODEL="custom-model",
        DEEPSEEK_TIMEOUT=60,
        BINANCE_API_KEY="test_key",
        BINANCE_API_SECRET="test_secret",
        OKEX_API_KEY="test_key",
        OKEX_API_SECRET="test_secret",
        NEWS_API_KEY="test_key",
        TWITTER_API_KEY="test_key",
        REDDIT_API_KEY="test_key",
    )

    settings = config.get_deepseek_settings()
    assert settings["api_key"] == "test_key"
    assert settings["api_url"] == "https://custom.deepseek.com"
    assert settings["model"] == "custom-model"
    assert settings["timeout"] == 60


def test_get_exchange_settings():
    """Test exchange settings getters."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        BINANCE_API_KEY="binance_key",
        BINANCE_API_SECRET="binance_secret",
        BINANCE_TESTNET=False,
        OKEX_API_KEY="okex_key",
        OKEX_API_SECRET="okex_secret",
        OKEX_TESTNET=False,
        NEWS_API_KEY="test_key",
        TWITTER_API_KEY="test_key",
        REDDIT_API_KEY="test_key",
    )

    binance_settings = config.get_binance_settings()
    assert binance_settings["api_key"] == "binance_key"
    assert binance_settings["api_secret"] == "binance_secret"
    assert binance_settings["testnet"] is False

    okex_settings = config.get_okex_settings()
    assert okex_settings["api_key"] == "okex_key"
    assert okex_settings["api_secret"] == "okex_secret"
    assert okex_settings["testnet"] is False


def test_get_news_settings():
    """Test news settings getter."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        NEWS_API_KEY="news_key",
        NEWS_UPDATE_INTERVAL=600,
        BINANCE_API_KEY="test_key",
        BINANCE_API_SECRET="test_secret",
        OKEX_API_KEY="test_key",
        OKEX_API_SECRET="test_secret",
        TWITTER_API_KEY="test_key",
        REDDIT_API_KEY="test_key",
    )

    settings = config.get_news_settings()
    assert settings["api_key"] == "news_key"
    assert settings["update_interval"] == 600


def test_get_social_settings():
    """Test social media settings getter."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        TWITTER_API_KEY="twitter_key",
        REDDIT_API_KEY="reddit_key",
        BINANCE_API_KEY="test_key",
        BINANCE_API_SECRET="test_secret",
        OKEX_API_KEY="test_key",
        OKEX_API_SECRET="test_secret",
        NEWS_API_KEY="test_key",
    )

    settings = config.get_social_settings()
    assert settings["twitter_api_key"] == "twitter_key"
    assert settings["reddit_api_key"] == "reddit_key"


def test_get_rate_limit_settings():
    """Test rate limit settings getter."""
    config = APIConfig(
        DEEPSEEK_API_KEY="test_key",
        RATE_LIMIT_ENABLED=False,
        RATE_LIMIT_REQUESTS=200,
        RATE_LIMIT_PERIOD=120,
        BINANCE_API_KEY="test_key",
        BINANCE_API_SECRET="test_secret",
        OKEX_API_KEY="test_key",
        OKEX_API_SECRET="test_secret",
        NEWS_API_KEY="test_key",
        TWITTER_API_KEY="test_key",
        REDDIT_API_KEY="test_key",
    )

    settings = config.get_rate_limit_settings()
    assert settings["enabled"] is False
    assert settings["requests"] == 200
    assert settings["period"] == 120
