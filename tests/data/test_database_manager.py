import pytest
import pytest_asyncio
from datetime import datetime
from src.shared.db.database_manager import DatabaseManager
from src.shared.models.mongodb import (
    RawNewsArticle,
    RawSocialMediaPost,
    MarketDataSnapshot,
)
from src.shared.models.sentiment import (
    SentimentAnalysis,
    AgentSentimentSignal,
    CombinedMarketSentiment,
)
from src.shared.db.exceptions import MongoDBError, PostgreSQLError, ValidationError


@pytest_asyncio.fixture
async def db_manager():
    manager = DatabaseManager(
        mongodb_url="mongodb://tradingbot_user:pass@localhost:27017/tradingbot_test?authSource=admin",
        postgres_url="postgresql+asyncpg://tradingbot_user:pass@localhost/tradingbot_test",
    )
    yield manager
    await manager.close()


@pytest.mark.asyncio
async def test_store_raw_news(db_manager):
    news = RawNewsArticle(
        source="Coindesk",
        title="Test Article",
        url="https://example.com",
        content="Test content",
        published_at=datetime.utcnow(),
    )
    doc_id = await db_manager.store_raw_news(news)
    assert doc_id is not None


@pytest.mark.asyncio
async def test_store_social_post(db_manager):
    post = RawSocialMediaPost(
        platform="Twitter",
        post_id="123",
        content="Test post",
        author="test_user",
        posted_at=datetime.utcnow(),
    )
    doc_id = await db_manager.store_social_post(post)
    assert doc_id is not None


@pytest.mark.asyncio
async def test_store_sentiment_analysis(db_manager):
    sentiment = {
        "source_id": "test_source",
        "score": 0.8,
        "sentiment": "positive",
        "language": "en",
        "raw_text": "Test text",
    }
    analysis = await db_manager.store_sentiment_analysis(sentiment)
    assert analysis.source_id == "test_source"
    assert analysis.score == 0.8


@pytest.mark.asyncio
async def test_store_invalid_sentiment(db_manager):
    invalid_sentiment = {
        "source_id": "test_source",
        "score": "invalid",
        "sentiment": "positive",
        "language": "en",
    }
    with pytest.raises(ValidationError):
        await db_manager.store_sentiment_analysis(invalid_sentiment)


@pytest.mark.asyncio
async def test_store_invalid_agent_sentiment(db_manager):
    invalid_sentiment = {
        "agent_id": "test_agent",
        "symbol": "BTC/USDT",
        "sentiment_score": "invalid",
        "confidence": 0.8,
        "signal_strength": 0.7,
        "meta_info": {},
    }
    with pytest.raises(ValidationError):
        await db_manager.store_agent_sentiment(invalid_sentiment)


@pytest.mark.asyncio
async def test_store_invalid_combined_sentiment(db_manager):
    invalid_sentiment = {
        "symbol": "BTC/USDT",
        "news_sentiment": "invalid",
        "social_sentiment": 0.8,
        "market_sentiment": 0.7,
        "combined_score": 0.75,
        "source_signals": {},
    }
    with pytest.raises(ValidationError):
        await db_manager.store_combined_sentiment(invalid_sentiment)


@pytest.mark.asyncio
async def test_get_latest_market_sentiment(db_manager):
    sentiment = {
        "symbol": "BTC/USDT",
        "news_sentiment": 0.7,
        "social_sentiment": 0.8,
        "market_sentiment": 0.6,
        "combined_score": 0.7,
        "source_signals": {"news": 5, "social": 10},
    }
    await db_manager.store_combined_sentiment(sentiment)
    latest = await db_manager.get_latest_market_sentiment("BTC/USDT")
    assert latest is not None
    assert latest.symbol == "BTC/USDT"
    assert latest.combined_score == 0.7


@pytest.mark.asyncio
async def test_get_raw_news(db_manager):
    news = RawNewsArticle(
        source="Coindesk",
        title="Test Article",
        url="https://example.com",
        content="Test content",
        published_at=datetime.utcnow(),
    )
    await db_manager.store_raw_news(news)
    news_list = await db_manager.get_raw_news_by_source("Coindesk")
    assert len(news_list) > 0
    assert news_list[0]["source"] == "Coindesk"


@pytest.mark.asyncio
async def test_get_social_posts(db_manager):
    post = RawSocialMediaPost(
        platform="Twitter",
        post_id="123",
        content="Test post",
        author="test_user",
        posted_at=datetime.utcnow(),
    )
    await db_manager.store_social_post(post)
    posts = await db_manager.get_social_posts_by_platform("Twitter")
    assert len(posts) > 0
    assert posts[0]["platform"] == "Twitter"
