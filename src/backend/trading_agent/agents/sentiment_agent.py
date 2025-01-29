from typing import Dict, Any, List
from datetime import datetime
from .base_agent import BaseAgent
from src.shared.sentiment.sentiment_analyzer import analyze_text
from src.shared.db.database_manager import DatabaseManager

class SentimentAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.symbols = config.get('symbols', ['BTC', 'ETH', 'SOL'])
        self.update_interval = config.get('update_interval', 300)
        self.languages = config.get('languages', ['en', 'zh'])
        self.sentiment_cache = {}

    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        self.symbols = new_config.get('symbols', self.symbols)
        self.update_interval = new_config.get('update_interval', self.update_interval)
        self.languages = new_config.get('languages', self.languages)
        self.last_update = datetime.now().isoformat()

    async def analyze_sentiment(self, text: str, language: str = "en") -> Dict[str, Any]:
        return await analyze_text(text, language)

    async def get_market_sentiment(self, symbol: str) -> Dict[str, Any]:
        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        # Get latest news and social media data from MongoDB
        news_cursor = self.db_manager.mongodb.raw_news.find(
            {"content": {"$regex": symbol, "$options": "i"}}
        ).sort("published_at", -1).limit(5)
        
        social_cursor = self.db_manager.mongodb.social_posts.find(
            {"content": {"$regex": symbol, "$options": "i"}}
        ).sort("posted_at", -1).limit(5)

        news_texts = [doc["content"] async for doc in news_cursor]
        social_texts = [doc["content"] async for doc in social_cursor]

        # Analyze sentiment for each source
        news_sentiments = [await self.analyze_sentiment(text) for text in news_texts]
        social_sentiments = [await self.analyze_sentiment(text) for text in social_texts]

        # Calculate average sentiment scores
        news_score = sum(s["score"] for s in news_sentiments) / len(news_sentiments) if news_sentiments else 0.5
        social_score = sum(s["score"] for s in social_sentiments) / len(social_sentiments) if social_sentiments else 0.5
        
        # Get market indicators sentiment
        market_data = await self.db_manager.mongodb.market_snapshots.find_one(
            {"symbol": symbol},
            sort=[("timestamp", -1)]
        )
        market_text = f"Price: {market_data['price']}, Volume: {market_data['volume']}" if market_data else f"Market data for {symbol}"
        market_sentiment = await self.analyze_sentiment(market_text)

        # Calculate combined score with weights
        weights = {"news": 0.3, "social": 0.3, "market": 0.4}
        combined_score = (
            news_score * weights["news"] +
            social_score * weights["social"] +
            market_sentiment["score"] * weights["market"]
        )

        sentiment_result = {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "sentiment": {
                "news": {"score": news_score, "samples": len(news_sentiments)},
                "social": {"score": social_score, "samples": len(social_sentiments)},
                "market": market_sentiment,
                "combined": {
                    "score": combined_score,
                    "label": "positive" if combined_score > 0.5 else "negative"
                }
            },
            "status": "active"
        }

        # Store the sentiment analysis result
        await self.db_manager.store_combined_sentiment({
            "symbol": symbol,
            "news_sentiment": news_score,
            "social_sentiment": social_score,
            "market_sentiment": market_sentiment["score"],
            "combined_score": combined_score,
            "source_signals": {
                "news_count": len(news_sentiments),
                "social_count": len(social_sentiments),
                "market_data": bool(market_data)
            }
        })

        return sentiment_result
