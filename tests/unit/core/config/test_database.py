"""
Tests for database configuration module.
"""

import pytest
from tradingbot.core.config.database import DatabaseConfig


def test_database_config_defaults():
    """Test database configuration default values."""
    config = DatabaseConfig()
    assert config.MONGODB_URI == "mongodb://localhost:27017"
    assert config.MONGODB_DATABASE == "tradingbot"
    assert config.MONGODB_MAX_POOL_SIZE == 100
    assert config.MONGODB_MIN_POOL_SIZE == 10
    assert config.MONGODB_COLLECTION_PREFIX == "dev_"

    assert config.USE_REDIS is True
    assert config.REDIS_URL == "redis://localhost"
    assert config.REDIS_MAX_CONNECTIONS == 10
    assert config.REDIS_TIMEOUT == 30
    assert config.REDIS_RETRY_ON_TIMEOUT is True


def test_mongodb_uri_validation():
    """Test MongoDB URI validation."""
    # Test valid URIs
    valid_uris = [
        "mongodb://localhost:27017",
        "mongodb://user:pass@localhost:27017",
        "mongodb+srv://user:pass@cluster.example.com",
    ]
    for uri in valid_uris:
        config = DatabaseConfig(MONGODB_URI=uri)
        assert config.MONGODB_URI == uri

    # Test invalid URIs
    invalid_uris = [
        "http://localhost:27017",
        "postgres://localhost:5432",
        "invalid_uri",
    ]
    for uri in invalid_uris:
        with pytest.raises(ValueError, match="Invalid MongoDB URI format"):
            DatabaseConfig(MONGODB_URI=uri)


def test_mongodb_pool_size_validation():
    """Test MongoDB pool size validation."""
    # Test valid pool sizes
    config = DatabaseConfig(MONGODB_MIN_POOL_SIZE=10, MONGODB_MAX_POOL_SIZE=20)
    assert config.MONGODB_MIN_POOL_SIZE == 10
    assert config.MONGODB_MAX_POOL_SIZE == 20

    # Test invalid pool sizes
    with pytest.raises(ValueError, match="MAX_POOL_SIZE must be >= MIN_POOL_SIZE"):
        DatabaseConfig(MONGODB_MIN_POOL_SIZE=20, MONGODB_MAX_POOL_SIZE=10)


def test_redis_url_validation():
    """Test Redis URL validation."""
    # Test valid URLs
    valid_urls = [
        "redis://localhost",
        "redis://user:pass@localhost",
        "redis://redis.example.com:6379",
    ]
    for url in valid_urls:
        config = DatabaseConfig(REDIS_URL=url)
        assert config.REDIS_URL == url

    # Test invalid URLs
    invalid_urls = ["http://localhost", "mongodb://localhost", "invalid_url"]
    for url in invalid_urls:
        with pytest.raises(ValueError, match="Invalid Redis URL format"):
            DatabaseConfig(REDIS_URL=url)


def test_get_mongodb_settings():
    """Test MongoDB settings getter."""
    config = DatabaseConfig(
        MONGODB_URI="mongodb://testhost:27017",
        MONGODB_DATABASE="testdb",
        MONGODB_MAX_POOL_SIZE=50,
        MONGODB_MIN_POOL_SIZE=5,
        MONGODB_COLLECTION_PREFIX="test_",
    )

    settings = config.get_mongodb_settings()
    assert settings["uri"] == "mongodb://testhost:27017"
    assert settings["database"] == "testdb"
    assert settings["max_pool_size"] == 50
    assert settings["min_pool_size"] == 5
    assert settings["collection_prefix"] == "test_"


def test_get_redis_settings():
    """Test Redis settings getter."""
    config = DatabaseConfig(
        REDIS_URL="redis://testhost",
        REDIS_MAX_CONNECTIONS=20,
        REDIS_TIMEOUT=60,
        REDIS_RETRY_ON_TIMEOUT=False,
    )

    settings = config.get_redis_settings()
    assert settings["url"] == "redis://testhost"
    assert settings["max_connections"] == 20
    assert settings["timeout"] == 60
    assert settings["retry_on_timeout"] is False


def test_get_collection_name():
    """Test collection name prefixing."""
    config = DatabaseConfig(MONGODB_COLLECTION_PREFIX="test_")

    # Test various collection names
    assert config.get_collection_name("users") == "test_users"
    assert config.get_collection_name("trades") == "test_trades"
    assert config.get_collection_name("orders") == "test_orders"

    # Test with different prefix
    config = DatabaseConfig(MONGODB_COLLECTION_PREFIX="prod_")
    assert config.get_collection_name("users") == "prod_users"


def test_environment_override():
    """Test environment variable override."""
    config = DatabaseConfig(
        MONGODB_URI="mongodb://customhost:27017",
        MONGODB_DATABASE="customdb",
        REDIS_URL="redis://customhost",
        USE_REDIS=False,
    )

    assert config.MONGODB_URI == "mongodb://customhost:27017"
    assert config.MONGODB_DATABASE == "customdb"
    assert config.REDIS_URL == "redis://customhost"
    assert config.USE_REDIS is False
