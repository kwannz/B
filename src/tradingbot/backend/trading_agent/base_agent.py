from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

class BaseTradingAgent(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.position_size = float(config.get("position_size", 0.1))
        self.is_running = False

    async def start(self):
        """Start the trading agent"""
        self.is_running = True

    async def stop(self):
        """Stop the trading agent"""
        self.is_running = False

    @abstractmethod
    async def execute_strategy(
        self, market_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Execute the trading strategy"""
        pass
