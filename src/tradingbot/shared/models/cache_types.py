from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class CacheConfig:
    DEFAULT_TTL = 300  # 5 minutes
    MIN_CONFIDENCE = 0.7
    MAX_CACHE_SIZE = 10000


class MarketDataCache(BaseModel):
    symbol: str
    price: float
    volume: float = 0.0
    timestamp: datetime


class OrderBookCache(BaseModel):
    symbol: str
    timestamp: datetime
    bids: Dict[float, float]
    asks: Dict[float, float]
    depth: int


class TradeHistoryCache(BaseModel):
    symbol: str
    timestamp: datetime
    trades: list[Dict[str, Any]]
    period: str


class SentimentCache(BaseModel):
    source: str
    timestamp: datetime
    score: float
    confidence: float


class RateLimitCache(BaseModel):
    symbol: str
    timestamp: datetime
    remaining: int
    reset_at: datetime


class ModelOutputCache(BaseModel):
    prompt_hash: str
    output: Dict[str, Any]
    timestamp: datetime
    model_name: str
