"""
Test sentiment analysis integration
"""

import os
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from tradingbot.shared.models.mongodb import RawNewsArticle
from tradingbot.shared.models.sentiment import SentimentAnalysis
from tradingbot.shared.news_collector.collector import NewsCollector


@pytest.fixture
async def collector(event_loop):
    """Create collector instance"""
    # Set test database URL
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/test_db"

    collector = NewsCollector()
    await collector.initialize()
    try:
        yield collector
    finally:
        if hasattr(collector, "session") and collector.session:
            await collector.close()


@pytest.fixture
def sample_article():
    """Create sample article"""
    return RawNewsArticle(
        source="test_source",
        title="Test Article",
        url="http://test.com/article",
        content="This is a very positive article about cryptocurrency.",
        author="Test Author",
        published_at=datetime.utcnow(),
        analysis_metadata={"language": "en"},
    )


@pytest.mark.asyncio
async def test_sentiment_analysis_integration(
    collector: NewsCollector, sample_article: RawNewsArticle
):
    """Test sentiment analysis integration"""
    # Mock sentiment analyzer
    mock_sentiment = {
        "language": "en",
        "score": 0.8,
        "sentiment": "positive",
        "raw_score": {"label": "positive", "score": 0.8},
    }

    async for news_collector in collector:
        with patch(
            "tradingbot.shared.sentiment.sentiment_analyzer.analyze_text",
            AsyncMock(return_value=mock_sentiment),
        ):
            # Process article
            await news_collector.process_source(
                url="http://test.com", name="test", parser=lambda x: [sample_article]
            )

        # Verify sentiment stored in article metadata
        assert "sentiment" in sample_article.metadata
        assert sample_article.metadata["sentiment"]["score"] == 0.8
        assert sample_article.metadata["sentiment"]["sentiment"] == "positive"

        # Verify sentiment analysis record created
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session

        engine = create_engine(os.getenv("DATABASE_URL"))
        with Session(engine) as session:
            sentiment_record = (
                session.query(SentimentAnalysis)
                .filter_by(source_id=sample_article.url)
                .first()
            )

            assert sentiment_record is not None
            assert sentiment_record.score == 0.8
            assert sentiment_record.sentiment == "positive"
            assert sentiment_record.language == "en"


@pytest.mark.asyncio
async def test_chinese_sentiment_analysis(collector: NewsCollector):
    """Test Chinese sentiment analysis"""
    article = RawNewsArticle(
        source="binance_cn",
        title="测试文章",
        url="http://test.com/cn/article",
        content="比特币价格突破历史新高，市场信心增强。",
        author="测试作者",
        published_at=datetime.utcnow(),
        analysis_metadata={"language": "zh"},
    )

    # Mock DeepSeek response
    mock_sentiment = {
        "language": "zh",
        "score": 0.9,
        "sentiment": "positive",
        "raw_score": {"sentiment": "positive", "score": 0.9},
    }

    async for news_collector in collector:
        with patch(
            "tradingbot.shared.sentiment.sentiment_analyzer.analyze_text",
            AsyncMock(return_value=mock_sentiment),
        ):
            await news_collector.process_source(
                url="http://test.com/cn", name="binance_cn", parser=lambda x: [article]
            )

        # Verify sentiment stored
        assert "sentiment" in article.metadata
        assert article.metadata["sentiment"]["score"] == 0.9
        assert article.metadata["sentiment"]["language"] == "zh"

        # Verify database record
        engine = create_engine(os.getenv("DATABASE_URL"))
        with Session(engine) as session:
            sentiment_record = (
                session.query(SentimentAnalysis)
                .filter_by(source_id=article.url)
                .first()
            )

            assert sentiment_record is not None
            assert sentiment_record.score == 0.9
            assert sentiment_record.language == "zh"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
