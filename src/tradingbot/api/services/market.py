"""
Market data service
"""

import asyncio
import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from ..core.exceptions import MarketDataError
from ..models.market import (
    Kline,
    MarketDepth,
    MarketOverview,
    OrderBook,
    PriceLevel,
    Ticker,
    Trade,
)


class MarketDataService:
    """Service for handling market data operations."""

    def __init__(self, redis_client: Any, exchange_client: Any):
        """Initialize market data service."""
        self.redis = redis_client
        self.exchange = exchange_client
        self.cache_ttl = {
            "ticker": 5,  # 5 seconds
            "orderbook": 2,
            "trades": 60,
            "klines": 300,  # 5 minutes
            "overview": 60,
            "depth": 2,
        }

    async def get_ticker(self, symbol: str) -> Ticker:
        """Get ticker for a symbol."""
        # Try cache first
        cached = await self.redis.get(f"ticker:{symbol}")
        if cached:
            return Ticker.parse_raw(cached)

        # Fetch from exchange
        try:
            ticker_data = await self.exchange.get_ticker(symbol)
            ticker = Ticker(**ticker_data)

            # Cache the result
            await self.redis.setex(
                f"ticker:{symbol}", self.cache_ttl["ticker"], ticker.json()
            )
            return ticker
        except Exception as e:
            raise MarketDataError(f"Failed to fetch ticker: {str(e)}")

    async def get_tickers(self, symbols: Optional[List[str]] = None) -> List[Ticker]:
        """Get tickers for multiple symbols."""
        if not symbols:
            # Get all available symbols from exchange
            try:
                symbols = await self.exchange.get_symbols()
            except Exception as e:
                raise MarketDataError(f"Failed to fetch symbols: {str(e)}")

        # Fetch all tickers concurrently
        tasks = [self.get_ticker(symbol) for symbol in symbols]
        tickers = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out any failed requests
        return [t for t in tickers if not isinstance(t, Exception)]

    async def get_orderbook(self, symbol: str, depth: int = 100) -> OrderBook:
        """Get orderbook for a symbol."""
        cached = await self.redis.get(f"orderbook:{symbol}")
        if cached:
            return OrderBook.parse_raw(cached)

        try:
            book_data = await self.exchange.get_orderbook(symbol, depth)
            book = OrderBook(
                symbol=symbol,
                last_update_id=book_data["lastUpdateId"],
                bids=[
                    PriceLevel(price=Decimal(price), quantity=Decimal(qty))
                    for price, qty in book_data["bids"]
                ],
                asks=[
                    PriceLevel(price=Decimal(price), quantity=Decimal(qty))
                    for price, qty in book_data["asks"]
                ],
            )

            await self.redis.setex(
                f"orderbook:{symbol}", self.cache_ttl["orderbook"], book.json()
            )
            return book
        except Exception as e:
            raise MarketDataError(f"Failed to fetch orderbook: {str(e)}")

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Trade]:
        """Get recent trades for a symbol."""
        cached = await self.redis.get(f"trades:{symbol}")
        if cached:
            trades = json.loads(cached)
            return [Trade(**t) for t in trades][:limit]

        try:
            trades_data = await self.exchange.get_trades(symbol, limit)
            trades = [Trade(**t) for t in trades_data]

            await self.redis.setex(
                f"trades:{symbol}",
                self.cache_ttl["trades"],
                json.dumps([t.dict() for t in trades]),
            )
            return trades
        except Exception as e:
            raise MarketDataError(f"Failed to fetch trades: {str(e)}")

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1m",
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 500,
    ) -> List[Kline]:
        """Get kline/candlestick data."""
        cache_key = f"klines:{symbol}:{interval}"
        cached = await self.redis.get(cache_key)

        if cached:
            klines = [Kline(**k) for k in json.loads(cached)]
            # Filter by time range
            if start_time and end_time:
                klines = [k for k in klines if start_time <= k.open_time <= end_time]
            return klines[:limit]

        try:
            klines_data = await self.exchange.get_klines(
                symbol, interval, start_time, end_time, limit
            )
            klines = [Kline(**k) for k in klines_data]

            await self.redis.setex(
                cache_key,
                self.cache_ttl["klines"],
                json.dumps([k.dict() for k in klines]),
            )
            return klines
        except Exception as e:
            raise MarketDataError(f"Failed to fetch klines: {str(e)}")

    async def get_market_overview(self, symbol: str) -> MarketOverview:
        """Get market overview."""
        cached = await self.redis.get(f"overview:{symbol}")
        if cached:
            return MarketOverview.parse_raw(cached)

        try:
            # Fetch required data concurrently
            ticker, trades, day_stats = await asyncio.gather(
                self.get_ticker(symbol),
                self.get_trades(symbol, 1),
                self.exchange.get_24h_stats(symbol),
            )

            overview = MarketOverview(
                symbol=symbol,
                price_change_stats={
                    "1h": day_stats["1h_change"],
                    "24h": day_stats["24h_change"],
                    "7d": day_stats["7d_change"],
                },
                volume_stats={
                    "1h": day_stats["1h_volume"],
                    "24h": day_stats["24h_volume"],
                    "7d": day_stats["7d_volume"],
                },
                high_low_stats={
                    "1h": {"high": day_stats["1h_high"], "low": day_stats["1h_low"]},
                    "24h": {"high": day_stats["24h_high"], "low": day_stats["24h_low"]},
                    "7d": {"high": day_stats["7d_high"], "low": day_stats["7d_low"]},
                },
                last_trade=trades[0] if trades else None,
            )

            await self.redis.setex(
                f"overview:{symbol}", self.cache_ttl["overview"], overview.json()
            )
            return overview
        except Exception as e:
            raise MarketDataError(f"Failed to fetch market overview: {str(e)}")

    async def get_market_depth(self, symbol: str, levels: int = 20) -> MarketDepth:
        """Get market depth."""
        cached = await self.redis.get(f"depth:{symbol}")
        if cached:
            depth = MarketDepth.parse_raw(cached)
            # Limit the number of levels
            depth.bid_depth = depth.bid_depth[:levels]
            depth.ask_depth = depth.ask_depth[:levels]
            return depth

        try:
            depth_data = await self.exchange.get_depth(symbol, levels)
            depth = MarketDepth(
                symbol=symbol,
                last_update_id=depth_data["lastUpdateId"],
                bid_depth=[
                    PriceLevel(price=Decimal(price), quantity=Decimal(qty))
                    for price, qty in depth_data["bids"]
                ],
                ask_depth=[
                    PriceLevel(price=Decimal(price), quantity=Decimal(qty))
                    for price, qty in depth_data["asks"]
                ],
            )

            await self.redis.setex(
                f"depth:{symbol}", self.cache_ttl["depth"], depth.json()
            )
            return depth
        except Exception as e:
            raise MarketDataError(f"Failed to fetch market depth: {str(e)}")

    async def update_cache(self, symbol: str):
        """Update cache for all market data types."""
        tasks = [
            self.get_ticker(symbol),
            self.get_orderbook(symbol),
            self.get_trades(symbol),
            self.get_klines(symbol),
            self.get_market_overview(symbol),
            self.get_market_depth(symbol),
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
