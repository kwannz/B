"""
Trading service for order and position management
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ..models.trading import (
    Order,
    OrderCreate,
    Position,
    Trade,
    OrderStatus,
    OrderType,
    OrderSide,
    PositionStatus,
    PositionSide,
    MarketType,
)
from ..core.exceptions import (
    OrderError,
    ValidationError,
    NotFoundError,
    TradingError,
    PositionError,
)


class TradingService:
    """Trading service for managing orders and positions."""

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize trading service."""
        self.db = db
        self.orders = db.orders
        self.positions = db.positions
        self.trades = db.trades

    async def create_order(
        self,
        order_in: OrderCreate,
        user_id: ObjectId,
        position_id: Optional[ObjectId] = None,
    ) -> Order:
        """Create new order."""
        # Validate order
        await self._validate_order(order_in, user_id)

        # Create order object
        order = Order(
            **order_in.dict(),
            user_id=user_id,
            position_id=position_id,
            remaining_amount=order_in.amount,
        )

        # Insert into database
        result = await self.orders.insert_one(order.dict(by_alias=True))
        order.id = result.inserted_id

        # Update position if closing
        if position_id:
            await self._update_position_on_order(order)

        return order

    async def get_order(self, order_id: ObjectId) -> Optional[Order]:
        """Get order by ID."""
        order_data = await self.orders.find_one({"_id": order_id})
        return Order(**order_data) if order_data else None

    async def get_orders(
        self,
        user_id: ObjectId,
        symbol: Optional[str] = None,
        status: Optional[OrderStatus] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Order]:
        """Get user orders with filters."""
        # Build query
        query = {"user_id": user_id}
        if symbol:
            query["symbol"] = symbol
        if status:
            query["status"] = status
        if from_time or to_time:
            query["created_at"] = {}
            if from_time:
                query["created_at"]["$gte"] = from_time
            if to_time:
                query["created_at"]["$lte"] = to_time

        # Execute query
        cursor = self.orders.find(query).sort("created_at", -1).skip(skip).limit(limit)
        orders = await cursor.to_list(length=limit)

        return [Order(**order) for order in orders]

    async def update_order(
        self, order_id: ObjectId, update_data: Dict[str, Any]
    ) -> Order:
        """Update order."""
        # Get current order
        order = await self.get_order(order_id)
        if not order:
            raise NotFoundError("Order not found")

        # Validate update
        if order.status not in [OrderStatus.PENDING, OrderStatus.OPEN]:
            raise OrderError("Order cannot be updated")

        # Update order
        update_data["updated_at"] = datetime.utcnow()
        result = await self.orders.update_one({"_id": order_id}, {"$set": update_data})

        if result.modified_count == 0:
            raise OrderError("Failed to update order")

        return await self.get_order(order_id)

    async def cancel_order(self, order_id: ObjectId) -> Order:
        """Cancel order."""
        # Get current order
        order = await self.get_order(order_id)
        if not order:
            raise NotFoundError("Order not found")

        # Validate cancellation
        if order.status not in [OrderStatus.PENDING, OrderStatus.OPEN]:
            raise OrderError("Order cannot be cancelled")

        # Update order status
        update_data = {"status": OrderStatus.CANCELLED, "updated_at": datetime.utcnow()}

        result = await self.orders.update_one({"_id": order_id}, {"$set": update_data})

        if result.modified_count == 0:
            raise OrderError("Failed to cancel order")

        return await self.get_order(order_id)

    async def create_position(
        self,
        user_id: ObjectId,
        symbol: str,
        side: PositionSide,
        amount: Decimal,
        entry_price: Decimal,
        market_type: MarketType,
        leverage: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Position:
        """Create new position."""
        # Validate position
        await self._validate_position_creation(user_id, symbol, amount, leverage)

        # Create position object
        position = Position(
            user_id=user_id,
            symbol=symbol,
            side=side,
            amount=amount,
            entry_price=entry_price,
            current_price=entry_price,
            market_type=market_type,
            leverage=leverage,
            metadata=metadata or {},
        )

        # Insert into database
        result = await self.positions.insert_one(position.dict(by_alias=True))
        position.id = result.inserted_id

        return position

    async def get_position(self, position_id: ObjectId) -> Optional[Position]:
        """Get position by ID."""
        position_data = await self.positions.find_one({"_id": position_id})
        return Position(**position_data) if position_data else None

    async def get_positions(
        self,
        user_id: ObjectId,
        symbol: Optional[str] = None,
        status: Optional[PositionStatus] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Position]:
        """Get user positions with filters."""
        # Build query
        query = {"user_id": user_id}
        if symbol:
            query["symbol"] = symbol
        if status:
            query["status"] = status
        if from_time or to_time:
            query["created_at"] = {}
            if from_time:
                query["created_at"]["$gte"] = from_time
            if to_time:
                query["created_at"]["$lte"] = to_time

        # Execute query
        cursor = (
            self.positions.find(query).sort("created_at", -1).skip(skip).limit(limit)
        )
        positions = await cursor.to_list(length=limit)

        return [Position(**position) for position in positions]

    async def update_position(
        self, position_id: ObjectId, update_data: Dict[str, Any]
    ) -> Position:
        """Update position."""
        # Get current position
        position = await self.get_position(position_id)
        if not position:
            raise NotFoundError("Position not found")

        # Validate update
        if position.status != PositionStatus.OPEN:
            raise PositionError("Position is not open")

        # Update position
        update_data["updated_at"] = datetime.utcnow()
        result = await self.positions.update_one(
            {"_id": position_id}, {"$set": update_data}
        )

        if result.modified_count == 0:
            raise PositionError("Failed to update position")

        return await self.get_position(position_id)

    async def close_position(
        self, position_id: ObjectId, close_price: Decimal
    ) -> Position:
        """Close position."""
        # Get current position
        position = await self.get_position(position_id)
        if not position:
            raise NotFoundError("Position not found")

        # Validate closure
        if position.status != PositionStatus.OPEN:
            raise PositionError("Position is not open")

        # Calculate PnL
        realized_pnl = self._calculate_pnl(
            position.side,
            position.entry_price,
            close_price,
            position.amount,
            position.leverage or 1,
        )

        # Update position
        update_data = {
            "status": PositionStatus.CLOSED,
            "current_price": close_price,
            "realized_pnl": realized_pnl,
            "closed_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        result = await self.positions.update_one(
            {"_id": position_id}, {"$set": update_data}
        )

        if result.modified_count == 0:
            raise PositionError("Failed to close position")

        return await self.get_position(position_id)

    async def get_trades(
        self,
        user_id: ObjectId,
        symbol: Optional[str] = None,
        order_id: Optional[ObjectId] = None,
        position_id: Optional[ObjectId] = None,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Trade]:
        """Get user trades with filters."""
        # Build query
        query = {"user_id": user_id}
        if symbol:
            query["symbol"] = symbol
        if order_id:
            query["order_id"] = order_id
        if position_id:
            query["position_id"] = position_id
        if from_time or to_time:
            query["created_at"] = {}
            if from_time:
                query["created_at"]["$gte"] = from_time
            if to_time:
                query["created_at"]["$lte"] = to_time

        # Execute query
        cursor = self.trades.find(query).sort("created_at", -1).skip(skip).limit(limit)
        trades = await cursor.to_list(length=limit)

        return [Trade(**trade) for trade in trades]

    async def _validate_order(self, order_in: OrderCreate, user_id: ObjectId) -> None:
        """Validate order creation."""
        # Check for existing open orders
        open_orders = await self.orders.count_documents(
            {
                "user_id": user_id,
                "symbol": order_in.symbol,
                "status": {"$in": [OrderStatus.PENDING, OrderStatus.OPEN]},
            }
        )

        if open_orders >= 10:  # Maximum open orders per symbol
            raise ValidationError("Maximum open orders reached for this symbol")

        # Validate DEX specific fields
        if order_in.wallet_address:
            if not order_in.gas_price or not order_in.gas_limit:
                raise ValidationError("Gas price and limit required for DEX orders")

        # Validate meme token fields
        if order_in.slippage_tolerance:
            if order_in.slippage_tolerance > 50:  # Maximum 50% slippage
                raise ValidationError("Slippage tolerance too high")

    async def _validate_position_creation(
        self, user_id: ObjectId, symbol: str, amount: Decimal, leverage: Optional[float]
    ) -> None:
        """Validate position creation."""
        # Check for existing open positions
        open_positions = await self.positions.count_documents(
            {"user_id": user_id, "symbol": symbol, "status": PositionStatus.OPEN}
        )

        if open_positions >= 5:  # Maximum open positions per symbol
            raise ValidationError("Maximum open positions reached for this symbol")

        # Validate leverage
        if leverage and leverage > 20:  # Maximum 20x leverage
            raise ValidationError("Leverage too high")

    async def _update_position_on_order(self, order: Order) -> None:
        """Update position when order is created for position."""
        if not order.position_id:
            return

        position = await self.get_position(order.position_id)
        if not position:
            raise NotFoundError("Position not found")

        # Update position status if closing
        if position.amount == order.amount:
            await self.update_position(position.id, {"status": PositionStatus.CLOSED})

    def _calculate_pnl(
        self,
        side: PositionSide,
        entry_price: Decimal,
        close_price: Decimal,
        amount: Decimal,
        leverage: float,
    ) -> Decimal:
        """Calculate position PnL."""
        if side == PositionSide.LONG:
            return (close_price - entry_price) * amount * Decimal(str(leverage))
        else:
            return (entry_price - close_price) * amount * Decimal(str(leverage))
