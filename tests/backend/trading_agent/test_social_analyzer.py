import pytest
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from src.backend.trading_agent.social_analyzer import SocialAnalyzer


@pytest.fixture
def mock_tweepy():
    with patch("tweepy.API") as mock:
        # 模拟推文数据
        mock_tweets = []
        for i in range(10):
            tweet = Mock()
            tweet.full_text = "This is a great investment! #BTC"
            tweet.created_at = datetime.now() - timedelta(hours=i)

            # 模拟用户数据
            tweet.user = Mock()
            tweet.user.followers_count = 5000 + i * 1000
            tweet.user.id_str = f"user_{i}"
            tweet.user.created_at = datetime.now() - timedelta(days=365)
            tweet.user.verified = i % 3 == 0  # 每三个用户中有一个认证用户

            mock_tweets.append(tweet)

        mock.search_tweets.return_value = mock_tweets
        yield mock


@pytest.fixture
def mock_discord():
    with patch("discord.Client") as mock:
        # 模拟Discord消息数据
        message = Mock()
        message.content = "Great news for #BTC!"
        message.created_at = datetime.now()
        message.author = Mock()
        message.author.id = "123456"
        message.author.guild_permissions.administrator = False
        message.author.roles = []
        message.reactions = [Mock(count=5), Mock(count=3)]

        # 模拟频道数据
        channel = AsyncMock()
        channel.history.return_value = [message]
        channel.guild = Mock(member_count=1000)

        # 设置客户端
        mock.get_channel.return_value = channel
        yield mock


@pytest.fixture
def mock_telegram():
    with patch("telethon.TelegramClient") as mock:
        # 模拟Telegram消息数据
        message = AsyncMock()
        message.text = "BTC price prediction"
        message.date = datetime.now()
        message.sender_id = "789012"
        message.views = 100

        # 模拟用户权限
        sender = AsyncMock()
        sender.bot = False
        message.get_sender.return_value = sender

        chat = AsyncMock()
        message.get_chat.return_value = chat

        permissions = AsyncMock()
        permissions.is_admin = True
        permissions.can_post_messages = True

        # 设置客户端
        mock.iter_messages.return_value = [message]
        mock.get_permissions.return_value = permissions
        yield mock


@pytest.fixture
def social_analyzer(mock_tweepy):
    config = {
        "twitter_api_key": "mock_key",
        "twitter_api_secret": "mock_secret",
        "twitter_access_token": "mock_token",
        "twitter_access_secret": "mock_token_secret",
        "analysis_window": 24,
        "min_followers": 1000,
        "influence_decay": 0.95,
        "alert_thresholds": {
            "sentiment_change": 0.3,
            "volume_change": 50,
            "influence_score": 0.8,
        },
    }
    return SocialAnalyzer(config)


@pytest.fixture
def mock_reddit():
    # This fixture is mentioned in the original file but not implemented in the new file
    # It's assumed to exist as it's called in the test_social_analyzer.py file
    pass


@pytest.fixture
def social_analyzer_with_all_platforms(
    mock_tweepy, mock_reddit, mock_discord, mock_telegram
):
    config = {
        "twitter_api_key": "mock_key",
        "twitter_api_secret": "mock_secret",
        "twitter_access_token": "mock_token",
        "twitter_access_secret": "mock_token_secret",
        "reddit_client_id": "mock_id",
        "reddit_client_secret": "mock_secret",
        "reddit_user_agent": "mock_agent",
        "discord_token": "mock_token",
        "discord_channels": ["123456789"],
        "telegram_api_id": "mock_id",
        "telegram_api_hash": "mock_hash",
        "telegram_groups": ["crypto_group"],
        "analysis_window": 24,
        "min_followers": 1000,
        "influence_decay": 0.95,
        "alert_thresholds": {
            "sentiment_change": 0.3,
            "volume_change": 50,
            "influence_score": 0.8,
            "community_growth": 20,
        },
    }
    return SocialAnalyzer(config)


