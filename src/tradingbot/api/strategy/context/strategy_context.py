"""
Strategy context for managing strategy execution state and dependencies
"""

from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis import Redis

from ...models.trading import Position, Order, MarketType
from ...models.risk import RiskMetrics, RiskLimit
from ...core.exceptions import ValidationError


class StrategyContext:
    """Strategy execution context."""

    def __init__(
        self,
        strategy_id: str,
        user_id: str,
        db: AsyncIOMotorDatabase,
        redis: Redis,
        config: Dict[str, Any],
    ):
        """Initialize strategy context."""
        self.strategy_id = strategy_id
        self.user_id = user_id
        self.db = db
        self.redis = redis
        self.config = config
        self.start_time = datetime.utcnow()
        self.metrics: Dict[str, Any] = {}
        self.state: Dict[str, Any] = {}
        self.signals: Dict[str, Any] = {}

    async def load_positions(self) -> Dict[str, Position]:
        """Load current positions."""
        positions = {}
        cursor = self.db.positions.find(
            {"user_id": self.user_id, "strategy_id": self.strategy_id, "status": "OPEN"}
        )
        async for pos in cursor:
            positions[pos["symbol"]] = Position(**pos)
        return positions

    async def load_orders(self) -> Dict[str, Order]:
        """Load active orders."""
        orders = {}
        cursor = self.db.orders.find(
            {
                "user_id": self.user_id,
                "strategy_id": self.strategy_id,
                "status": {"$in": ["NEW", "PARTIALLY_FILLED"]},
            }
        )
        async for order in cursor:
            orders[order["order_id"]] = Order(**order)
        return orders

    async def load_risk_metrics(self) -> RiskMetrics:
        """Load current risk metrics."""
        metrics = await self.db.risk_metrics.find_one(
            {"user_id": self.user_id, "strategy_id": self.strategy_id}
        )
        return RiskMetrics(**metrics) if metrics else None

    async def load_risk_limits(self) -> RiskLimit:
        """Load risk limits."""
        limits = await self.db.risk_limits.find_one(
            {"user_id": self.user_id, "strategy_id": self.strategy_id}
        )
        return RiskLimit(**limits) if limits else None

    async def update_metrics(self, metrics: Dict[str, Any]) -> None:
        """Update strategy metrics."""
        self.metrics.update(metrics)
        await self.db.strategy_metrics.update_one(
            {"strategy_id": self.strategy_id, "user_id": self.user_id},
            {"$set": metrics},
            upsert=True,
        )

    async def update_state(self, state: Dict[str, Any]) -> None:
        """Update strategy state."""
        self.state.update(state)
        await self.redis.hset(f"strategy_state:{self.strategy_id}", mapping=state)

    async def add_signal(
        self,
        symbol: str,
        signal_type: str,
        strength: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add trading signal."""
        signal = {
            "symbol": symbol,
            "type": signal_type,
            "strength": strength,
            "timestamp": datetime.utcnow(),
            "metadata": metadata or {},
        }
        self.signals[f"{symbol}:{signal_type}"] = signal
        await self.db.strategy_signals.insert_one(
            {"strategy_id": self.strategy_id, "user_id": self.user_id, **signal}
        )

    async def get_market_data(
        self,
        symbol: str,
        market_type: MarketType,
        interval: str = "1m",
        limit: int = 100,
    ) -> Dict[str, Any]:
        """Get market data."""
        key = f"market_data:{market_type}:{symbol}:{interval}"
        data = await self.redis.get(key)
        if not data:
            # Fetch from database if not in cache
            data = await self.db.market_data.find_one(
                {"symbol": symbol, "market_type": market_type, "interval": interval}
            )
            if data:
                await self.redis.setex(key, 60, str(data))  # Cache for 1 minute
        return data

    def validate_config(self) -> None:
        """Validate strategy configuration."""
        required_fields = ["max_positions", "position_size", "stop_loss", "take_profit"]
        for field in required_fields:
            if field not in self.config:
                raise ValidationError(message=f"Missing required config field: {field}")

    async def log_execution(self, event_type: str, details: Dict[str, Any]) -> None:
        """Log strategy execution event."""
        await self.db.strategy_logs.insert_one(
            {
                "strategy_id": self.strategy_id,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow(),
                "event_type": event_type,
                "details": details,
            }
        )

    async def cleanup(self) -> None:
        """Cleanup context resources."""
        # Clear cache
        await self.redis.delete(f"strategy_state:{self.strategy_id}")

        # Log execution end
        await self.log_execution(
            "STRATEGY_END",
            {
                "duration": (datetime.utcnow() - self.start_time).total_seconds(),
                "final_metrics": self.metrics,
            },
        )
