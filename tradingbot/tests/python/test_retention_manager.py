"""
Test data retention management
"""

import pytest
from datetime import datetime, timedelta
from tradingbot.shared.retention_manager import RetentionManager


@pytest.fixture
async def manager():
    """Create retention manager instance"""
    mgr = RetentionManager()
    await mgr.initialize()
    yield mgr
    await mgr.close()


@pytest.mark.asyncio
async def test_cleanup_old_data(manager):
    """Test cleaning up old data"""
    # Insert test data
    old_date = datetime.utcnow() - timedelta(days=8)
    new_date = datetime.utcnow()

    # Old news article
    await manager.news_storage.collection.insert_one(
        {"title": "Old News", "content": "Test content", "created_at": old_date}
    )

    # New news article
    await manager.news_storage.collection.insert_one(
        {"title": "New News", "content": "Test content", "created_at": new_date}
    )

    # Old social post
    await manager.social_storage.collection.insert_one(
        {"content": "Old post", "platform": "test", "created_at": old_date}
    )

    # New social post
    await manager.social_storage.collection.insert_one(
        {"content": "New post", "platform": "test", "created_at": new_date}
    )

    # Run cleanup
    result = await manager.cleanup_old_data()

    # Verify results
    assert result["news_count"] == 1  # One old article deleted
    assert result["social_count"] == 1  # One old post deleted

    # Verify remaining data
    news_count = await manager.news_storage.collection.count_documents({})
    social_count = await manager.social_storage.collection.count_documents({})

    assert news_count == 1  # Only new article remains
    assert social_count == 1  # Only new post remains


@pytest.mark.asyncio
async def test_storage_stats(manager):
    """Test getting storage statistics"""
    # Insert test data
    now = datetime.utcnow()

    await manager.news_storage.collection.insert_many(
        [
            {
                "title": f"News {i}",
                "content": "Test content",
                "created_at": now - timedelta(days=i),
            }
            for i in range(3)
        ]
    )

    await manager.social_storage.collection.insert_many(
        [
            {
                "content": f"Post {i}",
                "platform": "test",
                "created_at": now - timedelta(days=i),
            }
            for i in range(2)
        ]
    )

    # Get stats
    stats = await manager.get_storage_stats()

    # Verify stats
    assert stats["total_news"] == 3
    assert stats["total_social"] == 2
    assert isinstance(stats["oldest_news"], datetime)
    assert isinstance(stats["oldest_social"], datetime)

    # Verify oldest timestamps
    assert (now - stats["oldest_news"]).days == 2
    assert (now - stats["oldest_social"]).days == 1


@pytest.mark.asyncio
async def test_initialization_state(manager):
    """Test initialization state handling"""
    # Already initialized in fixture
    assert manager.initialized

    # Close and verify
    await manager.close()
    assert not manager.initialized

    # Operations should fail when not initialized
    with pytest.raises(RuntimeError):
        await manager.cleanup_old_data()

    with pytest.raises(RuntimeError):
        await manager.get_storage_stats()

    # Reinitialize and verify
    await manager.initialize()
    assert manager.initialized

    # Operations should work again
    stats = await manager.get_storage_stats()
    assert isinstance(stats, dict)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
