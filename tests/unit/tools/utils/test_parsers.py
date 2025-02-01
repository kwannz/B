"""
Test news source parsers
"""

from datetime import datetime

import pytest
from bs4 import BeautifulSoup

from tradingbot.shared.models.mongodb import RawNewsArticle
from tradingbot.shared.news_collector.parsers import (
    parse_coindesk,
    parse_cointelegraph,
    parse_decrypt,
)


@pytest.fixture
def coindesk_html():
    """Sample Coindesk HTML"""
    return """
    <article class="article-card">
        <h4 class="heading">Test Coindesk Article</h4>
        <a href="/test-article">Read more</a>
        <div class="card-text">Test content</div>
    </article>
    """


@pytest.fixture
def cointelegraph_html():
    """Sample Cointelegraph HTML"""
    return """
    <article class="post-card">
        <span class="post-card__title">Test Cointelegraph Article</span>
        <a class="post-card__title-link" href="/test-article">Read more</a>
        <p class="post-card__text">Test content</p>
    </article>
    """


@pytest.fixture
def decrypt_html():
    """Sample Decrypt HTML"""
    return """
    <article class="article-card">
        <h3 class="article-title">Test Decrypt Article</h3>
        <a href="/test-article">Read more</a>
        <div class="article-excerpt">Test content</div>
    </article>
    """


@pytest.mark.asyncio
async def test_parse_coindesk(coindesk_html):
    """Test Coindesk parser"""
    articles = await parse_coindesk(coindesk_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "coindesk"
    assert article.title == "Test Coindesk Article"
    assert article.url == "https://www.coindesk.com/test-article"
    assert article.content == "Test content"
    assert isinstance(article.published_at, datetime)


@pytest.mark.asyncio
async def test_parse_cointelegraph(cointelegraph_html):
    """Test Cointelegraph parser"""
    articles = await parse_cointelegraph(cointelegraph_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "cointelegraph"
    assert article.title == "Test Cointelegraph Article"
    assert article.url == "https://cointelegraph.com/test-article"
    assert article.content == "Test content"
    assert isinstance(article.published_at, datetime)


@pytest.mark.asyncio
async def test_parse_decrypt(decrypt_html):
    """Test Decrypt parser"""
    articles = await parse_decrypt(decrypt_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "decrypt"
    assert article.title == "Test Decrypt Article"
    assert article.url == "https://decrypt.co/test-article"
    assert article.content == "Test content"
    assert isinstance(article.published_at, datetime)


@pytest.mark.asyncio
async def test_parser_error_handling():
    """Test parser error handling"""
    # Invalid HTML
    articles = await parse_coindesk("<invalid>")
    assert articles == []

    articles = await parse_cointelegraph("<invalid>")
    assert articles == []

    articles = await parse_decrypt("<invalid>")
    assert articles == []

    # Empty content
    articles = await parse_coindesk("")
    assert articles == []

    articles = await parse_cointelegraph("")
    assert articles == []

    articles = await parse_decrypt("")
    assert articles == []


if __name__ == "__main__":
    pytest.main(["-v", __file__])
