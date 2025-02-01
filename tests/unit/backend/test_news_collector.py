import asyncio
from datetime import datetime, timedelta

import pytest

from src.shared.news_collector.collector import NewsCollector


@pytest.mark.asyncio
async def test_international_sources():
    collector = NewsCollector()
    await collector.initialize()
    try:
        for source, url in collector.sources.items():
            news = await collector._fetch_news(
                source, url, datetime.now() - timedelta(hours=24)
            )
            assert isinstance(news, list)
            if news:
                assert all(isinstance(article, dict) for article in news)
                assert all("title" in article for article in news)
                assert all("url" in article for article in news)
                assert all("timestamp" in article for article in news)
                assert all("language" in article for article in news)
                assert all(article["language"] == "en" for article in news)
    finally:
        await collector.close()


@pytest.mark.asyncio
async def test_chinese_sources():
    collector = NewsCollector()
    await collector.initialize()
    try:
        for source, url in collector.chinese_sources.items():
            news = await collector._fetch_news(
                source, url, datetime.now() - timedelta(hours=24)
            )
            assert isinstance(news, list)
            if news:
                assert all(isinstance(article, dict) for article in news)
                assert all("title" in article for article in news)
                assert all("url" in article for article in news)
                assert all("timestamp" in article for article in news)
                assert all("language" in article for article in news)
                assert all(article["language"] == "zh" for article in news)
    finally:
        await collector.close()


@pytest.mark.asyncio
async def test_telegram_source():
    collector = NewsCollector()
    await collector.initialize()
    try:
        news = await collector._fetch_telegram_news(
            "https://t.me/s/BWEnews", datetime.now() - timedelta(hours=24)
        )
        assert isinstance(news, list)
        if news:
            assert all(isinstance(article, dict) for article in news)
            assert all("title" in article for article in news)
            assert all("content" in article for article in news)
            assert all("timestamp" in article for article in news)
            assert all("language" in article for article in news)
    finally:
        await collector.close()


@pytest.mark.asyncio
async def test_timestamp_parsing():
    collector = NewsCollector()
    test_timestamps = [
        "2024-02-28T15:30:00Z",
        "February 28, 2024 15:30",
        "Feb 28, 2024 15:30",
        "2024年2月28日 15:30",
        "2月28日 15:30",
        "5 minutes ago",
        "1 hour ago",
        "刚刚",
        "5分钟前",
        "1小时前",
    ]
    for timestamp in test_timestamps:
        parsed = collector._parse_timestamp(timestamp)
        assert isinstance(parsed, datetime)
