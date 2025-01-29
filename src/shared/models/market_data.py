from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

class MarketData(BaseModel):
    """Raw market data model for MongoDB storage."""
    symbol: str
    exchange: str
    timestamp: datetime
    price: float
    volume: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    trades: List[Dict[str, Any]] = Field(default_factory=list)
    order_book: Dict[str, List[Dict[str, float]]] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        arbitrary_types_allowed = True

class MarketMetrics(BaseModel):
    """Market metrics model for MongoDB storage."""
    symbol: str
    timestamp: datetime
    volatility: float
    volume_profile: Dict[str, float]
    liquidity_score: float
    momentum_indicators: Dict[str, float] = Field(default_factory=dict)
    technical_indicators: Dict[str, float] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        arbitrary_types_allowed = True

class TradingSignal(BaseModel):
    """Trading signal model for MongoDB storage."""
    symbol: str
    timestamp: datetime
    signal_type: str
    confidence: float
    direction: str  # buy/sell
    strength: float
    timeframe: str
    indicators_used: List[str]
    analysis_data: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        arbitrary_types_allowed = True
