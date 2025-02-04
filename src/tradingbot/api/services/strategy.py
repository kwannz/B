"""
Strategy engine service
"""

import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Type

import numpy as np
import pandas as pd
from pymongo.database import Database

from tradingbot.api.core.exceptions import StrategyError
from ..models.strategy import (
    ArbitrageStrategyConfig,
    BacktestResult,
    GridStrategyConfig,
    MeanReversionStrategyConfig,
    MomentumStrategyConfig,
    Strategy,
    StrategyCreate,
    StrategyPerformance,
    StrategyStatus,
    StrategyType,
)
from ..models.trading import Order, OrderCreate, OrderSide, OrderType
from .market import MarketDataService
from .trading import TradingEngine

logger = logging.getLogger(__name__)


class StrategyEngine:
    """Strategy engine for managing and executing trading strategies."""

    def __init__(
        self,
        db: Database,
        trading_engine: TradingEngine,
        market_service: MarketDataService,
    ):
        """Initialize strategy engine."""
        self.db = db
        self.trading_engine = trading_engine
        self.market_service = market_service
        self.active_strategies: Dict[str, "BaseStrategy"] = {}
        self._strategy_factories = {
            StrategyType.GRID: GridStrategy,
            StrategyType.MOMENTUM: MomentumStrategy,
            StrategyType.MEAN_REVERSION: MeanReversionStrategy,
            StrategyType.ARBITRAGE: ArbitrageStrategy,
        }

    async def create_strategy(
        self, user_id: str, strategy_in: StrategyCreate
    ) -> Strategy:
        """Create a new strategy."""
        # Validate strategy configuration
        self._validate_strategy_config(strategy_in)

        # Create strategy record
        strategy_dict = strategy_in.dict()
        strategy_dict.update(
            {
                "user_id": user_id,
                "status": StrategyStatus.STOPPED,
                "performance": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )

        result = await self.db.strategies.insert_one(strategy_dict)
        strategy_dict["_id"] = result.inserted_id

        return Strategy(**strategy_dict)

    async def start_strategy(self, user_id: str, strategy_id: str):
        """Start a strategy."""
        strategy = await self._get_strategy(user_id, strategy_id)
        if not strategy:
            raise StrategyError("Strategy not found")

        if strategy.status == StrategyStatus.ACTIVE:
            raise StrategyError("Strategy is already running")

        # Create strategy instance
        strategy_class = self._strategy_factories.get(strategy.type)
        if not strategy_class:
            raise StrategyError(f"Unsupported strategy type: {strategy.type}")

        strategy_instance = strategy_class(
            strategy=strategy,
            trading_engine=self.trading_engine,
            market_service=self.market_service,
        )

        # Start strategy
        try:
            await strategy_instance.start()
            self.active_strategies[str(strategy.id)] = strategy_instance

            # Update strategy status
            await self.db.strategies.update_one(
                {"_id": strategy.id},
                {
                    "$set": {
                        "status": StrategyStatus.ACTIVE,
                        "last_run": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                },
            )
        except Exception as e:
            logger.error(f"Failed to start strategy {strategy.id}: {str(e)}")
            await self._update_strategy_error(strategy.id, str(e))
            raise StrategyError(f"Failed to start strategy: {str(e)}")

    async def stop_strategy(self, user_id: str, strategy_id: str):
        """Stop a strategy."""
        strategy = await self._get_strategy(user_id, strategy_id)
        if not strategy:
            raise StrategyError("Strategy not found")

        if strategy.status != StrategyStatus.ACTIVE:
            raise StrategyError("Strategy is not running")

        # Stop strategy instance
        strategy_instance = self.active_strategies.get(str(strategy.id))
        if strategy_instance:
            try:
                await strategy_instance.stop()
                del self.active_strategies[str(strategy.id)]

                # Update strategy status
                await self.db.strategies.update_one(
                    {"_id": strategy.id},
                    {
                        "$set": {
                            "status": StrategyStatus.STOPPED,
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
            except Exception as e:
                logger.error(f"Failed to stop strategy {strategy.id}: {str(e)}")
                await self._update_strategy_error(strategy.id, str(e))
                raise StrategyError(f"Failed to stop strategy: {str(e)}")

    async def backtest_strategy(
        self,
        user_id: str,
        strategy_id: str,
        start_time: datetime,
        end_time: datetime,
        initial_capital: Decimal,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> BacktestResult:
        """Run strategy backtest."""
        strategy = await self._get_strategy(user_id, strategy_id)
        if not strategy:
            raise StrategyError("Strategy not found")

        # Create strategy instance for backtesting
        strategy_class = self._strategy_factories.get(strategy.type)
        if not strategy_class:
            raise StrategyError(f"Unsupported strategy type: {strategy.type}")

        # Override strategy parameters if provided
        if parameters:
            strategy.config.update(parameters)

        strategy_instance = strategy_class(
            strategy=strategy,
            trading_engine=self.trading_engine,
            market_service=self.market_service,
            backtest_mode=True,
        )

        try:
            # Run backtest
            result = await strategy_instance.run_backtest(
                start_time=start_time,
                end_time=end_time,
                initial_capital=initial_capital,
            )

            # Save backtest result
            await self.db.backtest_results.insert_one(result.dict())

            return result
        except Exception as e:
            logger.error(f"Backtest failed for strategy {strategy.id}: {str(e)}")
            raise StrategyError(f"Backtest failed: {str(e)}")

    async def get_strategy_performance(
        self, user_id: str, strategy_id: str
    ) -> StrategyPerformance:
        """Get strategy performance metrics."""
        strategy = await self._get_strategy(user_id, strategy_id)
        if not strategy:
            raise StrategyError("Strategy not found")

        # Get strategy trades
        trades = await self.db.trades.find({"strategy_id": strategy.id}).to_list(
            length=None
        )

        # Calculate performance metrics
        performance = StrategyPerformance()
        if trades:
            performance.total_trades = len(trades)
            performance.winning_trades = sum(1 for t in trades if t["realized_pnl"] > 0)
            performance.losing_trades = sum(1 for t in trades if t["realized_pnl"] < 0)
            performance.total_pnl = sum(Decimal(str(t["realized_pnl"])) for t in trades)

            # Calculate other metrics
            if performance.total_trades > 0:
                performance.win_rate = Decimal(
                    performance.winning_trades / performance.total_trades
                )

                winning_pnls = [
                    Decimal(str(t["realized_pnl"]))
                    for t in trades
                    if t["realized_pnl"] > 0
                ]
                losing_pnls = [
                    Decimal(str(t["realized_pnl"]))
                    for t in trades
                    if t["realized_pnl"] < 0
                ]

                if winning_pnls:
                    performance.avg_win_pnl = sum(winning_pnls) / len(winning_pnls)
                if losing_pnls:
                    performance.avg_loss_pnl = sum(losing_pnls) / len(losing_pnls)

                performance.avg_trade_pnl = (
                    performance.total_pnl / performance.total_trades
                )

        return performance

    async def _get_strategy(self, user_id: str, strategy_id: str) -> Optional[Strategy]:
        """Get strategy by ID."""
        strategy = await self.db.strategies.find_one(
            {"_id": strategy_id, "user_id": user_id}
        )
        return Strategy(**strategy) if strategy else None

    async def _update_strategy_error(self, strategy_id: str, error: str):
        """Update strategy error status."""
        await self.db.strategies.update_one(
            {"_id": strategy_id},
            {
                "$set": {
                    "status": StrategyStatus.ERROR,
                    "error": error,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    def _validate_strategy_config(self, strategy: StrategyCreate):
        """Validate strategy configuration."""
        if strategy.type == StrategyType.GRID:
            GridStrategyConfig(**strategy.config)
        elif strategy.type == StrategyType.MOMENTUM:
            MomentumStrategyConfig(**strategy.config)
        elif strategy.type == StrategyType.MEAN_REVERSION:
            MeanReversionStrategyConfig(**strategy.config)
        elif strategy.type == StrategyType.ARBITRAGE:
            ArbitrageStrategyConfig(**strategy.config)
        else:
            raise StrategyError(f"Unsupported strategy type: {strategy.type}")


class BaseStrategy:
    """Base class for all trading strategies."""

    def __init__(
        self,
        strategy: Strategy,
        trading_engine: TradingEngine,
        market_service: MarketDataService,
        backtest_mode: bool = False,
    ):
        """Initialize strategy."""
        self.strategy = strategy
        self.trading_engine = trading_engine
        self.market_service = market_service
        self.backtest_mode = backtest_mode
        self.is_running = False
        self.task = None

    async def start(self):
        """Start strategy execution."""
        if self.is_running:
            return

        self.is_running = True
        self.task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """Stop strategy execution."""
        if not self.is_running:
            return

        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self):
        """Main strategy loop."""
        raise NotImplementedError

    async def run_backtest(
        self, start_time: datetime, end_time: datetime, initial_capital: Decimal
    ) -> BacktestResult:
        """Run strategy backtest."""
        raise NotImplementedError


class GridStrategy(BaseStrategy):
    """Grid trading strategy implementation."""

    async def _run_loop(self):
        """Main strategy loop."""
        config = GridStrategyConfig(**self.strategy.config)

        while self.is_running:
            try:
                for symbol in self.strategy.symbols:
                    # Get current price
                    ticker = await self.market_service.get_ticker(symbol)
                    current_price = ticker.price

                    # Check if price is within grid range
                    if (
                        current_price >= config.lower_price
                        and current_price <= config.upper_price
                    ):
                        # Calculate grid levels
                        grid_size = (
                            config.upper_price - config.lower_price
                        ) / config.grid_levels

                        # Place buy orders below current price
                        for i in range(1, config.grid_levels + 1):
                            buy_price = current_price - (i * grid_size)
                            if buy_price >= config.lower_price:
                                await self.trading_engine.create_order(
                                    user_id=str(self.strategy.user_id),
                                    order_in=OrderCreate(
                                        symbol=symbol,
                                        type=OrderType.LIMIT,
                                        side=OrderSide.BUY,
                                        amount=config.amount_per_grid,
                                        price=buy_price,
                                    ),
                                )

                        # Place sell orders above current price
                        for i in range(1, config.grid_levels + 1):
                            sell_price = current_price + (i * grid_size)
                            if sell_price <= config.upper_price:
                                await self.trading_engine.create_order(
                                    user_id=str(self.strategy.user_id),
                                    order_in=OrderCreate(
                                        symbol=symbol,
                                        type=OrderType.LIMIT,
                                        side=OrderSide.SELL,
                                        amount=config.amount_per_grid,
                                        price=sell_price,
                                    ),
                                )

                await asyncio.sleep(60)  # Update every minute

            except Exception as e:
                logger.error(f"Grid strategy error: {str(e)}")
                await asyncio.sleep(5)  # Wait before retrying


class MomentumStrategy(BaseStrategy):
    """Momentum trading strategy implementation."""

    async def _run_loop(self):
        """Main strategy loop."""
        config = MomentumStrategyConfig(**self.strategy.config)

        while self.is_running:
            try:
                for symbol in self.strategy.symbols:
                    # Get historical data
                    klines = await self.market_service.get_klines(
                        symbol=symbol, interval="1h", limit=config.lookback_period
                    )

                    # Calculate momentum signal
                    prices = pd.Series([float(k.close) for k in klines])
                    returns = prices.pct_change()
                    momentum = returns.mean()

                    # Generate trading signals
                    if abs(momentum) > config.signal_threshold:
                        side = OrderSide.BUY if momentum > 0 else OrderSide.SELL

                        # Place order
                        await self.trading_engine.create_order(
                            user_id=str(self.strategy.user_id),
                            order_in=OrderCreate(
                                symbol=symbol,
                                type=OrderType.MARKET,
                                side=side,
                                amount=config.position_size,
                            ),
                        )

                await asyncio.sleep(3600)  # Update every hour

            except Exception as e:
                logger.error(f"Momentum strategy error: {str(e)}")
                await asyncio.sleep(5)


class MeanReversionStrategy(BaseStrategy):
    """Mean reversion strategy implementation."""

    async def _run_loop(self):
        """Main strategy loop."""
        config = MeanReversionStrategyConfig(**self.strategy.config)

        while self.is_running:
            try:
                for symbol in self.strategy.symbols:
                    # Get historical data
                    klines = await self.market_service.get_klines(
                        symbol=symbol, interval="1h", limit=config.window_size
                    )

                    # Calculate mean and standard deviation
                    prices = pd.Series([float(k.close) for k in klines])
                    mean = prices.mean()
                    std = prices.std()

                    # Get current price
                    ticker = await self.market_service.get_ticker(symbol)
                    current_price = float(ticker.price)

                    # Generate trading signals
                    z_score = (current_price - mean) / std

                    if abs(z_score) > config.entry_std:
                        side = OrderSide.BUY if z_score < 0 else OrderSide.SELL

                        # Place order
                        await self.trading_engine.create_order(
                            user_id=str(self.strategy.user_id),
                            order_in=OrderCreate(
                                symbol=symbol,
                                type=OrderType.MARKET,
                                side=side,
                                amount=config.position_size,
                            ),
                        )

                await asyncio.sleep(3600)  # Update every hour

            except Exception as e:
                logger.error(f"Mean reversion strategy error: {str(e)}")
                await asyncio.sleep(5)


class ArbitrageStrategy(BaseStrategy):
    """Arbitrage strategy implementation."""

    async def _run_loop(self):
        """Main strategy loop."""
        config = ArbitrageStrategyConfig(**self.strategy.config)

        while self.is_running:
            try:
                # Get prices from different exchanges
                # This is a placeholder - implement actual arbitrage logic
                await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Arbitrage strategy error: {str(e)}")
                await asyncio.sleep(5)
