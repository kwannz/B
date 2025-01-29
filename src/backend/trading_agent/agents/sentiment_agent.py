from typing import Dict, Any
from datetime import datetime
from .base_agent import BaseAgent
from src.shared.sentiment.sentiment_analyzer import analyze_text

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
        # Analyze market sentiment from multiple sources
        news_text = f"Latest news about {symbol}"  # TODO: Get real news text
        social_text = f"Social media sentiment about {symbol}"  # TODO: Get real social media text
        market_text = f"Market indicators for {symbol}"  # TODO: Get real market indicators

        # Analyze each source using local-first model
        news_sentiment = await self.analyze_sentiment(news_text)
        social_sentiment = await self.analyze_sentiment(social_text)
        market_sentiment = await self.analyze_sentiment(market_text)

        # Aggregate sentiment scores with equal weights
        combined_score = (
            news_sentiment["score"] + 
            social_sentiment["score"] + 
            market_sentiment["score"]
        ) / 3.0

        return {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "sentiment": {
                "news": news_sentiment,
                "social": social_sentiment,
                "market": market_sentiment,
                "combined": {
                    "score": combined_score,
                    "label": "positive" if combined_score > 0.5 else "negative"
                }
            },
            "status": "active"
        }
