from typing import Dict, Any, List
from datetime import datetime
import pandas as pd
import numpy as np
from .base_agent import BaseAgent
from src.shared.db.database_manager import DatabaseManager
from src.shared.models.deepseek import DeepSeek1_5B
from src.shared.utils.fallback_manager import FallbackManager

class TechnicalAnalystAgent(BaseAgent):
    def __init__(self, agent_id: str, name: str, config: Dict[str, Any]):
        super().__init__(agent_id, name, config)
        self.indicators = config.get('indicators', ['rsi', 'macd', 'bollinger'])
        self.timeframes = config.get('timeframes', ['1h', '4h', '1d'])
        self.symbols = config.get('symbols', ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
        self.model = DeepSeek1_5B(quantized=True)
        
        class LegacyTechnicalSystem:
            async def process(self, request: str) -> Dict[str, Any]:
                return {"text": '{"signal": "neutral", "confidence": 0.5}', "confidence": 0.5}
                
        self.fallback_manager = FallbackManager(self.model, LegacyTechnicalSystem())

    async def start(self):
        self.status = "active"
        self.last_update = datetime.now().isoformat()

    async def stop(self):
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()

    async def update_config(self, new_config: Dict[str, Any]):
        self.config = new_config
        self.indicators = new_config.get('indicators', self.indicators)
        self.timeframes = new_config.get('timeframes', self.timeframes)
        self.symbols = new_config.get('symbols', self.symbols)
        self.last_update = datetime.now().isoformat()

    async def analyze_technicals(self, symbol: str) -> Dict[str, Any]:
        # Check cache first
        cached_analysis = self.cache.get(f"technical_analysis:{symbol}")
        if cached_analysis:
            return cached_analysis

        if not hasattr(self, 'db_manager'):
            self.db_manager = DatabaseManager(
                mongodb_url=self.config['mongodb_url'],
                postgres_url=self.config['postgres_url']
            )

        # Get historical market data from MongoDB
        cursor = self.db_manager.mongodb.market_snapshots.find(
            {"symbol": symbol}
        ).sort("timestamp", -1).limit(100)  # Get last 100 data points
        
        market_data = await cursor.to_list(length=100)
        if not market_data:
            return {
                "symbol": symbol,
                "timestamp": datetime.now().isoformat(),
                "indicators": {},
                "status": "no_data"
            }

        # Convert to pandas DataFrame for technical analysis
        df = pd.DataFrame(market_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Calculate technical indicators
        indicators = {}
        
        # RSI
        if 'rsi' in self.indicators:
            delta = df['price'].astype(float).diff()
            gain = (delta.where(delta > 0, 0.0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0.0)).rolling(window=14).mean()
            rs = gain / loss
            indicators['rsi'] = float(100 - (100 / (1 + rs.iloc[-1])))

        # MACD
        if 'macd' in self.indicators:
            exp1 = df['price'].ewm(span=12, adjust=False).mean()
            exp2 = df['price'].ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=9, adjust=False).mean()
            indicators['macd'] = {
                'macd': macd.iloc[-1],
                'signal': signal.iloc[-1],
                'histogram': macd.iloc[-1] - signal.iloc[-1]
            }

        # Bollinger Bands
        if 'bollinger' in self.indicators:
            sma = df['price'].rolling(window=20).mean()
            std = df['price'].rolling(window=20).std()
            indicators['bollinger'] = {
                'middle': sma.iloc[-1],
                'upper': sma.iloc[-1] + (2 * std.iloc[-1]),
                'lower': sma.iloc[-1] - (2 * std.iloc[-1])
            }

        analysis_result = {
            "symbol": symbol,
            "timestamp": datetime.now().isoformat(),
            "indicators": indicators,
            "status": "active"
        }

        # Store analysis in MongoDB
        await self.db_manager.mongodb.technical_analysis.insert_one({
            **analysis_result,
            "meta_info": {
                "data_points": len(market_data),
                "timeframe": self.timeframes[0] if self.timeframes else "1h"
            }
        })

        # Cache the analysis result
        self.cache.set(f"technical_analysis:{symbol}", analysis_result)
        return analysis_result