class TestSocialAnalyzer:
    async def test_sentiment_analysis(self, social_analyzer):
        result = await social_analyzer.analyze_social_sentiment("BTC")

        assert "current_sentiment" in result
        assert "sentiment_trend" in result
        assert "volume_change" in result
        assert "top_influencers" in result
        assert isinstance(result["current_sentiment"], float)

    def test_influence_score_calculation(self, social_analyzer):
        # 创建模拟推文
        tweet = Mock()
        tweet.user = Mock()
        tweet.user.followers_count = 10000
        tweet.user.created_at = datetime.now() - timedelta(days=500)
        tweet.user.verified = True
        tweet.user.id_str = "test_user"

        score = social_analyzer._calculate_influence_score(tweet)
        assert 0 <= score <= 1

        # 测试影响力分数衰减
        initial_score = social_analyzer.influencer_scores["test_user"]
        social_analyzer._clean_old_data()
        assert social_analyzer.influencer_scores["test_user"] < initial_score

    def test_sentiment_trend_calculation(self, social_analyzer):
        # 添加模拟历史数据
        social_analyzer.sentiment_history = [
            {
                "symbol": "BTC",
                "timestamp": datetime.now() - timedelta(hours=i),
                "weighted_sentiment": 0.1 * i,  # 递增趋势
                "sample_size": 100,
            }
            for i in range(48)
        ]

        trend = social_analyzer._calculate_sentiment_trend()
        assert trend in ["improving", "deteriorating", "stable"]

    def test_volume_change_calculation(self, social_analyzer):
        # 添加模拟历史数据
        social_analyzer.sentiment_history = [
            {
                "symbol": "BTC",
                "timestamp": datetime.now() - timedelta(hours=i),
                "weighted_sentiment": 0.5,
                "sample_size": 100 if i < 24 else 50,  # 最近24小时样本量翻倍
            }
            for i in range(48)
        ]

        change = social_analyzer._calculate_volume_change()
        assert change == pytest.approx(100.0)  # 应该显示100%的增长

    def test_top_influencers(self, social_analyzer):
        # 添加模拟影响力分数
        social_analyzer.influencer_scores = {f"user_{i}": 0.1 * i for i in range(10)}

        top_users = social_analyzer._get_top_influencers(limit=3)
        assert len(top_users) == 3
        assert top_users[0]["influence_score"] > top_users[1]["influence_score"]

    def test_data_cleanup(self, social_analyzer):
        # 添加过期数据
        old_time = datetime.now() - timedelta(hours=social_analyzer.analysis_window + 1)
        social_analyzer.sentiment_history = [
            {
                "symbol": "BTC",
                "timestamp": old_time,
                "weighted_sentiment": 0.5,
                "sample_size": 100,
            }
        ]

        social_analyzer._clean_old_data()
        assert len(social_analyzer.sentiment_history) == 0

    def test_analysis_summary(self, social_analyzer):
        summary = social_analyzer.get_analysis_summary()
        assert "analysis_window" in summary
        assert "data_points" in summary
        assert "influencer_count" in summary
        assert "alert_thresholds" in summary

    async def test_discord_data_collection(self, social_analyzer_with_all_platforms):
        discord_data = await social_analyzer_with_all_platforms._get_discord_data("BTC")

        assert len(discord_data) > 0
        assert all(d["platform"] == "discord" for d in discord_data)
        assert all("text" in d and "timestamp" in d for d in discord_data)

    def test_discord_influence_calculation(self, social_analyzer_with_all_platforms):
        # 创建模拟消息
        message = Mock()
        message.reactions = [Mock(count=5), Mock(count=3)]
        message.author = Mock()
        message.author.guild_permissions.administrator = True
        message.author.roles = []
        message.created_at = datetime.now()

        score = social_analyzer_with_all_platforms._calculate_discord_influence(message)
        assert 0 <= score <= 1

        # 测试管理员权限的影响
        message.author.guild_permissions.administrator = False
        normal_score = social_analyzer_with_all_platforms._calculate_discord_influence(
            message
        )
        assert normal_score < score

    async def test_telegram_data_collection(self, social_analyzer_with_all_platforms):
        telegram_data = await social_analyzer_with_all_platforms._get_telegram_data(
            "BTC"
        )

        assert len(telegram_data) > 0
        assert all(d["platform"] == "telegram" for d in telegram_data)
        assert all("text" in d and "timestamp" in d for d in telegram_data)

    async def test_telegram_influence_calculation(
        self, social_analyzer_with_all_platforms
    ):
        # 创建模拟消息
        message = AsyncMock()
        message.views = 100
        message.date = datetime.now()

        sender = AsyncMock()
        sender.bot = False
        message.get_sender.return_value = sender

        chat = AsyncMock()
        message.get_chat.return_value = chat

        score = await social_analyzer_with_all_platforms._calculate_telegram_influence(
            message
        )
        assert 0 <= score <= 1

        # 测试机器人的影响
        sender.bot = True
        bot_score = (
            await social_analyzer_with_all_platforms._calculate_telegram_influence(
                message
            )
        )
        assert bot_score < score

    async def test_community_growth_analysis(self, social_analyzer_with_all_platforms):
        growth_data = (
            await social_analyzer_with_all_platforms._analyze_community_growth("BTC")
        )

        assert "current_stats" in growth_data
        assert "growth_rates" in growth_data

        # 验证所有平台的数据
        assert all(
            platform in growth_data["current_stats"]
            for platform in [
                "twitter_users",
                "reddit_subscribers",
                "discord_members",
                "telegram_members",
            ]
        )
        assert all(
            platform in growth_data["growth_rates"]
            for platform in [
                "twitter_growth",
                "reddit_growth",
                "discord_growth",
                "telegram_growth",
            ]
        )

    def test_platform_breakdown(self, social_analyzer_with_all_platforms):
        sentiment_scores = [
            {"platform": platform, "sentiment": 0.5, "influence_score": 0.8}
            for platform in ["twitter", "reddit", "discord", "telegram"]
        ]

        breakdown = social_analyzer_with_all_platforms._get_platform_breakdown(
            sentiment_scores
        )

        assert all(
            platform in breakdown
            for platform in ["twitter", "reddit", "discord", "telegram"]
        )
        assert all(
            all(key in stats for key in ["count", "avg_sentiment", "std_sentiment"])
            for stats in breakdown.values()
        )
