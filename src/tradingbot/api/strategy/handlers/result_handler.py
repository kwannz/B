"""
Strategy result handler for processing strategy execution results
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from redis import Redis

from ...core.exceptions import ValidationError
from ...models.risk import RiskMetrics
from ...models.trading import Order, Position, Trade
from ..context.strategy_context import StrategyContext


class StrategyResultHandler:
    """Handler for processing strategy execution results."""

    def __init__(
        self, context: StrategyContext, db: AsyncIOMotorDatabase, redis: Redis
    ):
        """Initialize strategy result handler."""
        self.context = context
        self.db = db
        self.redis = redis

    async def process_signals(self, signals: List[Dict[str, Any]]) -> List[Order]:
        """Process trading signals and generate orders."""
        orders = []
        positions = await self.context.load_positions()
        risk_metrics = await self.context.load_risk_metrics()
        risk_limits = await self.context.load_risk_limits()

        for signal in signals:
            # Validate signal
            self._validate_signal(signal)

            # Check risk limits
            if not self._check_risk_limits(
                signal, positions, risk_metrics, risk_limits
            ):
                continue

            # Generate order
            order = self._generate_order(signal, positions)
            if order:
                orders.append(order)

        return orders

    async def process_trades(self, trades: List[Trade]) -> None:
        """Process completed trades."""
        for trade in trades:
            # Update position
            await self._update_position(trade)

            # Update metrics
            await self._update_metrics(trade)

            # Log trade
            await self._log_trade(trade)

    async def process_errors(self, errors: List[Dict[str, Any]]) -> None:
        """Process execution errors."""
        for error in errors:
            await self.context.log_execution(
                "ERROR",
                {
                    "error_type": error.get("type"),
                    "error_message": error.get("message"),
                    "error_details": error.get("details", {}),
                },
            )

    def _validate_signal(self, signal: Dict[str, Any]) -> None:
        """Validate trading signal."""
        required_fields = ["symbol", "type", "strength", "direction"]
        for field in required_fields:
            if field not in signal:
                raise ValidationError(message=f"Missing required signal field: {field}")

    def _check_risk_limits(
        self,
        signal: Dict[str, Any],
        positions: Dict[str, Position],
        risk_metrics: Optional[RiskMetrics],
        risk_limits: Optional[Dict[str, Any]],
    ) -> bool:
        """Check if signal complies with risk limits."""
        if not risk_limits:
            return True

        # Check position count
        if len(positions) >= risk_limits.get("max_positions", float("inf")):
            return False

        # Check concentration
        position_value = sum(p.amount * p.current_price for p in positions.values())
        if position_value >= risk_limits.get("max_position_value", float("inf")):
            return False

        # Check risk metrics
        if risk_metrics:
            if risk_metrics.var_95 >= risk_limits.get("max_var", float("inf")):
                return False

        return True

    def _generate_order(
        self, signal: Dict[str, Any], positions: Dict[str, Position]
    ) -> Optional[Order]:
        """Generate order from signal."""
        symbol = signal["symbol"]
        direction = signal["direction"]

        # Calculate order size
        size = self._calculate_order_size(signal, positions)
        if not size:
            return None

        # Generate order
        return Order(
            user_id=self.context.user_id,
            strategy_id=self.context.strategy_id,
            symbol=symbol,
            side="BUY" if direction > 0 else "SELL",
            order_type="LIMIT",
            quantity=size,
            price=signal.get("price"),
            stop_price=signal.get("stop_price"),
            time_in_force="GTC",
            metadata={
                "signal_type": signal["type"],
                "signal_strength": signal["strength"],
            },
        )

    def _calculate_order_size(
        self, signal: Dict[str, Any], positions: Dict[str, Position]
    ) -> Optional[Decimal]:
        """Calculate order size based on signal and positions."""
        base_size = Decimal(str(self.context.config["position_size"]))

        # Adjust size based on signal strength
        strength_factor = Decimal(str(abs(signal["strength"])))
        size = base_size * strength_factor

        # Check existing position
        position = positions.get(signal["symbol"])
        if position:
            # Reduce size if adding to position
            size = size * Decimal("0.5")

        return size

    async def _update_position(self, trade: Trade) -> None:
        """Update position based on trade."""
        position = await self.db.positions.find_one(
            {
                "user_id": self.context.user_id,
                "strategy_id": self.context.strategy_id,
                "symbol": trade.symbol,
                "status": "OPEN",
            }
        )

        if position:
            # Update existing position
            new_amount = Decimal(str(position["amount"]))
            if trade.side == "BUY":
                new_amount += trade.amount
            else:
                new_amount -= trade.amount

            if new_amount == 0:
                # Close position
                await self.db.positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "status": "CLOSED",
                            "closed_at": datetime.utcnow(),
                            "closed_price": trade.price,
                        }
                    },
                )
            else:
                # Update position
                await self.db.positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "amount": float(new_amount),
                            "current_price": float(trade.price),
                        }
                    },
                )
        else:
            # Create new position
            await self.db.positions.insert_one(
                {
                    "user_id": self.context.user_id,
                    "strategy_id": self.context.strategy_id,
                    "symbol": trade.symbol,
                    "amount": float(trade.amount),
                    "entry_price": float(trade.price),
                    "current_price": float(trade.price),
                    "status": "OPEN",
                    "created_at": datetime.utcnow(),
                }
            )

    async def _update_metrics(self, trade: Trade) -> None:
        """Update strategy metrics based on trade."""
        # Calculate trade PnL
        pnl = trade.amount * (trade.price - trade.entry_price)

        # Update metrics
        await self.context.update_metrics(
            {
                f"trade_count_{trade.symbol}": 1,
                f"volume_{trade.symbol}": float(trade.amount * trade.price),
                f"pnl_{trade.symbol}": float(pnl),
            }
        )

    async def _log_trade(self, trade: Trade) -> None:
        """Log trade details."""
        await self.context.log_execution(
            "TRADE",
            {
                "trade_id": str(trade.id),
                "symbol": trade.symbol,
                "side": trade.side,
                "amount": float(trade.amount),
                "price": float(trade.price),
                "pnl": float(trade.amount * (trade.price - trade.entry_price)),
            },
        )
