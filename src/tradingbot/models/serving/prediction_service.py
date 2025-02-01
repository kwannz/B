from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
import logging
from pathlib import Path
import time
import json
from prometheus_client import Counter, Histogram, Gauge


class PredictionService:
    """预测服务类"""

    def __init__(
        self,
        model_name: str,
        model_version: str,
        batch_size: int = 32,
        max_latency_ms: float = 100.0,
        enable_monitoring: bool = True,
    ):
        self.model_name = model_name
        self.model_version = model_version
        self.batch_size = batch_size
        self.max_latency_ms = max_latency_ms
        self.enable_monitoring = enable_monitoring
        self.logger = logging.getLogger(__name__)

        # 加载模型和特征流水线
        self.model = self._load_model()
        self.feature_pipeline = self._load_feature_pipeline()

        # 初始化监控指标
        if enable_monitoring:
            self._init_monitoring_metrics()

        # 预测性能统计
        self.prediction_stats = {
            "total_predictions": 0,
            "total_latency": 0.0,
            "max_latency": 0.0,
            "min_latency": float("inf"),
            "error_count": 0,
            "last_prediction_time": None,
        }

    def predict(
        self, features: pd.DataFrame, return_proba: bool = False
    ) -> Dict[str, Any]:
        """模型预测"""
        try:
            start_time = time.time()

            # 特征预处理
            X_processed = self.feature_pipeline.transform(features)

            # 批量预测
            if return_proba and hasattr(self.model, "predict_proba"):
                predictions = self.model.predict_proba(X_processed)
                prediction_type = "probability"
            else:
                predictions = self.model.predict(X_processed)
                prediction_type = "class"

            # 计算延迟
            latency = (time.time() - start_time) * 1000  # 转换为毫秒

            # 更新监控指标
            if self.enable_monitoring:
                self._update_monitoring_metrics(latency, len(features))

            # 更新预测统计
            self._update_prediction_stats(latency)

            return {
                "predictions": predictions.tolist(),
                "prediction_type": prediction_type,
                "model_version": self.model_version,
                "latency_ms": latency,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            self.logger.error(f"预测失败: {str(e)}")
            if self.enable_monitoring:
                self.metrics["prediction_errors"].inc()
            self.prediction_stats["error_count"] += 1
            raise

    def _load_model(self):
        """加载模型"""
        model_path = Path(
            f"models/artifacts/{self.model_name}_v{self.model_version}.joblib"
        )
        if not model_path.exists():
            raise FileNotFoundError(f"模型文件不存在: {model_path}")
        return joblib.load(model_path)

    def _load_feature_pipeline(self):
        """加载特征流水线"""
        pipeline_path = Path(
            f"models/artifacts/{self.model_name}_v{self.model_version}_pipeline.joblib"
        )
        if not pipeline_path.exists():
            raise FileNotFoundError(f"特征流水线文件不存在: {pipeline_path}")
        return joblib.load(pipeline_path)

    def _init_monitoring_metrics(self):
        """初始化监控指标"""
        self.metrics = {
            "prediction_count": Counter(
                "model_prediction_count_total",
                "预测请求总数",
                ["model_name", "model_version"],
            ),
            "prediction_latency": Histogram(
                "model_prediction_latency_milliseconds",
                "预测延迟(毫秒)",
                ["model_name", "model_version"],
                buckets=[5, 10, 25, 50, 100, 250, 500, 1000],
            ),
            "prediction_errors": Counter(
                "model_prediction_errors_total",
                "预测错误总数",
                ["model_name", "model_version"],
            ),
            "batch_size": Histogram(
                "model_prediction_batch_size",
                "预测批次大小",
                ["model_name", "model_version"],
                buckets=[1, 5, 10, 20, 50, 100],
            ),
            "model_memory": Gauge(
                "model_memory_bytes",
                "模型内存占用(字节)",
                ["model_name", "model_version"],
            ),
        }

    def _update_monitoring_metrics(self, latency: float, batch_size: int):
        """更新监控指标"""
        labels = {"model_name": self.model_name, "model_version": self.model_version}

        self.metrics["prediction_count"].labels(**labels).inc()
        self.metrics["prediction_latency"].labels(**labels).observe(latency)
        self.metrics["batch_size"].labels(**labels).observe(batch_size)

        # 检查延迟是否超过阈值
        if latency > self.max_latency_ms:
            self.logger.warning(
                f"预测延迟({latency:.2f}ms)超过阈值({self.max_latency_ms}ms)"
            )

    def _update_prediction_stats(self, latency: float):
        """更新预测统计信息"""
        self.prediction_stats.update(
            {
                "total_predictions": self.prediction_stats["total_predictions"] + 1,
                "total_latency": self.prediction_stats["total_latency"] + latency,
                "max_latency": max(self.prediction_stats["max_latency"], latency),
                "min_latency": min(self.prediction_stats["min_latency"], latency),
                "last_prediction_time": datetime.now(),
            }
        )

    def get_prediction_stats(self) -> Dict[str, Any]:
        """获取预测统计信息"""
        stats = self.prediction_stats.copy()
        if stats["total_predictions"] > 0:
            stats["avg_latency"] = stats["total_latency"] / stats["total_predictions"]
        return stats

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        return {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "feature_names": self.feature_pipeline.get_feature_names(),
            "feature_stats": self.feature_pipeline.get_feature_stats(),
            "model_params": getattr(self.model, "get_params", lambda: {})(),
            "prediction_stats": self.get_prediction_stats(),
        }
