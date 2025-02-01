"""
Test Reddit collector
"""

import os
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import praw
import pytest

from tradingbot.shared.models.mongodb import RawSocialMediaPost
from tradingbot.shared.social_media_analyzer.reddit_collector import RedditCollector


@pytest.fixture
async def reddit_collector():
    """Create Reddit collector instance"""
    collector = RedditCollector()
    # Mock storage
    collector.storage = AsyncMock()
    collector.storage.db_manager.initialize = AsyncMock()
    collector.storage.db_manager.close = AsyncMock()
    yield collector
    await collector.close()


@pytest.fixture
def mock_submission():
    """Create mock Reddit submission"""
    submission = Mock()
    submission.id = "123456"
    submission.title = "Test Post"
    submission.selftext = "Test content"
    submission.author = "test_user"
    submission.permalink = "/r/test/comments/123456/test_post"
    submission.created_utc = datetime.now().timestamp()
    submission.score = 100
    submission.num_comments = 10
    submission.upvote_ratio = 0.95
    submission.is_self = True
    submission.link_flair_text = "Discussion"
    return submission


@pytest.mark.asyncio
async def test_initialization(reddit_collector):
    """Test collector initialization"""
    with patch.dict(
        os.environ,
        {"REDDIT_CLIENT_ID": "test_id", "REDDIT_CLIENT_SECRET": "test_secret"},
    ):
        await reddit_collector.initialize()
        assert reddit_collector.reddit is not None
        reddit_collector.storage.db_manager.initialize.assert_called_once()


@pytest.mark.asyncio
async def test_collect_subreddit_posts(reddit_collector, mock_submission):
    """Test subreddit post collection"""
    # Mock Reddit client
    mock_reddit = Mock(spec=praw.Reddit)
    mock_subreddit = Mock()
    mock_subreddit.hot.return_value = [mock_submission]
    mock_reddit.subreddit.return_value = mock_subreddit
    reddit_collector.reddit = mock_reddit

    # Test collection
    posts = await reddit_collector.collect_subreddit_posts("test", limit=1)

    assert len(posts) == 1
    post = posts[0]
    assert isinstance(post, RawSocialMediaPost)
    assert post.platform == "reddit"
    assert post.post_id == "123456"
    assert post.content == "Test content"
    assert post.author == "test_user"
    assert post.url == "https://reddit.com/r/test/comments/123456/test_post"
    assert post.engagement["upvotes"] == 100
    assert post.engagement["comments"] == 10
    assert post.metadata["subreddit"] == "test"


@pytest.mark.asyncio
async def test_store_posts(reddit_collector):
    """Test post storage"""
    posts = [
        RawSocialMediaPost(
            platform="reddit", post_id="123", content="Test content", author="test_user"
        )
    ]

    await reddit_collector.store_posts(posts)
    reddit_collector.storage.store_posts.assert_called_once_with(posts)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
