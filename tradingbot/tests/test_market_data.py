import pytest
import asyncio
import logging
import aiohttp
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from unittest.mock import AsyncMock, MagicMock, patch

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tradingbot.shared.backtester import Backtester  # Import backtester module
from tradingbot.shared.market_data_orchestrator import MarketDataOrchestrator
from tradingbot.shared.models import NewsArticle, SocialMediaPost
from tradingbot.shared.models.social_media import SocialMediaPostModel

# Create test articles with all required fields
test_articles = [
    NewsArticle(
        source="coindesk",
        title="Test Coindesk Article",
        content="Full Coindesk article content",
        url="https://www.coindesk.com/markets/test1",
        published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
    ),
    NewsArticle(
        source="cointelegraph",
        title="Test Cointelegraph Article",
        content="Full Cointelegraph article content",
        url="https://cointelegraph.com/news/test2",
        published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
    ),
    NewsArticle(
        source="decrypt",
        title="Test Decrypt Article",
        content="Full Decrypt article content",
        url="https://decrypt.co/news/test3",
        published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
    ),
]

# Define test posts at module level
test_posts = [
    SocialMediaPost(
        platform="twitter",
        author="test_user",
        content="Test post 1",
        posted_at=datetime.utcnow(),
    )
]


# Helper function for mocking HTTP responses
async def mock_get_response(url: str, mock_responses: dict) -> "MockResponse":
    """Helper function to mock HTTP responses"""
    # Normalize URL
    url = url.lower().strip("/")
    if not url.startswith("http"):
        url = f"https://{url}"

    # Try exact match first
    for mock_url, response in mock_responses.items():
        normalized_mock = mock_url.lower().strip("/")
        if url == normalized_mock:
            return MockResponse(response, status=200)

    # Try matching article detail pages
    base_url = url.split("/markets")[0].split("/news")[0]
    for mock_url, response in mock_responses.items():
        normalized_mock = mock_url.lower().strip("/")
        mock_base = normalized_mock.split("/markets")[0].split("/news")[0]

        if base_url == mock_base:
            # If this is a detail page request
            if "/markets/" in url or "/news/" in url:
                # Try to find matching detail page
                for detail_url, detail_content in mock_responses.items():
                    detail_normalized = detail_url.lower().strip("/")
                    if (
                        "/markets/" in detail_normalized
                        or "/news/" in detail_normalized
                    ):
                        if any(path in url for path in ["/test1", "/test2", "/test3"]):
                            return MockResponse(detail_content, status=200)

            # Return main page content as fallback
            return MockResponse(response, status=200)

    # Log unmatched URL for debugging
    logging.warning(f"No mock response found for URL: {url}")
    logging.warning(f"Available mock URLs: {list(mock_responses.keys())}")

    # Return 404 response
    return MockResponse("", status=404)


class MockResponse:
    """Mock aiohttp response for testing"""

    def __init__(self, text, status=200):
        self._text = text
        self.status = status
        self._json = None
        self._released = False
        self._context_manager = self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.release()
        return None

    async def text(self):
        if self._released:
            raise RuntimeError("Response already released")
        return self._text

    async def json(self):
        if self._released:
            raise RuntimeError("Response already released")
        if self._json is not None:
            return self._json
        try:
            return {"data": self._text, "status": "success"}
        except Exception as e:
            raise RuntimeError(f"Failed to parse JSON: {str(e)}")

    def raise_for_status(self):
        if self.status >= 400:
            raise aiohttp.ClientResponseError(
                request_info=None, history=None, status=self.status
            )

    async def release(self):
        """Release the response"""
        self._released = True

    @property
    def closed(self):
        return self._released


@pytest.fixture(autouse=True)
async def mock_mongodb():
    """Mock MongoDB client for testing"""

    # Create mock class to replace MongoDBManager
    class MockMongoDBManager:
        _instance = None

        def __new__(cls):
            if not hasattr(cls, "_instance") or cls._instance is None:
                cls._instance = object.__new__(cls)
            return cls._instance

        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)
            self._data = {}  # In-memory storage

        async def start(self):
            """Start mock MongoDB connection"""
            self.initialized = True
            self.logger.info("Mock MongoDB connection started")
            return True

        async def stop(self):
            """Stop mock MongoDB connection"""
            self.initialized = False
            self._data = {}
            self.logger.info("Mock MongoDB connection stopped")

        async def find(self, collection, query=None):
            if not self.initialized:
                raise RuntimeError("Mock MongoDB not initialized")
            return self._data.get(collection, [])

        async def insert_one(self, collection, document):
            if not self.initialized:
                raise RuntimeError("Mock MongoDB not initialized")
            if collection not in self._data:
                self._data[collection] = []
            self._data[collection].append(document)
            return len(self._data[collection]) - 1  # Return mock _id

        async def admin_command(self, command):
            """Mock admin commands"""
            if not self.initialized:
                raise RuntimeError("Mock MongoDB not initialized")
            if command == "ping":
                return True
            return False

        @property
        def db(self):
            if not self.initialized:
                raise RuntimeError("Mock MongoDB not initialized")
            return self

        @property
        def admin(self):
            """Mock admin database"""
            return self

    # Create mock instance
    mock_db = MockMongoDBManager()

    # Patch the MongoDBManager
    with patch("src.shared.models.mongodb.MongoDBManager", return_value=mock_db):
        yield mock_db

        # Cleanup
        if mock_db.initialized:
            await mock_db.stop()


