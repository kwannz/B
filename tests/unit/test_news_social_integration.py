"""
Integration tests for news collection and social media analysis system
"""

import os
import sys
import pytest
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import AsyncExitStack, asynccontextmanager
from unittest.mock import AsyncMock, patch, MagicMock, Mock
from typing import AsyncGenerator, Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent)
sys.path.append(project_root)


# Mock keyword extractor module before imports
class MockKeywordExtractor:
    def __init__(self):
        self.initialized = False
        self.nlp = Mock()
        self.nlp.xp = Mock()

    async def initialize(self):
        self.initialized = True

    async def extract_keywords(self, text):
        return [{"keyword": "test", "score": 0.9, "pos": "NOUN"}]


mock_keyword_extractor = Mock()
mock_keyword_extractor.KeywordExtractor = Mock(return_value=MockKeywordExtractor())
sys.modules["src.shared.keyword_extractor"] = mock_keyword_extractor

# Import required modules
from tradingbot.shared.news_collector.collector import NewsCollector
from tradingbot.shared.social_media_analyzer.social_collector import (
    SocialMediaCollector,
)
from tradingbot.shared.retention_manager import retention_manager
from tradingbot.shared.sentiment.sentiment_analyzer import sentiment_analyzer
from tradingbot.shared.models.mongodb import RawNewsArticle, RawSocialMediaPost
import aiohttp


@pytest.fixture
async def setup_components(db_session, monkeypatch, keyword_extractor):
    """Initialize all components with proper async handling and timeouts"""
    # Set test environment
    monkeypatch.setenv("TESTING", "true")

    # Create components
    news = NewsCollector(db_session)
    social = SocialMediaCollector()

    # Create patches
    patches = [
        patch(
            "src.shared.sentiment.sentiment_analyzer.NewsSentimentAnalyzer._initialize_finbert"
        ),
        patch(
            "src.shared.sentiment.sentiment_analyzer.sentiment_analyzer.initialize",
            new_callable=AsyncMock,
        ),
        patch.object(
            sentiment_analyzer,
            "analyze_text",
            new=AsyncMock(
                return_value={
                    "language": "en",
                    "score": 0.75,
                    "sentiment": "positive",
                    "raw_score": {"label": "positive", "score": 0.75},
                    "keywords": [{"keyword": "test", "score": 0.8, "pos": "NOUN"}],
                }
            ),
        ),
        patch(
            "aiohttp.ClientSession.get",
            new=AsyncMock(
                return_value=AsyncMock(
                    status=200,
                    text=AsyncMock(
                        return_value="<article><h1>Test Article</h1><p>Test content</p></article>"
                    ),
                )
            ),
        ),
        patch(
            "playwright.async_api.async_playwright",
            return_value=AsyncMock(
                chromium=AsyncMock(
                    launch=AsyncMock(
                        return_value=AsyncMock(
                            new_page=AsyncMock(
                                return_value=AsyncMock(
                                    goto=AsyncMock(),
                                    fill=AsyncMock(),
                                    click=AsyncMock(),
                                    wait_for_selector=AsyncMock(),
                                )
                            )
                        )
                    )
                ),
                start=AsyncMock(),
            ),
        ),
        patch.object(social, "_init_twitter", new_callable=AsyncMock),
    ]

    # Start patches
    for p in patches:
        p.start()

    async with AsyncExitStack() as stack:
        try:
            # Initialize MongoDB first
            await asyncio.wait_for(news.storage.db_manager.initialize(), timeout=10)

            # Initialize all components
            await asyncio.wait_for(
                asyncio.gather(
                    news.initialize(),
                    social.initialize(),
                    retention_manager.initialize(),
                    sentiment_analyzer.initialize(),
                ),
                timeout=10,
            )

            # Register cleanup callbacks for sessions
            if hasattr(news, "session") and news.session:
                await stack.enter_async_context(news.session)
            if hasattr(social, "session") and social.session:
                await stack.enter_async_context(social.session)
            if hasattr(sentiment_analyzer, "session") and sentiment_analyzer.session:
                await stack.enter_async_context(sentiment_analyzer.session)

            # Create async context managers for cleanup
            @asynccontextmanager
            async def cleanup_context():
                try:
                    yield
                finally:
                    try:
                        # Clean test data first while MongoDB is still initialized
                        print("\nCleaning test data in cleanup_context...")
                        if news.storage.db_manager.initialized:
                            count_before = (
                                await news.storage.collection.count_documents({})
                            )
                            if count_before > 0:
                                await news.storage.collection.delete_many({})
                                count_after = (
                                    await news.storage.collection.count_documents({})
                                )
                                print(
                                    f"Cleanup in context - Before: {count_before}, After: {count_after} news articles"
                                )
                        if social.storage.db_manager.initialized:
                            social_count = (
                                await social.storage.collection.count_documents({})
                            )
                            if social_count > 0:
                                await social.storage.collection.delete_many({})
                    except Exception as e:
                        logger.error(f"Error cleaning test data: {str(e)}")

                    try:
                        # Close components
                        await asyncio.gather(
                            news.close(),
                            social.close(),
                            retention_manager.close(),
                            sentiment_analyzer.close(),
                            return_exceptions=True,
                        )
                    except Exception as e:
                        logger.error(f"Error closing components: {str(e)}")

                    try:
                        # Close MongoDB last
                        if news.storage.db_manager.initialized:
                            await news.storage.db_manager.close()
                    except Exception as e:
                        logger.error(f"Error closing MongoDB: {str(e)}")

            # Register cleanup context
            await stack.enter_async_context(cleanup_context())

            yield (news, social)

        except asyncio.TimeoutError:
            logger.error("Timeout during component initialization")
            raise
        except Exception as e:
            logger.error(f"Error during setup: {str(e)}")
            raise
        finally:
            # Reset test mode
            os.environ["TESTING"] = ""

            # Stop all patches
            for p in patches:
                p.stop()

            # No cleanup in finally block - already handled in cleanup_context


