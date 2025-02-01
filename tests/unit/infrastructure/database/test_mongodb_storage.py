"""
Test MongoDB storage functionality
"""

import os
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch
from typing import Dict, Any, List

from tradingbot.shared.models.mongodb import MongoDBStorage, MongoDBManager


@pytest.fixture
async def mongodb_storage():
    """Create MongoDB storage instance"""
    storage = MongoDBStorage("test_collection")
    await storage.db_manager.initialize()
    yield storage
    await storage.db_manager.close()


@pytest.fixture
def sample_document():
    """Create sample document"""
    return {
        "title": "Test Document",
        "content": "Test content",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "metadata": {"source": "test"},
    }


@pytest.mark.asyncio
async def test_collection_prefix():
    """Test collection prefix handling"""
    # Set environment variable
    os.environ["MONGODB_COLLECTION_PREFIX"] = "test_"
    storage = MongoDBStorage("collection")
    assert storage.collection_name == "test_collection"

    # Reset environment
    os.environ.pop("MONGODB_COLLECTION_PREFIX", None)


@pytest.mark.asyncio
async def test_document_validation(mongodb_storage, sample_document):
    """Test document validation"""
    # Valid document should pass
    mongodb_storage._validate_document(sample_document)

    # Invalid document (missing required field)
    invalid_doc = sample_document.copy()
    del invalid_doc["created_at"]
    with pytest.raises(ValueError, match="Missing required fields"):
        mongodb_storage._validate_document(invalid_doc)

    # Invalid timestamp type
    invalid_doc = sample_document.copy()
    invalid_doc["created_at"] = "2024-01-20"
    with pytest.raises(ValueError, match="must be a datetime object"):
        mongodb_storage._validate_document(invalid_doc)


@pytest.mark.asyncio
async def test_bulk_operations(mongodb_storage, sample_document):
    """Test bulk write operations"""
    # Mock bulk_write
    mock_result = Mock()
    mock_result.inserted_count = 2
    mock_result.modified_count = 1
    mock_result.deleted_count = 1
    mock_result.upserted_ids = ["id1"]

    mongodb_storage.collection.bulk_write = AsyncMock(return_value=mock_result)

    # Create bulk operations
    operations = [
        {"insertOne": {"document": sample_document}},
        {
            "updateOne": {
                "filter": {"_id": "test_id"},
                "update": {"$set": {"title": "Updated"}},
            }
        },
        {"deleteOne": {"filter": {"_id": "delete_id"}}},
    ]

    # Execute bulk write
    result = await mongodb_storage.bulk_write(operations)

    # Verify results
    assert result["inserted"] == 2
    assert result["modified"] == 1
    assert result["deleted"] == 1
    assert result["upserted"] == 1


@pytest.mark.asyncio
async def test_index_creation(mongodb_storage):
    """Test index creation"""
    # Define indexes
    indexes = [
        {"keys": [("created_at", -1)], "name": "created_at_index"},
        {"keys": [("title", "text")], "name": "title_text_index"},
    ]

    # Mock create_indexes
    mongodb_storage.collection.create_indexes = AsyncMock()

    # Create indexes
    await mongodb_storage.create_indexes(indexes)

    # Verify indexes were created
    assert mongodb_storage.indexes == indexes
    mongodb_storage.collection.create_indexes.assert_called_once_with(indexes)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