@pytest.fixture
async def mock_exception_handler():
    """Mock ExceptionHandler"""

    class MockExceptionHandler:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)

        async def start(self):
            self.initialized = True
            self.logger.info("Mock ExceptionHandler started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock ExceptionHandler stopped")

    with patch("src.shared.exception_handler.ExceptionHandler", MockExceptionHandler):
        yield MockExceptionHandler()


@pytest.fixture
async def mock_sentiment_analyzer():
    """Mock NewsSentimentAnalyzer"""

    class MockSentimentAnalyzer:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)

        async def start(self):
            self.initialized = True
            self.logger.info("Mock SentimentAnalyzer started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock SentimentAnalyzer stopped")

        async def analyze_article(self, article_data):
            return 0.8

        async def _get_finbert_sentiment(
            self, text: str
        ) -> Tuple[Optional[float], float]:
            """Mock FinBERT sentiment analysis"""
            return (0.8, 0.9)

    with patch(
        "src.shared.news_sentiment_analyzer.NewsSentimentAnalyzer",
        MockSentimentAnalyzer,
    ):
        yield MockSentimentAnalyzer()


@pytest.fixture
async def mock_client_session():
    """Mock aiohttp ClientSession"""
    session = AsyncMock()
    session.get = AsyncMock()
    session.close = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=session):
        yield session
        await session.close()


@pytest.fixture
async def mock_redis():
    """Mock Redis client"""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=None)
    mock_client.setex = AsyncMock()
    mock_client.close = AsyncMock()

    with patch("redis.asyncio.from_url", return_value=mock_client):
        yield mock_client
        await mock_client.close()


@pytest.fixture
async def mock_backtester():
    """Mock Backtester"""

    class MockBacktester:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)
            self._historical_data = pd.DataFrame()

        async def start(self):
            self.initialized = True
            self.logger.info("Mock Backtester started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock Backtester stopped")

        async def load_data(self, data):
            self._historical_data = pd.DataFrame(data)

        async def run_backtest(self, strategy):
            return {
                "trades": [],
                "metrics": {
                    "total_return": 0.1,
                    "sharpe_ratio": 1.5,
                    "max_drawdown": 0.05,
                },
                "equity_curve": [{"timestamp": datetime.utcnow(), "equity": 10000}],
            }

    with patch("src.shared.backtester.Backtester", MockBacktester):
        yield MockBacktester()


@pytest.fixture
async def mock_risk_controller():
    """Mock RiskController"""

    class MockRiskController:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)

        async def start(self):
            self.initialized = True
            self.logger.info("Mock RiskController started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock RiskController stopped")

        async def check_risk(self, trade_data):
            return {"allowed": True, "risk_level": "low", "warnings": []}

        async def get_risk_metrics(self):
            return {
                "current_risk_level": "low",
                "total_position_value": 5000.0,
                "current_drawdown": 0.02,
                "position_sizes": {},
            }

    with patch("src.shared.risk_controller.RiskController", MockRiskController):
        yield MockRiskController()


