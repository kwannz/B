"""
Test Chinese news source parsers
"""

import pytest
from datetime import datetime
from bs4 import BeautifulSoup

from tradingbot.shared.news_collector.parsers import (
    parse_binance_cn,
    parse_jinse,
    parse_odaily,
    BINANCE_CN_URL,
    JINSE_URL,
    ODAILY_URL,
)
from tradingbot.shared.models.mongodb import RawNewsArticle


@pytest.fixture
def binance_cn_html():
    """Sample Binance CN HTML"""
    return """
    <div class="article-item">
        <h2 class="article-title">测试币安文章</h2>
        <a href="/test-article">阅读更多</a>
        <div class="article-summary">测试内容</div>
        <span class="author">测试作者</span>
    </div>
    """


@pytest.fixture
def jinse_html():
    """Sample Jinse HTML"""
    return """
    <div class="article-list__item">
        <h3 class="article-title">测试金色文章</h3>
        <a href="/test-article">阅读更多</a>
        <div class="article-content">测试内容</div>
        <span class="author-name">测试作者</span>
    </div>
    """


@pytest.fixture
def odaily_html():
    """Sample Odaily HTML"""
    return """
    <div class="post-item">
        <h2 class="post-title">测试Odaily文章</h2>
        <a href="/test-article">阅读更多</a>
        <div class="post-excerpt">测试内容</div>
        <span class="post-author">测试作者</span>
    </div>
    """


@pytest.mark.asyncio
async def test_parse_binance_cn(binance_cn_html):
    """Test Binance CN parser"""
    articles = await parse_binance_cn(binance_cn_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "binance_cn"
    assert article.title == "测试币安文章"
    assert article.url == f"{BINANCE_CN_URL}/test-article"
    assert article.content == "测试内容"
    assert article.author == "测试作者"
    assert article.metadata["language"] == "zh"


@pytest.mark.asyncio
async def test_parse_jinse(jinse_html):
    """Test Jinse parser"""
    articles = await parse_jinse(jinse_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "jinse"
    assert article.title == "测试金色文章"
    assert article.url == f"{JINSE_URL}/test-article"
    assert article.content == "测试内容"
    assert article.author == "测试作者"
    assert article.metadata["language"] == "zh"


@pytest.mark.asyncio
async def test_parse_odaily(odaily_html):
    """Test Odaily parser"""
    articles = await parse_odaily(odaily_html)
    assert len(articles) == 1

    article = articles[0]
    assert isinstance(article, RawNewsArticle)
    assert article.source == "odaily"
    assert article.title == "测试Odaily文章"
    assert article.url == f"{ODAILY_URL}/test-article"
    assert article.content == "测试内容"
    assert article.author == "测试作者"
    assert article.metadata["language"] == "zh"


@pytest.mark.asyncio
async def test_parser_error_handling():
    """Test parser error handling"""
    # Invalid HTML
    articles = await parse_binance_cn("<invalid>")
    assert articles == []

    articles = await parse_jinse("<invalid>")
    assert articles == []

    articles = await parse_odaily("<invalid>")
    assert articles == []

    # Empty content
    articles = await parse_binance_cn("")
    assert articles == []

    articles = await parse_jinse("")
    assert articles == []

    articles = await parse_odaily("")
    assert articles == []


if __name__ == "__main__":
    pytest.main(["-v", __file__])
