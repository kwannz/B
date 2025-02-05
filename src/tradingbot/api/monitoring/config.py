import os
from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class MonitoringConfig:
    prometheus_port: int = 9090
    grafana_port: int = 3000
    metrics_enabled: bool = True
    log_level: str = "INFO"
    metrics_prefix: str = "tradingbot"
    collection_interval: int = 15
    retention_days: int = 15
    alert_endpoints: Dict[str, str] = None
    
    def __post_init__(self):
        self.alert_endpoints = {
            "slack": os.getenv("ALERT_WEBHOOK_SLACK", ""),
            "discord": os.getenv("ALERT_WEBHOOK_DISCORD", "")
        }

monitoring_config = MonitoringConfig()
