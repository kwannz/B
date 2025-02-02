"""
Risk management related models
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, root_validator, validator

from .base import PyObjectId
from .trading import Order, Position


class RiskLevel(str, Enum):
    """Risk level enumeration."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskType(str, Enum):
    """Risk type enumeration."""

    MARKET = "MARKET"
    CREDIT = "CREDIT"
    LIQUIDITY = "LIQUIDITY"
    OPERATIONAL = "OPERATIONAL"
    REGULATORY = "REGULATORY"


class RiskMetrics(BaseModel):
    """Risk metrics model."""

    # Value at Risk metrics
    var_95: Decimal = Field(..., description="95% Value at Risk")
    var_99: Decimal = Field(..., description="99% Value at Risk")
    cvar_95: Decimal = Field(..., description="95% Conditional VaR")
    expected_shortfall: Decimal = Field(..., description="Expected Shortfall")

    # Volatility metrics
    volatility: float = Field(..., ge=0, description="Portfolio volatility")
    beta: float = Field(..., description="Portfolio beta")
    correlation: float = Field(..., ge=-1, le=1, description="Correlation with market")

    # Position risk metrics
    position_concentration: float = Field(
        ..., ge=0, le=100, description="Position concentration %"
    )
    leverage_ratio: float = Field(..., ge=0, description="Current leverage ratio")
    margin_usage: float = Field(..., ge=0, le=100, description="Margin usage %")

    # Liquidity risk metrics
    liquidity_score: float = Field(..., ge=0, le=100, description="Liquidity score")
    avg_spread: float = Field(..., ge=0, description="Average spread")
    slippage_impact: float = Field(..., ge=0, description="Estimated slippage impact")

    # Market risk metrics
    delta: float = Field(..., description="Portfolio delta")
    gamma: float = Field(..., description="Portfolio gamma")
    vega: float = Field(..., description="Portfolio vega")
    theta: float = Field(..., description="Portfolio theta")

    # Additional metrics
    stress_test_loss: Decimal = Field(..., description="Stress test potential loss")
    risk_adjusted_return: float = Field(..., description="Risk-adjusted return")
    diversification_score: float = Field(
        ..., ge=0, le=100, description="Portfolio diversification"
    )

    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @validator(
        "liquidity_score",
        "position_concentration",
        "margin_usage",
        "diversification_score",
    )
    def validate_percentage(cls, v):
        """Validate percentage is between 0 and 100."""
        if not 0 <= v <= 100:
            raise ValueError("Percentage must be between 0 and 100")
        return v


class RiskLimit(BaseModel):
    """Risk limit model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId

    # Position limits
    max_position_size: Decimal = Field(..., gt=0)
    max_single_position_size: Decimal = Field(..., gt=0)
    max_leverage: float = Field(..., gt=0)
    max_drawdown: float = Field(..., gt=0)
    max_daily_loss: Decimal = Field(..., gt=0)

    # Portfolio limits
    max_portfolio_var: Decimal = Field(..., gt=0)
    max_correlation: float = Field(..., ge=-1, le=1)
    min_liquidity_score: float = Field(..., ge=0, le=100)
    max_concentration: float = Field(..., ge=0, le=100)

    # Trading limits
    max_daily_trades: int = Field(..., gt=0)
    max_order_size: Decimal = Field(..., gt=0)
    min_order_size: Decimal = Field(..., gt=0)
    max_slippage: float = Field(..., ge=0)

    # Market limits
    allowed_markets: List[str] = Field(default_factory=list)
    trading_hours_start: int = Field(..., ge=0, le=23)
    trading_hours_end: int = Field(..., ge=0, le=23)

    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @root_validator
    def validate_trading_hours(cls, values):
        """Validate trading hours."""
        start = values.get("trading_hours_start")
        end = values.get("trading_hours_end")
        if start is not None and end is not None:
            if start >= end:
                raise ValueError("Trading hours start must be before end")
        return values

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True


class RiskProfile(BaseModel):
    """User risk profile model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId

    # Risk tolerance settings
    risk_tolerance: RiskLevel
    investment_horizon: str = Field(..., pattern="^(SHORT|MEDIUM|LONG)_TERM$")
    max_drawdown_tolerance: float = Field(..., ge=0, le=100)
    target_annual_return: float = Field(..., ge=0)

    # Trading preferences
    preferred_markets: List[str] = Field(default_factory=list)
    excluded_markets: List[str] = Field(default_factory=list)
    max_positions: int = Field(..., gt=0)
    preferred_position_duration: str = Field(..., pattern="^(INTRADAY|SWING|POSITION)$")

    # Risk management preferences
    stop_loss_type: str = Field(..., pattern="^(FIXED|TRAILING|ATR)$")
    take_profit_type: str = Field(..., pattern="^(FIXED|TRAILING|RR_RATIO)$")
    position_sizing_type: str = Field(..., pattern="^(FIXED|RISK_BASED|KELLY)$")

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}
        allow_population_by_field_name = True


class RiskAssessment(BaseModel):
    """Risk assessment model."""

    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId

    # Current state
    current_positions: List[Position]
    open_orders: List[Order]
    portfolio_value: Decimal
    margin_used: Decimal

    # Risk metrics
    risk_metrics: RiskMetrics
    limit_breaches: List[Dict[str, Any]] = Field(default_factory=list)
    risk_level: RiskLevel

    # Analysis
    risk_factors: List[Dict[str, Any]] = Field(default_factory=list)
    stress_test_results: Dict[str, Any] = Field(default_factory=dict)
    scenario_analysis: Dict[str, Any] = Field(default_factory=dict)

    # Recommendations
    risk_warnings: List[str] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    position_adjustments: List[Dict[str, Any]] = Field(default_factory=list)

    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        """Pydantic config."""

        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat(), Decimal: str}
        allow_population_by_field_name = True
