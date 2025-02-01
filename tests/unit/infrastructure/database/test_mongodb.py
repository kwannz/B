"""
MongoDB integration tests
"""

import os
from datetime import datetime
from typing import Any, Dict

import pytest

from tradingbot.shared.models.mongodb import (
    MongoConfig,
    MongoDBManager,
    MongoDBStorage,
    RawNewsArticle,
    RawSocialMediaPost,
)


@pytest.fixture
async def mongo_manager():
    """Create MongoDB manager instance"""
    manager = MongoDBManager()
    await manager.initialize()
    yield manager
    await manager.close()


@pytest.fixture
async def test_storage():
    """Create test storage instance"""
    storage = MongoDBStorage("test_collection")
    await storage.db_manager.initialize()
    # Clear test collection
    await storage.collection.delete_many({})
    yield storage
    # Cleanup
    await storage.collection.delete_many({})
    await storage.db_manager.close()


@pytest.mark.asyncio
async def test_mongodb_connection():
    """Test MongoDB connection"""
    manager = MongoDBManager()
    await manager.initialize()
    assert manager.initialized
    assert manager._client is not None
    assert manager._db is not None
    await manager.close()
    assert not manager.initialized


@pytest.mark.asyncio
async def test_raw_news_article():
    """Test RawNewsArticle model"""
    article = RawNewsArticle(
        source="test_source",
        title="Test Title",
        url="http://test.com",
        content="Test content",
        author="Test Author",
        published_at=datetime.utcnow(),
        tags=["test", "news"],
    )

    # Test default values
    assert isinstance(article.metadata, dict)
    assert isinstance(article.created_at, datetime)
    assert isinstance(article.updated_at, datetime)

    # Test to_dict conversion
    data = article.to_dict()
    assert data["source"] == "test_source"
    assert data["title"] == "Test Title"
    assert isinstance(data["tags"], list)
    assert isinstance(data["metadata"], dict)


@pytest.mark.asyncio
async def test_raw_social_media_post():
    """Test RawSocialMediaPost model"""
    post = RawSocialMediaPost(
        platform="twitter",
        post_id="123456",
        content="Test post",
        author="test_user",
        url="http://twitter.com/test",
    )

    # Test default values
    assert isinstance(post.engagement, dict)
    assert "likes" in post.engagement
    assert "comments" in post.engagement
    assert "shares" in post.engagement
    assert isinstance(post.metadata, dict)

    # Test to_dict conversion
    data = post.to_dict()
    assert data["platform"] == "twitter"
    assert data["post_id"] == "123456"
    assert isinstance(data["engagement"], dict)


@pytest.mark.asyncio
async def test_mongodb_storage(test_storage):
    """Test MongoDBStorage operations"""
    # Test insert_one
    doc = {"test_field": "test_value"}
    doc_id = await test_storage.insert_one(doc)
    assert doc_id is not None

    # Test find_one
    found_doc = await test_storage.find_one({"test_field": "test_value"})
    assert found_doc is not None
    assert found_doc["test_field"] == "test_value"

    # Test insert_many
    docs = [{"test_field": f"value_{i}", "index": i} for i in range(5)]
    ids = await test_storage.insert_many(docs)
    assert len(ids) == 5

    # Test find_many
    found_docs = await test_storage.find_many(
        {"test_field": {"$regex": "value_"}}, sort=[("index", 1)]
    )
    assert len(found_docs) == 5
    assert found_docs[0]["index"] == 0

    # Test update_one
    update_result = await test_storage.update_one(
        {"test_field": "value_0"}, {"$set": {"updated": True}}
    )
    assert update_result is True

    # Test delete_one
    delete_result = await test_storage.delete_one({"test_field": "value_0"})
    assert delete_result is True

    # Test delete_many
    delete_count = await test_storage.delete_many({"test_field": {"$regex": "value_"}})
    assert delete_count == 4
