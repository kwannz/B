from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field

from ..models.agent import Agent, AgentStatus
from ..models.base import PyObjectId
from ..models.risk import LimitSettings, RiskMetrics
from ..models.trading import Order, Position, Trade


class AccountResponse(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    balance: Decimal
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OrderResponse(BaseModel):
    order: Order


class OrderListResponse(BaseModel):
    orders: List[Order]
    count: int = Field(...)


class PositionListResponse(BaseModel):
    positions: List[Position]
    count: int = Field(...)


class TradeResponse(BaseModel):
    trade: Trade


class TradeListResponse(BaseModel):
    trades: List[Trade]
    count: int = Field(...)


class AgentResponse(BaseModel):
    agent: Agent


class AgentListResponse(BaseModel):
    agents: List[Agent]
    count: int = Field(...)


class StrategyResponse(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    name: str
    description: Optional[str] = None
    status: str
    config: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StrategyListResponse(BaseModel):
    strategies: List[StrategyResponse]
    count: int = Field(...)


class SignalResponse(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    strategy_id: PyObjectId
    symbol: str
    side: str
    strength: float = Field(..., ge=0, le=1)
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SignalListResponse(BaseModel):
    signals: List[SignalResponse]
    count: int = Field(...)


class LimitSettingsResponse(BaseModel):
    settings: LimitSettings


class RiskMetricsResponse(BaseModel):
    metrics: RiskMetrics


class PerformanceResponse(BaseModel):
    total_pnl: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    win_rate: float
    loss_rate: float
    average_win: Decimal
    average_loss: Decimal
    largest_win: Decimal
    largest_loss: Decimal
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    recovery_factor: float
    profit_factor: float
    metadata: dict = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
