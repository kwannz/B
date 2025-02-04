"""
Machine learning service for risk prediction and limit adjustment
"""

import logging
import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from pymongo.database import Database
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler

from ..models.trading import Position
from .market import MarketDataService
from .risk_analytics import RiskAnalytics

logger = logging.getLogger(__name__)


class RiskML:
    """Machine learning based risk management system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_analytics: RiskAnalytics,
        model_path: str = "models",
        update_interval: int = 24 * 60 * 60,  # 1 day
        training_lookback: int = 252,  # 1 year
        prediction_horizon: int = 5,  # 5 days
    ):
        """Initialize risk ML system."""
        self.db = db
        self.market_service = market_service
        self.risk_analytics = risk_analytics
        self.model_path = model_path
        self.update_interval = update_interval
        self.training_lookback = training_lookback
        self.prediction_horizon = prediction_horizon

        # Ensure model directory exists
        os.makedirs(model_path, exist_ok=True)

        # Initialize models
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.var_predictor = RandomForestRegressor(n_estimators=100, random_state=42)
        self.volatility_predictor = RandomForestRegressor(n_estimators=100, random_state=42)
        self.correlation_predictor = RandomForestRegressor(n_estimators=100, random_state=42)

        # Initialize scalers
        self.feature_scaler = StandardScaler()
        self.target_scalers = {
            "var": StandardScaler(),
            "volatility": StandardScaler(),
            "correlation": StandardScaler()
        }

        # Last update timestamp
        self._last_update = None

    async def initialize(self):
        """Initialize ML models."""
        # Load existing models if available
        try:
            self.anomaly_detector = joblib.load(
                os.path.join(self.model_path, "anomaly_detector.joblib")
            )
            self.var_predictor = joblib.load(
                os.path.join(self.model_path, "var_predictor.joblib")
            )
            self.volatility_predictor = joblib.load(
                os.path.join(self.model_path, "volatility_predictor.joblib")
            )
            self.correlation_predictor = joblib.load(
                os.path.join(self.model_path, "correlation_predictor.joblib")
            )
            self.feature_scaler = joblib.load(
                os.path.join(self.model_path, "feature_scaler.joblib")
            )

            for target in ["var", "volatility", "correlation"]:
                self.target_scalers[target] = joblib.load(
                    os.path.join(self.model_path, f"{target}_scaler.joblib")
                )

            logger.info("Loaded existing ML models")

        except FileNotFoundError:
            logger.info("No existing models found, will train new ones")
            await self.train_models()

    async def train_models(self):
        """Train ML models."""
        # Get historical data
        features, targets = await self._prepare_training_data()

        if len(features) < self.training_lookback:
            logger.warning("Insufficient data for training")
            return

        # Train anomaly detector
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.anomaly_detector.fit(features)

        # Scale features
        self.feature_scaler = StandardScaler()
        scaled_features = self.feature_scaler.fit_transform(features)

        # Train predictors
        for target_name in targets:
            # Scale target
            target_scaler = StandardScaler()
            scaled_target = target_scaler.fit_transform(
                targets[target_name].reshape(-1, 1)
            )
            self.target_scalers[target_name] = target_scaler

            # Train predictor
            predictor = RandomForestRegressor(n_estimators=100, random_state=42)
            predictor.fit(scaled_features, scaled_target.ravel())

            # Save predictor
            setattr(self, f"{target_name}_predictor", predictor)

        # Save models
        self._save_models()

        self._last_update = datetime.utcnow()
        logger.info("Successfully trained ML models")

    async def detect_anomalies(self, user_id: str) -> List[Dict[str, Any]]:
        """Detect anomalies in current positions."""
        # Get current positions
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return []

        # Extract features
        features = await self._extract_features(positions)

        if features is None:
            return []

        # Detect anomalies
        anomaly_scores = self.anomaly_detector.score_samples(features)
        anomalies = []

        for position, score in zip(positions, anomaly_scores):
            threshold = -0.5  # IsolationForest default threshold
            if score < threshold:
                anomalies.append(
                    {
                        "symbol": position["symbol"],
                        "score": float(score),
                        "threshold": float(threshold),
                        "features": {
                            name: float(value)
                            for name, value in zip(
                                self._get_feature_names(), features[-1]
                            )
                        },
                    }
                )

        return anomalies

    async def predict_risk_metrics(self, user_id: str) -> Dict[str, List[float]]:
        """Predict risk metrics for the next few days."""
        # Get current positions
        positions = await self.db.positions.find(
            {"user_id": user_id, "status": "open"}
        ).to_list(None)

        if not positions:
            return {}

        # Extract features
        features = await self._extract_features(positions)

        if features is None:
            return {}

        # Scale features
        scaled_features = self.feature_scaler.transform(features)

        predictions = {}

        # Predict each metric
        for target_name in ["var", "volatility", "correlation"]:
            predictor = getattr(self, f"{target_name}_predictor")
            scaler = self.target_scalers[target_name]

            # Make predictions
            scaled_predictions = predictor.predict(scaled_features)

            # Inverse transform predictions
            predictions[target_name] = (
                scaler.inverse_transform(scaled_predictions.reshape(-1, 1))
                .ravel()
                .tolist()
            )

        return predictions

    async def adjust_risk_limits(self, user_id: str) -> Dict[str, Any]:
        """Adjust risk limits based on predictions."""
        # Get predictions
        predictions = await self.risk_analytics.predict_risk_metrics(user_id)

        if not predictions:
            return {}

        # Get current metrics
        current_metrics = await self.risk_analytics.calculate_advanced_metrics(user_id)

        # Calculate adjustment factors
        adjustments = {}

        for metric in ["var", "volatility"]:
            current = current_metrics.get(metric, 0)
            predicted = np.mean(predictions.get(metric, [current]))

            if current == 0:
                adjustments[metric] = 1.0
            else:
                # Adjust based on predicted change
                change = predicted / current
                # Limit adjustment to ±20%
                adjustments[metric] = max(0.8, min(1.2, change))

        # Get current limits
        user = await self.db.users.find_one({"_id": user_id})
        current_limits = user.get("risk_limits", {})

        # Calculate new limits
        new_limits = {
            "position_size": current_limits.get("position_size", 0.2),
            "var": current_limits.get("var", 0.02) * adjustments.get("var", 1.0),
            "volatility": current_limits.get("volatility", 0.3)
            * adjustments.get("volatility", 1.0),
            "correlation": current_limits.get("correlation", 0.7),
            "leverage": current_limits.get("leverage", 3.0),
        }

        # Apply minimum and maximum constraints
        new_limits = self._apply_limit_constraints(new_limits)

        # Save new limits
        await self.db.users.update_one(
            {"_id": user_id}, {"$set": {"risk_limits": new_limits}}
        )

        return {
            "current_limits": current_limits,
            "new_limits": new_limits,
            "adjustments": adjustments,
            "predictions": predictions,
        }

    async def _prepare_training_data(self) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        """Prepare training data for ML models."""
        # Get historical positions
        positions = await self.db.positions.find(
            {
                "status": "closed",
                "closed_at": {
                    "$gte": datetime.utcnow() - timedelta(days=self.training_lookback)
                },
            }
        ).to_list(None)

        if not positions:
            return np.array([]), {}

        # Group positions by date
        daily_positions = {}
        for position in positions:
            date = position["closed_at"].date()
            if date not in daily_positions:
                daily_positions[date] = []
            daily_positions[date].append(position)

        # Extract features and targets
        features_list = []
        targets = {"var": [], "volatility": [], "correlation": []}

        for date in sorted(daily_positions.keys()):
            # Extract features
            date_features = await self._extract_features(daily_positions[date])
            if date_features is not None:
                features_list.append(date_features)

            # Calculate actual risk metrics for next day
            next_date = date + timedelta(days=1)
            if next_date in daily_positions:
                next_positions = daily_positions[next_date]
                returns_data, weights = await self.risk_analytics._get_position_data(
                    next_positions
                )
                if len(returns_data) > 0:
                    portfolio_returns = (
                        self.risk_analytics._calculate_portfolio_returns(
                            returns_data, weights
                        )
                    )

                    # Calculate targets
                    targets["var"].append(
                        self.risk_analytics._calculate_var(
                            portfolio_returns, self.risk_analytics.confidence_level
                        )
                    )
                    targets["volatility"].append(
                        float(portfolio_returns.std() * np.sqrt(252))
                    )

                    if len(returns_data.columns) > 1:
                        corr_matrix = returns_data.corr()
                        targets["correlation"].append(
                            float(
                                corr_matrix.values[
                                    np.triu_indices_from(corr_matrix.values, 1)
                                ].mean()
                            )
                        )
                    else:
                        targets["correlation"].append(0.0)

        features = np.vstack(features_list)
        targets = {name: np.array(values) for name, values in targets.items()}

        return features, targets

    async def _extract_features(
        self, positions: List[Dict[str, Any]]
    ) -> Optional[np.ndarray]:
        """Extract features from positions."""
        if not positions:
            return None

        features = []

        # Get historical data
        returns_data, weights = await self.risk_analytics._get_position_data(positions)

        if len(returns_data) == 0:
            return None

        # Calculate portfolio returns
        portfolio_returns = self.risk_analytics._calculate_portfolio_returns(
            returns_data, weights
        )

        # Basic statistics
        features.extend(
            [
                portfolio_returns.mean(),
                portfolio_returns.std(),
                portfolio_returns.skew(),
                portfolio_returns.kurtosis(),
            ]
        )

        # Risk metrics
        features.extend(
            [
                self.risk_analytics._calculate_var(
                    portfolio_returns, self.risk_analytics.confidence_level
                ),
                self.risk_analytics._calculate_cvar(
                    portfolio_returns, self.risk_analytics.confidence_level
                ),
                self.risk_analytics._calculate_downside_deviation(portfolio_returns),
                self.risk_analytics._calculate_max_drawdown(portfolio_returns),
            ]
        )

        # Portfolio characteristics
        total_value = sum(
            Decimal(str(p["amount"])) * Decimal(str(p["current_price"]))
            for p in positions
        )

        features.extend(
            [
                len(positions),  # Number of positions
                float(total_value),  # Portfolio value
                max(float(w) for w in weights.values()),  # Maximum position weight
                np.std(list(weights.values())),  # Weight dispersion
            ]
        )

        return np.array(features).reshape(1, -1)

    def _get_feature_names(self) -> List[str]:
        """Get feature names."""
        return [
            "mean_return",
            "volatility",
            "skewness",
            "kurtosis",
            "var",
            "cvar",
            "downside_deviation",
            "max_drawdown",
            "position_count",
            "portfolio_value",
            "max_weight",
            "weight_dispersion",
        ]

    def _apply_limit_constraints(self, limits: Dict[str, float]) -> Dict[str, float]:
        """Apply constraints to risk limits."""
        return {
            "position_size": max(0.1, min(0.5, limits["position_size"])),
            "var": max(0.01, min(0.05, limits["var"])),
            "volatility": max(0.2, min(0.5, limits["volatility"])),
            "correlation": max(0.5, min(0.9, limits["correlation"])),
            "leverage": max(1.0, min(5.0, limits["leverage"])),
        }

    def _save_models(self):
        """Save ML models to disk."""
        joblib.dump(
            self.anomaly_detector,
            os.path.join(self.model_path, "anomaly_detector.joblib"),
        )
        joblib.dump(
            self.var_predictor, os.path.join(self.model_path, "var_predictor.joblib")
        )
        joblib.dump(
            self.volatility_predictor,
            os.path.join(self.model_path, "volatility_predictor.joblib"),
        )
        joblib.dump(
            self.correlation_predictor,
            os.path.join(self.model_path, "correlation_predictor.joblib"),
        )
        joblib.dump(
            self.feature_scaler, os.path.join(self.model_path, "feature_scaler.joblib")
        )

        for target, scaler in self.target_scalers.items():
            joblib.dump(
                scaler, os.path.join(self.model_path, f"{target}_scaler.joblib")
            )
