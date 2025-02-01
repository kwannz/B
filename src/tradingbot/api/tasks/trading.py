"""
Trading background tasks
"""

import asyncio
import logging
from typing import List, Dict
from datetime import datetime
from decimal import Decimal

from ..services.trading import TradingEngine
from ..services.market import MarketDataService
from ..models.trading import Order, Position, OrderStatus, PositionStatus
from ..core.exceptions import TradingError

logger = logging.getLogger(__name__)


class OrderUpdateTask:
    """Background task for updating order status and positions."""

    def __init__(
        self,
        trading_engine: TradingEngine,
        market_service: MarketDataService,
        update_interval: int = 1,  # seconds
    ):
        """Initialize order update task."""
        self.trading_engine = trading_engine
        self.market_service = market_service
        self.update_interval = update_interval
        self.is_running = False
        self.task = None
        self.last_update = None

    async def start(self):
        """Start the order update task."""
        if self.is_running:
            logger.warning("Order update task is already running")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._update_loop())
        logger.info("Started order update task")

    async def stop(self):
        """Stop the order update task."""
        if not self.is_running:
            logger.warning("Order update task is not running")
            return

        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped order update task")

    async def _update_loop(self):
        """Main update loop."""
        while self.is_running:
            try:
                await self._update_orders()
                await self._update_positions()
                self.last_update = datetime.utcnow()
            except Exception as e:
                logger.error(f"Error in order update loop: {str(e)}")

            await asyncio.sleep(self.update_interval)

    async def _update_orders(self):
        """Update open orders status."""
        # Get all open orders
        open_orders = await self.trading_engine.db.orders.find(
            {"status": {"$in": [OrderStatus.PENDING, OrderStatus.OPEN]}}
        ).to_list(length=None)

        for order in open_orders:
            try:
                # Get order status from exchange
                exchange_order = await self.trading_engine.exchange.get_order(
                    symbol=order["symbol"], order_id=order.get("exchange_order_id")
                )

                if not exchange_order:
                    continue

                # Update order status
                new_status = self._map_exchange_status(exchange_order["status"])
                if new_status != order["status"]:
                    await self.trading_engine._update_order_status(
                        order["_id"],
                        new_status,
                        filled_amount=Decimal(str(exchange_order["filled"])),
                        average_price=Decimal(str(exchange_order["average"])),
                    )

                    # If order is filled, create trade and update position
                    if new_status == OrderStatus.FILLED:
                        await self.trading_engine._create_trade(
                            Order(**order), Decimal(str(exchange_order["average"]))
                        )
                        await self.trading_engine._update_position(
                            Order(**order), Decimal(str(exchange_order["average"]))
                        )

            except Exception as e:
                logger.error(f"Failed to update order {order['_id']}: {str(e)}")

    async def _update_positions(self):
        """Update open positions."""
        # Get all open positions
        open_positions = await self.trading_engine.db.positions.find(
            {"status": PositionStatus.OPEN}
        ).to_list(length=None)

        for position in open_positions:
            try:
                # Get current market price
                ticker = await self.market_service.get_ticker(position["symbol"])

                # Calculate unrealized PnL
                unrealized_pnl = self.trading_engine._calculate_pnl(
                    position["side"],
                    position["amount"],
                    position["entry_price"],
                    ticker.price,
                )

                # Update position
                await self.trading_engine.db.positions.update_one(
                    {"_id": position["_id"]},
                    {
                        "$set": {
                            "current_price": ticker.price,
                            "unrealized_pnl": unrealized_pnl,
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )

                # Check for liquidation
                account = await self.trading_engine.db.accounts.find_one(
                    {"user_id": position["user_id"]}
                )

                if account:
                    # Calculate position value and margin
                    position_value = position["amount"] * ticker.price
                    margin = position_value / position["leverage"]

                    # Check if position should be liquidated
                    if unrealized_pnl <= -margin:
                        await self._liquidate_position(
                            Position(**position), ticker.price
                        )

            except Exception as e:
                logger.error(f"Failed to update position {position['_id']}: {str(e)}")

    async def _liquidate_position(self, position: Position, price: Decimal):
        """Liquidate a position."""
        try:
            # Create market order to close position
            order = await self.trading_engine.create_order(
                user_id=position.user_id,
                order_in={
                    "symbol": position.symbol,
                    "type": "market",
                    "side": "sell" if position.side == "buy" else "buy",
                    "amount": position.amount,
                    "reduce_only": True,
                },
            )

            # Update position status
            await self.trading_engine.db.positions.update_one(
                {"_id": position.id},
                {
                    "$set": {
                        "status": PositionStatus.LIQUIDATED,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

            logger.warning(f"Position {position.id} liquidated at {price}")

        except Exception as e:
            logger.error(f"Failed to liquidate position {position.id}: {str(e)}")

    def _map_exchange_status(self, exchange_status: str) -> OrderStatus:
        """Map exchange order status to internal status."""
        # Implement mapping based on your exchange's status values
        status_map = {
            "new": OrderStatus.OPEN,
            "partially_filled": OrderStatus.PARTIALLY_FILLED,
            "filled": OrderStatus.FILLED,
            "canceled": OrderStatus.CANCELLED,
            "rejected": OrderStatus.REJECTED,
            "expired": OrderStatus.EXPIRED,
        }
        return status_map.get(exchange_status.lower(), OrderStatus.PENDING)

    def get_status(self) -> dict:
        """Get the current status of the updater."""
        return {
            "is_running": self.is_running,
            "update_interval": self.update_interval,
            "last_update": self.last_update.isoformat() if self.last_update else None,
        }