@pytest.fixture
def mock_env(monkeypatch):
    """Mock environment variables"""
    # Mock API keys and URLs
    monkeypatch.setenv("NEWS_API_KEY", "mock_news_api_key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "mock_deepseek_api_key")
    monkeypatch.setenv("COINDESK_URL", "https://api.coindesk.com")
    monkeypatch.setenv("COINTELEGRAPH_URL", "https://api.cointelegraph.com")
    monkeypatch.setenv("DECRYPT_URL", "https://api.decrypt.co")
    monkeypatch.setenv("FINBERT_MODEL_PATH", "/tmp/finbert")

    # Mock configuration
    monkeypatch.setenv("USE_REDIS", "false")
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("MAX_RETRIES", "1")
    monkeypatch.setenv("RETRY_DELAY", "0")
    monkeypatch.setenv("COLLECTION_INTERVAL", "60")
    monkeypatch.setenv("MAX_SEQUENCE_LENGTH", "512")
    monkeypatch.setenv("MIN_CONFIDENCE", "0.5")
    monkeypatch.setenv("BATCH_SIZE", "8")

    # Mock social media credentials
    monkeypatch.setenv("TWITTER_USER", "mock_user")
    monkeypatch.setenv("TWITTER_PASS", "mock_pass")
    monkeypatch.setenv("TWITTER_EMAIL", "mock@example.com")

    # Mock database configuration
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("MONGODB_DATABASE", "test_db")
    monkeypatch.setenv("POSTGRES_URL", "postgresql://localhost:5432/test_db")

    # Mock source URLs
    monkeypatch.setenv("COINDESK_URL", "api.coindesk.com")
    monkeypatch.setenv("COINTELEGRAPH_URL", "api.cointelegraph.com")
    monkeypatch.setenv("DECRYPT_URL", "api.decrypt.co")


@pytest.mark.asyncio
async def test_news_collection(
    mock_env, mock_mongodb, mock_exception_handler, mock_client_session
):
    """Test news collection functionality"""
    # Create mock session with proper async context manager and all required methods
    mock_session = AsyncMock()
    mock_session.add = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.execute.return_value.scalars = AsyncMock()
    mock_session.execute.return_value.scalars.return_value = AsyncMock()
    mock_session.execute.return_value.scalars.return_value.all = AsyncMock(
        return_value=[]
    )
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    # Mock responses for each news source with proper HTML structure
    mock_responses = {
        # English Sources
        "https://www.coindesk.com/markets": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">Test Coindesk Article</div>
                    <div class="article-content">Test content 1</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/markets/test1">Read more</a>
                </article>
            </body></html>
        """,
        "https://www.coindesk.com/markets/test1": """
            <html><body>
                <div class="article-content">Full Coindesk article content</div>
            </body></html>
        """,
        # Chinese Sources
        "https://www.binance.com/zh-CN/square/profile/BinanceSquareCN": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">测试币安文章</div>
                    <div class="article-content">测试内容</div>
                    <time datetime="2025-01-22T00:00:00Z">2025年1月22日</time>
                    <a href="/zh-CN/test1">阅读更多</a>
                </article>
            </body></html>
        """,
        "https://www.binance.com/zh-CN/test1": """
            <html><body>
                <div class="article-content">完整的币安文章内容</div>
            </body></html>
        """,
        # Japanese Sources
        "https://www.odaily.news/ja": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">テスト記事</div>
                    <div class="article-content">テストコンテンツ</div>
                    <time datetime="2025-01-22T00:00:00Z">2025年1月22日</time>
                    <a href="/ja/test1">続きを読む</a>
                </article>
            </body></html>
        """,
        "https://www.odaily.news/ja/test1": """
            <html><body>
                <div class="article-content">完全な記事の内容</div>
            </body></html>
        """,
    }

    # Add detail page URLs to mock responses
    for base_url, content in list(mock_responses.items()):
        if not any(base_url.endswith(x) for x in ("test1",)):
            continue
        detail_url = f"{base_url}/detail"
        mock_responses[detail_url] = content

    # Create mock session with proper async context manager
    mock_session = AsyncMock()

    async def mock_get(*args, **kwargs):
        url = args[0] if args else kwargs.get("url", "")
        response = await mock_get_response(url, mock_responses)
        return response._context_manager

    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    # Mock AIAnalyzer for translations
    mock_ai_analyzer = AsyncMock()
    mock_ai_analyzer.translate_text = AsyncMock(return_value="Translated content")

    # Configure mock news collector with proper async context
    with patch("aiohttp.ClientSession", return_value=mock_session), patch(
        "src.shared.news_collector.AIAnalyzer", return_value=mock_ai_analyzer
    ):
        mock_articles = [
            NewsArticle(
                source="coindesk",
                title="Test Coindesk Article",
                content="Test content 1",
                url="https://www.coindesk.com/markets/test1",
                published_at=datetime.utcnow(),
                metadata={"original_language": "en"},
            ),
            NewsArticle(
                source="binance_square",
                title="测试币安文章",
                content="测试内容",
                url="https://www.binance.com/zh-CN/test1",
                published_at=datetime.utcnow(),
                metadata={"original_language": "zh-CN"},
            ),
            NewsArticle(
                source="odaily",
                title="テスト記事",
                content="テストコンテンツ",
                url="https://www.odaily.news/ja/test1",
                published_at=datetime.utcnow(),
                metadata={"original_language": "ja"},
            ),
        ]

    # Create mock session with proper async context manager
    mock_session = AsyncMock()
    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()
    mock_session.close = AsyncMock()

    orchestrator = None
    try:
        with patch("aiohttp.ClientSession", return_value=mock_session), patch(
            "src.shared.news_collector.aiohttp.ClientSession", return_value=mock_session
        ), patch(
            "src.shared.news_collector.AIAnalyzer", return_value=mock_ai_analyzer
        ), patch.dict(
            os.environ, {"ENABLE_TRANSLATION": "true", "TARGET_LANGUAGE": "en"}
        ):
            orchestrator = MarketDataOrchestrator(mock_session)
            await orchestrator.start()

            # Configure news collector sources
            orchestrator.news_collector.sources = {
                "coindesk": {
                    "url": "https://www.coindesk.com/markets",
                    "enabled": True,
                    "use_crawler": True,
                    "language": "en",
                },
                "binance_square": {
                    "url": "https://www.binance.com/zh-CN/square/profile/BinanceSquareCN",
                    "enabled": True,
                    "use_crawler": True,
                    "language": "zh-CN",
                },
                "odaily": {
                    "url": "https://www.odaily.news/ja",
                    "enabled": True,
                    "use_crawler": True,
                    "language": "ja",
                },
            }

            # Verify news collection
            articles = await orchestrator.news_collector.fetch_all_sources()
            assert len(articles) == 3, f"Expected 3 articles, got {len(articles)}"

            # Verify article properties and translations
            for article in articles:
                assert isinstance(article, NewsArticle)
                assert article.title, f"Article {article.source} missing title"
                assert article.content, f"Article {article.source} missing content"
                assert (
                    article.published_at
                ), f"Article {article.source} missing published_at"
                assert article.metadata, f"Article {article.source} missing metadata"

                # Verify language metadata
                assert (
                    "original_language" in article.metadata
                ), f"Article {article.source} missing original_language"
                if article.metadata["original_language"] != "en":
                    assert (
                        "translated" in article.metadata
                    ), f"Article {article.source} missing translated flag"
                    assert (
                        "target_language" in article.metadata
                    ), f"Article {article.source} missing target_language"
                    assert (
                        "original_title" in article.metadata
                    ), f"Article {article.source} missing original_title"
                    assert (
                        "original_content" in article.metadata
                    ), f"Article {article.source} missing original_content"

                # Verify UTC timestamps
                assert (
                    article.published_at.tzinfo is not None
                ), f"Article {article.source} timestamp missing timezone"

            # Verify translation was called for non-English articles
            translation_calls = len(
                [
                    call
                    for call in mock_ai_analyzer.translate_text.call_args_list
                    if call[0][1] != "en"  # Check source language arg
                ]
            )
            assert (
                translation_calls == 2
            ), f"Expected 2 translation calls, got {translation_calls}"

            # Verify data persistence
            assert mock_session.add.called, "Session add not called"
            assert mock_session.commit.called, "Session commit not called"
    finally:
        if orchestrator:
            await orchestrator.stop()


@pytest.mark.asyncio
async def test_sentiment_analysis(
    mock_env, mock_mongodb, mock_exception_handler, mock_client_session
):
    """Test sentiment analysis functionality"""
    mock_session = AsyncMock()
    mock_session.add = AsyncMock()
    mock_session.commit = AsyncMock()

    # Create test articles with all required fields
    test_articles = [
        NewsArticle(
            source="coindesk",
            title="Test Coindesk Article",
            content="Full Coindesk article content with positive sentiment about cryptocurrency markets",
            url="https://www.coindesk.com/markets/test1",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
            metadata={"sentiment_score": 0.8},
        ),
        NewsArticle(
            source="cointelegraph",
            title="Test Cointelegraph Article",
            content="Full Cointelegraph article content",
            url="https://cointelegraph.com/news/test2",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
        ),
        NewsArticle(
            source="decrypt",
            title="Test Decrypt Article",
            content="Full Decrypt article content",
            url="https://decrypt.co/news/test3",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
        ),
    ]

    # Mock news content
    mock_responses = {
        # Web scraping responses
        "https://www.coindesk.com/markets": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">Test Coindesk Article</div>
                    <div class="article-content">Full Coindesk article content</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/markets/test1">Read more</a>
                </article>
            </body></html>
        """,
        # RSS feed responses
        "https://www.coindesk.com/arc/outboundfeeds/rss/": """<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
                <channel>
                    <title>CoinDesk RSS Feed</title>
                    <item>
                        <title>Test RSS Article</title>
                        <link>https://www.coindesk.com/markets/test-rss</link>
                        <description>Test RSS content</description>
                        <pubDate>Tue, 22 Jan 2025 00:00:00 +0000</pubDate>
                        <guid>https://www.coindesk.com/markets/test-rss</guid>
                    </item>
                </channel>
            </rss>
        """,
        "https://cointelegraph.com/rss": """<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
                <channel>
                    <title>Cointelegraph RSS Feed</title>
                    <item>
                        <title>Test Cointelegraph RSS</title>
                        <link>https://cointelegraph.com/news/test-rss</link>
                        <description>Test Cointelegraph content</description>
                        <pubDate>Tue, 22 Jan 2025 00:00:00 +0000</pubDate>
                        <guid>https://cointelegraph.com/news/test-rss</guid>
                    </item>
                </channel>
            </rss>
        """,
        "https://cointelegraph.com/news": """
            <html><body>
                <article class="post-card-inline">
                    <div class="post-card-inline__title">Test Cointelegraph Article</div>
                    <div class="post__content">Full Cointelegraph article content</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/news/test2">Read more</a>
                </article>
            </body></html>
        """,
        "https://decrypt.co/news": """
            <html><body>
                <article class="article-card">
                    <div class="article-title">Test Decrypt Article</div>
                    <div class="article-content">Full Decrypt article content</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/news/test3">Read more</a>
                </article>
            </body></html>
        """,
    }

    orchestrator = MarketDataOrchestrator(mock_session)
    try:
        # Initialize orchestrator first
        await orchestrator.start()

        # Configure mock sentiment analyzers
        finbert_mock = AsyncMock()
        finbert_mock.return_value = (None, 0.4)  # Low confidence to force fallback

        deepseek_mock = AsyncMock()
        deepseek_mock.return_value = {"sentiment_score": 0.7, "confidence": 0.85}

        # Patch with proper async mocks
        with patch(
            "src.shared.news_sentiment_analyzer.NewsSentimentAnalyzer._get_finbert_sentiment",
            new=finbert_mock,
        ) as finbert_patch, patch(
            "src.shared.ai_analyzer.AIAnalyzer.get_market_sentiment", new=deepseek_mock
        ) as deepseek_patch:

            # Verify mocks are properly configured
            assert finbert_patch.return_value == (
                None,
                0.4,
            ), "FinBERT mock not configured correctly"
            assert deepseek_patch.return_value == {
                "sentiment_score": 0.7,
                "confidence": 0.85,
            }, "DeepSeek mock not configured correctly"

            # Configure sentiment analyzer
            orchestrator.sentiment_analyzer.min_confidence = (
                0.5  # Set low threshold to force fallback
            )

            await orchestrator.start()

            # Test sentiment analysis
            sentiment = await orchestrator.sentiment_analyzer.analyze_article(
                test_articles[0]
            )
            assert sentiment is not None, "Sentiment should not be None"
            assert isinstance(
                sentiment, float
            ), f"Expected float sentiment, got {type(sentiment)}"
            assert (
                -1 <= sentiment <= 1
            ), f"Sentiment {sentiment} outside valid range [-1, 1]"

            # Verify both models were called
            finbert_patch.assert_called_once()
            deepseek_patch.assert_called_once()
    finally:
        if orchestrator:
            await orchestrator.stop()


@pytest.mark.asyncio
async def test_social_media_collection(
    mock_env, mock_mongodb, mock_exception_handler, mock_client_session
):
    """Test social media collection functionality"""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.execute.return_value.scalars = AsyncMock()
    mock_session.execute.return_value.scalars.return_value = AsyncMock()
    mock_session.execute.return_value.scalars.return_value.all = AsyncMock(
        return_value=[
            SocialMediaPostModel(
                platform="twitter",
                author="test_user",
                content="Test post 1",
                posted_at=datetime.utcnow(),
            )
        ]
    )

    # Mock social media analyzer
    class MockSocialMediaAnalyzer:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)
            self.test_posts = test_posts

        async def start(self):
            self.initialized = True
            self.logger.info("Mock SocialMediaAnalyzer started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock SocialMediaAnalyzer stopped")

        async def get_recent_posts(
            self, platform: Optional[str] = None, hours: int = 24
        ):
            if not self.initialized:
                raise RuntimeError("Mock SocialMediaAnalyzer not initialized")
            if platform:
                return [post for post in self.test_posts if post.platform == platform]
            return self.test_posts

    # Mock orchestrator with our mock analyzer
    with patch(
        "src.shared.social_media_analyzer.SocialMediaAnalyzer", MockSocialMediaAnalyzer
    ):
        orchestrator = MarketDataOrchestrator(mock_session)
        try:
            await orchestrator.start()

            # Test social media collection
            posts = await orchestrator.social_media_analyzer.get_recent_posts()
            assert len(posts) == 1, f"Expected 1 post but got {len(posts)}"
            assert (
                posts[0].platform == "twitter"
            ), f"Expected platform 'twitter' but got {posts[0].platform if posts else 'no posts'}"

            # Verify mock was called correctly
            assert (
                orchestrator.social_media_analyzer.initialized
            ), "Social media analyzer not initialized"

        finally:
            await orchestrator.stop()


