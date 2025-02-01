"""
Backtest engine service
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

from ..models.strategy import Strategy, BacktestResult, StrategyPerformance
from ..models.trading import (
    Order,
    OrderCreate,
    OrderType,
    OrderSide,
    OrderStatus,
    Position,
    Trade,
)
from ..models.market import Ticker, Kline
from ..core.exceptions import BacktestError
from .market import MarketDataService

logger = logging.getLogger(__name__)


class BacktestEngine:
    """Engine for running strategy backtests."""

    def __init__(
        self,
        market_service: MarketDataService,
        initial_capital: Decimal,
        start_time: datetime,
        end_time: datetime,
        commission_rate: Decimal = Decimal("0.001"),  # 0.1%
        slippage: Decimal = Decimal("0.001"),  # 0.1%
    ):
        """Initialize backtest engine."""
        self.market_service = market_service
        self.initial_capital = initial_capital
        self.start_time = start_time
        self.end_time = end_time
        self.commission_rate = commission_rate
        self.slippage = slippage

        # Backtest state
        self.current_time = start_time
        self.balance = initial_capital
        self.positions: Dict[str, Position] = {}
        self.orders: List[Order] = []
        self.trades: List[Trade] = []
        self.equity_curve: List[Dict[str, Any]] = []
        self.drawdown_curve: List[Dict[str, Any]] = []

        # Market data cache
        self._klines_cache: Dict[str, pd.DataFrame] = {}
        self._ticker_cache: Dict[str, List[Ticker]] = {}

    async def initialize(self, symbols: List[str]):
        """Initialize backtest data."""
        # Load historical data for all symbols
        for symbol in symbols:
            # Load klines
            klines = await self.market_service.get_klines(
                symbol=symbol,
                interval="1h",
                start_time=self.start_time,
                end_time=self.end_time,
            )

            # Convert to DataFrame
            df = pd.DataFrame(
                [
                    {
                        "timestamp": k.open_time,
                        "open": float(k.open),
                        "high": float(k.high),
                        "low": float(k.low),
                        "close": float(k.close),
                        "volume": float(k.volume),
                    }
                    for k in klines
                ]
            )
            df.set_index("timestamp", inplace=True)
            self._klines_cache[symbol] = df

            # Create ticker cache
            self._ticker_cache[symbol] = [
                Ticker(
                    symbol=symbol,
                    price=Decimal(str(row.close)),
                    volume=Decimal(str(row.volume)),
                    timestamp=idx,
                )
                for idx, row in df.iterrows()
            ]

    def get_current_price(self, symbol: str) -> Decimal:
        """Get price at current timestamp."""
        df = self._klines_cache[symbol]
        return Decimal(str(df.loc[df.index <= self.current_time].iloc[-1].close))

    def get_historical_data(self, symbol: str, lookback: int) -> pd.DataFrame:
        """Get historical data up to current timestamp."""
        df = self._klines_cache[symbol]
        mask = df.index <= self.current_time
        return df[mask].tail(lookback)

    async def execute_order(self, order: OrderCreate) -> Order:
        """Execute an order in backtest."""
        # Get execution price with slippage
        price = self.get_current_price(order.symbol)
        slippage_amount = price * self.slippage
        execution_price = (
            price + slippage_amount
            if order.side == OrderSide.BUY
            else price - slippage_amount
        )

        # Calculate order cost with commission
        order_value = execution_price * order.amount
        commission = order_value * self.commission_rate
        total_cost = order_value + commission

        # Check if we have enough balance
        if order.side == OrderSide.BUY and total_cost > self.balance:
            raise BacktestError("Insufficient balance")

        # Create order record
        order_dict = order.dict()
        order_dict.update(
            {
                "status": OrderStatus.FILLED,
                "filled_amount": order.amount,
                "average_price": execution_price,
                "commission": commission,
                "created_at": self.current_time,
                "updated_at": self.current_time,
            }
        )
        executed_order = Order(**order_dict)
        self.orders.append(executed_order)

        # Create trade record
        trade = Trade(
            order_id=executed_order.id,
            symbol=order.symbol,
            side=order.side,
            amount=order.amount,
            price=execution_price,
            commission=commission,
            timestamp=self.current_time,
        )
        self.trades.append(trade)

        # Update balance and positions
        if order.side == OrderSide.BUY:
            self.balance -= total_cost
            self._update_position(
                symbol=order.symbol,
                side=order.side,
                amount=order.amount,
                price=execution_price,
            )
        else:
            self.balance += order_value - commission
            self._update_position(
                symbol=order.symbol,
                side=order.side,
                amount=order.amount,
                price=execution_price,
            )

        # Update equity curve
        self._update_equity_curve()

        return executed_order

    def _update_position(
        self, symbol: str, side: OrderSide, amount: Decimal, price: Decimal
    ):
        """Update position after trade."""
        position = self.positions.get(symbol)

        if position:
            if side == position.side:
                # Increase position
                new_amount = position.amount + amount
                new_entry_price = (
                    (position.entry_price * position.amount) + (price * amount)
                ) / new_amount

                position.amount = new_amount
                position.entry_price = new_entry_price
                position.current_price = price
                position.updated_at = self.current_time
            else:
                # Reduce or close position
                if amount >= position.amount:
                    # Close position
                    del self.positions[symbol]
                else:
                    # Reduce position
                    position.amount -= amount
                    position.current_price = price
                    position.updated_at = self.current_time
        else:
            # Create new position
            self.positions[symbol] = Position(
                symbol=symbol,
                side=side,
                amount=amount,
                entry_price=price,
                current_price=price,
                created_at=self.current_time,
                updated_at=self.current_time,
            )

    def _update_equity_curve(self):
        """Update equity curve and drawdown."""
        # Calculate total position value
        position_value = sum(
            pos.amount * self.get_current_price(pos.symbol)
            for pos in self.positions.values()
        )

        # Calculate equity
        total_equity = self.balance + position_value

        # Update equity curve
        self.equity_curve.append(
            {
                "timestamp": self.current_time,
                "equity": total_equity,
                "balance": self.balance,
                "position_value": position_value,
            }
        )

        # Calculate drawdown
        peak = max(point["equity"] for point in self.equity_curve)
        drawdown = (peak - total_equity) / peak

        self.drawdown_curve.append(
            {"timestamp": self.current_time, "drawdown": drawdown}
        )

    def calculate_performance(self) -> StrategyPerformance:
        """Calculate backtest performance metrics."""
        performance = StrategyPerformance()

        if self.trades:
            # Basic metrics
            performance.total_trades = len(self.trades)
            performance.winning_trades = sum(
                1
                for t in self.trades
                if (
                    t.side == OrderSide.BUY
                    and t.price < self.get_current_price(t.symbol)
                )
                or (
                    t.side == OrderSide.SELL
                    and t.price > self.get_current_price(t.symbol)
                )
            )
            performance.losing_trades = (
                performance.total_trades - performance.winning_trades
            )

            # PnL metrics
            equity_series = pd.Series(
                [point["equity"] for point in self.equity_curve],
                index=[point["timestamp"] for point in self.equity_curve],
            )
            returns = equity_series.pct_change().dropna()

            performance.total_pnl = Decimal(
                str(equity_series.iloc[-1] - self.initial_capital)
            )
            performance.max_drawdown = Decimal(
                str(max(point["drawdown"] for point in self.drawdown_curve))
            )

            # Risk metrics
            if len(returns) > 1:
                performance.sharpe_ratio = Decimal(
                    str(np.sqrt(252) * returns.mean() / returns.std())
                )

                downside_returns = returns[returns < 0]
                if len(downside_returns) > 0:
                    performance.sortino_ratio = Decimal(
                        str(np.sqrt(252) * returns.mean() / downside_returns.std())
                    )

            # Trading metrics
            if performance.total_trades > 0:
                performance.win_rate = Decimal(
                    performance.winning_trades / performance.total_trades
                )

                trade_durations = [
                    (t.timestamp - o.created_at).total_seconds() / 60
                    for t, o in zip(self.trades[1:], self.trades[:-1])
                ]
                if trade_durations:
                    performance.avg_trade_duration = float(np.mean(trade_durations))

        return performance

    def get_backtest_result(self, strategy_id: str) -> BacktestResult:
        """Get complete backtest result."""
        return BacktestResult(
            strategy_id=strategy_id,
            start_time=self.start_time,
            end_time=self.end_time,
            initial_capital=self.initial_capital,
            final_capital=Decimal(str(self.equity_curve[-1]["equity"])),
            total_trades=len(self.trades),
            performance=self.calculate_performance(),
            trades=[t.dict() for t in self.trades],
            equity_curve=self.equity_curve,
            drawdown_curve=self.drawdown_curve,
            parameters={
                "commission_rate": str(self.commission_rate),
                "slippage": str(self.slippage),
            },
        )
