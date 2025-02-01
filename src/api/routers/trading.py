"""
Trading router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta

from ..core.deps import get_database, get_current_user
from ..core.exceptions import NotFoundError, ValidationError, OrderError
from ..models.user import User
from ..models.trading import (
    Order,
    OrderCreate,
    Position,
    Trade,
    OrderStatus,
    OrderType,
    OrderSide,
    PositionStatus,
)
from ..services.trading import TradingService
from ..services.market import MarketDataService

router = APIRouter()


# Dependencies
async def get_trading_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> TradingService:
    """Get trading service instance."""
    return TradingService(db)


async def get_market_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MarketDataService:
    """Get market data service instance."""
    return MarketDataService(db)


@router.post("/orders", response_model=Order)
async def create_order(
    order_in: OrderCreate,
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
    market_service: MarketDataService = Depends(get_market_service),
):
    """Create new order."""
    # Validate symbol
    if not await market_service.is_valid_symbol(order_in.symbol):
        raise ValidationError(f"Invalid symbol: {order_in.symbol}")

    # Create order
    order = await trading_service.create_order(order_in, current_user.id)

    return order


@router.get("/orders", response_model=List[Order])
async def get_orders(
    symbol: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get user orders."""
    return await trading_service.get_orders(
        user_id=current_user.id,
        symbol=symbol,
        status=status,
        from_time=from_time,
        to_time=to_time,
        limit=limit,
        skip=skip,
    )


@router.get("/orders/{order_id}", response_model=Order)
async def get_order(
    order_id: str = Path(..., title="Order ID"),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get order by ID."""
    order = await trading_service.get_order(order_id)
    if not order:
        raise NotFoundError("Order not found")

    if order.user_id != current_user.id:
        raise OrderError("Order does not belong to user")

    return order


@router.delete("/orders/{order_id}", response_model=Order)
async def cancel_order(
    order_id: str = Path(..., title="Order ID"),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Cancel order."""
    order = await trading_service.get_order(order_id)
    if not order:
        raise NotFoundError("Order not found")

    if order.user_id != current_user.id:
        raise OrderError("Order does not belong to user")

    if order.status not in [OrderStatus.PENDING, OrderStatus.OPEN]:
        raise OrderError("Order cannot be cancelled")

    return await trading_service.cancel_order(order_id)


@router.get("/positions", response_model=List[Position])
async def get_positions(
    symbol: Optional[str] = None,
    status: Optional[PositionStatus] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get user positions."""
    return await trading_service.get_positions(
        user_id=current_user.id,
        symbol=symbol,
        status=status,
        from_time=from_time,
        to_time=to_time,
        limit=limit,
        skip=skip,
    )


@router.get("/positions/{position_id}", response_model=Position)
async def get_position(
    position_id: str = Path(..., title="Position ID"),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get position by ID."""
    position = await trading_service.get_position(position_id)
    if not position:
        raise NotFoundError("Position not found")

    if position.user_id != current_user.id:
        raise OrderError("Position does not belong to user")

    return position


@router.post("/positions/{position_id}/close", response_model=Order)
async def close_position(
    position_id: str = Path(..., title="Position ID"),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Close position."""
    position = await trading_service.get_position(position_id)
    if not position:
        raise NotFoundError("Position not found")

    if position.user_id != current_user.id:
        raise OrderError("Position does not belong to user")

    if position.status != PositionStatus.OPEN:
        raise OrderError("Position is not open")

    # Create market order to close position
    order_in = OrderCreate(
        user_id=current_user.id,
        symbol=position.symbol,
        type=OrderType.MARKET,
        side=OrderSide.SELL if position.side == OrderSide.BUY else OrderSide.BUY,
        amount=position.amount,
    )

    return await trading_service.create_order(
        order_in, current_user.id, position_id=position_id
    )


@router.get("/trades", response_model=List[Trade])
async def get_trades(
    symbol: Optional[str] = None,
    order_id: Optional[str] = None,
    position_id: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    trading_service: TradingService = Depends(get_trading_service),
):
    """Get user trades."""
    return await trading_service.get_trades(
        user_id=current_user.id,
        symbol=symbol,
        order_id=order_id,
        position_id=position_id,
        from_time=from_time,
        to_time=to_time,
        limit=limit,
        skip=skip,
    )
