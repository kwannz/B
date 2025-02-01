"""
Trading related models for order and position management
"""

from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
from decimal import Decimal
from pydantic import BaseModel, Field, validator, root_validator
from bson import ObjectId

from .base import PyObjectId


class OrderType(str, Enum):
    """Order type enumeration."""

    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP_LOSS = "STOP_LOSS"
    TAKE_PROFIT = "TAKE_PROFIT"
    STOP_LOSS_LIMIT = "STOP_LOSS_LIMIT"
    TAKE_PROFIT_LIMIT = "TAKE_PROFIT_LIMIT"


class OrderSide(str, Enum):
    """Order side enumeration."""

    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, Enum):
    """Order status enumeration."""

    PENDING = "PENDING"
    OPEN = "OPEN"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class PositionSide(str, Enum):
    """Position side enumeration."""

    LONG = "LONG"
    SHORT = "SHORT"


class PositionStatus(str, Enum):
    """Position status enumeration."""

    OPEN = "OPEN"
    CLOSED = "CLOSED"
    LIQUIDATED = "LIQUIDATED"


class MarketType(str, Enum):
    """Market type enumeration."""

    SPOT = "SPOT"
    MARGIN = "MARGIN"
    FUTURES = "FUTURES"
    DEX = "DEX"
    MEME = "MEME"


class OrderBase(BaseModel):
    """Base order model."""

    symbol: str
    type: OrderType
    side: OrderSide
    amount: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    time_in_force: str = Field("GTC", regex="^(GTC|IOC|FOK)$")
    reduce_only: bool = False
    post_only: bool = False
    leverage: Optional[float] = Field(None, ge=1)

    # DEX specific fields
    wallet_address: Optional[str] = None
    gas_price: Optional[int] = None
    gas_limit: Optional[int] = None
    nonce: Optional[int] = None

    # Meme token specific fields
    slippage_tolerance: Optional[float] = Field(None, ge=0, le=100)
    social_volume_threshold: Optional[int] = None
    sentiment_threshold: Optional[float] = Field(None, ge=-1, le=1)

    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("price", "stop_price")
    def validate_prices(cls, v, values):
        """Validate price fields based on order type."""
        order_type = values.get("type")
        if order_type in [
            OrderType.LIMIT,
            OrderType.STOP_LOSS_LIMIT,
            OrderType.TAKE_PROFIT_LIMIT,
        ]:
            if not v or v <= 0:
                raise ValueError(f"Price is required for {order_type} orders")
        return v


class OrderCreate(OrderBase):
    """Order creation model."""

    user_id: PyObjectId
    strategy_id: Optional[PyObjectId] = None
    position_id: Optional[PyObjectId] = None


class Order(OrderBase):
    """Complete order model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    strategy_id: Optional[PyObjectId] = None
    position_id: Optional[PyObjectId] = None

    status: OrderStatus = OrderStatus.PENDING
    filled_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    average_fill_price: Optional[Decimal] = None

    # Execution details
    execution_started_at: Optional[datetime] = None
    last_execution_at: Optional[datetime] = None
    execution_attempts: int = 0
    execution_logs: List[Dict[str, Any]] = Field(default_factory=list)

    # Transaction details
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    gas_used: Optional[int] = None
    gas_price_used: Optional[int] = None

    fees: Dict[str, Decimal] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True


class Position(BaseModel):
    """Position model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    strategy_id: Optional[PyObjectId] = None

    symbol: str
    side: PositionSide
    status: PositionStatus = PositionStatus.OPEN
    market_type: MarketType

    # Position details
    entry_price: Decimal
    current_price: Decimal
    amount: Decimal
    leverage: Optional[float] = Field(None, ge=1)

    # PnL tracking
    unrealized_pnl: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    fees_paid: Decimal = Decimal("0")

    # Risk management
    stop_loss_price: Optional[Decimal] = None
    take_profit_price: Optional[Decimal] = None
    liquidation_price: Optional[Decimal] = None
    margin_ratio: Optional[float] = None

    # DEX specific fields
    pool_address: Optional[str] = None
    token_address: Optional[str] = None

    # Meme token specific fields
    social_sentiment: Optional[float] = Field(None, ge=-1, le=1)
    viral_score: Optional[float] = Field(None, ge=0, le=100)
    whale_holdings: Optional[Decimal] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True


class Trade(BaseModel):
    """Trade model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    order_id: PyObjectId
    position_id: Optional[PyObjectId] = None

    symbol: str
    side: OrderSide
    amount: Decimal
    price: Decimal

    # Trade details
    fee_asset: str
    fee_amount: Decimal
    realized_pnl: Optional[Decimal] = None

    # Market impact
    slippage: float = Field(0, ge=0)
    price_impact: float = Field(0, ge=0)
    liquidity_score: float = Field(0, ge=0, le=100)

    # Transaction details
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    gas_used: Optional[int] = None

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True
