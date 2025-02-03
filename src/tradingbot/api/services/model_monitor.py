"""
Model monitoring service for tracking and updating ML models
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List

import asyncio
import numpy as np
from pymongo.database import Database
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)

from ..models.trading import Position
from .market import MarketDataService
from .risk import RiskManager
from .risk_analytics import RiskAnalytics
from .risk_ml import RiskML

logger = logging.getLogger(__name__)


class ModelMonitor:
    """Model monitoring and update system."""

    def __init__(
        self,
        db: Database,
        market_service: MarketDataService,
        risk_manager: RiskManager,
        risk_analytics: RiskAnalytics,
        risk_ml: RiskML,
        metrics_path: str = "metrics",
        update_interval: int = 24 * 60 * 60,  # 1 day
        performance_threshold: float = 0.7,
        min_samples: int = 100,
    ):
        """Initialize model monitor."""
        self.db = db
        self.market_service = market_service
        self.risk_manager = risk_manager
        self.risk_analytics = risk_analytics
        self.risk_ml = risk_ml
        self.metrics_path = metrics_path
        self.update_interval = update_interval
        self.performance_threshold = performance_threshold
        self.min_samples = min_samples

        # Ensure metrics directory exists
        os.makedirs(metrics_path, exist_ok=True)

        # Initialize monitoring state
        self._last_update = None
        self._metrics_history = self._load_metrics_history()

    async def start_monitoring(self) -> None:
        """Start continuous model monitoring and update cycle."""
        check_interval = 60  # Check every minute
        retry_delay = 5  # Short delay before retry

        while True:
            try:
                await self._check_and_update_models()
                await asyncio.sleep(check_interval)
            except Exception as e:
                logger.error("Error in model monitoring: %s", str(e))
                await asyncio.sleep(retry_delay)

    async def _check_and_update_models(self) -> None:
        """Check if models need evaluation and updates."""
        current_time = datetime.utcnow()
        
        if not self._should_check_models(current_time):
            return
            
        metrics = await self.evaluate_models()
        self._update_metrics_history(metrics)
        
        if self._should_update_models(metrics):
            await self.update_models()
            
        self._last_update = current_time
        
    def _should_check_models(self, current_time: datetime) -> bool:
        """Determine if models should be checked based on time interval."""
        if not self._last_update:
            return True
            
        elapsed = (current_time - self._last_update).total_seconds()
        return elapsed >= self.update_interval

    async def evaluate_models(self) -> Dict[str, Any]:
        """Evaluate model performance."""
        metrics = {"timestamp": datetime.utcnow(), "models": {}}

        # Get evaluation data
        evaluation_data = await self._get_evaluation_data()

        if not evaluation_data:
            return metrics

        # Evaluate anomaly detection
        metrics["models"]["anomaly_detector"] = (
            await self._evaluate_anomaly_detector(evaluation_data)
        )

        # Evaluate risk predictors
        predictors = ["var", "volatility", "correlation"]
        for predictor in predictors:
            model_name = f"{predictor}_predictor"
            metrics["models"][model_name] = (
                await self._evaluate_predictor(predictor, evaluation_data)
            )

        return metrics

    async def update_models(self):
        """Update ML models."""
        logger.info("Starting model update")

        try:
            # Train new models
            await self.risk_ml.train_models()

            # Evaluate new models
            new_metrics = await self.evaluate_models()

            # Update metrics history
            self._update_metrics_history(new_metrics)

            logger.info("Successfully updated models")

        except Exception as e:
            logger.error("Error updating models: %s", str(e))
            raise

    def _should_update_models(self, metrics: Dict[str, Any]) -> bool:
        """Determine if models should be updated."""
        if not self._metrics_history:
            return True

        # Check performance degradation
        for model, model_metrics in metrics["models"].items():
            if model_metrics["sample_count"] < self.min_samples:
                continue

            historical_metrics = [
                h["models"].get(model, {}).get("performance", 0)
                for h in self._metrics_history[-10:]  # Last 10 evaluations
            ]

            if historical_metrics:
                avg_historical = np.mean(historical_metrics)
                current = model_metrics["performance"]

                if current < avg_historical * 0.8:  # 20% degradation
                    logger.warning(
                        "Performance degradation detected for %s: current=%.3f, historical=%.3f",
                        model, current, avg_historical
                    )
                    return True

        return False

    def _update_metrics_history(self, metrics: Dict[str, Any]) -> None:
        """Update metrics history and save to disk.
        
        Args:
            metrics: Dictionary containing model evaluation metrics
        """
        self._metrics_history.append(metrics)
        self._save_metrics_to_disk(metrics)
        self._trim_metrics_history()
        
    def _save_metrics_to_disk(self, metrics: Dict[str, Any]) -> None:
        """Save metrics to disk in JSON format."""
        timestamp_str = metrics["timestamp"].strftime("%Y%m%d_%H%M%S")
        metrics_file = os.path.join(
            self.metrics_path,
            f"metrics_{timestamp_str}.json",
        )
        with open(metrics_file, "w") as f:
            json.dump(metrics, f, default=str)
            
    def _trim_metrics_history(self, max_entries: int = 100) -> None:
        """Trim metrics history to keep only recent entries."""
        if len(self._metrics_history) > max_entries:
            self._metrics_history = self._metrics_history[-max_entries:]

    def _load_metrics_history(self) -> List[Dict[str, Any]]:
        """Load metrics history from disk."""
        history = []

        try:
            # Load all metrics files
            for filename in sorted(os.listdir(self.metrics_path)):
                if filename.startswith("metrics_") and filename.endswith(".json"):
                    with open(os.path.join(self.metrics_path, filename)) as f:
                        metrics = json.load(f)
                        metrics["timestamp"] = datetime.strptime(
                            metrics["timestamp"], "%Y-%m-%d %H:%M:%S.%f"
                        )
                        history.append(metrics)

            # Keep only last 100 evaluations
            history = history[-100:]

        except Exception as e:
            logger.error("Error loading metrics history: %s", str(e))

        return history

    async def _get_evaluation_data(self) -> Dict[str, Any]:
        """Get data for model evaluation."""
        # Get recent positions from last 30 days
        query = {
            "status": "closed",
            "closed_at": {"$gte": datetime.utcnow() - timedelta(days=30)},
        }
        positions = await self.db.positions.find(query).to_list(None)

        if not positions:
            return {}

        # Initialize feature and target arrays
        features = []
        targets = {
            "anomaly": [],
            "var": [],
            "volatility": [],
            "correlation": [],
        }

        for position in positions:
            position_data = await self._extract_position_data(position)
            if position_data:
                features.append(position_data["features"])
                for target_type, value in position_data["targets"].items():
                    targets[target_type].append(value)

    async def _extract_position_data(self, position: Position) -> Dict[str, Any]:
        """Extract features and targets from a position."""
        position_features = await self.risk_ml._extract_features([position])
        if position_features is None:
            return {}

        returns_data, weights = await self.risk_analytics._get_position_data([position])
        if len(returns_data) == 0:
            return {}

        portfolio_returns = self.risk_analytics._calculate_portfolio_returns(
            returns_data, weights
        )

        # Calculate targets
        realized_pnl = float(position.get("realized_pnl", 0))
        var_value = self.risk_analytics._calculate_var(
            portfolio_returns, self.risk_analytics.confidence_level
        )
        volatility = float(portfolio_returns.std() * np.sqrt(252))
        
        # Calculate correlation
        corr_value = (
            float(
                returns_data.corr()
                .values[np.triu_indices_from(returns_data.corr().values, 1)]
                .mean()
            )
            if len(returns_data.columns) > 1
            else 0
        )

        return {
            "features": position_features,
            "targets": {
                "anomaly": 1 if realized_pnl < -0.1 else 0,
                "var": var_value,
                "volatility": volatility,
                "correlation": corr_value,
            },
        }

        if not features:
            return {}

        return {
            "features": np.vstack(features),
            "targets": {name: np.array(values) for name, values in targets.items()},
        }

    async def _evaluate_anomaly_detector(
        self, evaluation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate anomaly detection model."""
        if not evaluation_data:
            return self._empty_metrics()

        features = evaluation_data["features"]
        true_anomalies = evaluation_data["targets"]["anomaly"]

        # Get predictions
        anomaly_scores = self.risk_ml.anomaly_detector.score_samples(features)
        pred_anomalies = anomaly_scores < self.risk_ml.anomaly_detector.threshold_

        # Calculate metrics
        metrics = {
            "sample_count": len(features),
            "auc_roc": float(roc_auc_score(true_anomalies, -anomaly_scores)),
            "precision": float(precision_score(true_anomalies, pred_anomalies)),
            "recall": float(recall_score(true_anomalies, pred_anomalies)),
            "f1": float(f1_score(true_anomalies, pred_anomalies)),
        }

        # Calculate overall performance score (average of AUC-ROC and F1)
        perf_metrics = [metrics["auc_roc"], metrics["f1"]]
        metrics["performance"] = np.mean(perf_metrics)

        return metrics

    async def _evaluate_predictor(
        self, predictor_name: str, evaluation_data: Dict[str, Any]
    ) -> Dict[str, float]:
        """Evaluate performance metrics for a risk predictor model."""
        if not evaluation_data:
            return self._empty_metrics()

        features = evaluation_data["features"]
        true_values = evaluation_data["targets"][predictor_name]
        predictions = await self._get_predictor_predictions(
            predictor_name, features
        )

        base_metrics = self._calculate_base_metrics(true_values, predictions)
        mape = self._calculate_mape(true_values, predictions)
        
        return {
            **base_metrics,
            "mape": mape,
            "performance": self._calculate_performance_score(mape, base_metrics["r2"]),
        }

    async def _get_predictor_predictions(
        self, predictor_name: str, features: np.ndarray
    ) -> np.ndarray:
        """Get scaled predictions from a predictor model."""
        predictor = getattr(self.risk_ml, f"{predictor_name}_predictor")
        scaler = self.risk_ml.target_scalers[predictor_name]
        
        scaled_features = self.risk_ml.feature_scaler.transform(features)
        scaled_pred = predictor.predict(scaled_features)
        return scaler.inverse_transform(scaled_pred.reshape(-1, 1)).ravel()

    def _calculate_base_metrics(
        self, true_values: np.ndarray, predictions: np.ndarray
    ) -> Dict[str, float]:
        """Calculate basic regression metrics."""
        return {
            "sample_count": float(len(true_values)),
            "mse": float(mean_squared_error(true_values, predictions)),
            "mae": float(mean_absolute_error(true_values, predictions)),
            "r2": float(r2_score(true_values, predictions)),
        }

    def _calculate_mape(
        self, true_values: np.ndarray, predictions: np.ndarray
    ) -> float:
        """Calculate Mean Absolute Percentage Error."""
        non_zero_mask = true_values != 0
        if not non_zero_mask.any():
            return 0.0
            
        diff = true_values[non_zero_mask] - predictions[non_zero_mask]
        rel_error = diff / true_values[non_zero_mask]
        return float(np.mean(np.abs(rel_error)))

    def _calculate_performance_score(self, mape: float, r2: float) -> float:
        """Calculate overall performance score."""
        return float(1 - min(mape, 1 - r2))

    def _empty_metrics(self) -> Dict[str, Any]:
        """Return empty metrics structure."""
        return {"sample_count": 0, "performance": 0.0}

    def get_model_diagnostics(self) -> Dict[str, Any]:
        """Get model diagnostics report."""
        if not self._metrics_history:
            return {}

        diagnostics = {
            "last_update": self._last_update,
            "metrics_history": len(self._metrics_history),
            "models": {},
        }

        # Calculate trends for each model
        latest_metrics = self._metrics_history[-1]["models"]
        for model in latest_metrics:
            model_metrics = []
            for metrics in self._metrics_history:
                model_data = metrics["models"].get(model)
                if model_data:
                    model_metrics.append({
                        "timestamp": metrics["timestamp"],
                        "performance": model_data["performance"],
                        "sample_count": model_data["sample_count"],
                    })

            if model_metrics:
                diagnostics["models"][model] = {
                    "current_performance": model_metrics[-1]["performance"],
                    "performance_trend": self._calculate_trend(
                        [m["performance"] for m in model_metrics]
                    ),
                    "sample_count_trend": self._calculate_trend(
                        [m["sample_count"] for m in model_metrics]
                    ),
                    "needs_update": self._should_update_model(model_metrics),
                }

        return diagnostics

    def _calculate_trend(self, values: List[float], window: int = 5) -> float:
        """Calculate trend in values."""
        if len(values) < 2:
            return 0.0

        # Use simple linear regression
        x = np.arange(len(values))
        y = np.array(values)

        slope = np.polyfit(x, y, 1)[0]

        # Normalize by mean value
        mean_value = np.mean(values)
        if mean_value != 0:
            return float(slope / mean_value)
        else:
            return float(slope)

    def _should_update_model(self, model_metrics: List[Dict[str, Any]]) -> bool:
        """Determine if specific model needs update."""
        if len(model_metrics) < 2:
            return False

        # Check performance trend
        performance_trend = self._calculate_trend(
            [m["performance"] for m in model_metrics]
        )

        # Check sample count
        recent_samples = model_metrics[-1]["sample_count"]

        return (
            performance_trend < -0.1  # 10% degradation trend
            or recent_samples < self.min_samples
        )
