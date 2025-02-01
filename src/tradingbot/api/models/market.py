"""
Market data models and schemas
"""

from typing import List, Optional, Dict
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field, validator


class PriceLevel(BaseModel):
    """Price level in orderbook."""

    price: Decimal
    quantity: Decimal


class Ticker(BaseModel):
    """Ticker information for a symbol."""

    symbol: str
    price: Decimal
    price_change: Decimal
    price_change_percent: Decimal
    weighted_avg_price: Decimal
    prev_close_price: Decimal
    last_price: Decimal
    last_qty: Decimal
    bid_price: Decimal
    ask_price: Decimal
    open_price: Decimal
    high_price: Decimal
    low_price: Decimal
    volume: Decimal
    quote_volume: Decimal
    open_time: datetime
    close_time: datetime
    first_id: int  # First tradeId
    last_id: int  # Last tradeId
    count: int  # Trade count


class OrderBook(BaseModel):
    """Order book for a symbol."""

    symbol: str
    last_update_id: int
    bids: List[PriceLevel]
    asks: List[PriceLevel]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator("bids", "asks")
    def sort_levels(cls, v):
        """Sort bids descending and asks ascending by price."""
        return sorted(v, key=lambda x: x.price, reverse=True if v == "bids" else False)


class Trade(BaseModel):
    """Individual trade information."""

    symbol: str
    id: int
    price: Decimal
    qty: Decimal
    quote_qty: Decimal
    time: datetime
    is_buyer_maker: bool
    is_best_match: bool


class Kline(BaseModel):
    """Candlestick/kline data."""

    symbol: str
    open_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    close_time: datetime
    quote_asset_volume: Decimal
    number_of_trades: int
    taker_buy_base_asset_volume: Decimal
    taker_buy_quote_asset_volume: Decimal


class MarketOverview(BaseModel):
    """Market overview information."""

    symbol: str
    price_change_stats: Dict[str, Decimal] = Field(
        description="Price change statistics for different time periods (1h, 24h, 7d)"
    )
    volume_stats: Dict[str, Decimal] = Field(
        description="Volume statistics for different time periods"
    )
    high_low_stats: Dict[str, Dict[str, Decimal]] = Field(
        description="High/low statistics for different time periods"
    )
    last_trade: Trade
    last_update: datetime = Field(default_factory=datetime.utcnow)


class MarketDepth(BaseModel):
    """Market depth information."""

    symbol: str
    last_update_id: int
    bid_depth: List[PriceLevel]  # Sorted by price descending
    ask_depth: List[PriceLevel]  # Sorted by price ascending
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator("bid_depth")
    def sort_bids(cls, v):
        """Sort bids by price descending."""
        return sorted(v, key=lambda x: x.price, reverse=True)

    @validator("ask_depth")
    def sort_asks(cls, v):
        """Sort asks by price ascending."""
        return sorted(v, key=lambda x: x.price)
