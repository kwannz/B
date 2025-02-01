import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from prometheus_client import Counter, Gauge, Histogram, Summary
from scipy import stats


class ModelMonitor:
    """模型监控类"""

    def __init__(
        self,
        model_name: str,
        model_version: str,
        feature_pipeline: Any,
        monitoring_window: int = 24,  # 小时
        drift_threshold: float = 0.05,
        performance_threshold: float = 0.8,
    ):
        self.model_name = model_name
        self.model_version = model_version
        self.feature_pipeline = feature_pipeline
        self.monitoring_window = monitoring_window
        self.drift_threshold = drift_threshold
        self.performance_threshold = performance_threshold
        self.logger = logging.getLogger(__name__)

        # 初始化监控指标
        self._init_monitoring_metrics()

        # 加载基准数据统计
        self.baseline_stats = self._load_baseline_stats()

        # 初始化监控状态
        self.monitoring_stats = {
            "feature_drift": {},
            "performance_metrics": {},
            "predictions": [],
            "actuals": [],
            "timestamps": [],
            "alerts": [],
        }

    def track_prediction(
        self,
        features: pd.DataFrame,
        prediction: Any,
        actual: Optional[Any] = None,
        timestamp: Optional[datetime] = None,
    ):
        """跟踪预测结果"""
        try:
            current_time = timestamp or datetime.now()

            # 特征漂移检测
            drift_detected = self._check_feature_drift(features)
            if drift_detected:
                self.logger.warning("检测到特征漂移")
                self._record_alert("feature_drift", drift_detected)

            # 更新预测记录
            self.monitoring_stats["predictions"].append(prediction)
            if actual is not None:
                self.monitoring_stats["actuals"].append(actual)
            self.monitoring_stats["timestamps"].append(current_time)

            # 性能指标计算
            if actual is not None:
                self._update_performance_metrics(prediction, actual)

            # 清理过期数据
            self._clean_old_data(current_time)

            # 更新Prometheus指标
            self._update_monitoring_metrics()

        except Exception as e:
            self.logger.error(f"预测跟踪失败: {str(e)}")
            raise

    def _init_monitoring_metrics(self):
        """初始化监控指标"""
        self.metrics = {
            "feature_drift": Gauge(
                "model_feature_drift",
                "特征漂移检测结果",
                ["model_name", "model_version", "feature_name"],
            ),
            "prediction_accuracy": Gauge(
                "model_prediction_accuracy",
                "预测准确率",
                ["model_name", "model_version"],
            ),
            "prediction_error": Histogram(
                "model_prediction_error",
                "预测误差",
                ["model_name", "model_version"],
                buckets=[0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
            ),
            "performance_metrics": Gauge(
                "model_performance_metrics",
                "模型性能指标",
                ["model_name", "model_version", "metric_name"],
            ),
            "data_quality": Gauge(
                "model_data_quality",
                "数据质量指标",
                ["model_name", "model_version", "metric_name"],
            ),
        }

    def _load_baseline_stats(self) -> Dict[str, Any]:
        """加载基准数据统计信息"""
        stats_path = Path(
            f"models/artifacts/{self.model_name}_v{self.model_version}_baseline_stats.json"
        )
        if not stats_path.exists():
            self.logger.warning("基准统计文件不存在，将使用第一批数据作为基准")
            return {}

        with open(stats_path, "r") as f:
            return json.load(f)

    def _check_feature_drift(self, features: pd.DataFrame) -> Dict[str, float]:
        """检测特征漂移"""
        drift_results = {}

        # 计算当前数据统计
        current_stats = {
            "numerical": {
                feat: {
                    "mean": features[feat].mean(),
                    "std": features[feat].std(),
                    "quantiles": features[feat].quantile([0.25, 0.5, 0.75]).to_dict(),
                }
                for feat in self.feature_pipeline.numerical_features
            },
            "categorical": {
                feat: features[feat].value_counts(normalize=True).to_dict()
                for feat in self.feature_pipeline.categorical_features
            },
        }

        # 如果没有基准统计，使用当前统计作为基准
        if not self.baseline_stats:
            self.baseline_stats = current_stats
            self._save_baseline_stats()
            return {}

        # 检查数值特征漂移
        for feat in self.feature_pipeline.numerical_features:
            # KS检验
            baseline_data = pd.Series(
                self.baseline_stats["numerical"][feat]["quantiles"].values()
            )
            current_data = pd.Series(
                current_stats["numerical"][feat]["quantiles"].values()
            )
            ks_statistic, p_value = stats.ks_2samp(baseline_data, current_data)

            if p_value < self.drift_threshold:
                drift_results[feat] = {
                    "drift_type": "numerical",
                    "p_value": p_value,
                    "statistic": ks_statistic,
                }

        # 检查类别特征漂移
        for feat in self.feature_pipeline.categorical_features:
            # 卡方检验
            baseline_dist = pd.Series(self.baseline_stats["categorical"][feat])
            current_dist = pd.Series(current_stats["categorical"][feat])

            # 对齐类别
            all_categories = set(baseline_dist.index) | set(current_dist.index)
            baseline_dist = baseline_dist.reindex(all_categories, fill_value=0)
            current_dist = current_dist.reindex(all_categories, fill_value=0)

            chi2_statistic, p_value = stats.chisquare(current_dist, baseline_dist)

            if p_value < self.drift_threshold:
                drift_results[feat] = {
                    "drift_type": "categorical",
                    "p_value": p_value,
                    "statistic": chi2_statistic,
                }

        return drift_results

    def _update_performance_metrics(self, prediction: Any, actual: Any):
        """更新性能指标"""
        # 计算预测误差
        if isinstance(prediction, (np.ndarray, list)):
            error = np.mean(np.abs(np.array(prediction) - np.array(actual)))
        else:
            error = abs(prediction - actual)

        # 更新性能指标
        current_metrics = {
            "error": error,
            "accuracy": 1.0 if error < self.performance_threshold else 0.0,
        }

        # 更新监控统计
        for metric_name, value in current_metrics.items():
            if metric_name not in self.monitoring_stats["performance_metrics"]:
                self.monitoring_stats["performance_metrics"][metric_name] = []
            self.monitoring_stats["performance_metrics"][metric_name].append(value)

    def _clean_old_data(self, current_time: datetime):
        """清理过期数据"""
        cutoff_time = current_time - timedelta(hours=self.monitoring_window)

        # 清理预测记录
        valid_indices = [
            i
            for i, ts in enumerate(self.monitoring_stats["timestamps"])
            if ts >= cutoff_time
        ]

        self.monitoring_stats["predictions"] = [
            self.monitoring_stats["predictions"][i] for i in valid_indices
        ]
        self.monitoring_stats["actuals"] = [
            self.monitoring_stats["actuals"][i] for i in valid_indices
        ]
        self.monitoring_stats["timestamps"] = [
            self.monitoring_stats["timestamps"][i] for i in valid_indices
        ]

        # 清理性能指标
        for metric_name in self.monitoring_stats["performance_metrics"]:
            self.monitoring_stats["performance_metrics"][metric_name] = [
                self.monitoring_stats["performance_metrics"][metric_name][i]
                for i in valid_indices
            ]

    def _update_monitoring_metrics(self):
        """更新Prometheus监控指标"""
        labels = {"model_name": self.model_name, "model_version": self.model_version}

        # 更新特征漂移指标
        for feat, drift_info in self.monitoring_stats["feature_drift"].items():
            self.metrics["feature_drift"].labels(feature_name=feat, **labels).set(
                drift_info["p_value"]
            )

        # 更新性能指标
        if self.monitoring_stats["actuals"]:
            recent_predictions = np.array(self.monitoring_stats["predictions"][-100:])
            recent_actuals = np.array(self.monitoring_stats["actuals"][-100:])

            accuracy = np.mean(
                np.abs(recent_predictions - recent_actuals) < self.performance_threshold
            )
            self.metrics["prediction_accuracy"].labels(**labels).set(accuracy)

            for error in np.abs(recent_predictions - recent_actuals):
                self.metrics["prediction_error"].labels(**labels).observe(error)

    def _record_alert(self, alert_type: str, alert_details: Dict[str, Any]):
        """记录告警信息"""
        alert = {
            "type": alert_type,
            "details": alert_details,
            "timestamp": datetime.now().isoformat(),
        }
        self.monitoring_stats["alerts"].append(alert)

    def _save_baseline_stats(self):
        """保存基准统计信息"""
        stats_path = Path(
            f"models/artifacts/{self.model_name}_v{self.model_version}_baseline_stats.json"
        )
        stats_path.parent.mkdir(parents=True, exist_ok=True)
        with open(stats_path, "w") as f:
            json.dump(self.baseline_stats, f, indent=2)

    def get_monitoring_report(self) -> Dict[str, Any]:
        """生成监控报告"""
        return {
            "model_info": {
                "name": self.model_name,
                "version": self.model_version,
                "monitoring_window": self.monitoring_window,
            },
            "feature_drift": self.monitoring_stats["feature_drift"],
            "performance_metrics": {
                metric: np.mean(values[-100:])
                for metric, values in self.monitoring_stats[
                    "performance_metrics"
                ].items()
            },
            "alerts": self.monitoring_stats["alerts"][-10:],  # 最近10条告警
            "data_volume": len(self.monitoring_stats["predictions"]),
            "timestamp": datetime.now().isoformat(),
        }
