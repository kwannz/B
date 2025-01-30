import json
import pickle
import logging
from typing import Any, Optional, Type, TypeVar, Dict, Union
import redis
from datetime import datetime
from src.shared.monitor.metrics import track_cache_hit, track_cache_miss
from src.shared.models.cache import (
    CacheConfig, MarketDataCache, OrderBookCache,
    TradeHistoryCache, SentimentCache, RateLimitCache,
    ModelOutputCache
)

CacheableType = Union[Dict[str, Any], MarketDataCache, OrderBookCache, TradeHistoryCache, SentimentCache, RateLimitCache, ModelOutputCache]
T = TypeVar('T')

class HybridCache:
    def __init__(self):
        self._memory = {}
        try:
            self._redis = redis.Redis(host='localhost', port=6379, db=0)
            self._redis.ping()
        except (redis.ConnectionError, redis.ResponseError):
            self._redis = None
            logging.warning("Redis connection failed, falling back to memory-only cache")
        
    def get(self, key: str, model_type: Optional[Type[T]] = None) -> Optional[Union[T, Any]]:
        from src.shared.monitor.metrics import track_cache_hit, track_cache_miss
        
        # Check memory cache first
        if key in self._memory:
            track_cache_hit()
            return self._memory[key]
            
        # Try Redis if available
        if self._redis is not None:
            try:
                val = self._redis.get(key)
                if val:
                    try:
                        data = pickle.loads(val)
                        if model_type and isinstance(data, dict):
                            try:
                                data = model_type(**data)
                            except Exception:
                                pass
                        self._memory[key] = data
                        track_cache_hit()
                        return data
                    except Exception:
                        pass
            except Exception as e:
                logging.warning(f"Redis get failed: {str(e)}")
                
        track_cache_miss()
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
        if self._redis is not None:
            try:
                self._redis.delete(key)
            except Exception as e:
                logging.warning(f"Redis delete failed: {str(e)}")
        
    def clear(self):
        self._memory.clear()
        if self._redis is not None:
            try:
                self._redis.flushdb()
            except Exception as e:
                logging.warning(f"Redis flush failed: {str(e)}")

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
