from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from .base import PyObjectId
from .trading import TradeStatus

class TradeCreate(BaseModel):
    symbol: str
    direction: str
    quantity: Decimal
    entry_price: Decimal
    take_profit: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    leverage: Optional[float] = Field(default=1.0)
    metadata: dict = Field(default_factory=dict)

class Trade(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    symbol: str
    direction: str
    quantity: Decimal
    entry_price: Decimal
    exit_price: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    leverage: float = Field(default=1.0)
    status: TradeStatus = Field(default=TradeStatus.PENDING)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
