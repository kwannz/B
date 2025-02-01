"""
社交媒体分析器测试
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from tradingbot.shared.social_media_analyzer import SocialMediaAnalyzer

# Mock Twitter Data
MOCK_TWITTER_RESPONSE = {
    "data": [
        {
            "id": "1234567890",
            "text": "Bitcoin is looking bullish! #BTC #crypto",
            "created_at": "2024-02-25T00:00:00Z",
            "public_metrics": {
                "retweet_count": 100,
                "reply_count": 50,
                "like_count": 500,
                "quote_count": 25,
            },
        }
    ],
    "meta": {"result_count": 1},
}

# Mock Reddit Data
MOCK_REDDIT_RESPONSE = {
    "data": {
        "children": [
            {
                "data": {
                    "title": "Bitcoin Analysis",
                    "selftext": "Bullish sentiment in the market",
                    "created_utc": 1708819200,
                    "score": 1000,
                    "num_comments": 100,
                    "upvote_ratio": 0.95,
                }
            }
        ]
    }
}


@pytest.fixture
async def social_analyzer(monkeypatch):
    """创建社交媒体分析器实例"""
    # 设置测试环境变量
    monkeypatch.setenv("TESTING", "true")

    analyzer = SocialMediaAnalyzer()
    await analyzer.initialize()
    yield analyzer
    await analyzer.close()


@pytest.mark.asyncio
async def test_initialization(social_analyzer):
    """测试初始化"""
    assert social_analyzer.twitter_client is not None
    assert social_analyzer.reddit_client is not None


@pytest.mark.asyncio
async def test_twitter_analysis(social_analyzer):
    """测试Twitter分析"""
    # Mock Twitter client's search_recent_tweets method
    mock_tweet = Mock()
    mock_tweet.text = "Bitcoin is looking bullish! #BTC #crypto"
    mock_tweet.public_metrics = {
        "retweet_count": 100,
        "like_count": 500,
        "reply_count": 50,
        "quote_count": 25,
    }

    mock_tweets = Mock()
    mock_tweets.data = [mock_tweet]
    social_analyzer.twitter_client.search_recent_tweets.return_value = mock_tweets

    # Mock AI analyzer
    with patch.object(
        social_analyzer.ai_analyzer, "get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.return_value = {"sentiment_score": 0.8, "confidence": 0.9}

        result = await social_analyzer.analyze_twitter("bitcoin")

        assert result is not None
        assert "sentiment_score" in result
        assert "volume" in result
        assert "trending_topics" in result
        assert isinstance(result["sentiment_score"], float)
        assert result["sentiment_score"] >= -1 and result["sentiment_score"] <= 1


@pytest.mark.asyncio
async def test_reddit_analysis(social_analyzer):
    """测试Reddit分析"""
    # Mock Reddit client's subreddit method
    mock_post = Mock()
    mock_post.title = "Bitcoin Analysis"
    mock_post.selftext = "Bullish sentiment in the market"
    mock_post.score = 1000
    mock_post.num_comments = 100
    mock_post.permalink = "/r/Bitcoin/comments/test"

    mock_subreddit = Mock()
    mock_subreddit.hot.return_value = [mock_post]
    mock_subreddit.active_user_count = 5000
    social_analyzer.reddit_client.subreddit.return_value = mock_subreddit

    # Mock AI analyzer
    with patch.object(
        social_analyzer.ai_analyzer, "get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.return_value = {"sentiment_score": 0.7, "confidence": 0.85}

        result = await social_analyzer.analyze_reddit("Bitcoin")

        assert result is not None
        assert "sentiment_score" in result
        assert "active_users" in result
        assert "top_posts" in result
        assert isinstance(result["sentiment_score"], float)
        assert result["sentiment_score"] >= -1 and result["sentiment_score"] <= 1


@pytest.mark.asyncio
async def test_aggregated_sentiment(social_analyzer):
    """测试聚合情感分析"""
    # Mock Twitter response
    mock_tweet = Mock()
    mock_tweet.text = "Bitcoin trending up! #BTC"
    mock_tweet.public_metrics = {
        "retweet_count": 200,
        "like_count": 1000,
        "reply_count": 100,
        "quote_count": 50,
    }

    mock_tweets = Mock()
    mock_tweets.data = [mock_tweet]
    social_analyzer.twitter_client.search_recent_tweets.return_value = mock_tweets

    # Mock Reddit response
    mock_post = Mock()
    mock_post.title = "Market Analysis"
    mock_post.selftext = "Positive market indicators"
    mock_post.score = 2000
    mock_post.num_comments = 200
    mock_post.permalink = "/r/Bitcoin/comments/test2"

    mock_subreddit = Mock()
    mock_subreddit.hot.return_value = [mock_post]
    mock_subreddit.active_user_count = 10000
    social_analyzer.reddit_client.subreddit.return_value = mock_subreddit

    # Mock AI analyzer
    with patch.object(
        social_analyzer.ai_analyzer, "get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.return_value = {"sentiment_score": 0.75, "confidence": 0.9}

        sentiment = await social_analyzer.get_aggregated_sentiment()

        assert sentiment is not None
        assert isinstance(sentiment, float)
        assert -1 <= sentiment <= 1


@pytest.mark.asyncio
async def test_error_handling(social_analyzer):
    """测试错误处理"""
    with patch(
        "tweepy.Client.search_recent_tweets", side_effect=Exception("API Error")
    ):
        result = await social_analyzer.analyze_twitter("bitcoin")
        assert result["sentiment_score"] == 0.0
        assert result["error"] is not None


if __name__ == "__main__":
    pytest.main(["-v", __file__])
