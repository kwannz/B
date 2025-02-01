"""
Strategy router
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from ..core.exceptions import StrategyError
from ..deps import check_rate_limit, get_current_active_user, get_db
from ..models.strategy import (
    BacktestResult,
    Strategy,
    StrategyCreate,
    StrategyPerformance,
    StrategyStatus,
)
from ..models.user import User
from ..services.strategy import StrategyEngine

router = APIRouter()


# Strategy management endpoints
@router.post("/strategies", response_model=Strategy)
async def create_strategy(
    *,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    strategy_in: StrategyCreate,
    _: None = Depends(check_rate_limit),
) -> Strategy:
    """Create a new strategy."""
    strategy_engine = StrategyEngine(db)
    return await strategy_engine.create_strategy(
        user_id=str(current_user.id), strategy_in=strategy_in
    )


@router.get("/strategies", response_model=List[Strategy])
async def get_strategies(
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    status: Optional[StrategyStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> List[Strategy]:
    """Get user's strategies."""
    query = {"user_id": current_user.id}
    if status:
        query["status"] = status

    strategies = await db.strategies.find(query).skip(skip).limit(limit).to_list(None)
    return [Strategy(**s) for s in strategies]


@router.get("/strategies/{strategy_id}", response_model=Strategy)
async def get_strategy(
    strategy_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Strategy:
    """Get strategy by ID."""
    strategy = await db.strategies.find_one(
        {"_id": strategy_id, "user_id": current_user.id}
    )
    if not strategy:
        raise StrategyError("Strategy not found")

    return Strategy(**strategy)


@router.post("/strategies/{strategy_id}/start")
async def start_strategy(
    strategy_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: None = Depends(check_rate_limit),
):
    """Start a strategy."""
    strategy_engine = StrategyEngine(db)
    await strategy_engine.start_strategy(
        user_id=str(current_user.id), strategy_id=strategy_id
    )
    return {"message": "Strategy started successfully"}


@router.post("/strategies/{strategy_id}/stop")
async def stop_strategy(
    strategy_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: None = Depends(check_rate_limit),
):
    """Stop a strategy."""
    strategy_engine = StrategyEngine(db)
    await strategy_engine.stop_strategy(
        user_id=str(current_user.id), strategy_id=strategy_id
    )
    return {"message": "Strategy stopped successfully"}


# Strategy performance endpoints
@router.get("/strategies/{strategy_id}/performance", response_model=StrategyPerformance)
async def get_strategy_performance(
    strategy_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StrategyPerformance:
    """Get strategy performance metrics."""
    strategy_engine = StrategyEngine(db)
    return await strategy_engine.get_strategy_performance(
        user_id=str(current_user.id), strategy_id=strategy_id
    )


# Backtesting endpoints
@router.post("/strategies/{strategy_id}/backtest", response_model=BacktestResult)
async def run_backtest(
    strategy_id: str,
    *,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    start_time: datetime,
    end_time: datetime,
    initial_capital: Decimal,
    parameters: Optional[dict] = None,
    _: None = Depends(check_rate_limit),
) -> BacktestResult:
    """Run strategy backtest."""
    strategy_engine = StrategyEngine(db)
    return await strategy_engine.backtest_strategy(
        user_id=str(current_user.id),
        strategy_id=strategy_id,
        start_time=start_time,
        end_time=end_time,
        initial_capital=initial_capital,
        parameters=parameters,
    )


@router.get("/strategies/{strategy_id}/backtests", response_model=List[BacktestResult])
async def get_backtest_results(
    strategy_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
) -> List[BacktestResult]:
    """Get strategy backtest results."""
    results = (
        await db.backtest_results.find(
            {"strategy_id": strategy_id, "user_id": current_user.id}
        )
        .skip(skip)
        .limit(limit)
        .to_list(None)
    )

    return [BacktestResult(**r) for r in results]
