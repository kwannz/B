import json
import pickle
from typing import Any, Optional, Type, TypeVar, Dict, Union
import redis
from datetime import datetime
from shared.models.cache import (
    CacheConfig, MarketDataCache, OrderBookCache,
    TradeHistoryCache, SentimentCache, RateLimitCache
)

CacheableType = Union[Dict[str, Any], MarketDataCache, OrderBookCache, TradeHistoryCache, SentimentCache, RateLimitCache]
T = TypeVar('T')

class HybridCache:
    def __init__(self):
        self._redis = redis.Redis(host='localhost', port=6379, db=0)
        self._memory = {}
        
    def get(self, key: str, model_type: Type[T] = None) -> Optional[T]:
        if key in self._memory:
            return self._memory[key]
            
        val = self._redis.get(key)
        if val:
            try:
                data = pickle.loads(val)
                if model_type:
                    data = model_type.parse_raw(json.dumps(data))
                self._memory[key] = data
                return data
            except Exception:
                return None
        return None
        
    def set(self, key: str, value: Any, ttl: int = CacheConfig.DEFAULT_TTL):
        self._memory[key] = value
        try:
            if isinstance(value, (MarketDataCache, OrderBookCache, TradeHistoryCache, SentimentCache, RateLimitCache)):
                value = json.loads(value.json())
            pickled = pickle.dumps(value)
            self._redis.set(key, pickled, ex=ttl)
        except Exception:
            pass
            
    def delete(self, key: str):
        if key in self._memory:
            del self._memory[key]
        self._redis.delete(key)
        
    def clear(self):
        self._memory.clear()
        self._redis.flushdb()

    def get_market_data(self, symbol: str) -> Optional[MarketDataCache]:
        return self.get(f"market_data:{symbol}", MarketDataCache)
        
    def get_order_book(self, symbol: str) -> Optional[OrderBookCache]:
        return self.get(f"order_book:{symbol}", OrderBookCache)
        
    def get_trade_history(self, symbol: str) -> Optional[TradeHistoryCache]:
        return self.get(f"trade_history:{symbol}", TradeHistoryCache)
        
    def get_sentiment(self, source: str) -> Optional[SentimentCache]:
        return self.get(f"sentiment:{source}", SentimentCache)
        
    def get_rate_limit(self, symbol: str) -> Optional[RateLimitCache]:
        return self.get(f"rate_limit:{symbol}", RateLimitCache)
