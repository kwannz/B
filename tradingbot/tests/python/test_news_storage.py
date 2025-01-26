"""
Test news and social media storage
"""

import pytest
from datetime import datetime, timedelta
from tradingbot.shared.models.mongodb import RawNewsArticle, RawSocialMediaPost
from tradingbot.shared.models.news_storage import NewsStorage, SocialMediaStorage


@pytest.fixture
async def news_storage():
    """Create news storage instance"""
    storage = NewsStorage()
    await storage.db_manager.initialize()
    # Clear test collection
    await storage.collection.delete_many({})
    yield storage
    # Cleanup
    await storage.collection.delete_many({})
    await storage.db_manager.close()


@pytest.fixture
async def social_storage():
    """Create social media storage instance"""
    storage = SocialMediaStorage()
    await storage.db_manager.initialize()
    # Clear test collection
    await storage.collection.delete_many({})
    yield storage
    # Cleanup
    await storage.collection.delete_many({})
    await storage.db_manager.close()


@pytest.fixture
def sample_article():
    """Create sample news article"""
    return RawNewsArticle(
        source="test_source",
        title="Test Article",
        url="http://test.com/article",
        content="Test content for article",
        author="Test Author",
        published_at=datetime.utcnow(),
        tags=["crypto", "test"],
    )


@pytest.fixture
def sample_post():
    """Create sample social media post"""
    return RawSocialMediaPost(
        platform="twitter",
        post_id="123456",
        content="Test post content #crypto",
        author="test_user",
        url="http://twitter.com/test/123456",
        sentiment=0.8,
    )


@pytest.mark.asyncio
async def test_news_storage_operations(news_storage, sample_article):
    """Test news storage operations"""
    # Test storing single article
    article_id = await news_storage.store_article(sample_article)
    assert article_id is not None

    # Test storing multiple articles
    articles = [
        RawNewsArticle(
            source="test_source",
            title=f"Article {i}",
            url=f"http://test.com/article{i}",
            content=f"Content {i}",
            published_at=datetime.utcnow(),
        )
        for i in range(3)
    ]
    ids = await news_storage.store_articles(articles)
    assert len(ids) == 3

    # Test cleanup
    old_article = RawNewsArticle(
        source="old_source",
        title="Old Article",
        url="http://test.com/old",
        content="Old content",
        created_at=datetime.utcnow() - timedelta(days=8),
    )
    await news_storage.store_article(old_article)

    deleted = await news_storage.cleanup_old_articles(days=7)
    assert deleted == 1


@pytest.mark.asyncio
async def test_social_storage_operations(social_storage, sample_post):
    """Test social media storage operations"""
    # Test storing single post
    post_id = await social_storage.store_post(sample_post)
    assert post_id is not None

    # Test storing multiple posts
    posts = [
        RawSocialMediaPost(
            platform="twitter",
            post_id=str(i),
            content=f"Post {i}",
            author="test_user",
            sentiment=float(i) / 10,
        )
        for i in range(3)
    ]
    ids = await social_storage.store_posts(posts)
    assert len(ids) == 3

    # Test cleanup
    old_post = RawSocialMediaPost(
        platform="twitter",
        post_id="old_123",
        content="Old post",
        author="old_user",
        created_at=datetime.utcnow() - timedelta(days=8),
    )
    await social_storage.store_post(old_post)

    deleted = await social_storage.cleanup_old_posts(days=7)
    assert deleted == 1

    # Test sentiment stats
    stats = await social_storage.get_sentiment_stats()
    assert stats["count"] == 3  # excluding deleted old post
    assert "avg_sentiment" in stats
    assert "positive_count" in stats
    assert "negative_count" in stats


if __name__ == "__main__":
    pytest.main(["-v", __file__])