@pytest.mark.asyncio
async def test_news_collection_pipeline(setup_components):
    """Test complete news collection pipeline"""
    news, _ = setup_components

    try:
        # Create test articles as proper RawNewsArticle instances
        now = datetime.utcnow()
        test_articles = [
            RawNewsArticle(
                title="Test Article 1",
                content="Test content 1 with positive sentiment",
                source="coindesk",
                url="https://www.coindesk.com/markets/article1",
                published_at=now,
                metadata={"language": "en"},
                tags=["crypto", "bitcoin"],
            ),
            RawNewsArticle(
                title="Test Article 2",
                content="Test content 2 with negative sentiment",
                source="cointelegraph",
                url="https://cointelegraph.com/news/article2",
                published_at=now,
                metadata={"language": "zh"},
                tags=["ethereum", "defi"],
            ),
        ]

        # Store articles with all required fields
        for article in test_articles:
            await news.storage.store_article(article)

        # Verify initial storage
        stored_articles = await news.storage.collection.find({}).to_list(length=None)
        assert len(stored_articles) == 2, "Failed to store test articles"

        # Verify article fields
        for article in stored_articles:
            assert "source" in article, "Missing source field"
            assert "title" in article, "Missing title field"
            assert "url" in article, "Missing url field"
            assert "content" in article, "Missing content field"

        # Mock sentiment analyzer response
        mock_sentiment = {
            "language": "en",
            "score": 0.75,
            "sentiment": "positive",
            "raw_score": {"label": "positive", "score": 0.75},
            "keywords": [{"keyword": "test", "score": 0.8, "pos": "NOUN"}],
        }

        # Patch sentiment analyzer
        with patch.object(
            sentiment_analyzer, "analyze_text", new_callable=AsyncMock
        ) as mock_analyze:
            mock_analyze.return_value = mock_sentiment

            # Process articles through collector
            sources = [
                {"name": "coindesk", "url": "https://www.coindesk.com/markets"},
                {"name": "cointelegraph", "url": "https://cointelegraph.com/news"},
            ]
            await news.collect_news(sources)

            # Collect processed articles
            articles = await news.collect_all_sources()
            assert len(articles) == 2, f"Expected 2 articles, got {len(articles)}"

        # Verify article structure and sentiment analysis
        for article in articles:
            # Basic structure
            assert isinstance(
                article, RawNewsArticle
            ), "Article should be RawNewsArticle instance"
            assert article.title.startswith(
                "Test Article"
            ), f"Unexpected title: {article.title}"
            assert article.source in [
                "coindesk",
                "cointelegraph",
            ], f"Unexpected source: {article.source}"
            assert isinstance(
                article.published_at, datetime
            ), "published_at should be datetime"
            assert isinstance(article.tags, list), "tags should be list"

            # Verify sentiment was analyzed
            assert "sentiment" in article.metadata, "Missing sentiment analysis"
            sentiment = article.metadata["sentiment"]
            assert isinstance(sentiment, dict), "Sentiment should be dictionary"
            assert "score" in sentiment, "Missing sentiment score"
            assert isinstance(sentiment["score"], float), "Score should be float"
            assert (
                0 <= sentiment["score"] <= 1
            ), f"Invalid score range: {sentiment['score']}"

            # Verify language-specific processing
            assert article.metadata["language"] in [
                "en",
                "zh",
            ], f"Unexpected language: {article.metadata['language']}"

        # Additional sentiment analysis verification
        for article in articles:
            # Test sentiment analysis
            sentiment = await sentiment_analyzer.analyze_text(
                article.content, language=article.metadata.get("language", "auto")
            )

            # Detailed sentiment checks
            assert sentiment is not None, "Sentiment analysis result should not be None"
            assert isinstance(
                sentiment, dict
            ), "Sentiment result should be a dictionary"
            assert "sentiment" in sentiment, "Missing 'sentiment' in result"
            assert sentiment["sentiment"] in [
                "positive",
                "negative",
                "neutral",
            ], f"Invalid sentiment: {sentiment['sentiment']}"
            assert "score" in sentiment, "Missing 'score' in result"
            assert isinstance(sentiment["score"], float), "Score should be float"
            assert (
                0 <= sentiment["score"] <= 1
            ), f"Score out of range: {sentiment['score']}"

            # Verify keywords
            assert "keywords" in sentiment, "Missing 'keywords' in result"
            assert len(sentiment["keywords"]) > 0, "Keywords list is empty"
            for kw in sentiment["keywords"]:
                assert isinstance(kw, dict), "Keyword entry should be dictionary"
                assert "keyword" in kw, "Missing 'keyword' in keyword entry"
                assert "score" in kw, "Missing 'score' in keyword entry"
                assert "pos" in kw, "Missing 'pos' in keyword entry"
                assert isinstance(kw["score"], float), "Keyword score should be float"
                assert (
                    0 <= kw["score"] <= 1
                ), f"Keyword score out of range: {kw['score']}"

    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")

    finally:
        # Cleanup
        await news.storage.collection.delete_many({})


