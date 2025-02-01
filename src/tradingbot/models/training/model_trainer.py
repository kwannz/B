import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.metrics import make_scorer
from sklearn.model_selection import cross_validate

from src.models.base import BaseModel
from src.utils.metrics import calculate_trading_metrics
from src.utils.validation import validate_model_input


class ModelTrainer:
    """模型训练框架核心类"""

    def __init__(
        self,
        model: BaseEstimator,
        feature_pipeline: Any,
        model_name: str,
        model_version: str,
        model_params: Dict[str, Any],
        training_params: Dict[str, Any],
    ):
        self.model = model
        self.feature_pipeline = feature_pipeline
        self.model_name = model_name
        self.model_version = model_version
        self.model_params = model_params
        self.training_params = training_params
        self.model_artifacts_path = Path("models/artifacts")
        self.logger = logging.getLogger(__name__)

        # 初始化监控指标
        self.training_metrics = {
            "training_start_time": None,
            "training_end_time": None,
            "training_duration": None,
            "cross_validation_scores": None,
            "feature_importance": None,
            "model_size": None,
            "performance_metrics": None,
        }

    def preprocess_data(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        y: Optional[Union[pd.Series, np.ndarray]] = None,
        is_training: bool = True,
    ) -> tuple:
        """特征预处理"""
        try:
            # 验证输入数据
            validate_model_input(X, y, is_training)

            # 应用特征工程流水线
            if is_training:
                X_processed = self.feature_pipeline.fit_transform(X)
                return X_processed, y
            else:
                X_processed = self.feature_pipeline.transform(X)
                return X_processed

        except Exception as e:
            self.logger.error(f"特征预处理失败: {str(e)}")
            raise

    def train(
        self,
        X_train: Union[pd.DataFrame, np.ndarray],
        y_train: Union[pd.Series, np.ndarray],
        validation_data: Optional[tuple] = None,
    ) -> Dict[str, Any]:
        """模型训练"""
        try:
            self.training_metrics["training_start_time"] = datetime.now()

            # 特征预处理
            X_processed, y_processed = self.preprocess_data(X_train, y_train)

            # 交叉验证
            cv_scores = cross_validate(
                self.model,
                X_processed,
                y_processed,
                cv=self.training_params.get("cv", 5),
                scoring=make_scorer(calculate_trading_metrics),
                n_jobs=self.training_params.get("n_jobs", -1),
            )

            # 在全量数据上训练
            self.model.fit(X_processed, y_processed)

            # 计算特征重要性
            if hasattr(self.model, "feature_importances_"):
                self.training_metrics["feature_importance"] = dict(
                    zip(
                        self.feature_pipeline.get_feature_names(),
                        self.model.feature_importances_,
                    )
                )

            # 验证集评估
            if validation_data:
                X_val, y_val = validation_data
                X_val_processed = self.preprocess_data(X_val, is_training=False)
                val_predictions = self.model.predict(X_val_processed)
                val_metrics = calculate_trading_metrics(y_val, val_predictions)
                self.training_metrics["validation_metrics"] = val_metrics

            # 更新训练指标
            self.training_metrics.update(
                {
                    "training_end_time": datetime.now(),
                    "training_duration": (
                        datetime.now() - self.training_metrics["training_start_time"]
                    ).total_seconds(),
                    "cross_validation_scores": cv_scores,
                    "model_size": self._get_model_size(),
                }
            )

            # 保存模型和指标
            self._save_model()
            self._save_metrics()

            return self.training_metrics

        except Exception as e:
            self.logger.error(f"模型训练失败: {str(e)}")
            raise

    def _get_model_size(self) -> float:
        """获取模型大小(MB)"""
        import tempfile

        with tempfile.NamedTemporaryFile() as tmp:
            joblib.dump(self.model, tmp.name)
            return Path(tmp.name).stat().st_size / (1024 * 1024)

    def _save_model(self):
        """保存模型文件"""
        model_path = (
            self.model_artifacts_path
            / f"{self.model_name}_v{self.model_version}.joblib"
        )
        model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, model_path)

    def _save_metrics(self):
        """保存训练指标"""
        metrics_path = (
            self.model_artifacts_path
            / f"{self.model_name}_v{self.model_version}_metrics.json"
        )
        import json

        with open(metrics_path, "w") as f:
            json.dump(self.training_metrics, f, indent=2, default=str)
