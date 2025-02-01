"""
新闻爬虫测试
"""

from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from bs4 import BeautifulSoup

from tradingbot.shared.news_crawler import NewsCrawler

# 测试数据
MOCK_HTML = """
<html>
    <article class="post">
        <h1 class="post__title">Test Article</h1>
        <div class="post__content">Test content</div>
        <time class="post__date" datetime="2024-02-25T00:00:00Z">2024-02-25</time>
        <a href="/article/test">Read more</a>
    </article>
</html>
"""


@pytest.fixture
async def news_crawler():
    """创建爬虫实例"""
    crawler = NewsCrawler()
    await crawler.initialize()
    yield crawler
    await crawler.close()


@pytest.mark.asyncio
async def test_initialization(news_crawler):
    """测试初始化"""
    assert news_crawler.session is not None
    assert news_crawler.exception_handler is not None


@pytest.mark.asyncio
async def test_crawl_source(news_crawler, mock_response):
    """测试爬取新闻源"""
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.text = Mock(
            return_value=MOCK_HTML
        )

        articles = await news_crawler.crawl_source(
            "cointelegraph", "https://cointelegraph.com"
        )

        assert len(articles) == 1
        article = articles[0]
        assert article["title"] == "Test Article"
        assert article["content"] == "Test content"
        assert article["url"] == "https://cointelegraph.com/article/test"
        assert isinstance(article["published_at"], datetime)


@pytest.mark.asyncio
async def test_invalid_source(news_crawler):
    """测试无效新闻源"""
    articles = await news_crawler.crawl_source("invalid_source", "https://example.com")
    assert len(articles) == 0


@pytest.mark.asyncio
async def test_parse_article(news_crawler):
    """测试文章解析"""
    soup = BeautifulSoup(MOCK_HTML, "html.parser")
    article_elem = soup.select_one("article.post")

    config = news_crawler.source_configs["cointelegraph"]
    article = await news_crawler._parse_article(article_elem, config)

    assert article is not None
    assert article["title"] == "Test Article"
    assert article["content"] == "Test content"
    assert article["url"].endswith("/article/test")
    assert isinstance(article["published_at"], datetime)


@pytest.mark.asyncio
async def test_validate_article(news_crawler):
    """测试文章验证"""
    valid_article = {
        "title": "Test",
        "content": "Content",
        "url": "https://example.com",
        "published_at": datetime.utcnow(),
    }
    assert await news_crawler.validate_article(valid_article) is True

    invalid_article = {"title": "Test", "url": "https://example.com"}
    assert await news_crawler.validate_article(invalid_article) is False


if __name__ == "__main__":
    pytest.main(["-v", __file__])
