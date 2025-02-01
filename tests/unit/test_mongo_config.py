"""
Test MongoDB configuration
"""

import os
import pytest
from datetime import datetime, timedelta
from tradingbot.config.mongo_config import MongoDBConnection, NEWS_DB_NAME, SOCIAL_DB_NAME


@pytest.fixture
async def mongo_conn():
    """Create MongoDB connection"""
    conn = MongoDBConnection()
    await conn.initialize()
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_mongodb_initialization():
    """Test MongoDB initialization"""
    conn = MongoDBConnection()
    await conn.initialize()
    assert conn.initialized
    assert conn._client is not None
    assert conn._news_db is not None
    assert conn._social_db is not None
    await conn.close()
    assert not conn.initialized


@pytest.mark.asyncio
async def test_database_names(mongo_conn):
    """Test database names"""
    assert mongo_conn.news_db.name == NEWS_DB_NAME
    assert mongo_conn.social_db.name == SOCIAL_DB_NAME


@pytest.mark.asyncio
async def test_cleanup_old_data(mongo_conn):
    """Test data cleanup"""
    # Insert test data
    old_date = datetime.utcnow() - timedelta(days=8)
    new_date = datetime.utcnow()

    # News articles
    await mongo_conn.news_db.raw_news.insert_many(
        [
            {"title": "Old News", "created_at": old_date},
            {"title": "New News", "created_at": new_date},
        ]
    )

    # Social posts
    await mongo_conn.social_db.raw_social.insert_many(
        [
            {"content": "Old Post", "created_at": old_date},
            {"content": "New Post", "created_at": new_date},
        ]
    )

    # Run cleanup
    await mongo_conn.cleanup_old_data(days=7)

    # Verify cleanup
    news_count = await mongo_conn.news_db.raw_news.count_documents({})
    social_count = await mongo_conn.social_db.raw_social.count_documents({})

    assert news_count == 1  # Only new article remains
    assert social_count == 1  # Only new post remains


if __name__ == "__main__":
    pytest.main(["-v", __file__])
