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
        return {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "sentiment": {},
            "status": "pending_implementation"
        }
