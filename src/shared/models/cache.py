from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Union, List
from pydantic import BaseModel, Field

class CacheConfig:
    """Default cache configuration."""
    DEFAULT_TTL = 300  # 5 minutes
    MARKET_DATA_TTL = 60  # 1 minute
    ORDER_BOOK_TTL = 30  # 30 seconds
    TRADE_HISTORY_TTL = 3600  # 1 hour
    SENTIMENT_TTL = 1800  # 30 minutes

class MarketDataCache(BaseModel):
    """Real-time market data cache model."""
    symbol: str
    price: float
    volume: float
    timestamp: datetime
    bid: Optional[float] = None
    ask: Optional[float] = None
    last_trade: Optional[Dict[str, Any]] = None
    liquidity: float = 0.0
    spread: float = 0.0
    volatility: float = 1.0
    market_impact: float = 0.0
    slippage: float = 0.0
    ttl: int = CacheConfig.MARKET_DATA_TTL
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get attribute value with fallback to default."""
        return getattr(self, key, default)

class OrderBookCache(BaseModel):
    """Real-time order book cache model."""
    symbol: str
    timestamp: datetime
    bids: List[Dict[str, float]]
    asks: List[Dict[str, float]]
    depth: int
    ttl: int = CacheConfig.ORDER_BOOK_TTL

class TradeHistoryCache(BaseModel):
    """Recent trades cache model."""
    symbol: str
    trades: List[Dict[str, Any]]
    start_time: datetime
    end_time: datetime
    ttl: int = CacheConfig.TRADE_HISTORY_TTL

class SentimentCache(BaseModel):
    """News sentiment analysis cache model."""
    source: str
    sentiment_score: float
    confidence: float
    timestamp: datetime
    ttl: int = CacheConfig.SENTIMENT_TTL

class RateLimitCache(BaseModel):
    """Rate limit tracking cache model."""
    symbol: str
    requests: list[float] = []  # List of request timestamps
    window_start: float
    limit: int
    window_size: int

class ModelOutputCache(BaseModel):
    """Cache for model generation outputs."""
    prompt_hash: str
    output: Dict[str, Any]
    timestamp: datetime
    model_name: str = "deepseek-1.5b"
    ttl: int = 3600  # 1 hour cache for model outputs
