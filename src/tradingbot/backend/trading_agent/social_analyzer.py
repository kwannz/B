from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import discord
import numpy as np
import pandas as pd
import praw
import requests
import tweepy
from telethon import TelegramClient
from textblob import TextBlob

from src.shared.cache.hybrid_cache import HybridCache
from src.shared.models.alerts import Alert, AlertLevel
from src.shared.utils.rate_limiter import RateLimiter


class SocialAnalyzer:
    """社交媒体分析器，用于分析加密货币相关的社交媒体讨论"""

    def __init__(self, config: Dict):
        self.config = config
        self.cache = HybridCache()
        self.rate_limiter = RateLimiter(max_requests=100, time_window=60)  # 60秒

        # 初始化API客户端
        self._init_twitter_client()
        self._init_reddit_client()
        self._init_discord_client()
        self._init_telegram_client()

        # 初始化数据存储
        self.sentiment_history: Dict[str, List[Dict]] = defaultdict(list)
        self.trend_history: Dict[str, List[Dict]] = defaultdict(list)
        self.influencer_scores: Dict[str, float] = {}
        self.community_stats: Dict[str, Dict] = {}

        # 配置参数
        self.analysis_window = config.get("analysis_window", 24)  # 小时
        self.min_followers = config.get("min_followers", 1000)
        self.influence_decay = config.get("influence_decay", 0.95)
        self.alert_thresholds = config.get(
            "alert_thresholds",
            {
                "sentiment_change": 0.3,
                "volume_change": 50,
                "influence_score": 0.8,
                "community_growth": 20,
            },
        )

    def _init_twitter_client(self):
        """初始化Twitter API客户端"""
        try:
            auth = tweepy.OAuthHandler(
                self.config["twitter_api_key"], self.config["twitter_api_secret"]
            )
            auth.set_access_token(
                self.config["twitter_access_token"],
                self.config["twitter_access_secret"],
            )
            self.twitter_api = tweepy.API(auth)
        except Exception as e:
            print(f"Twitter API initialization failed: {str(e)}")
            self.twitter_api = None

    def _init_reddit_client(self):
        """初始化Reddit API客户端"""
        try:
            self.reddit_api = praw.Reddit(
                client_id=self.config["reddit_client_id"],
                client_secret=self.config["reddit_client_secret"],
                user_agent=self.config["reddit_user_agent"],
            )
        except Exception as e:
            print(f"Reddit API initialization failed: {str(e)}")
            self.reddit_api = None

    def _init_discord_client(self):
        """初始化Discord API客户端"""
        try:
            intents = discord.Intents.default()
            intents.message_content = True
            self.discord_client = discord.Client(intents=intents)
            self.discord_client.event(self._on_discord_ready)
            self.discord_client.event(self._on_discord_message)

            # 异步启动客户端
            import asyncio

            asyncio.create_task(self.discord_client.start(self.config["discord_token"]))
        except Exception as e:
            print(f"Discord API initialization failed: {str(e)}")
            self.discord_client = None

    def _init_telegram_client(self):
        """初始化Telegram API客户端"""
        try:
            self.telegram_client = TelegramClient(
                "crypto_analyzer",
                self.config["telegram_api_id"],
                self.config["telegram_api_hash"],
            )
            # 异步启动客户端
            import asyncio

            asyncio.create_task(self.telegram_client.start())
        except Exception as e:
            print(f"Telegram API initialization failed: {str(e)}")
            self.telegram_client = None

    async def _on_discord_ready(self):
        """Discord客户端就绪回调"""
        print(f"Discord bot logged in as {self.discord_client.user}")

    async def _on_discord_message(self, message):
        """Discord消息回调"""
        if message.author == self.discord_client.user:
            return

        # 处理消息...
        pass

    async def analyze_social_sentiment(self, symbol: str) -> Dict:
        """分析特定加密货币的社交媒体情绪

        Args:
            symbol: 加密货币符号

        Returns:
            Dict: 情绪分析结果
        """
        try:
            # 获取多平台数据
            twitter_data = await self._get_twitter_data(symbol)
            reddit_data = await self._get_reddit_data(symbol)
            discord_data = await self._get_discord_data(symbol)
            telegram_data = await self._get_telegram_data(symbol)

            # 合并所有平台数据
            all_data = twitter_data + reddit_data + discord_data + telegram_data
            if not all_data:
                return self._get_empty_analysis()

            # 分析情绪
            sentiment_scores = []
            for post in all_data:
                # 计算情绪分数
                sentiment_score = self._analyze_text_sentiment(post["text"])
                influence_score = post["influence_score"]

                sentiment_scores.append(
                    {
                        "timestamp": post["timestamp"],
                        "sentiment": sentiment_score,
                        "influence_score": influence_score,
                        "platform": post["platform"],
                        "user_id": post["user_id"],
                    }
                )

            # 计算加权情绪分数
            weighted_sentiment = self._calculate_weighted_sentiment(sentiment_scores)

            # 更新历史数据
            self._update_sentiment_history(
                symbol, weighted_sentiment, len(sentiment_scores)
            )

            # 分析社区增长
            community_growth = await self._analyze_community_growth(symbol)

            # 生成分析结果
            result = {
                "current_sentiment": weighted_sentiment,
                "sentiment_trend": self._calculate_sentiment_trend(symbol),
                "volume_change": self._calculate_volume_change(symbol),
                "top_influencers": self._get_top_influencers(),
                "community_stats": community_growth,
                "platform_breakdown": self._get_platform_breakdown(sentiment_scores),
                "timestamp": datetime.now().isoformat(),
            }

            # 检查是否需要生成告警
            await self._check_alerts(symbol, result)

            return result

        except Exception as e:
            print(f"Social sentiment analysis failed: {str(e)}")
            return self._get_empty_analysis()

    async def _get_twitter_data(self, symbol: str) -> List[Dict]:
        """获取Twitter数据"""
        if not self.twitter_api:
            return []

        try:
            with self.rate_limiter:
                query = f"#{symbol} OR ${symbol} -filter:retweets"
                tweets = self.twitter_api.search_tweets(
                    q=query, lang="en", count=100, tweet_mode="extended"
                )

                return [
                    {
                        "text": tweet.full_text,
                        "timestamp": tweet.created_at,
                        "platform": "twitter",
                        "user_id": tweet.user.id_str,
                        "influence_score": self._calculate_influence_score(tweet),
                    }
                    for tweet in tweets
                    if tweet.user.followers_count >= self.min_followers
                ]

        except Exception as e:
            print(f"Twitter data collection failed: {str(e)}")
            return []

    async def _get_reddit_data(self, symbol: str) -> List[Dict]:
        """获取Reddit数据"""
        if not self.reddit_api:
            return []

        try:
            with self.rate_limiter:
                subreddit = self.reddit_api.subreddit(
                    f"cryptocurrency+{symbol.lower()}"
                )
                posts = subreddit.search(query=symbol, sort="new", time_filter="day")

                return [
                    {
                        "text": post.selftext or post.title,
                        "timestamp": datetime.fromtimestamp(post.created_utc),
                        "platform": "reddit",
                        "user_id": post.author.name if post.author else "deleted",
                        "influence_score": self._calculate_reddit_influence(post),
                    }
                    for post in posts
                ]

        except Exception as e:
            print(f"Reddit data collection failed: {str(e)}")
            return []

    def _analyze_text_sentiment(self, text: str) -> float:
        """分析文本情绪

        Args:
            text: 待分析文本

        Returns:
            float: 情绪分数 (-1 到 1)
        """
        try:
            # 使用TextBlob进行情绪分析
            blob = TextBlob(text)
            return blob.sentiment.polarity
        except:
            return 0.0

    def _calculate_weighted_sentiment(self, scores: List[Dict]) -> float:
        """计算加权情绪分数

        Args:
            scores: 情绪分数列表

        Returns:
            float: 加权情绪分数
        """
        if not scores:
            return 0.0

        weights = [s["influence_score"] for s in scores]
        sentiments = [s["sentiment"] for s in scores]

        return np.average(sentiments, weights=weights)

    def _calculate_reddit_influence(self, post) -> float:
        """计算Reddit帖子的影响力分数

        Args:
            post: Reddit帖子对象

        Returns:
            float: 影响力分数 (0-1)
        """
        # 基础分数 = 评论数和投票的对数
        engagement = np.log1p(post.num_comments + post.score) / 10

        # 考虑作者的karma
        author_karma = 0
        if post.author:
            try:
                author_karma = (
                    np.log1p(post.author.link_karma + post.author.comment_karma) / 20
                )
            except:
                pass

        # 考虑帖子年龄
        age_hours = (
            datetime.now() - datetime.fromtimestamp(post.created_utc)
        ).total_seconds() / 3600
        recency = max(0, 1 - age_hours / 24)  # 24小时内线性衰减

        return min(1.0, (engagement + author_karma) * recency)

    async def _get_discord_data(self, symbol: str) -> List[Dict]:
        """获取Discord数据

        Args:
            symbol: 加密货币符号

        Returns:
            List[Dict]: Discord消息数据
        """
        if not self.discord_client:
            return []

        try:
            with self.rate_limiter:
                messages = []
                # 获取配置的加密货币频道
                channels = self.config.get("discord_channels", [])

                for channel_id in channels:
                    channel = self.discord_client.get_channel(channel_id)
                    if not channel:
                        continue

                    # 获取最近的消息
                    async for message in channel.history(limit=100):
                        if symbol.lower() in message.content.lower():
                            messages.append(
                                {
                                    "text": message.content,
                                    "timestamp": message.created_at,
                                    "platform": "discord",
                                    "user_id": str(message.author.id),
                                    "influence_score": self._calculate_discord_influence(
                                        message
                                    ),
                                }
                            )

                return messages

        except Exception as e:
            print(f"Discord data collection failed: {str(e)}")
            return []

    async def _get_telegram_data(self, symbol: str) -> List[Dict]:
        """获取Telegram数据

        Args:
            symbol: 加密货币符号

        Returns:
            List[Dict]: Telegram消息数据
        """
        if not self.telegram_client:
            return []

        try:
            with self.rate_limiter:
                messages = []
                # 获取配置的加密货币群组
                groups = self.config.get("telegram_groups", [])

                for group in groups:
                    # 获取最近的消息
                    async for message in self.telegram_client.iter_messages(
                        group, limit=100, search=symbol
                    ):
                        if not message.text:
                            continue

                        messages.append(
                            {
                                "text": message.text,
                                "timestamp": message.date,
                                "platform": "telegram",
                                "user_id": str(message.sender_id),
                                "influence_score": await self._calculate_telegram_influence(
                                    message
                                ),
                            }
                        )

                return messages

        except Exception as e:
            print(f"Telegram data collection failed: {str(e)}")
            return []

    def _calculate_discord_influence(self, message) -> float:
        """计算Discord用户影响力分数

        Args:
            message: Discord消息对象

        Returns:
            float: 影响力分数 (0-1)
        """
        # 基础分数 = 消息反应数
        reaction_score = sum(reaction.count for reaction in message.reactions) / 10

        # 考虑用户角色
        role_score = 0
        if message.author.guild_permissions.administrator:
            role_score = 0.3
        elif any(role.permissions.manage_messages for role in message.author.roles):
            role_score = 0.2

        # 考虑消息年龄
        age_hours = (datetime.now() - message.created_at).total_seconds() / 3600
        recency = max(0, 1 - age_hours / 24)  # 24小时内线性衰减

        return min(1.0, (reaction_score + role_score) * recency)

    async def _calculate_telegram_influence(self, message) -> float:
        """计算Telegram用户影响力分数

        Args:
            message: Telegram消息对象

        Returns:
            float: 影响力分数 (0-1)
        """
        try:
            # 获取用户信息
            sender = await message.get_sender()
            chat = await message.get_chat()

            # 基础分数 = 消息查看数
            view_score = np.log1p(message.views or 0) / 10

            # 考虑用户角色
            role_score = 0
            if sender.bot:
                role_score = 0.1
            elif await self.telegram_client.get_permissions(chat, sender):
                perms = await self.telegram_client.get_permissions(chat, sender)
                if perms.is_admin:
                    role_score = 0.3
                elif perms.can_post_messages:
                    role_score = 0.2

            # 考虑消息年龄
            age_hours = (datetime.now() - message.date).total_seconds() / 3600
            recency = max(0, 1 - age_hours / 24)  # 24小时内线性衰减

            return min(1.0, (view_score + role_score) * recency)

        except Exception as e:
            print(f"Telegram influence calculation failed: {str(e)}")
            return 0.0

    async def _analyze_community_growth(self, symbol: str) -> Dict:
        """分析社区增长情况

        Args:
            symbol: 加密货币符号

        Returns:
            Dict: 社区增长统计
        """
        try:
            # 获取Twitter关注者数据
            if self.twitter_api:
                cashtag_tweets = self.twitter_api.search_tweets(
                    q=f"${symbol}", count=100
                )
                unique_users = len(set(t.user.id_str for t in cashtag_tweets))
            else:
                unique_users = 0

            # 获取Reddit订阅者数据
            if self.reddit_api:
                subreddit = self.reddit_api.subreddit(symbol.lower())
                subscriber_count = subreddit.subscribers
            else:
                subscriber_count = 0

            # 获取Discord成员统计
            discord_members = 0
            if self.discord_client:
                for channel_id in self.config.get("discord_channels", []):
                    channel = self.discord_client.get_channel(channel_id)
                    if channel and channel.guild:
                        discord_members += channel.guild.member_count

            # 获取Telegram群组统计
            telegram_members = 0
            if self.telegram_client:
                for group in self.config.get("telegram_groups", []):
                    try:
                        full_chat = await self.telegram_client(
                            functions.channels.GetFullChannel(channel=group)
                        )
                        telegram_members += full_chat.full_chat.participants_count
                    except:
                        pass

            # 计算增长率
            current_stats = {
                "twitter_users": unique_users,
                "reddit_subscribers": subscriber_count,
                "discord_members": discord_members,
                "telegram_members": telegram_members,
                "timestamp": datetime.now(),
            }

            if symbol in self.community_stats:
                old_stats = self.community_stats[symbol]
                hours_diff = (
                    current_stats["timestamp"] - old_stats["timestamp"]
                ).total_seconds() / 3600

                if hours_diff > 0:
                    growth_rates = {
                        "twitter_growth": (unique_users - old_stats["twitter_users"])
                        / hours_diff,
                        "reddit_growth": (
                            subscriber_count - old_stats["reddit_subscribers"]
                        )
                        / hours_diff,
                        "discord_growth": (
                            discord_members - old_stats.get("discord_members", 0)
                        )
                        / hours_diff,
                        "telegram_growth": (
                            telegram_members - old_stats.get("telegram_members", 0)
                        )
                        / hours_diff,
                    }
                else:
                    growth_rates = {
                        "twitter_growth": 0,
                        "reddit_growth": 0,
                        "discord_growth": 0,
                        "telegram_growth": 0,
                    }
            else:
                growth_rates = {
                    "twitter_growth": 0,
                    "reddit_growth": 0,
                    "discord_growth": 0,
                    "telegram_growth": 0,
                }

            self.community_stats[symbol] = current_stats

            return {"current_stats": current_stats, "growth_rates": growth_rates}

        except Exception as e:
            print(f"Community growth analysis failed: {str(e)}")
            return {
                "current_stats": {
                    "twitter_users": 0,
                    "reddit_subscribers": 0,
                    "discord_members": 0,
                    "telegram_members": 0,
                },
                "growth_rates": {
                    "twitter_growth": 0,
                    "reddit_growth": 0,
                    "discord_growth": 0,
                    "telegram_growth": 0,
                },
            }

    def _get_platform_breakdown(self, sentiment_scores: List[Dict]) -> Dict:
        """获取各平台情绪分布

        Args:
            sentiment_scores: 情绪分数列表

        Returns:
            Dict: 平台情绪分布
        """
        platform_data = defaultdict(list)
        for score in sentiment_scores:
            platform_data[score["platform"]].append(score["sentiment"])

        return {
            platform: {
                "count": len(scores),
                "avg_sentiment": np.mean(scores),
                "std_sentiment": np.std(scores),
            }
            for platform, scores in platform_data.items()
        }

    async def _check_alerts(self, symbol: str, analysis: Dict):
        """检查是否需要生成告警

        Args:
            symbol: 加密货币符号
            analysis: 分析结果
        """
        alerts = []

        # 检查情绪变化
        if (
            abs(analysis["current_sentiment"])
            > self.alert_thresholds["sentiment_change"]
        ):
            alerts.append(
                Alert(
                    message=f"Significant sentiment change detected for {symbol}",
                    level=AlertLevel.MEDIUM,
                    timestamp=datetime.now(),
                )
            )

        # 检查讨论量变化
        if abs(analysis["volume_change"]) > self.alert_thresholds["volume_change"]:
            alerts.append(
                Alert(
                    message=f"Unusual discussion volume for {symbol}",
                    level=AlertLevel.LOW,
                    timestamp=datetime.now(),
                )
            )

        # 检查社区增长
        growth_rate = analysis["community_stats"]["growth_rates"]["reddit_growth"]
        if growth_rate > self.alert_thresholds["community_growth"]:
            alerts.append(
                Alert(
                    message=f"Rapid community growth for {symbol}",
                    level=AlertLevel.HIGH,
                    timestamp=datetime.now(),
                )
            )

        # TODO: 发送告警通知

    def _get_empty_analysis(self) -> Dict:
        """返回空分析结果"""
        return {
            "current_sentiment": 0.0,
            "sentiment_trend": "neutral",
            "volume_change": 0.0,
            "top_influencers": [],
            "community_stats": {
                "current_stats": {
                    "twitter_users": 0,
                    "reddit_subscribers": 0,
                    "discord_members": 0,
                    "telegram_members": 0,
                },
                "growth_rates": {
                    "twitter_growth": 0,
                    "reddit_growth": 0,
                    "discord_growth": 0,
                    "telegram_growth": 0,
                },
            },
            "platform_breakdown": {},
            "timestamp": datetime.now().isoformat(),
        }

    def get_analysis_summary(self) -> Dict:
        """获取分析总结"""
        return {
            "analysis_window": self.analysis_window,
            "data_points": {
                symbol: len(history)
                for symbol, history in self.sentiment_history.items()
            },
            "influencer_count": len(self.influencer_scores),
            "alert_thresholds": self.alert_thresholds,
            "platforms": {
                "twitter": self.twitter_api is not None,
                "reddit": self.reddit_api is not None,
                "discord": self.discord_client is not None,
                "telegram": self.telegram_client is not None,
            },
        }
