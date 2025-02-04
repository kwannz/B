"""
Risk analytics service for advanced risk analysis
"""

import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from pymongo.database import Database
from scipy import stats
from scipy.optimize import minimize

from .market import MarketDataService
from ..shared.risk.risk_manager import RiskManager

logger = logging.getLogger(__name__)


class RiskAnalytics:
    """Advanced risk analytics system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_manager: RiskManager,
        lookback_days: int = 252,  # One year
        confidence_level: float = 0.99,
        risk_free_rate: float = 0.02,  # 2% annual
    ):
        """Initialize risk analytics."""
        self.db = db
        self.market_service = market_service
        self.risk_manager = risk_manager
        self.lookback_days = lookback_days
        self.confidence_level = confidence_level
        self.risk_free_rate = risk_free_rate

    async def calculate_advanced_metrics(self, user_id: str) -> Dict[str, Any]:
        """Calculate advanced risk metrics."""
        # Get positions and historical data
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return self._empty_metrics()

        # Get historical data
        returns_data, weights = await self._get_position_data(positions)

        if not returns_data:
            return self._empty_metrics()

        # Calculate metrics
        metrics = {}

        # Portfolio returns
        portfolio_returns = self._calculate_portfolio_returns(returns_data, weights)

        # Basic statistics
        metrics.update(self._calculate_basic_stats(portfolio_returns))

        # Risk metrics
        metrics.update(self._calculate_risk_metrics(portfolio_returns))

        # Performance metrics
        metrics.update(
            self._calculate_performance_metrics(portfolio_returns, self.risk_free_rate)
        )

        # Tail risk metrics
        metrics.update(self._calculate_tail_risk(portfolio_returns))

        return metrics

    async def analyze_risk_factors(self, user_id: str) -> Dict[str, Any]:
        """Analyze portfolio risk factors."""
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Get historical data
        returns_data, weights = await self._get_position_data(positions)

        if not returns_data:
            return {}

        # Calculate risk decomposition
        risk_factors = {}

        # Principal Component Analysis
        pca_factors = self._calculate_pca_factors(returns_data)
        risk_factors["pca"] = pca_factors

        # Factor exposures
        exposures = await self._calculate_factor_exposures(returns_data, weights)
        risk_factors["exposures"] = exposures

        # Correlation analysis
        correlations = self._calculate_correlation_matrix(returns_data)
        risk_factors["correlations"] = correlations

        return risk_factors

    def _apply_stress_scenario(
        self, returns_data: pd.DataFrame, scenario: Dict[str, Any]
    ) -> pd.DataFrame:
        """Apply stress scenario to returns data."""
        stressed_returns = returns_data.copy()
        
        if "market_shock" in scenario:
            stressed_returns = stressed_returns * (1 + float(scenario["market_shock"]))
            
        if "volatility_multiplier" in scenario:
            vol_adj = float(scenario["volatility_multiplier"])
            means = stressed_returns.mean()
            stressed_returns = (stressed_returns - means) * vol_adj + means
            
        if "correlation_stress" in scenario:
            corr_stress = float(scenario["correlation_stress"])
            if corr_stress > 0:
                means = stressed_returns.mean()
                stressed_returns = (
                    stressed_returns * (1 - corr_stress) + means * corr_stress
                )
                
        return stressed_returns
    async def calculate_stress_metrics(
        self, user_id: str, scenario: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate stress test metrics."""
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Get historical data
        returns_data, weights = await self._get_position_data(positions)

        if not returns_data:
            return {}

        # Apply stress scenario
        stressed_returns = self._apply_stress_scenario(returns_data, scenario)

        # Calculate stressed metrics
        metrics = {}

        # Portfolio returns under stress
        stressed_portfolio_returns = self._calculate_portfolio_returns(
            stressed_returns, weights
        )

        # Risk metrics under stress
        metrics["var"] = self._calculate_var(
            stressed_portfolio_returns, self.confidence_level
        )
        metrics["cvar"] = self._calculate_cvar(
            stressed_portfolio_returns, self.confidence_level
        )
        metrics["volatility"] = float(stressed_portfolio_returns.std() * np.sqrt(252))

        # Maximum drawdown under stress
        metrics["max_drawdown"] = self._calculate_max_drawdown(
            stressed_portfolio_returns
        )

        return metrics

    async def optimize_portfolio(
        self,
        user_id: str,
        target_return: Optional[float] = None,
        target_risk: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Optimize portfolio weights."""
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Get historical data
        returns_data, current_weights = await self._get_position_data(positions)

        if not returns_data:
            return {}

        # Calculate optimal weights
        optimal_weights = self._optimize_weights(
            returns_data, target_return, target_risk
        )

        # Calculate metrics for both portfolios
        current_metrics = self._calculate_portfolio_metrics(
            returns_data, current_weights
        )

        optimal_metrics = self._calculate_portfolio_metrics(
            returns_data, optimal_weights
        )

        return {
            "current_portfolio": current_metrics,
            "optimal_portfolio": optimal_metrics,
            "recommended_changes": self._get_portfolio_changes(
                positions, current_weights, optimal_weights
            ),
        }

    async def _get_position_data(
        self, positions: List[Dict[str, Any]]
    ) -> Tuple[pd.DataFrame, Dict[str, float]]:
        """Get historical data and weights for positions."""
        returns_data = {}
        weights = {}
        total_value = Decimal("0")

        for position in positions:
            symbol = position["symbol"]
            amount = Decimal(str(position["amount"]))
            price = Decimal(str(position["current_price"]))
            position_value = amount * price
            total_value += position_value

            # Get historical data
            klines = await self.market_service.get_klines(
                symbol=symbol, interval="1d", limit=self.lookback_days
            )

            if klines:
                prices = pd.Series(
                    [float(k.close) for k in klines],
                    index=[k.open_time for k in klines],
                )
                returns_data[symbol] = prices.pct_change().dropna()
                weights[symbol] = float(position_value / total_value)

        return pd.DataFrame(returns_data), weights

    def _calculate_portfolio_returns(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> pd.Series:
        """Calculate portfolio returns."""
        return returns_data.dot(pd.Series(weights))

    def _calculate_basic_stats(self, returns: pd.Series) -> Dict[str, float]:
        """Calculate basic statistical metrics."""
        return {
            "mean_return": float(returns.mean() * 252),
            "volatility": float(returns.std() * np.sqrt(252)),
            "skewness": float(stats.skew(returns.to_numpy())),
            "kurtosis": float(stats.kurtosis(returns.to_numpy())),
        }

    def _calculate_risk_metrics(self, returns: pd.Series) -> Dict[str, float]:
        """Calculate risk metrics."""
        return {
            "var": self._calculate_var(returns, self.confidence_level),
            "cvar": self._calculate_cvar(returns, self.confidence_level),
            "downside_deviation": self._calculate_downside_deviation(returns),
            "max_drawdown": self._calculate_max_drawdown(returns),
        }

    def _calculate_performance_metrics(
        self, returns: pd.Series, risk_free_rate: float
    ) -> Dict[str, float]:
        """Calculate performance metrics."""
        excess_returns = returns - risk_free_rate / 252

        return {
            "sharpe_ratio": self._calculate_sharpe_ratio(returns, risk_free_rate),
            "sortino_ratio": self._calculate_sortino_ratio(returns, risk_free_rate),
            "calmar_ratio": self._calculate_calmar_ratio(returns, risk_free_rate),
            "information_ratio": self._calculate_information_ratio(excess_returns),
        }

    def _calculate_tail_risk(self, returns: pd.Series) -> Dict[str, float]:
        """Calculate tail risk metrics."""
        return {
            "expected_shortfall": self._calculate_expected_shortfall(returns),
            "tail_dependence": self._calculate_tail_dependence(returns),
            "extreme_value": self._calculate_extreme_value(returns),
        }

    def _calculate_var(self, returns: pd.Series, confidence_level: float) -> float:
        """Calculate Value at Risk."""
        return float(np.percentile(returns, (1 - confidence_level) * 100))

    def _calculate_cvar(self, returns: pd.Series, confidence_level: float) -> float:
        """Calculate Conditional Value at Risk."""
        var = self._calculate_var(returns, confidence_level)
        return float(returns[returns <= var].mean())

    def _calculate_downside_deviation(self, returns: pd.Series) -> float:
        """Calculate downside deviation."""
        negative_returns = returns[returns < 0]
        return float(np.sqrt(np.mean(negative_returns**2)))

    def _calculate_max_drawdown(self, returns: pd.Series) -> float:
        """Calculate maximum drawdown."""
        cumulative = (1 + returns).cumprod()
        rolling_max = cumulative.expanding().max()
        drawdowns = (cumulative - rolling_max) / rolling_max
        return float(abs(drawdowns.min()))

    def _calculate_sharpe_ratio(
        self, returns: pd.Series, risk_free_rate: float
    ) -> float:
        """Calculate Sharpe ratio."""
        excess_returns = returns - risk_free_rate / 252
        return float(np.sqrt(252) * excess_returns.mean() / returns.std())

    def _calculate_sortino_ratio(
        self, returns: pd.Series, risk_free_rate: float
    ) -> float:
        """Calculate Sortino ratio."""
        excess_returns = returns - risk_free_rate / 252
        downside_std = self._calculate_downside_deviation(returns)

        if downside_std == 0:
            return 0.0

        return float(np.sqrt(252) * excess_returns.mean() / downside_std)

    def _calculate_calmar_ratio(
        self, returns: pd.Series, risk_free_rate: float
    ) -> float:
        """Calculate Calmar ratio."""
        excess_returns = returns - risk_free_rate / 252
        max_drawdown = self._calculate_max_drawdown(returns)

        if max_drawdown == 0:
            return 0.0

        return float(252 * excess_returns.mean() / max_drawdown)

    def _calculate_information_ratio(self, excess_returns: pd.Series) -> float:
        """Calculate Information ratio."""
        if len(excess_returns) < 2:
            return 0.0

        return float(np.sqrt(252) * excess_returns.mean() / excess_returns.std())

    def _calculate_expected_shortfall(self, returns: pd.Series) -> float:
        """Calculate Expected Shortfall."""
        var = self._calculate_var(returns, self.confidence_level)
        return float(returns[returns <= var].mean())

    def _calculate_tail_dependence(self, returns: pd.Series) -> float:
        """Calculate tail dependence coefficient."""
        # Using empirical copula
        ranks = returns.rank() / (len(returns) + 1)
        threshold = 0.1  # 10% tail

        joint_exceedance = np.mean((ranks <= threshold) & (ranks.shift(1) <= threshold))

        return float(joint_exceedance / threshold)

    def _calculate_extreme_value(self, returns: pd.Series) -> float:
        """Calculate extreme value estimate."""
        # Using Peak Over Threshold method
        threshold = np.percentile(returns, 5)  # 5% threshold
        exceedances = returns[returns <= threshold]

        if len(exceedances) < 2:
            return float(returns.min())

        # Fit Generalized Pareto Distribution
        shape, loc, scale = stats.genpareto.fit(-exceedances)

        # Calculate 99.9% VaR
        return float(-stats.genpareto.ppf(0.999, shape, loc, scale))

    def _calculate_pca_factors(self, returns_data: pd.DataFrame) -> Dict[str, Any]:
        """Calculate principal component factors."""
        # Standardize returns
        standardized_returns = (returns_data - returns_data.mean()) / returns_data.std()

        # Calculate correlation matrix
        corr_matrix = standardized_returns.corr().values

        # Perform PCA
        eigenvalues, eigenvectors = np.linalg.eigh(corr_matrix)

        # Sort by eigenvalue in descending order
        idx = eigenvalues.argsort()[::-1]
        eigenvalues = eigenvalues[idx].astype(np.float64)
        eigenvectors = eigenvectors[:, idx].astype(np.float64)

        # Calculate explained variance
        total_var = np.sum(eigenvalues)
        explained_var = eigenvalues / total_var

        return {
            "eigenvalues": eigenvalues.tolist(),
            "eigenvectors": eigenvectors.tolist(),
            "explained_variance": explained_var.tolist(),
            "cumulative_variance": np.cumsum(explained_var).tolist(),
        }

    async def _calculate_factor_exposures(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> Dict[str, float]:
        """Calculate factor exposures."""
        # Get market returns
        market_returns = await self.risk_manager.get_market_returns()

        exposures = {}
        portfolio_returns = self._calculate_portfolio_returns(returns_data, weights)

        # Market beta
        cov_matrix = np.cov(portfolio_returns.to_numpy(), market_returns)
        market_beta = cov_matrix[0, 1] / np.var(market_returns)
        exposures["market_beta"] = float(market_beta)

        # Size factor (using volume as proxy)
        volumes = {}
        for symbol in returns_data.columns:
            klines = await self.market_service.get_klines(
                symbol=symbol, interval="1d", limit=1
            )
            if klines:
                volumes[symbol] = float(klines[0].volume)

        size_exposure = sum(
            weights[symbol] * volumes.get(symbol, 0) for symbol in weights
        )
        exposures["size"] = float(size_exposure)

        # Momentum factor
        momentum = {}
        for symbol in returns_data.columns:
            returns = returns_data[symbol]
            momentum[symbol] = float(np.prod(1 + returns.to_numpy()) - 1.0)

        momentum_exposure = sum(
            weights[symbol] * momentum.get(symbol, 0) for symbol in weights
        )
        exposures["momentum"] = float(momentum_exposure)

        return exposures

    def _calculate_correlation_matrix(
        self, returns_data: pd.DataFrame
    ) -> Dict[str, List[float]]:
        """Calculate correlation matrix."""
        corr_matrix = returns_data.corr()
        matrix_values = corr_matrix.values.astype(float).tolist()
        symbols = [float(i) for i in range(len(returns_data.columns))]  # Use numeric indices instead of symbols

        return {
            "symbols": symbols,
            "matrix": matrix_values,
        }

    def _optimize_weights(
        self,
        returns_data: pd.DataFrame,
        target_return: Optional[float] = None,
        target_risk: Optional[float] = None,
    ) -> Dict[str, float]:
        """Optimize portfolio weights."""
        n_assets = len(returns_data.columns)

        # Calculate mean returns and covariance
        mean_returns = returns_data.mean() * 252
        cov_matrix = returns_data.cov() * 252

        # Define optimization constraints
        constraints = [
            {"type": "eq", "fun": lambda x: np.sum(x) - 1}  # Weights sum to 1
        ]

        bounds = tuple((0, 1) for _ in range(n_assets))  # No short selling

        if target_return is not None:
            constraints.append(
                {
                    "type": "eq",
                    "fun": lambda x: np.sum(mean_returns * x) - target_return,
                }
            )

        if target_risk is not None:
            constraints.append(
                {
                    "type": "eq",
                    "fun": lambda x: np.sqrt(np.dot(x.T, np.dot(cov_matrix, x)))
                    - target_risk,
                }
            )

        # Minimize portfolio variance
        def objective(x):
            return np.sqrt(np.dot(x.T, np.dot(cov_matrix, x)))

        # Initial guess: equal weights
        x0 = np.array([1 / n_assets] * n_assets)

        result = minimize(
            objective, x0, method="SLSQP", bounds=bounds, constraints=constraints
        )

        return dict(zip(returns_data.columns, result.x))

    def _calculate_portfolio_metrics(
        self, returns_data: pd.DataFrame, weights: Dict[str, float]
    ) -> Dict[str, Any]:
        """Calculate portfolio metrics."""
        portfolio_returns = self._calculate_portfolio_returns(returns_data, weights)

        return {
            "weights": weights,
            "expected_return": float(portfolio_returns.mean() * 252),
            "volatility": float(portfolio_returns.std() * np.sqrt(252)),
            "sharpe_ratio": self._calculate_sharpe_ratio(
                portfolio_returns, self.risk_free_rate
            ),
        }

    def _get_portfolio_changes(
        self,
        positions: List[Dict[str, Any]],
        current_weights: Dict[str, float],
        optimal_weights: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        """Get recommended portfolio changes."""
        changes = []

        for position in positions:
            symbol = position["symbol"]
            current_weight = current_weights.get(symbol, 0)
            optimal_weight = optimal_weights.get(symbol, 0)

            if abs(optimal_weight - current_weight) > 0.01:  # 1% threshold
                changes.append(
                    {
                        "symbol": symbol,
                        "current_weight": current_weight,
                        "optimal_weight": optimal_weight,
                        "change": optimal_weight - current_weight,
                    }
                )

        return changes

    def _empty_metrics(self) -> Dict[str, Any]:
        """Return empty metrics structure."""
        return {
            "mean_return": 0.0,
            "volatility": 0.0,
            "sharpe_ratio": 0.0,
            "sortino_ratio": 0.0,
            "var": 0.0,
            "cvar": 0.0,
            "max_drawdown": 0.0,
        }
