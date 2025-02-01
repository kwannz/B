"""
Test MongoDB integration with NewsCollector
"""

import os
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch
from sqlalchemy.orm import Session

from tradingbot.shared.news_collector import NewsCollector
from tradingbot.shared.models.mongodb import MongoDBManager, RawNewsArticle
from tradingbot.shared.models.database import NewsArticle


@pytest.fixture
def mock_db_session():
    """Create mock database session"""
    session = Mock(spec=Session)
    session.add = Mock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
async def news_collector(mock_db_session):
    """Create news collector instance"""
    collector = NewsCollector(mock_db_session)
    await collector.initialize()
    yield collector
    await collector.close()


@pytest.fixture
def sample_raw_article():
    """Create sample raw article data"""
    return {
        "source": {"name": "coindesk"},
        "title": "Test Article",
        "url": "http://test.com/article",
        "content": "Test content",
        "author": "Test Author",
        "publishedAt": "2024-01-20T12:00:00Z",
        "tags": ["bitcoin", "test"],
    }


@pytest.mark.asyncio
async def test_mongodb_initialization(news_collector):
    """Test MongoDB initialization"""
    assert news_collector.mongodb is not None
    assert news_collector.mongodb.initialized
    assert news_collector.raw_storage is not None


@pytest.mark.asyncio
async def test_raw_article_storage(news_collector, sample_raw_article):
    """Test storing raw article in MongoDB"""
    # Mock MongoDB storage
    mock_insert = AsyncMock(return_value="test_id")
    news_collector.raw_storage.insert_one = mock_insert

    # Process article
    processed = await news_collector._parse_articles(
        "coindesk", {"articles": [sample_raw_article]}
    )

    # Verify MongoDB storage was called
    assert mock_insert.called
    call_args = mock_insert.call_args[0][0]
    assert isinstance(call_args, dict)
    assert call_args["source"] == "coindesk"
    assert call_args["title"] == "Test Article"
    assert call_args["url"] == "http://test.com/article"

    # Verify processed article
    assert len(processed) == 1
    article = processed[0]
    assert isinstance(article, NewsArticle)
    assert article.source == "coindesk"
    assert article.title == "Test Article"
    assert article.metadata["raw_id"] == "test_id"


@pytest.mark.asyncio
async def test_raw_article_validation(news_collector):
    """Test raw article validation"""
    invalid_article = {
        "source": {"name": "coindesk"},
        # Missing required fields
        "content": "Test content",
    }

    # Process invalid article
    processed = await news_collector._parse_articles(
        "coindesk", {"articles": [invalid_article]}
    )

    # Verify no articles were processed
    assert len(processed) == 0


@pytest.mark.asyncio
async def test_mongodb_error_handling(news_collector, sample_raw_article):
    """Test MongoDB error handling"""
    # Mock MongoDB storage to raise error
    mock_insert = AsyncMock(side_effect=Exception("MongoDB error"))
    news_collector.raw_storage.insert_one = mock_insert

    # Process article
    processed = await news_collector._parse_articles(
        "coindesk", {"articles": [sample_raw_article]}
    )

    # Verify error was handled gracefully
    assert len(processed) == 0


@pytest.mark.asyncio
async def test_full_article_flow(news_collector, sample_raw_article, mock_db_session):
    """Test full article flow from raw storage to processed storage"""
    # Mock MongoDB and PostgreSQL storage
    mongo_id = "test_mongo_id"
    news_collector.raw_storage.insert_one = AsyncMock(return_value=mongo_id)

    # Mock sentiment analyzer
    news_collector.sentiment_analyzer.analyze_article = AsyncMock(return_value=0.5)

    # Process and store article
    articles = await news_collector._parse_articles(
        "coindesk", {"articles": [sample_raw_article]}
    )
    await news_collector.store_articles(articles)

    # Verify MongoDB storage
    assert news_collector.raw_storage.insert_one.called

    # Verify PostgreSQL storage
    assert mock_db_session.add.called
    stored_article = mock_db_session.add.call_args[0][0]
    assert isinstance(stored_article, NewsArticle)
    assert stored_article.metadata["raw_id"] == mongo_id
    assert stored_article.sentiment_score == 0.5


if __name__ == "__main__":
    pytest.main(["-v", __file__])
