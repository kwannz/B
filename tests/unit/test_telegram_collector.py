"""
Test Telegram collector
"""

import os
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch
from telegram import Bot, Message, User, Chat

from tradingbot.shared.social_media_analyzer.telegram_collector import TelegramCollector
from tradingbot.shared.models.mongodb import RawSocialMediaPost


@pytest.fixture
async def telegram_collector():
    """Create Telegram collector instance"""
    collector = TelegramCollector()
    # Mock storage
    collector.storage = AsyncMock()
    collector.storage.db_manager.initialize = AsyncMock()
    collector.storage.db_manager.close = AsyncMock()
    yield collector
    await collector.close()


@pytest.fixture
def mock_message():
    """Create mock Telegram message"""
    message = AsyncMock(spec=Message)
    message.message_id = 123456
    message.text = "Test message content"
    message.date = datetime.now()
    message.from_user = Mock(spec=User)
    message.from_user.username = "test_user"
    message.views = 100
    message.forward_count = 5
    message.media_group_id = None
    message.forward_from = None
    return message


@pytest.mark.asyncio
async def test_initialization(telegram_collector):
    """Test collector initialization"""
    with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "test_token"}):
        await telegram_collector.initialize()
        assert telegram_collector.bot is not None
        telegram_collector.storage.db_manager.initialize.assert_called_once()


@pytest.mark.asyncio
async def test_collect_channel_messages(telegram_collector, mock_message):
    """Test channel message collection"""
    # Mock bot
    mock_bot = AsyncMock(spec=Bot)
    mock_bot.get_chat_history.return_value.__aiter__.return_value = [mock_message]
    telegram_collector.bot = mock_bot

    # Test collection
    posts = await telegram_collector.collect_channel_messages("test_channel", limit=1)

    assert len(posts) == 1
    post = posts[0]
    assert isinstance(post, RawSocialMediaPost)
    assert post.platform == "telegram"
    assert post.post_id == "123456"
    assert post.content == "Test message content"
    assert post.author == "test_user"
    assert post.url == "https://t.me/test_channel/123456"
    assert post.engagement["views"] == 100
    assert post.engagement["forwards"] == 5
    assert post.metadata["channel"] == "test_channel"


@pytest.mark.asyncio
async def test_store_posts(telegram_collector):
    """Test post storage"""
    posts = [
        RawSocialMediaPost(
            platform="telegram",
            post_id="123",
            content="Test content",
            author="test_user",
        )
    ]

    await telegram_collector.store_posts(posts)
    telegram_collector.storage.store_posts.assert_called_once_with(posts)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