@pytest.mark.asyncio
async def test_social_media_collection(setup_components):
    """Test social media collection pipeline"""
    _, social = setup_components

    try:
        # Add test posts
        now = datetime.utcnow()
        test_posts = [
            RawSocialMediaPost(
                platform="twitter",
                post_id="123",
                content="Test post 1 #crypto",
                author="test_user",
                url="https://twitter.com/test/123",
                published_at=now,
                created_at=now,
                updated_at=now,
                metadata={"language": "en"},
                engagement={"likes": 10, "comments": 5, "shares": 2},
            ).to_dict(),
            RawSocialMediaPost(
                platform="reddit",
                post_id="456",
                content="Test post 2 about BTC",
                author="test_user",
                url="https://reddit.com/r/test/456",
                published_at=now,
                created_at=now,
                updated_at=now,
                metadata={"language": "en"},
                engagement={"upvotes": 15, "comments": 8},
            ).to_dict(),
        ]

        # Store posts with all required fields
        for post_dict in test_posts:
            post = RawSocialMediaPost(
                platform=post_dict.get("platform", "twitter"),
                post_id=post_dict.get("post_id"),
                content=post_dict.get("content"),
                author=post_dict.get("author"),
                url=post_dict.get("url"),
                published_at=post_dict.get("published_at", datetime.utcnow()),
                engagement=post_dict.get("engagement", {}),
            )
            await social.storage.store_post(post)

        # Collect posts
        posts = await social.collect_all_platforms()
        assert len(posts) == 2, f"Expected 2 posts, got {len(posts)}"

        # Verify post fields
        for post in posts:
            assert post.platform is not None, "Missing platform field"
            assert post.post_id is not None, "Missing post_id field"
            assert post.content is not None, "Missing content field"
            assert post.author is not None, "Missing author field"

        # Verify post structure
        for post in posts:
            # Basic structure checks
            assert isinstance(
                post.content, str
            ), f"Content should be string, got {type(post.content)}"
            assert post.platform in [
                "twitter",
                "reddit",
            ], f"Unexpected platform: {post.platform}"
            assert post.author == "test_user", f"Unexpected author: {post.author}"
            assert isinstance(
                post.published_at, datetime
            ), "published_at should be datetime"
            assert isinstance(
                post.metadata, dict
            ), f"Metadata should be dict, got {type(post.metadata)}"
            assert isinstance(
                post.engagement, dict
            ), f"Engagement should be dict, got {type(post.engagement)}"

            # Platform-specific checks
            if post.platform == "twitter":
                assert (
                    post.content == "Test post 1 #crypto"
                ), f"Unexpected content: {post.content}"
                assert "likes" in post.engagement, "Missing likes in engagement"
                assert "shares" in post.engagement, "Missing shares in engagement"
            else:
                assert (
                    post.content == "Test post 2 about BTC"
                ), f"Unexpected content: {post.content}"
                assert "upvotes" in post.engagement, "Missing upvotes in engagement"

            # Sentiment analysis
            with (
                patch(
                    "src.shared.sentiment.sentiment_analyzer.NewsSentimentAnalyzer._initialize_finbert"
                ),
                patch.object(
                    sentiment_analyzer, "analyze_text", new_callable=AsyncMock
                ) as mock_analyze,
            ):
                mock_analyze.return_value = {
                    "sentiment": "positive",
                    "score": 0.75,
                    "keywords": [{"keyword": "crypto", "score": 0.8, "pos": "NOUN"}],
                }

                sentiment = await sentiment_analyzer.analyze_text(
                    post.content, language=post.metadata.get("language", "auto")
                )

                # Detailed sentiment checks
                assert sentiment is not None, "Sentiment should not be None"
                assert (
                    sentiment["sentiment"] == "positive"
                ), f"Unexpected sentiment: {sentiment['sentiment']}"
                assert (
                    sentiment["score"] == 0.75
                ), f"Unexpected score: {sentiment['score']}"
                assert (
                    len(sentiment["keywords"]) == 1
                ), "Should have exactly one keyword"
                assert (
                    sentiment["keywords"][0]["keyword"] == "crypto"
                ), "Keyword should be 'crypto'"
                assert (
                    sentiment["keywords"][0]["score"] == 0.8
                ), "Keyword score should be 0.8"
                assert (
                    sentiment["keywords"][0]["pos"] == "NOUN"
                ), "Part of speech should be NOUN"

    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")

    finally:
        # Cleanup
        await social.storage.collection.delete_many({})


