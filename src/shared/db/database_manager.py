from typing import Dict, Any, Optional, List
from datetime import datetime
import motor.motor_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from ..models.mongodb import (
    RawNewsArticle, RawSocialMediaPost, MarketDataSnapshot,
    UnstructuredAnalysis, AgentAnalysisResult
)
from ..models.sentiment import SentimentAnalysis, AgentSentimentSignal, CombinedMarketSentiment
from ..models.trading import Strategy, Wallet

class DatabaseManager:
    def __init__(self, mongodb_url: str, postgres_url: str):
        # MongoDB setup
        self.mongodb_client = motor.motor_asyncio.AsyncIOMotorClient(mongodb_url)
        self.mongodb = self.mongodb_client.tradingbot
        
        # PostgreSQL setup
        self.postgres_engine = create_async_engine(postgres_url)
        self.async_session = sessionmaker(
            self.postgres_engine, class_=AsyncSession, expire_on_commit=False
        )

    async def store_raw_news(self, news: RawNewsArticle) -> str:
        result = await self.mongodb.raw_news.insert_one(news.dict())
        return str(result.inserted_id)

    async def store_social_post(self, post: RawSocialMediaPost) -> str:
        result = await self.mongodb.social_posts.insert_one(post.dict())
        return str(result.inserted_id)

    async def store_market_snapshot(self, snapshot: MarketDataSnapshot) -> str:
        result = await self.mongodb.market_snapshots.insert_one(snapshot.dict())
        return str(result.inserted_id)

    async def store_unstructured_analysis(self, analysis: UnstructuredAnalysis) -> str:
        result = await self.mongodb.unstructured_analysis.insert_one(analysis.dict())
        return str(result.inserted_id)

    async def store_agent_analysis(self, analysis: AgentAnalysisResult) -> str:
        result = await self.mongodb.agent_analysis.insert_one(analysis.dict())
        return str(result.inserted_id)

    async def store_sentiment_analysis(self, sentiment: Dict[str, Any]) -> SentimentAnalysis:
        async with self.async_session() as session:
            analysis = SentimentAnalysis(**sentiment)
            session.add(analysis)
            await session.commit()
            return analysis

    async def store_agent_sentiment(self, sentiment: Dict[str, Any]) -> AgentSentimentSignal:
        async with self.async_session() as session:
            signal = AgentSentimentSignal(**sentiment)
            session.add(signal)
            await session.commit()
            return signal

    async def store_combined_sentiment(self, sentiment: Dict[str, Any]) -> CombinedMarketSentiment:
        async with self.async_session() as session:
            combined = CombinedMarketSentiment(**sentiment)
            session.add(combined)
            await session.commit()
            return combined

    async def get_latest_market_sentiment(self, symbol: str) -> Optional[CombinedMarketSentiment]:
        async with self.async_session() as session:
            query = select(CombinedMarketSentiment).filter_by(
                symbol=symbol
            ).order_by(CombinedMarketSentiment.created_at.desc())
            result = await session.execute(query)
            return result.scalars().first()

    async def get_raw_news_by_source(self, source: str, limit: int = 100) -> List[Dict[str, Any]]:
        cursor = self.mongodb.raw_news.find({"source": source}).limit(limit)
        return [doc async for doc in cursor]

    async def get_social_posts_by_platform(self, platform: str, limit: int = 100) -> List[Dict[str, Any]]:
        cursor = self.mongodb.social_posts.find({"platform": platform}).limit(limit)
        return [doc async for doc in cursor]

    async def close(self):
        await self.mongodb_client.close()
        await self.postgres_engine.dispose()
