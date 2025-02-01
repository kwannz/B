"""
Test news collector initialization and configuration
"""

import os
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from tradingbot.shared.models.database import NewsArticle
from tradingbot.shared.news_collector import NewsCollector


@pytest.fixture
def mock_db_session():
    """Create mock database session"""
    session = Mock()
    session.add = Mock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
async def news_collector(mock_db_session):
    """Create news collector instance with mocked components"""
    # Set test environment
    os.environ["TESTING"] = "true"
    os.environ["NEWS_API_KEY"] = "test_api_key"

    # Mock MongoDB and its initialization
    mock_manager = AsyncMock()
    mock_manager.initialized = True
    mock_manager.db = AsyncMock()
    mock_manager.initialize = AsyncMock()
    mock_manager.close = AsyncMock()

    mock_storage = AsyncMock()
    mock_storage.collection_name = "raw_news_articles"
    mock_storage.insert_one = AsyncMock(return_value="test_id")

    with (
        patch("src.shared.models.mongodb.MongoDBManager", return_value=mock_manager),
        patch("src.shared.models.mongodb.MongoDBStorage", return_value=mock_storage),
    ):
        collector = NewsCollector(mock_db_session)
        collector.mongodb = mock_manager
        collector.raw_storage = mock_storage

        # Mock HTTP responses
        async def mock_get(*args, **kwargs):
            response = AsyncMock()
            response.status = 200
            response.json = AsyncMock(
                return_value={
                    "articles": [
                        {
                            "title": "Test Article",
                            "url": "https://test.com/article",
                            "content": "Test content",
                            "published_at": "2024-01-21T00:00:00Z",
                        }
                    ]
                }
            )

            # Properly implement async context manager
            async def async_enter():
                return response

            async def async_exit(exc_type, exc, tb):
                pass

            response.__aenter__ = async_enter
            response.__aexit__ = async_exit
            return response

        # Patch aiohttp session
        with patch("aiohttp.ClientSession") as mock_session:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=mock_get)
            mock_client.close = AsyncMock()

            # Properly implement async context manager for session
            async def session_enter():
                return mock_client

            async def session_exit(exc_type, exc, tb):
                pass

            mock_client.__aenter__ = session_enter
            mock_client.__aexit__ = session_exit
            mock_session.return_value = mock_client

            await collector.initialize()
            yield collector
            await collector.close()

        # Clean up environment
        os.environ.pop("NEWS_API_KEY", None)


@pytest.mark.asyncio
async def test_api_key_configuration():
    """Test API key configuration"""
    # Missing API key
    os.environ.pop("NEWS_API_KEY", None)
    with pytest.raises(ValueError, match="NEWS_API_KEY.*not set"):
        NewsCollector(Mock())

    # Valid API key
    os.environ["NEWS_API_KEY"] = "test_api_key"
    collector = NewsCollector(Mock())
    assert collector.news_api_key == "test_api_key"

    # Clean up
    os.environ.pop("NEWS_API_KEY", None)


@pytest.mark.asyncio
async def test_news_sources_configuration(news_collector):
    """Test news sources configuration"""
    # Verify supported sources
    assert "coindesk" in news_collector.sources
    assert "cointelegraph" in news_collector.sources
    assert "decrypt" in news_collector.sources

    # Verify source configuration
    for source, config in news_collector.sources.items():
        assert "api_url" in config
        assert "enabled" in config
        assert isinstance(config["enabled"], bool)


@pytest.mark.asyncio
async def test_api_connections(news_collector):
    """Test API connections"""
    # Test connection verification
    connection_status = await news_collector.verify_connections()
    assert isinstance(connection_status, dict)

    # All sources should be accessible with our mock
    for source, status in connection_status.items():
        assert status is True, f"Connection to {source} failed"


@pytest.mark.asyncio
async def test_mongodb_integration(news_collector):
    """Test MongoDB integration"""
    # Get the mock manager from the fixture
    mock_manager = news_collector.mongodb

    # Reset the mock to ensure clean state
    mock_manager.initialize.reset_mock()
    mock_manager.initialized = False

    # Re-initialize collector to test MongoDB initialization
    await news_collector.initialize()

    # Verify MongoDB manager initialization
    assert news_collector.mongodb is not None
    mock_manager.initialize.assert_called_once()

    # Verify raw storage configuration
    assert news_collector.raw_storage is not None
    assert news_collector.raw_storage.collection_name == "raw_news_articles"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
