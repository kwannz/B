import os
from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class MonitoringConfig:
    prometheus_port: int = 9090
    grafana_port: int = 3000
    metrics_enabled: bool = True
    swap_metrics_enabled: bool = True
    log_level: str = "INFO"
    metrics_prefix: str = "tradingbot"
    collection_interval: int = 15
    swap_metrics_interval: int = 15
    retention_days: int = 15
    alert_endpoints: Dict[str, str] = None
    swap_risk_thresholds: Dict[str, float] = None
    
    def __post_init__(self):
        self.alert_endpoints = {
            "slack": os.getenv("ALERT_WEBHOOK_SLACK", ""),
            "discord": os.getenv("ALERT_WEBHOOK_DISCORD", "")
        }
        self.swap_risk_thresholds = {
            "max_slippage": float(os.getenv("SWAP_MAX_SLIPPAGE", "0.02")),
            "min_liquidity": float(os.getenv("SWAP_MIN_LIQUIDITY", "1000.0")),
            "max_risk_level": float(os.getenv("SWAP_MAX_RISK_LEVEL", "0.8")),
            "min_confidence": float(os.getenv("SWAP_MIN_CONFIDENCE", "0.7"))
        }

monitoring_config = MonitoringConfig()
