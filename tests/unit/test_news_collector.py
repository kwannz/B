"""
新闻收集器测试
"""

import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
<<<<<<< HEAD
from sqlalchemy.orm import Session

from tradingbot.shared.news_collector import NewsCollector
from tradingbot.shared.models.database import NewsArticle
||||||| fa1bd03
from sqlalchemy.orm import Session

from tradingbot.shared.news_collector import NewsCollector
from tradingbot.trading_agent.python.models.database import NewsArticle
=======
from tradingbot.shared.news_collector.collector import NewsCollector
from tradingbot.shared.models.mongodb import RawNewsArticle
from tradingbot.shared.models.news_storage import NewsStorage
>>>>>>> origin/main

# 测试数据
MOCK_COINDESK_RESPONSE = {
    "articles": [
        {
            "title": "Test Article 1",
            "url": "https://coindesk.com/article1",
            "content": "Test content 1",
            "published_at": "2024-02-25T00:00:00Z",
            "author": "Test Author",
            "tags": ["bitcoin", "ethereum"],
        }
    ]
}


@pytest.fixture
async def news_collector():
    """创建新闻收集器实例"""
    collector = NewsCollector()
    await collector.initialize()
    yield collector
    await collector.close()


@pytest.mark.asyncio
async def test_initialization(news_collector):
    """测试初始化"""
    assert news_collector.news_api_key is not None
    assert news_collector.session is not None
    assert len(news_collector.sources) == 3
    assert all(
        source in news_collector.sources
        for source in ["coindesk", "cointelegraph", "decrypt"]
    )


@pytest.mark.asyncio
async def test_fetch_api_source(news_collector):
    """测试通过API获取新闻"""
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = MOCK_COINDESK_RESPONSE
        mock_get.return_value.__aenter__.return_value = mock_response

        articles = await news_collector.fetch_source("coindesk")

        assert len(articles) == 1
        article = articles[0]
        assert article.source == "coindesk"
        assert article.title == "Test Article 1"
        assert article.url == "https://coindesk.com/article1"


@pytest.mark.asyncio
async def test_fetch_crawler_source(news_collector):
    """测试通过爬虫获取新闻"""
    mock_article = {
        "title": "Test Crawled Article",
        "content": "Test crawled content",
        "url": "https://cointelegraph.com/test",
        "published_at": datetime.utcnow(),
    }

    with patch("src.shared.news_crawler.NewsCrawler.crawl_source") as mock_crawl:
        mock_crawl.return_value = [mock_article]

        articles = await news_collector.fetch_source("cointelegraph")

        assert len(articles) == 1
        article = articles[0]
        assert article.source == "cointelegraph"
        assert article.title == mock_article["title"]
        assert article.url == mock_article["url"]
        assert article.content == mock_article["content"]


@pytest.mark.asyncio
async def test_deduplication(news_collector):
    """测试文章去重"""
    articles = [
        RawNewsArticle(
            source="coindesk",
            title="Test 1",
            url="https://test.com/1",
            content="Test content 1",
            published_at=datetime.utcnow(),
        ),
        RawNewsArticle(
            source="coindesk",
            title="Test 1 Duplicate",
            url="https://test.com/1",  # 相同URL
            content="Test content 2",
            published_at=datetime.utcnow(),
        ),
    ]

    result = news_collector._deduplicate_articles(articles)
    assert len(result) == 1
    assert result[0].title == "Test 1"


@pytest.mark.asyncio
async def test_age_filtering(news_collector):
    """测试时间范围过滤"""
    now = datetime.utcnow()
    articles = [
        RawNewsArticle(
            source="coindesk",
            title="Recent",
            url="https://test.com/1",
            content="Recent content",
            published_at=now - timedelta(days=1),
        ),
        RawNewsArticle(
            source="coindesk",
            title="Old",
            url="https://test.com/2",
            content="Old content",
            published_at=now - timedelta(days=10),
        ),
    ]

    result = news_collector._filter_by_age(articles)
    assert len(result) == 1
    assert result[0].title == "Recent"


@pytest.mark.asyncio
async def test_store_articles(news_collector):
    """Test article storage"""
    # Mock storage
    news_collector.storage.store_articles = AsyncMock()

    # Create test article
    article = RawNewsArticle(
        source="coindesk",
        title="Test Store",
        content="Test content",
        url="https://test.com/store",
        published_at=datetime.utcnow(),
    )

    # Store article
    await news_collector.storage.store_articles([article])

    # Verify storage called
    news_collector.storage.store_articles.assert_called_once()
    args = news_collector.storage.store_articles.call_args[0][0]
    assert len(args) == 1
    assert isinstance(args[0], RawNewsArticle)
    assert args[0].title == "Test Store"


@pytest.mark.asyncio
async def test_connection_verification(news_collector):
    """测试连接验证"""
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_get.return_value.__aenter__.return_value = mock_response

        results = await news_collector.verify_connections()

        assert "coindesk" in results
        assert results["coindesk"] is True


@pytest.mark.asyncio
async def test_error_handling(news_collector):
    """测试错误处理"""
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.side_effect = Exception("API Error")

        articles = await news_collector.fetch_source("coindesk")
        assert len(articles) == 0


if __name__ == "__main__":
    pytest.main(["-v", __file__])
