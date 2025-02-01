from datetime import datetime

import pytest
import pytest_asyncio

from src.shared.models.mongodb import RawSocialMediaPost
from src.shared.social.social_scraper import SocialMediaScraper


@pytest_asyncio.fixture
async def twitter_scraper():
    config = {"batch_size": 10, "rate_limit_delay": 0.5, "max_retries": 3}
    scraper = SocialMediaScraper("Twitter", config)
    yield scraper
    await scraper.close()


@pytest.mark.asyncio
async def test_simulate_login(twitter_scraper):
    success = await twitter_scraper.simulate_login()
    assert success is True


@pytest.mark.asyncio
async def test_scrape_posts(twitter_scraper):
    posts = await twitter_scraper.scrape_posts("bitcoin", limit=3)
    assert len(posts) == 3
    for post in posts:
        assert isinstance(post, RawSocialMediaPost)
        assert post.platform == "Twitter"
        assert "bitcoin" in post.content.lower()
        assert isinstance(post.posted_at, datetime)
        assert post.engagement_metrics
        assert post.meta_info["simulation"] is True


@pytest.mark.asyncio
async def test_scrape_posts_with_invalid_login(twitter_scraper):
    twitter_scraper.simulate_login = lambda: False
    with pytest.raises(Exception):
        await twitter_scraper.scrape_posts("bitcoin")


@pytest.mark.asyncio
async def test_multiple_queries(twitter_scraper):
    queries = ["bitcoin", "ethereum", "crypto"]
    all_posts = []
    for query in queries:
        posts = await twitter_scraper.scrape_posts(query, limit=2)
        assert len(posts) == 2
        all_posts.extend(posts)

    assert len(all_posts) == len(queries) * 2
    assert len({post.post_id for post in all_posts}) == len(all_posts)