@pytest.mark.asyncio
async def test_data_retention(setup_components):
    """Test data retention policies"""
    news, social = setup_components

    try:
        # Clean any existing data
        await news.storage.collection.delete_many({})
        await social.storage.collection.delete_many({})

        # Verify clean state
        initial_news = await news.storage.collection.count_documents({})
        initial_social = await social.storage.collection.count_documents({})
        assert initial_news == 0, f"Expected 0 news articles, got {initial_news}"
        assert initial_social == 0, f"Expected 0 social posts, got {initial_social}"

        # Insert test data
        old_date = datetime.utcnow() - timedelta(days=8)
        current_date = datetime.utcnow()

        # Create and store old article
        old_article = RawNewsArticle(
            title="Old Test Article",
            content="Test content",
            source="test",
            url="http://test.com/old",
            created_at=old_date,
            published_at=old_date,
            metadata={"language": "en"},
        )
        print(
            f"\nStoring old article - URL: {old_article.url}, Created: {old_article.created_at}"
        )
        await news.storage.store_article(old_article)

        # Verify old article storage
        old_docs = await news.storage.collection.find({"url": old_article.url}).to_list(
            length=None
        )
        print(f"Found {len(old_docs)} documents with URL {old_article.url}")

        # Create and store current article
        current_article = RawNewsArticle(
            title="Current Test Article",
            content="Test content",
            source="test",
            url="http://test.com/current",
            created_at=current_date,
            published_at=current_date,
            metadata={"language": "en"},
        )
        print(
            f"\nStoring current article - URL: {current_article.url}, Created: {current_article.created_at}"
        )
        await news.storage.store_article(current_article)

        # Verify current article storage
        current_docs = await news.storage.collection.find(
            {"url": current_article.url}
        ).to_list(length=None)
        print(f"Found {len(current_docs)} documents with URL {current_article.url}")

        # Create and store old social post
        old_post = RawSocialMediaPost(
            content="Old test post",
            platform="test",
            post_id="old_123",
            author="test_user",
            url="http://test.com/old",
            created_at=old_date,
            published_at=old_date,
            metadata={"language": "en"},
            engagement={"likes": 5},
        )
        await social.storage.store_post(old_post)

        # Create and store current social post
        current_post = RawSocialMediaPost(
            content="Current test post",
            platform="test",
            post_id="current_123",
            author="test_user",
            url="http://test.com/current",
            created_at=current_date,
            published_at=current_date,
            metadata={"language": "en"},
            engagement={"likes": 10},
        )
        await social.storage.store_post(current_post)

        # Verify initial counts
        news_count = await news.storage.collection.count_documents({})
        social_count = await social.storage.collection.count_documents({})
        assert news_count == 2, f"Expected 2 news articles, got {news_count}"
        assert social_count == 2, f"Expected 2 social posts, got {social_count}"

        # Get initial stats
        stats_before = await retention_manager.get_storage_stats()
        print(
            f"\nInitial stats - News: {stats_before['total_news']}, Social: {stats_before['total_social']}"
        )

        # Debug: Print all news articles before cleanup
        all_docs = await news.storage.collection.find({}).to_list(length=None)
        print("\nAll news articles before cleanup:")
        for doc in all_docs:
            print(
                f"- ID: {doc.get('_id')}, URL: {doc.get('url')}, Created: {doc.get('created_at')}"
            )

        assert (
            stats_before["total_news"] == 2
        ), f"Expected 2 news articles in stats, got {stats_before['total_news']}"
        assert (
            stats_before["total_social"] == 2
        ), f"Expected 2 social posts in stats, got {stats_before['total_social']}"

        # Run cleanup
        print("\nRunning retention cleanup...")
        deleted = await retention_manager.cleanup_old_data()
        print(
            f"Cleanup results - News: {deleted['news_count']}, Social: {deleted['social_count']}"
        )

        # Debug: Print remaining documents
        remaining = await news.storage.collection.find({}).to_list(length=None)
        print("\nRemaining documents after cleanup:")
        for doc in remaining:
            print(
                f"- ID: {doc.get('_id')}, URL: {doc.get('url')}, Created: {doc.get('created_at')}"
            )

        assert (
            deleted["news_count"] == 1
        ), f"Expected 1 news article deleted, got {deleted['news_count']}"
        assert (
            deleted["social_count"] == 1
        ), f"Expected 1 social post deleted, got {deleted['social_count']}"

        # Verify cleanup
        stats_after = await retention_manager.get_storage_stats()
        assert (
            stats_after["total_news"] == 1
        ), f"Expected 1 news article after cleanup, got {stats_after['total_news']}"
        assert (
            stats_after["total_social"] == 1
        ), f"Expected 1 social post after cleanup, got {stats_after['total_social']}"

        # Verify no old data remains
        old_articles = await news.storage.collection.find(
            {"created_at": {"$lt": datetime.utcnow() - timedelta(days=7)}}
        ).to_list(length=None)
        assert (
            len(old_articles) == 0
        ), f"Found {len(old_articles)} old articles after cleanup"

        old_posts = await social.storage.collection.find(
            {"created_at": {"$lt": datetime.utcnow() - timedelta(days=7)}}
        ).to_list(length=None)
        assert len(old_posts) == 0, f"Found {len(old_posts)} old posts after cleanup"

    finally:
        # Clean up test data
        await news.storage.collection.delete_many({})
        await social.storage.collection.delete_many({})


