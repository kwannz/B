"""
Risk monitoring service for real-time risk tracking
"""

from typing import List, Dict, Any, Optional, Set
from decimal import Decimal
import asyncio
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from pymongo.database import Database

from ..models.trading import Position, OrderSide
from ..models.market import Ticker
from ..core.exceptions import RiskError
from .market import MarketDataService
from .risk import RiskManager
from .backtest import BacktestEngine

logger = logging.getLogger(__name__)


class RiskMonitor:
    """Real-time risk monitoring system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_manager: RiskManager,
        update_interval: int = 60,  # 1 minute
        alert_thresholds: Optional[Dict[str, Decimal]] = None,
    ):
        """Initialize risk monitor."""
        self.db = db
        self.market_service = market_service
        self.risk_manager = risk_manager
        self.update_interval = update_interval
        self.alert_thresholds = alert_thresholds or {
            "drawdown": Decimal("0.05"),  # 5% drawdown
            "var": Decimal("0.03"),  # 3% VaR
            "correlation": Decimal("0.8"),  # 80% correlation
            "concentration": Decimal("0.3"),  # 30% in single position
            "leverage": Decimal("2.5"),  # 2.5x leverage
        }

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._monitored_users: Set[str] = set()
        self._market_data_cache: Dict[str, pd.DataFrame] = {}
        self._last_alert_time: Dict[str, datetime] = {}

        # Initialize market index data
        self._market_index_symbols = [
            "BTC/USDT",
            "ETH/USDT",
        ]  # Major crypto pairs as market proxy
        self._market_index_weights = [0.7, 0.3]  # BTC dominance weighted
        self._market_returns: Optional[pd.Series] = None

    async def start(self):
        """Start risk monitoring."""
        if self._running:
            logger.warning("Risk monitor already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info("Risk monitor started")

    async def stop(self):
        """Stop risk monitoring."""
        if not self._running:
            return

        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Risk monitor stopped")

    async def add_user(self, user_id: str):
        """Add user to monitoring."""
        self._monitored_users.add(user_id)
        logger.info(f"Added user {user_id} to risk monitoring")

    async def remove_user(self, user_id: str):
        """Remove user from monitoring."""
        self._monitored_users.discard(user_id)
        logger.info(f"Removed user {user_id} from risk monitoring")

    async def _monitor_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                await self._update_market_data()

                for user_id in self._monitored_users:
                    await self._check_user_risks(user_id)

                await asyncio.sleep(self.update_interval)
            except Exception as e:
                logger.error(f"Error in risk monitoring loop: {e}")
                await asyncio.sleep(5)  # Short delay before retry

    async def _update_market_data(self):
        """Update market data cache."""
        # Update market index data
        returns_data = {}

        for symbol in self._market_index_symbols:
            klines = await self.market_service.get_klines(
                symbol=symbol, interval="1h", limit=168  # One week of hourly data
            )

            prices = pd.Series(
                [float(k.close) for k in klines], index=[k.open_time for k in klines]
            )

            returns_data[symbol] = prices.pct_change().dropna()

        # Calculate market index returns
        returns_df = pd.DataFrame(returns_data)
        self._market_returns = returns_df.dot(self._market_index_weights)

        # Cache the data
        self._market_data_cache = returns_df

    async def _check_user_risks(self, user_id: str):
        """Check risk metrics for a user."""
        # Get portfolio metrics
        metrics = await self.risk_manager.calculate_portfolio_metrics(user_id)

        alerts = []

        # Check drawdown
        if metrics["max_drawdown"] > self.alert_thresholds["drawdown"]:
            alerts.append(
                {
                    "type": "drawdown",
                    "value": metrics["max_drawdown"],
                    "threshold": self.alert_thresholds["drawdown"],
                }
            )

        # Check VaR
        if metrics["var"] > self.alert_thresholds["var"]:
            alerts.append(
                {
                    "type": "var",
                    "value": metrics["var"],
                    "threshold": self.alert_thresholds["var"],
                }
            )

        # Get positions for additional checks
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if positions:
            # Check position concentration
            account = await self.db.accounts.find_one({"user_id": user_id})
            balance = Decimal(str(account["balance"]))

            for position in positions:
                position_value = Decimal(str(position["amount"])) * Decimal(
                    str(position["current_price"])
                )
                concentration = position_value / balance

                if concentration > self.alert_thresholds["concentration"]:
                    alerts.append(
                        {
                            "type": "concentration",
                            "symbol": position["symbol"],
                            "value": concentration,
                            "threshold": self.alert_thresholds["concentration"],
                        }
                    )

            # Check correlations
            symbols = [p["symbol"] for p in positions]
            for i, symbol1 in enumerate(symbols):
                for symbol2 in symbols[i + 1 :]:
                    correlation = await self.risk_manager._calculate_correlation(
                        symbol1, [symbol2]
                    )
                    if correlation > self.alert_thresholds["correlation"]:
                        alerts.append(
                            {
                                "type": "correlation",
                                "symbols": [symbol1, symbol2],
                                "value": correlation,
                                "threshold": self.alert_thresholds["correlation"],
                            }
                        )

        # Generate alerts if needed
        if alerts:
            await self._generate_alerts(user_id, alerts)

    async def _generate_alerts(self, user_id: str, alerts: List[Dict[str, Any]]):
        """Generate risk alerts."""
        current_time = datetime.utcnow()

        # Check if enough time has passed since last alert
        last_alert = self._last_alert_time.get(user_id)
        if last_alert and (current_time - last_alert) < timedelta(minutes=30):
            return

        # Save alerts to database
        alert_doc = {"user_id": user_id, "timestamp": current_time, "alerts": alerts}
        await self.db.risk_alerts.insert_one(alert_doc)

        # Update last alert time
        self._last_alert_time[user_id] = current_time

        # Log alerts
        for alert in alerts:
            logger.warning(
                f"Risk alert for user {user_id}: "
                f"{alert['type']} = {alert['value']} "
                f"exceeds threshold {alert['threshold']}"
            )

    async def get_market_returns(self) -> pd.Series:
        """Get market index returns for risk calculations."""
        if self._market_returns is None:
            await self._update_market_data()
        return self._market_returns

    async def run_scenario_analysis(
        self, user_id: str, scenarios: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """Run multiple scenario analyses."""
        results = []

        # Use default scenarios if none provided
        test_scenarios = scenarios or self.risk_manager._default_scenarios()

        for scenario in test_scenarios:
            result = await self.risk_manager.run_stress_test(user_id, scenario)
            results.append(result)

        return results

    async def calculate_risk_contribution(
        self, user_id: str
    ) -> Dict[str, Dict[str, Decimal]]:
        """Calculate risk contribution of each position."""
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Get historical data for all positions
        returns_data = {}
        position_values = {}
        total_value = Decimal("0")

        for position in positions:
            symbol = position["symbol"]
            amount = Decimal(str(position["amount"]))
            price = Decimal(str(position["current_price"]))
            position_value = amount * price

            klines = await self.market_service.get_klines(
                symbol=symbol, interval="1d", limit=252
            )

            prices = pd.Series([float(k.close) for k in klines])
            returns_data[symbol] = prices.pct_change().dropna()
            position_values[symbol] = position_value
            total_value += position_value

        # Calculate portfolio metrics
        returns_df = pd.DataFrame(returns_data)
        cov_matrix = returns_df.cov()
        weights = {
            symbol: float(value / total_value)
            for symbol, value in position_values.items()
        }

        # Calculate risk metrics for each position
        risk_contributions = {}

        for symbol in positions:
            symbol = symbol["symbol"]
            # Marginal VaR
            position_var = await self.risk_manager._calculate_var(
                symbol, position_values[symbol], OrderSide.BUY
            )

            # Beta to portfolio
            symbol_returns = returns_df[symbol]
            portfolio_returns = returns_df.dot(pd.Series(weights))
            beta = np.cov(symbol_returns, portfolio_returns)[0][1] / np.var(
                portfolio_returns
            )

            risk_contributions[symbol] = {
                "var_contribution": position_var / total_value,
                "beta": Decimal(str(beta)),
                "weight": Decimal(str(weights[symbol])),
            }

        return risk_contributions
