"""
Risk attribution service for analyzing risk sources
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from pymongo.database import Database
from scipy import stats
from sklearn.decomposition import PCA

from ..core.exceptions import RiskError
from ..models.trading import OrderSide, Position
from .market import MarketDataService
from .risk import RiskManager
from .risk_analytics import RiskAnalytics

logger = logging.getLogger(__name__)


class RiskAttribution:
    """Risk attribution analysis system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_manager: RiskManager,
        risk_analytics: RiskAnalytics,
        lookback_days: int = 252,  # 1 year
    ):
        """Initialize risk attribution."""
        self.db = db
        self.market_service = market_service
        self.risk_manager = risk_manager
        self.risk_analytics = risk_analytics
        self.lookback_days = lookback_days

    async def analyze_risk_sources(self, user_id: str) -> Dict[str, Any]:
        """Analyze sources of portfolio risk."""
        # Get positions and historical data
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Get historical data
        returns_data, weights = await self.risk_analytics._get_position_data(positions)

        if len(returns_data) == 0:
            return {}

        # Calculate risk decomposition
        decomposition = {}

        # Component VaR
        decomposition["var_contribution"] = await self._calculate_component_var(
            returns_data, weights
        )

        # Risk factor attribution
        decomposition["factor_attribution"] = await self._calculate_factor_attribution(
            returns_data, weights
        )

        # Style analysis
        decomposition["style_attribution"] = await self._calculate_style_attribution(
            returns_data, weights
        )

        # Risk concentration
        decomposition["concentration"] = self._calculate_concentration(weights)

        return decomposition

    async def analyze_performance_attribution(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Analyze sources of portfolio performance."""
        # Get positions history
        query = {"user_id": user_id, "status": {"$in": ["open", "closed"]}}

        if start_date:
            query["created_at"] = {"$gte": start_date}
        if end_date:
            query["closed_at"] = {"$lte": end_date}

        positions = await self.db.positions.find(query).to_list(None)

        if not positions:
            return {}

        # Calculate performance attribution
        attribution = {}

        # Selection effect
        attribution["selection"] = await self._calculate_selection_effect(positions)

        # Allocation effect
        attribution["allocation"] = await self._calculate_allocation_effect(positions)

        # Interaction effect
        attribution["interaction"] = await self._calculate_interaction_effect(positions)

        # Trading effect
        attribution["trading"] = await self._calculate_trading_effect(positions)

        return attribution

    async def generate_risk_report(self, user_id: str) -> Dict[str, Any]:
        """Generate comprehensive risk report."""
        # Get current portfolio state
        portfolio_metrics = await self.risk_analytics.calculate_advanced_metrics(
            user_id
        )

        # Get risk decomposition
        risk_sources = await self.analyze_risk_sources(user_id)

        # Get performance attribution
        performance = await self.analyze_performance_attribution(
            user_id, start_date=datetime.utcnow() - timedelta(days=30)  # Last 30 days
        )

        # Get risk predictions
        predictions = await self.risk_manager.predict_risk_metrics(user_id)

        return {
            "timestamp": datetime.utcnow(),
            "portfolio_metrics": portfolio_metrics,
            "risk_sources": risk_sources,
            "performance_attribution": performance,
            "risk_predictions": predictions,
        }

    async def _calculate_component_var(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> Dict[str, float]:
        """Calculate component VaR contribution."""
        portfolio_returns = self.risk_analytics._calculate_portfolio_returns(
            returns_data, weights
        )

        # Calculate portfolio VaR
        var = self.risk_analytics._calculate_var(
            portfolio_returns, self.risk_analytics.confidence_level
        )

        # Calculate marginal VaR contributions
        contributions = {}

        for symbol in returns_data.columns:
            # Calculate covariance with portfolio
            symbol_returns = returns_data[symbol]
            cov = np.cov(portfolio_returns, symbol_returns)[0, 1]

            # Calculate marginal contribution
            marginal_var = weights[symbol] * cov / (portfolio_returns.std() * var)
            contributions[symbol] = float(marginal_var)

        return contributions

    async def _calculate_factor_attribution(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> Dict[str, Dict[str, float]]:
        """Calculate risk factor attribution."""
        # Get market data
        market_returns = await self.risk_manager.get_market_returns()

        # Calculate factor exposures and contributions
        factors = {}
        portfolio_returns = self.risk_analytics._calculate_portfolio_returns(
            returns_data, weights
        )

        # Market factor
        market_beta = np.cov(portfolio_returns, market_returns)[0, 1] / np.var(
            market_returns
        )
        market_contrib = market_beta * market_returns.std()

        factors["market"] = {
            "exposure": float(market_beta),
            "contribution": float(market_contrib),
        }

        # Size factor
        size_exposures = {}
        for symbol in returns_data.columns:
            klines = await self.market_service.get_klines(
                symbol=symbol, interval="1d", limit=1
            )
            if klines:
                size_exposures[symbol] = float(klines[0].volume)

        size_factor = pd.Series(size_exposures)
        size_beta = np.cov(portfolio_returns, size_factor)[0, 1] / np.var(size_factor)
        size_contrib = size_beta * size_factor.std()

        factors["size"] = {
            "exposure": float(size_beta),
            "contribution": float(size_contrib),
        }

        # Momentum factor
        momentum_exposures = {}
        for symbol in returns_data.columns:
            returns = returns_data[symbol]
            momentum_exposures[symbol] = float((1 + returns).prod() - 1)

        momentum_factor = pd.Series(momentum_exposures)
        momentum_beta = np.cov(portfolio_returns, momentum_factor)[0, 1] / np.var(
            momentum_factor
        )
        momentum_contrib = momentum_beta * momentum_factor.std()

        factors["momentum"] = {
            "exposure": float(momentum_beta),
            "contribution": float(momentum_contrib),
        }

        return factors

    async def _calculate_style_attribution(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> Dict[str, float]:
        """Calculate investment style attribution."""
        # Perform PCA on returns
        pca = PCA(n_components=3)
        pca_result = pca.fit_transform(returns_data)

        # Calculate style exposures
        portfolio_returns = self.risk_analytics._calculate_portfolio_returns(
            returns_data, weights
        )

        styles = {}
        for i, component in enumerate(pca.components_):
            exposure = np.corrcoef(portfolio_returns, pca_result[:, i])[0, 1]
            contribution = exposure * np.sqrt(pca.explained_variance_ratio_[i])

            styles[f"style_{i+1}"] = {
                "exposure": float(exposure),
                "contribution": float(contribution),
                "explained_variance": float(pca.explained_variance_ratio_[i]),
            }

        return styles

    def _calculate_concentration(self, weights: Dict[str, float]) -> Dict[str, float]:
        """Calculate risk concentration metrics."""
        # Herfindahl-Hirschman Index
        hhi = sum(w * w for w in weights.values())

        # Gini coefficient
        sorted_weights = sorted(weights.values())
        n = len(sorted_weights)
        gini = sum((2 * i - n - 1) * w for i, w in enumerate(sorted_weights, 1)) / (
            n * sum(sorted_weights)
        )

        # Theil entropy
        theil = -sum(w * np.log(w) if w > 0 else 0 for w in weights.values())

        return {"hhi": float(hhi), "gini": float(gini), "theil": float(theil)}

    async def _calculate_selection_effect(
        self, positions: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate security selection effect."""
        selection_effects = {}

        for position in positions:
            symbol = position["symbol"]
            weight = float(position["amount"] * position["entry_price"])

            # Get benchmark return
            market_returns = await self.risk_manager.get_market_returns()
            benchmark_return = float(market_returns.mean())

            # Calculate security return
            security_return = float(
                (position["exit_price"] - position["entry_price"])
                / position["entry_price"]
                if position["status"] == "closed"
                else (position["current_price"] - position["entry_price"])
                / position["entry_price"]
            )

            # Calculate selection effect
            selection_effects[symbol] = weight * (security_return - benchmark_return)

        return selection_effects

    async def _calculate_allocation_effect(
        self, positions: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate asset allocation effect."""
        allocation_effects = {}

        # Get benchmark weights (equal-weighted)
        n_assets = len(positions)
        benchmark_weight = 1.0 / n_assets if n_assets > 0 else 0

        for position in positions:
            symbol = position["symbol"]
            weight = float(position["amount"] * position["entry_price"])

            # Get market return
            market_returns = await self.risk_manager.get_market_returns()
            market_return = float(market_returns.mean())

            # Calculate allocation effect
            allocation_effects[symbol] = (weight - benchmark_weight) * market_return

        return allocation_effects

    async def _calculate_interaction_effect(
        self, positions: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate interaction effect."""
        interaction_effects = {}

        # Get benchmark weights
        n_assets = len(positions)
        benchmark_weight = 1.0 / n_assets if n_assets > 0 else 0

        for position in positions:
            symbol = position["symbol"]
            weight = float(position["amount"] * position["entry_price"])

            # Get returns
            market_returns = await self.risk_manager.get_market_returns()
            market_return = float(market_returns.mean())

            security_return = float(
                (position["exit_price"] - position["entry_price"])
                / position["entry_price"]
                if position["status"] == "closed"
                else (position["current_price"] - position["entry_price"])
                / position["entry_price"]
            )

            # Calculate interaction effect
            interaction_effects[symbol] = (weight - benchmark_weight) * (
                security_return - market_return
            )

        return interaction_effects

    async def _calculate_trading_effect(
        self, positions: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Calculate trading effect."""
        trading_effects = {}

        for position in positions:
            symbol = position["symbol"]

            # Get all trades for this position
            trades = await self.db.trades.find(
                {"position_id": position["_id"]}
            ).to_list(None)

            if not trades:
                continue

            # Calculate trading effect
            total_effect = 0.0

            for trade in trades:
                # Calculate price impact
                price_impact = (trade["price"] - position["entry_price"]) / position[
                    "entry_price"
                ]

                # Calculate volume impact
                volume_impact = float(trade["amount"]) / float(position["amount"])

                total_effect += price_impact * volume_impact

            trading_effects[symbol] = total_effect

        return trading_effects
