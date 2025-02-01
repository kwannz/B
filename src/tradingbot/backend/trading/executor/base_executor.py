from datetime import datetime
from typing import Any, Dict, Optional

from src.shared.models.errors import TradingError


class BaseExecutor:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()
        self._validate_config()

    def _validate_config(self) -> None:
        required_fields = ["strategy_type", "risk_level", "trade_size"]
        missing_fields = [
            field for field in required_fields if field not in self.config
        ]
        if missing_fields:
            raise TradingError(
                f"Missing required config fields: {', '.join(missing_fields)}"
            )

    async def execute_trade(self, trade_params: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("Subclasses must implement execute_trade")

    async def cancel_trade(self, trade_id: str) -> bool:
        raise NotImplementedError("Subclasses must implement cancel_trade")

    async def get_trade_status(self, trade_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement get_trade_status")

    async def start(self) -> bool:
        self.status = "active"
        self.last_update = datetime.now().isoformat()
        return True

    async def stop(self) -> bool:
        self.status = "inactive"
        self.last_update = datetime.now().isoformat()
        return True

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "last_update": self.last_update,
            "config": self.config,
        }
