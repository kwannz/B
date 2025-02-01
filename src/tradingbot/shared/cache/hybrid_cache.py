import json
import pickle
import logging
from typing import Any, Optional, Type, TypeVar, Dict, Union
import redis
from datetime import datetime, timezone
from src.shared.monitor.metrics import track_cache_hit, track_cache_miss
from src.shared.models.cache_types import (
    CacheConfig,
    MarketDataCache,
    OrderBookCache,
    TradeHistoryCache,
    SentimentCache,
    RateLimitCache,
    ModelOutputCache,
)

CacheableType = Union[
    Dict[str, Any],
    MarketDataCache,
    OrderBookCache,
    TradeHistoryCache,
    SentimentCache,
    RateLimitCache,
    ModelOutputCache,
]
T = TypeVar("T")


class HybridCache:
    def __init__(self, use_redis=True):
        self._memory = {}
        self._redis = None
        self._use_redis = False
        if use_redis:
            try:
                self._redis = redis.Redis(host="localhost", port=6379, db=0)
                self._redis.ping()
                self._use_redis = True
            except (redis.ConnectionError, redis.ResponseError):
                logging.warning(
                    "Redis connection failed, falling back to memory-only cache"
                )
                self._redis = None

    def get(
        self, key: str, model_type: Optional[Type[T]] = None
    ) -> Optional[Union[T, Any]]:
        from src.shared.monitor.metrics import track_cache_hit, track_cache_miss

        # Check memory cache first
        if key in self._memory:
            data = self._memory[key]
            if model_type and isinstance(data, dict):
                try:
                    if model_type == MarketDataCache:
                        if "timestamp" not in data:
                            data["timestamp"] = datetime.now(timezone.utc)
                        elif isinstance(data["timestamp"], (int, float)):
                            data["timestamp"] = datetime.fromtimestamp(
                                data["timestamp"], tz=timezone.utc
                            )
                        if "volume" not in data:
                            data["volume"] = 0.0
                    data = model_type(**data)
                    self._memory[key] = data
                except Exception as e:
                    logging.warning(
                        f"Failed to convert data to {model_type.__name__}: {str(e)}"
                    )
                    return None
            track_cache_hit()
            return data

        # Try Redis if available
        if self._redis is not None and self._use_redis:
            try:
                val = self._redis.get(key)
                if val:
                    try:
                        data = pickle.loads(val)
                        if model_type and isinstance(data, dict):
                            try:
                                if model_type == MarketDataCache:
                                    if "timestamp" not in data:
                                        data["timestamp"] = datetime.now()
                                    if "volume" not in data:
                                        data["volume"] = 0.0
                                data = model_type(**data)
                            except Exception as e:
                                logging.warning(
                                    f"Failed to convert Redis data to {model_type.__name__}: {str(e)}"
                                )
                                return None
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
        if ttl <= 0:
            self.delete(key)
            return

        self._memory[key] = value
        if self._redis is not None and self._use_redis:
            try:
                if isinstance(
                    value,
                    (
                        MarketDataCache,
                        OrderBookCache,
                        TradeHistoryCache,
                        SentimentCache,
                        RateLimitCache,
                    ),
                ):
                    value = json.loads(value.json())
                pickled = pickle.dumps(value)
                self._redis.set(key, pickled, ex=ttl)
            except Exception as e:
                logging.warning(f"Redis set failed for key {key}: {str(e)}")

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

    def invalidate(self, key: str):
        """Alias for delete to maintain compatibility with existing code"""
        self.delete(key)

    def get_market_data(self, symbol: str) -> Optional[MarketDataCache]:
        data = self.get(f"market_data:{symbol}", MarketDataCache)
        return data if isinstance(data, MarketDataCache) else None

    def get_order_book(self, symbol: str) -> Optional[OrderBookCache]:
        data = self.get(f"order_book:{symbol}")
        if isinstance(data, dict):
            try:
                return OrderBookCache(**data)
            except Exception:
                return None
        return data if isinstance(data, OrderBookCache) else None

    def get_trade_history(self, symbol: str) -> Optional[TradeHistoryCache]:
        data = self.get(f"trade_history:{symbol}")
        if isinstance(data, dict):
            try:
                return TradeHistoryCache(**data)
            except Exception:
                return None
        return data if isinstance(data, TradeHistoryCache) else None

    def get_sentiment(self, source: str) -> Optional[SentimentCache]:
        data = self.get(f"sentiment:{source}")
        if isinstance(data, dict):
            try:
                return SentimentCache(**data)
            except Exception:
                return None
        return data if isinstance(data, SentimentCache) else None

    def get_rate_limit(self, symbol: str) -> Optional[RateLimitCache]:
        data = self.get(f"rate_limit:{symbol}")
        if isinstance(data, dict):
            try:
                return RateLimitCache(**data)
            except Exception:
                return None
        return data if isinstance(data, RateLimitCache) else None
