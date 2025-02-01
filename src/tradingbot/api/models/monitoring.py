"""
Monitoring related models for system metrics and alerts
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, validator

from .base import PyObjectId
from .trading import Order, Position


class AlertType(str, Enum):
    """Alert type enumeration."""

    SYSTEM = "SYSTEM"
    TRADING = "TRADING"
    RISK = "RISK"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"
    MARKET = "MARKET"


class AlertStatus(str, Enum):
    """Alert status enumeration."""

    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    EXPIRED = "EXPIRED"


class AlertPriority(str, Enum):
    """Alert priority enumeration."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Alert(BaseModel):
    """Alert model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    type: AlertType
    status: AlertStatus = AlertStatus.ACTIVE
    priority: AlertPriority
    title: str
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True


class SystemMetrics(BaseModel):
    """System metrics model."""

    cpu_usage: float = Field(..., ge=0, le=100)
    memory_usage: float = Field(..., ge=0, le=100)
    disk_usage: float = Field(..., ge=0, le=100)
    network_latency: float  # in milliseconds
    active_connections: int
    request_rate: float  # requests per second
    error_rate: float  # errors per second
    database_connections: int
    cache_hit_rate: float
    message_queue_size: int
    system_uptime: float  # in seconds
    last_backup_time: Optional[datetime]
    component_status: Dict[str, bool]  # key: component name, value: is healthy
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TradingMetrics(BaseModel):
    """Trading metrics model."""

    total_orders: int = 0
    filled_orders: int = 0
    cancelled_orders: int = 0
    failed_orders: int = 0
    active_positions: int = 0
    pending_orders: int = 0
    total_volume: Decimal = Decimal("0")
    buy_volume: Decimal = Decimal("0")
    sell_volume: Decimal = Decimal("0")
    average_fill_time: float = 0  # in seconds
    order_success_rate: float = 0  # percentage
    slippage_average: float = 0  # percentage
    commission_total: Decimal = Decimal("0")
    profit_loss: Decimal = Decimal("0")
    margin_used: Decimal = Decimal("0")
    margin_available: Decimal = Decimal("0")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator("order_success_rate")
    def validate_success_rate(cls, v):
        """Validate success rate is between 0 and 100."""
        if not 0 <= v <= 100:
            raise ValueError("Success rate must be between 0 and 100")
        return v


class PerformanceMetrics(BaseModel):
    """Performance metrics model."""

    total_pnl: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    unrealized_pnl: Decimal = Decimal("0")
    win_rate: float = 0  # percentage
    loss_rate: float = 0  # percentage
    average_win: Decimal = Decimal("0")
    average_loss: Decimal = Decimal("0")
    largest_win: Decimal = Decimal("0")
    largest_loss: Decimal = Decimal("0")
    sharpe_ratio: float = 0
    sortino_ratio: float = 0
    max_drawdown: float = 0  # percentage
    max_drawdown_duration: int = 0  # in days
    recovery_factor: float = 0
    profit_factor: float = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator("win_rate", "loss_rate")
    def validate_rate(cls, v):
        """Validate rate is between 0 and 100."""
        if not 0 <= v <= 100:
            raise ValueError("Rate must be between 0 and 100")
        return v


class HealthCheck(BaseModel):
    """Health check model."""

    component: str
    status: bool
    message: Optional[str]
    last_check: datetime = Field(default_factory=datetime.utcnow)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    error_count: int = 0
    warning_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MonitoringReport(BaseModel):
    """Comprehensive monitoring report model."""

    user_id: PyObjectId
    system_metrics: Optional[SystemMetrics]
    trading_metrics: TradingMetrics
    performance_metrics: PerformanceMetrics
    risk_metrics: Dict[str, Any]  # from risk management service
    alerts: List[Alert]
    recommendations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True