@pytest.mark.asyncio
async def test_rss_feed_collection(
    mock_env, mock_mongodb, mock_exception_handler, mock_client_session
):
    """Test RSS feed collection functionality"""
    # Configure mock responses
    mock_responses = {
        "https://www.coindesk.com/arc/outboundfeeds/rss/": """<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
                <channel>
                    <title>CoinDesk RSS Feed</title>
                    <item>
                        <title>Test RSS Article</title>
                        <link>https://www.coindesk.com/markets/test-rss</link>
                        <description>Test RSS content</description>
                        <pubDate>Tue, 22 Jan 2025 00:00:00 +0000</pubDate>
                        <guid>https://www.coindesk.com/markets/test-rss</guid>
                    </item>
                </channel>
            </rss>
        """
    }

    async def mock_get(*args, **kwargs):
        url = args[0] if args else kwargs.get("url", "")
        response = MockResponse(text=mock_responses.get(url, ""), status=200)
        return response._context_manager

    # Create mock session with proper async context manager
    mock_session = AsyncMock()
    mock_session.add = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    # Create mock session
    mock_session = AsyncMock()
    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    orchestrator = MarketDataOrchestrator(mock_session)
    try:
        await orchestrator.start()

        # Test RSS feed collection
        articles = await orchestrator.news_collector.fetch_rss_source(
            "coindesk_rss", "https://www.coindesk.com/arc/outboundfeeds/rss/"
        )

        # Verify articles were collected
        assert len(articles) > 0, "No articles fetched from RSS feed"
        assert articles[0].source == "coindesk_rss"
        assert articles[0].title == "Test RSS Article"
        assert articles[0].url == "https://www.coindesk.com/markets/test-rss"

        # Verify deduplication
        articles = orchestrator.news_collector._deduplicate_articles(
            articles + articles
        )
        assert len(articles) == 1, "Duplicate articles not removed"

        # Verify age filtering
        old_article = articles[0]
        old_article.published_at = datetime.utcnow() - timedelta(days=10)
        filtered_articles = orchestrator.news_collector._filter_by_age([old_article])
        assert len(filtered_articles) == 0, "Old article not filtered out"

    finally:
        await orchestrator.stop()


