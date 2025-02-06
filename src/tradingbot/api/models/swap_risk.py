from decimal import Decimal
from typing import Dict, Optional

from pydantic import BaseModel, Field

class SwapRiskMetrics(BaseModel):
    dex_liquidity: Dict[str, Decimal] = Field(default_factory=dict)
    total_liquidity: Decimal = Field(default=Decimal("0"))
    cross_dex_spread: Decimal = Field(default=Decimal("0"))
    volume_24h: Decimal = Field(default=Decimal("0"))
    market_impact: Decimal = Field(default=Decimal("0"))
    expected_slippage: Decimal = Field(default=Decimal("0"))
    price_impact: Decimal = Field(default=Decimal("0"))
    liquidity_score: Decimal = Field(default=Decimal("0"))
    volatility_factor: Decimal = Field(default=Decimal("1"))
    correlation_factor: Decimal = Field(default=Decimal("0"))
    risk_level: Decimal = Field(default=Decimal("0"))
    confidence_score: Decimal = Field(default=Decimal("0"))
    market_data_source: str = "gmgn"
    is_stale: bool = False
    rate_limit_info: Dict[str, float] = Field(default_factory=dict)
    recommendations: Optional[Dict[str, str]] = None
