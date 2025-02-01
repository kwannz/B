"""
Test social media collector
"""

import os
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from playwright.async_api import Browser, Page

from tradingbot.shared.models.mongodb import RawSocialMediaPost
from tradingbot.shared.social_media_analyzer.social_collector import (
    SocialMediaCollector,
)


@pytest.fixture
async def social_collector():
    """Create social collector instance"""
    collector = SocialMediaCollector()
    # Mock storage
    collector.storage = AsyncMock()
    collector.storage.db_manager.initialize = AsyncMock()
    collector.storage.db_manager.close = AsyncMock()
    yield collector
    await collector.close()


@pytest.fixture
def mock_tweet_html():
    """Sample tweet HTML"""
    return """
    <article data-testid="tweet" data-tweet-id="123456">
        <div data-testid="User-Name">Test User\n@testuser</div>
        <div data-testid="tweetText">Test tweet content #crypto</div>
    </article>
    """


@pytest.mark.asyncio
async def test_initialization(social_collector):
    """Test collector initialization"""
    with patch("playwright.async_api.async_playwright") as mock_playwright:
        # Mock browser
        mock_browser = AsyncMock(spec=Browser)
        mock_playwright.return_value.start = AsyncMock()
        mock_playwright.return_value.chromium.launch = AsyncMock(
            return_value=mock_browser
        )

        await social_collector.initialize()

        assert social_collector.browser is not None
        social_collector.storage.db_manager.initialize.assert_called_once()


@pytest.mark.asyncio
async def test_twitter_login(social_collector):
    """Test Twitter login"""
    with patch.dict(
        os.environ, {"TWITTER_USERNAME": "test_user", "TWITTER_PASSWORD": "test_pass"}
    ):
        # Mock page
        mock_page = AsyncMock(spec=Page)
        social_collector.browser = AsyncMock()
        social_collector.browser.new_page = AsyncMock(return_value=mock_page)

        await social_collector._init_twitter()

        # Verify login flow
        mock_page.goto.assert_called_with("https://twitter.com/login")
        assert mock_page.fill.call_count == 2
        assert mock_page.click.call_count == 2


@pytest.mark.asyncio
async def test_collect_twitter_posts(social_collector, mock_tweet_html):
    """Test Twitter post collection"""
    # Mock page
    mock_page = AsyncMock(spec=Page)
    mock_tweet = AsyncMock()
    mock_tweet.get_attribute.side_effect = ["123456", "123456"]
    mock_tweet.inner_html = AsyncMock(return_value=mock_tweet_html)

    # Mock tweet elements
    mock_author = AsyncMock()
    mock_author.inner_text = AsyncMock(return_value="Test User\n@testuser")
    mock_content = AsyncMock()
    mock_content.inner_text = AsyncMock(return_value="Test tweet content #crypto")

    mock_tweet.query_selector = AsyncMock(side_effect=[mock_author, mock_content])
    mock_page.query_selector_all = AsyncMock(return_value=[mock_tweet])

    social_collector.twitter_page = mock_page

    # Test collection
    posts = await social_collector.collect_twitter_posts("crypto", limit=1)

    assert len(posts) == 1
    post = posts[0]
    assert isinstance(post, RawSocialMediaPost)
    assert post.platform == "twitter"
    assert post.content == "Test tweet content #crypto"
    assert post.author == "Test User"
    assert post.url == "https://twitter.com/i/web/status/123456"


@pytest.mark.asyncio
async def test_store_posts(social_collector):
    """Test post storage"""
    posts = [
        RawSocialMediaPost(
            platform="twitter",
            post_id="123",
            content="Test content",
            author="Test Author",
        )
    ]

    await social_collector.store_posts(posts)
    social_collector.storage.store_posts.assert_called_once_with(posts)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
