from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict


class AlertType(Enum):
    VOLUME_SURGE = "volume_surge"
    PRICE_SPIKE = "price_spike"
    LIQUIDITY_DROP = "liquidity_drop"
    SENTIMENT_CHANGE = "sentiment_change"
    MARKET_CAP_THRESHOLD = "market_cap_threshold"


class AlertSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Alert:
    type: AlertType
    severity: AlertSeverity
    token: str
    message: str
    data: Dict[str, Any]
