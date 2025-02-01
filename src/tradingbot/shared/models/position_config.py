from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TokenPositionConfig(BaseModel):
    base_size: float = Field(
        default=1000.0, description="Base position size for this token"
    )
    size_multiplier: float = Field(
        default=1.0, description="Multiplier applied to base size"
    )
    max_position_percent: float = Field(
        default=0.2, description="Maximum position size as percentage of total capital"
    )
    risk_based_sizing: bool = Field(
        default=True, description="Enable risk-based position sizing"
    )
    volatility_adjustment: bool = Field(
        default=True, description="Enable volatility-based size adjustment"
    )
    staged_entry: bool = Field(
        default=False, description="Enable staged entry positions"
    )
    entry_stages: List[float] = Field(
        default=[0.5, 0.3, 0.2],
        description="Position size percentage for each entry stage",
    )
    profit_targets: List[float] = Field(
        default=[2.0, 3.0, 5.0],
        description="Price multiplier targets for taking profit",
    )
    size_per_stage: List[float] = Field(
        default=[0.2, 0.25, 0.2],
        description="Percentage of position to sell at each target",
    )


class PositionConfig(BaseModel):
    base_size: float = Field(default=1000.0, description="Default base position size")
    size_multiplier: float = Field(default=1.0, description="Default size multiplier")
    max_position_percent: float = Field(
        default=0.2, description="Default maximum position percentage"
    )
    risk_based_sizing: bool = Field(
        default=True, description="Enable risk-based sizing by default"
    )
    volatility_adjustment: bool = Field(
        default=True, description="Enable volatility adjustment by default"
    )
    staged_entry: bool = Field(
        default=False, description="Enable staged entries by default"
    )
    entry_stages: List[float] = Field(
        default=[0.5, 0.3, 0.2], description="Default entry stage percentages"
    )
    profit_targets: List[float] = Field(
        default=[2.0, 3.0, 5.0], description="Default profit target multipliers"
    )
    size_per_stage: List[float] = Field(
        default=[0.2, 0.25, 0.2], description="Default size percentages per stage"
    )
    per_token_limits: Dict[str, TokenPositionConfig] = Field(
        default_factory=dict, description="Token-specific configurations"
    )


class StageEntry(BaseModel):
    price: float = Field(..., description="Entry price for this stage")
    target_price: float = Field(..., description="Target price for taking profit")
    size: float = Field(..., description="Position size for this stage")
    executed: bool = Field(
        default=False, description="Whether this stage has been executed"
    )


class PositionEntry(BaseModel):
    symbol: str = Field(..., description="Trading pair symbol")
    trade_id: Optional[str] = Field(None, description="Associated trade ID")
    entry_price: float = Field(..., description="Initial entry price")
    total_size: float = Field(..., description="Total position size")
    stages: List[StageEntry] = Field(
        default_factory=list, description="Staged entry details"
    )
    timestamp: str = Field(..., description="Entry timestamp")
