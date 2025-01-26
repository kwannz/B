"""
Test Celery tasks
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from tradingbot.trading_agent.python.api.tasks import (
    collect_news,
    collect_social,
    cleanup_old_data,
    get_latest_analysis,
)


@pytest.mark.asyncio
async def test_collect_news():
    """Test news collection task"""
    with patch("src.shared.news_collector.collector.NewsCollector") as mock_collector:
        # Setup mock
        instance = mock_collector.return_value
        instance.initialize = AsyncMock()
        instance.collect_all_sources = AsyncMock(return_value=[{"title": "Test"}])
        instance.close = AsyncMock()

        # Run task
        result = await collect_news()

        # Verify result
        assert result["status"] == "success"
        assert result["count"] == 1
        assert "timestamp" in result

        # Verify calls
        instance.initialize.assert_called_once()
        instance.collect_all_sources.assert_called_once()
        instance.close.assert_called_once()


@pytest.mark.asyncio
async def test_collect_social():
    """Test social media collection task"""
    with patch(
        "src.shared.social_media_analyzer.social_collector.SocialMediaCollector"
    ) as mock_collector:
        # Setup mock
        instance = mock_collector.return_value
        instance.initialize = AsyncMock()
        instance.collect_all_platforms = AsyncMock(return_value=[{"content": "Test"}])
        instance.close = AsyncMock()

        # Run task
        result = await collect_social()

        # Verify result
        assert result["status"] == "success"
        assert result["count"] == 1
        assert "timestamp" in result

        # Verify calls
        instance.initialize.assert_called_once()
        instance.collect_all_platforms.assert_called_once()
        instance.close.assert_called_once()


@pytest.mark.asyncio
async def test_cleanup_old_data():
    """Test data cleanup task"""
    with patch("src.shared.retention_manager.retention_manager") as mock_manager:
        # Setup mock
        mock_manager.initialize = AsyncMock()
        mock_manager.cleanup_old_data = AsyncMock(
            return_value={"news_count": 1, "social_count": 2}
        )
        mock_manager.close = AsyncMock()

        # Run task
        result = await cleanup_old_data()

        # Verify result
        assert result["status"] == "success"
        assert result["deleted"]["news_count"] == 1
        assert result["deleted"]["social_count"] == 2
        assert "timestamp" in result

        # Verify calls
        mock_manager.initialize.assert_called_once()
        mock_manager.cleanup_old_data.assert_called_once()
        mock_manager.close.assert_called_once()


@pytest.mark.asyncio
async def test_get_latest_analysis():
    """Test getting latest analysis data"""
    with patch("src.shared.news_collector.collector.NewsCollector") as mock_news:
        with patch(
            "src.shared.social_media_analyzer.social_collector.SocialMediaCollector"
        ) as mock_social:
            # Setup mocks
            news_instance = mock_news.return_value
            news_instance.initialize = AsyncMock()
            news_instance.storage.collection.find = AsyncMock()
            news_instance.storage.collection.find.return_value.sort = AsyncMock()
            news_instance.storage.collection.find.return_value.sort.return_value.limit = (
                AsyncMock()
            )
            news_instance.storage.collection.find.return_value.sort.return_value.limit.return_value.to_list = AsyncMock(
                return_value=[{"title": "Test"}]
            )
            news_instance.close = AsyncMock()

            social_instance = mock_social.return_value
            social_instance.initialize = AsyncMock()
            social_instance.storage.collection.find = AsyncMock()
            social_instance.storage.collection.find.return_value.sort = AsyncMock()
            social_instance.storage.collection.find.return_value.sort.return_value.limit = (
                AsyncMock()
            )
            social_instance.storage.collection.find.return_value.sort.return_value.limit.return_value.to_list = AsyncMock(
                return_value=[{"content": "Test"}]
            )
            social_instance.close = AsyncMock()

            # Run task
            result = await get_latest_analysis(hours=24, limit=100)

            # Verify result
            assert result["status"] == "success"
            assert len(result["articles"]) == 1
            assert len(result["posts"]) == 1
            assert "timestamp" in result

            # Verify calls
            news_instance.initialize.assert_called_once()
            news_instance.close.assert_called_once()
            social_instance.initialize.assert_called_once()
            social_instance.close.assert_called_once()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