@pytest.mark.asyncio
async def test_market_data_integration(mock_env, mock_mongodb, mock_exception_handler):
    """Integration test for complete market data workflow"""

    # Mock sentiment analyzer
    class MockSentimentAnalyzer:
        def __init__(self):
            self.initialized = False
            self.logger = logging.getLogger(__name__)

        async def start(self):
            self.initialized = True
            self.logger.info("Mock SentimentAnalyzer started")

        async def stop(self):
            self.initialized = False
            self.logger.info("Mock SentimentAnalyzer stopped")

        async def analyze_article(self, article_data):
            return 0.8

        async def _get_finbert_sentiment(
            self, text: str
        ) -> Tuple[Optional[float], float]:
            """Mock FinBERT sentiment analysis"""
            return (0.8, 0.9)

    # Test data setup
    mock_session = AsyncMock()
    mock_session.add = AsyncMock()
    mock_session.commit = AsyncMock()

    # Mock social media posts
    test_posts = [
        SocialMediaPost(
            platform="twitter",
            author="crypto_analyst",
            content="Bullish market indicators #BTC",
            posted_at=datetime.utcnow(),
        )
    ]

    # Create test articles with all required fields
    test_articles = [
        NewsArticle(
            source="coindesk",
            title="Test Coindesk Article",
            content="Full Coindesk article content",
            url="https://www.coindesk.com/markets/test1",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
        ),
        NewsArticle(
            source="cointelegraph",
            title="Test Cointelegraph Article",
            content="Full Cointelegraph article content",
            url="https://cointelegraph.com/news/test2",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
        ),
        NewsArticle(
            source="decrypt",
            title="Test Decrypt Article",
            content="Full Decrypt article content",
            url="https://decrypt.co/news/test3",
            published_at=datetime.fromisoformat("2025-01-22T00:00:00Z"),
        ),
    ]

    # Mock news content for different sources with full URLs
    mock_responses = {
        "https://www.coindesk.com/markets": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">Test Coindesk Article</div>
                    <div class="article-content">Test content 1</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/markets/test1">Read more</a>
                </article>
            </body></html>
        """,
        "https://www.coindesk.com/markets/test1": """
            <html><body>
                <div class="article-content">Full Coindesk article content</div>
            </body></html>
        """,
        "https://cointelegraph.com/news": """
            <html><body>
                <article class="post-card-inline">
                    <div class="post-card-inline__title">Test Cointelegraph Article</div>
                    <div class="post__content">Test content 2</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/news/test2">Read more</a>
                </article>
            </body></html>
        """,
        "https://cointelegraph.com/news/test2": """
            <html><body>
                <div class="post__content">Full Cointelegraph article content</div>
            </body></html>
        """,
        "https://decrypt.co/news": """
            <html><body>
                <article class="article-card">
                    <div class="article-title">Test Decrypt Article</div>
                    <div class="article-content">Test content 3</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/news/test3">Read more</a>
                </article>
            </body></html>
        """,
        "https://decrypt.co/news/test3": """
            <html><body>
                <div class="article-content">Full Decrypt article content</div>
            </body></html>
        """,
    }

    async def mock_get(*args, **kwargs):
        url = args[0] if args else kwargs.get("url", "")
        return await mock_get_response(url, mock_responses)

    # Mock social media posts
    test_posts = [
        SocialMediaPost(
            platform="twitter",
            author="crypto_analyst",
            content="Bullish market indicators #BTC",
            posted_at=datetime.utcnow(),
        )
    ]

    # Create mock session with proper async context manager
    mock_session = AsyncMock()
    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session), patch(
        "src.shared.news_sentiment_analyzer.NewsSentimentAnalyzer._get_finbert_sentiment",
        return_value=(0.8, 0.9),
    ), patch(
        "src.shared.ai_analyzer.AIAnalyzer.get_market_sentiment",
        return_value={"sentiment_score": 0.7, "confidence": 0.85},
    ), patch(
        "src.shared.social_media_analyzer.SocialMediaAnalyzer.get_recent_posts",
        return_value=test_posts,
    ):

        # Mocks are configured via patch return_value

        orchestrator = MarketDataOrchestrator(mock_session)

        # Configure news collector sources
        orchestrator.news_collector.sources = {
            "coindesk": {
                "url": "https://www.coindesk.com/markets",
                "enabled": True,
                "use_crawler": True,
            },
            "cointelegraph": {
                "url": "https://cointelegraph.com/news",
                "enabled": True,
                "use_crawler": True,
            },
            "decrypt": {
                "url": "https://decrypt.co/news",
                "enabled": True,
                "use_crawler": True,
            },
        }

        try:
            await orchestrator.start()

            # Test complete workflow
            # 1. Collect news
            articles = await orchestrator.news_collector.fetch_all_sources()
            assert (
                len(articles) == 3
            ), f"Expected 3 articles, got {len(articles)}"  # One from each source
            assert all(
                isinstance(article, NewsArticle) for article in articles
            ), "Invalid article type"

            # Verify sources
            sources = {article.source for article in articles}
            expected_sources = {"coindesk", "cointelegraph", "decrypt"}
            assert (
                sources == expected_sources
            ), f"Expected sources {expected_sources}, got {sources}"

            # Verify article fields
            for article in articles:
                assert article.title, f"Article {article.source} missing title"
                assert article.content, f"Article {article.source} missing content"
                assert article.url, f"Article {article.source} missing url"
                assert (
                    article.published_at
                ), f"Article {article.source} missing published_at"

            # 2. Analyze sentiment
            for article in articles:
                sentiment = await orchestrator.sentiment_analyzer.analyze_article(
                    article
                )
                assert (
                    sentiment is not None
                ), f"Sentiment analysis failed for {article.source}"
                assert (
                    -1 <= sentiment <= 1
                ), f"Invalid sentiment range for {article.source}: {sentiment}"
                assert isinstance(
                    sentiment, float
                ), f"Invalid sentiment type for {article.source}: {type(sentiment)}"

            # 3. Collect social media data
            posts = await orchestrator.social_media_analyzer.get_recent_posts()
            assert len(posts) == 1  # One test post
            assert all(isinstance(post, SocialMediaPost) for post in posts)
            assert posts[0].platform == "twitter"
            assert "Bullish" in posts[0].content

            # 4. Verify data persistence
            assert mock_session.add.called
            assert mock_session.commit.called

        finally:
            await orchestrator.stop()


@pytest.mark.asyncio
async def test_strategy_execution(
    mock_env,
    mock_mongodb,
    mock_exception_handler,
    mock_backtester,
    mock_risk_controller,
    mock_sentiment_analyzer,
    mock_client_session,
):
    """Test strategy execution with market data integration"""
    mock_session = AsyncMock()
    mock_session.add = AsyncMock()
    mock_session.commit = AsyncMock()

    # Mock news content
    mock_responses = {
        "https://www.coindesk.com/markets": """
            <html><body>
                <article class="article-card">
                    <div class="article-card-title">Bitcoin Shows Strong Momentum</div>
                    <div class="article-content">Positive market indicators suggest upward trend.</div>
                    <time datetime="2025-01-22T00:00:00Z">Jan 22, 2025</time>
                    <a href="/test1">Read more</a>
                </article>
            </body></html>
        """
    }

    # Mock social media data
    test_posts = [
        SocialMediaPost(
            platform="twitter",
            author="crypto_analyst",
            content="Strong buy signals for BTC! #Bitcoin",
            posted_at=datetime.utcnow(),
        )
    ]

    # Mock historical data
    historical_data = [
        {
            "timestamp": datetime.utcnow() - timedelta(hours=i),
            "open": 100.0 + i,
            "high": 105.0 + i,
            "low": 95.0 + i,
            "close": 102.0 + i,
            "volume": 1000.0 + i * 100,
        }
        for i in range(24)  # 24 hours of data
    ]

    # Test strategy configuration
    strategy = {
        "type": "momentum",
        "parameters": {
            "timeframe": "1h",
            "rsi_period": 14,
            "rsi_overbought": 70,
            "rsi_oversold": 30,
            "volume_threshold": 1.5,
            "sentiment_threshold": 0.6,
        },
    }

    # Configure mock responses
    async def mock_get(*args, **kwargs):
        url = args[0] if args else kwargs.get("url", "")
        response = await mock_get_response(url, mock_responses)
        return response._context_manager

    mock_session.get = AsyncMock(side_effect=mock_get)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock()

    orchestrator = MarketDataOrchestrator(mock_session)
    try:
        await orchestrator.start()

        # 1. Collect and analyze market data
        articles = await orchestrator.news_collector.fetch_all_sources()
        assert len(articles) > 0, "Should collect news articles"

        posts = await orchestrator.social_media_analyzer.get_recent_posts()
        assert len(posts) > 0, "Should collect social media posts"

        # 2. Get market sentiment
        sentiment = await orchestrator.get_market_sentiment()
        assert sentiment is not None, "Should calculate market sentiment"
        assert isinstance(sentiment, dict), "Sentiment should be a dictionary"
        assert "sentiment_score" in sentiment, "Should include sentiment score"

        # 3. Configure backtester with collected data
        await orchestrator.backtester.load_data(historical_data)

        # 4. Run backtest with sentiment-aware strategy
        strategy["parameters"]["market_sentiment"] = sentiment["sentiment_score"]
        result = await orchestrator.backtester.run_backtest(strategy)

        # Verify backtest results
        assert result is not None, "Backtest result should not be None"
        assert "trades" in result, "Should contain trades"
        assert "metrics" in result, "Should contain metrics"
        assert "equity_curve" in result, "Should contain equity curve"

        # Verify metrics details
        metrics = result["metrics"]
        assert "total_return" in metrics, "Should include total return"
        assert "sharpe_ratio" in metrics, "Should include Sharpe ratio"
        assert "max_drawdown" in metrics, "Should include max drawdown"

        # 5. Verify risk management
        risk_metrics = await orchestrator.risk_controller.get_risk_metrics()
        assert risk_metrics is not None, "Risk metrics should not be None"
        assert "current_risk_level" in risk_metrics, "Should include risk level"
        assert "total_position_value" in risk_metrics, "Should include position value"

        # 6. Test live market integration
        market_data = {
            "price": 100.0,
            "volume": 1000.0,
            "timestamp": datetime.utcnow(),
            "sentiment_score": sentiment["sentiment_score"],
        }

        # Check trade risk with sentiment consideration
        risk_check = await orchestrator.risk_controller.check_risk(
            {
                "amount": 1.0,
                "price": market_data["price"],
                "side": "buy",
                "symbol": "BTC-USD",
                "sentiment": market_data["sentiment_score"],
            }
        )

        assert isinstance(risk_check, dict), "Risk check should return a dictionary"
        assert "allowed" in risk_check, "Should include allowed flag"
        assert "risk_level" in risk_check, "Should include risk level"
        assert "warnings" in risk_check, "Should include any warnings"

    finally:
        await orchestrator.stop()
