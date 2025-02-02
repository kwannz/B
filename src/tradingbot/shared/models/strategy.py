from datetime import datetime
from enum import Enum, auto
from typing import Dict, Any, Optional

class StrategyStatus(Enum):
    ACTIVE = auto()
    PAUSED = auto()
    STOPPED = auto()
    ERROR = auto()

class Strategy:
    def __init__(
        self,
        strategy_id: str,
        name: str,
        status: StrategyStatus = StrategyStatus.STOPPED,
        config: Optional[Dict[str, Any]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self.strategy_id = strategy_id
        self.name = name
        self.status = status
        self.config = config or {}
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def update_status(self, status: StrategyStatus):
        self.status = status
        self.updated_at = datetime.utcnow()

    def update_config(self, config: Dict[str, Any]):
        self.config.update(config)
        self.updated_at = datetime.utcnow()
