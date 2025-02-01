"""
Market data router
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from ..core.exceptions import MarketDataError
from ..deps import check_rate_limit, get_db, get_redis
from ..models.market import Kline, MarketDepth, MarketOverview, OrderBook, Ticker, Trade

router = APIRouter()


# Ticker endpoints
@router.get("/ticker/{symbol}", response_model=Ticker)
async def get_ticker(
    symbol: str, redis=Depends(get_redis), _: None = Depends(check_rate_limit)
) -> Ticker:
    """Get ticker for a symbol."""
    # Try to get from cache first
    cached = await redis.get(f"ticker:{symbol}")
    if cached:
        return Ticker.parse_raw(cached)

    raise MarketDataError(message="Ticker data not available")


@router.get("/tickers", response_model=List[Ticker])
async def get_tickers(
    symbols: Optional[List[str]] = Query(None),
    redis=Depends(get_redis),
    _: None = Depends(check_rate_limit),
) -> List[Ticker]:
    """Get tickers for multiple symbols."""
    if not symbols:
        # Get all available tickers
        keys = await redis.keys("ticker:*")
        symbols = [key.split(":")[1] for key in keys]

    tickers = []
    for symbol in symbols:
        cached = await redis.get(f"ticker:{symbol}")
        if cached:
            tickers.append(Ticker.parse_raw(cached))

    return tickers


# Orderbook endpoints
@router.get("/orderbook/{symbol}", response_model=OrderBook)
async def get_orderbook(
    symbol: str,
    depth: int = Query(100, ge=1, le=500),
    redis=Depends(get_redis),
    _: None = Depends(check_rate_limit),
) -> OrderBook:
    """Get orderbook for a symbol."""
    cached = await redis.get(f"orderbook:{symbol}")
    if cached:
        return OrderBook.parse_raw(cached)

    raise MarketDataError(message="Orderbook data not available")


# Recent trades endpoints
@router.get("/trades/{symbol}", response_model=List[Trade])
async def get_trades(
    symbol: str,
    limit: int = Query(100, ge=1, le=1000),
    redis=Depends(get_redis),
    _: None = Depends(check_rate_limit),
) -> List[Trade]:
    """Get recent trades for a symbol."""
    cached = await redis.get(f"trades:{symbol}")
    if cached:
        trades = Trade.parse_raw(cached)
        return trades[:limit]

    raise MarketDataError(message="Trade data not available")


# Kline/candlestick endpoints
@router.get("/klines/{symbol}", response_model=List[Kline])
async def get_klines(
    symbol: str,
    interval: str = Query("1m", regex="^[1-9][0-9]*(m|h|d|w|M)$"),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(500, ge=1, le=1000),
    redis=Depends(get_redis),
    _: None = Depends(check_rate_limit),
) -> List[Kline]:
    """Get kline/candlestick data for a symbol."""
    if not end_time:
        end_time = datetime.utcnow()
    if not start_time:
        start_time = end_time - timedelta(days=1)

    cached = await redis.get(f"klines:{symbol}:{interval}")
    if cached:
        klines = Kline.parse_raw(cached)
        # Filter by time range
        filtered = [k for k in klines if start_time <= k.open_time <= end_time]
        return filtered[:limit]

    raise MarketDataError(message="Kline data not available")


# Market overview endpoints
@router.get("/overview/{symbol}", response_model=MarketOverview)
async def get_market_overview(
    symbol: str, redis=Depends(get_redis), _: None = Depends(check_rate_limit)
) -> MarketOverview:
    """Get market overview for a symbol."""
    cached = await redis.get(f"overview:{symbol}")
    if cached:
        return MarketOverview.parse_raw(cached)

    raise MarketDataError(message="Market overview not available")


# Market depth endpoints
@router.get("/depth/{symbol}", response_model=MarketDepth)
async def get_market_depth(
    symbol: str,
    levels: int = Query(20, ge=1, le=100),
    redis=Depends(get_redis),
    _: None = Depends(check_rate_limit),
) -> MarketDepth:
    """Get market depth for a symbol."""
    cached = await redis.get(f"depth:{symbol}")
    if cached:
        depth = MarketDepth.parse_raw(cached)
        # Limit the number of levels
        depth.bid_depth = depth.bid_depth[:levels]
        depth.ask_depth = depth.ask_depth[:levels]
        return depth

    raise MarketDataError(message="Market depth not available")