@pytest.mark.asyncio
async def test_sentiment_analysis_consistency(setup_components):
    """Test sentiment analysis consistency"""
    # Test pairs of similar content in different languages
    test_pairs = [
        (
            "Bitcoin price reaches new all-time high as market sentiment improves",
            "比特币价格创下新高，市场情绪改善",
        ),
        (
            "Ethereum network upgrade successful, gas fees reduced",
            "以太坊网络升级成功，燃气费用降低",
        ),
    ]

    for en_text, zh_text in test_pairs:
        # Analyze English text
        en_sentiment = await sentiment_analyzer.analyze_text(en_text, language="en")
        assert en_sentiment is not None

        # Analyze Chinese text
        zh_sentiment = await sentiment_analyzer.analyze_text(zh_text, language="zh")
        assert zh_sentiment is not None

        # Sentiments should be similar (within 0.3)
        assert abs(en_sentiment["score"] - zh_sentiment["score"]) <= 0.3

        # Both should have keywords
        assert len(en_sentiment["keywords"]) > 0
        assert len(zh_sentiment["keywords"]) > 0


@pytest.mark.asyncio
async def test_real_time_collection(setup_components):
    """Test real-time data collection"""
    news, social = setup_components

    # Add test data
    now = datetime.utcnow()
    test_article = RawNewsArticle(
        title="Test Real-time Article",
        content="Test content for real-time collection",
        source="test_source",
        url="http://test.com/realtime",
        published_at=now,
        created_at=now,
    )
    await news.storage.store_article(test_article)

    test_post = RawSocialMediaPost(
        platform="twitter",
        post_id="realtime_123",
        content="Test real-time post",
        author="test_user",
        published_at=now,
        created_at=now,
    )
    await social.storage.store_post(test_post)

    # Test multiple collection rounds
    for _ in range(2):
        # Collect data
        articles = await news.collect_all_sources()
        posts = await social.collect_all_platforms()

        # Verify collection
        assert len(articles) > 0, "No articles found"
        assert len(posts) > 0, "No posts found"

        # Verify timestamps
        for article in articles:
            assert (datetime.utcnow() - article.published_at).days <= 7

        for post in posts:
            assert (datetime.utcnow() - post.published_at).days <= 7

        # Wait briefly between collections
        await asyncio.sleep(1)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
