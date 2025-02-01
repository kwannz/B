from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
    confusion_matrix,
)
import logging
from datetime import datetime
import json
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns


class ModelEvaluator:
    """模型评估类"""

    def __init__(
        self,
        model_name: str,
        model_version: str,
        task_type: str = "classification",  # or "regression"
        metrics_dir: str = "models/metrics",
        plots_dir: str = "models/plots",
    ):
        self.model_name = model_name
        self.model_version = model_version
        self.task_type = task_type
        self.metrics_dir = Path(metrics_dir)
        self.plots_dir = Path(plots_dir)
        self.logger = logging.getLogger(__name__)

        # 创建必要的目录
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
        self.plots_dir.mkdir(parents=True, exist_ok=True)

        # 初始化评估结果
        self.evaluation_results = {
            "model_info": {
                "name": model_name,
                "version": model_version,
                "task_type": task_type,
            },
            "metrics": {},
            "feature_importance": {},
            "error_analysis": {},
            "validation_results": {},
        }

    def evaluate_model(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        feature_names: Optional[List[str]] = None,
        feature_importance: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """评估模型性能"""
        try:
            # 计算评估指标
            metrics = self._calculate_metrics(y_true, y_pred)
            self.evaluation_results["metrics"] = metrics

            # 特征重要性分析
            if feature_names is not None and feature_importance is not None:
                self._analyze_feature_importance(feature_names, feature_importance)

            # 错误分析
            self._analyze_errors(y_true, y_pred)

            # 生成评估图表
            self._generate_evaluation_plots(y_true, y_pred)

            # 保存评估结果
            self._save_evaluation_results()

            return self.evaluation_results

        except Exception as e:
            self.logger.error(f"模型评估失败: {str(e)}")
            raise

    def validate_model(
        self,
        validation_data: pd.DataFrame,
        target_column: str,
        prediction_column: str,
        validation_rules: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, bool]:
        """验证模型预测结果"""
        try:
            validation_results = {}

            # 默认验证规则
            if validation_rules is None:
                validation_rules = {
                    "missing_values": True,
                    "value_range": True,
                    "statistical_tests": True,
                    "performance_threshold": {"accuracy": 0.8, "f1": 0.7, "mse": 0.2},
                }

            # 数据完整性验证
            if validation_rules.get("missing_values"):
                validation_results["missing_values"] = self._validate_missing_values(
                    validation_data[[target_column, prediction_column]]
                )

            # 值范围验证
            if validation_rules.get("value_range"):
                validation_results["value_range"] = self._validate_value_range(
                    validation_data[target_column], validation_data[prediction_column]
                )

            # 统计检验
            if validation_rules.get("statistical_tests"):
                validation_results["statistical_tests"] = (
                    self._perform_statistical_tests(
                        validation_data[target_column],
                        validation_data[prediction_column],
                    )
                )

            # 性能阈值验证
            if validation_rules.get("performance_threshold"):
                validation_results["performance_threshold"] = (
                    self._validate_performance_threshold(
                        validation_data[target_column],
                        validation_data[prediction_column],
                        validation_rules["performance_threshold"],
                    )
                )

            self.evaluation_results["validation_results"] = validation_results
            self._save_evaluation_results()

            return validation_results

        except Exception as e:
            self.logger.error(f"模型验证失败: {str(e)}")
            raise

    def _calculate_metrics(
        self, y_true: np.ndarray, y_pred: np.ndarray
    ) -> Dict[str, float]:
        """计算评估指标"""
        metrics = {}

        if self.task_type == "classification":
            metrics.update(
                {
                    "accuracy": accuracy_score(y_true, y_pred),
                    "precision": precision_score(y_true, y_pred, average="weighted"),
                    "recall": recall_score(y_true, y_pred, average="weighted"),
                    "f1": f1_score(y_true, y_pred, average="weighted"),
                }
            )

            # 二分类问题额外指标
            if len(np.unique(y_true)) == 2:
                try:
                    metrics["auc_roc"] = roc_auc_score(y_true, y_pred)
                except:
                    pass

        elif self.task_type == "regression":
            metrics.update(
                {
                    "mse": mean_squared_error(y_true, y_pred),
                    "rmse": np.sqrt(mean_squared_error(y_true, y_pred)),
                    "mae": mean_absolute_error(y_true, y_pred),
                    "r2": r2_score(y_true, y_pred),
                }
            )

        return metrics

    def _analyze_feature_importance(
        self, feature_names: List[str], feature_importance: np.ndarray
    ):
        """分析特征重要性"""
        importance_dict = dict(zip(feature_names, feature_importance))
        sorted_importance = dict(
            sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
        )

        self.evaluation_results["feature_importance"] = sorted_importance

        # 生成特征重要性图
        plt.figure(figsize=(10, 6))
        plt.bar(range(len(sorted_importance)), list(sorted_importance.values()))
        plt.xticks(
            range(len(sorted_importance)), list(sorted_importance.keys()), rotation=45
        )
        plt.title("Feature Importance")
        plt.tight_layout()
        plt.savefig(
            self.plots_dir
            / f"{self.model_name}_v{self.model_version}_feature_importance.png"
        )
        plt.close()

    def _analyze_errors(self, y_true: np.ndarray, y_pred: np.ndarray):
        """分析预测错误"""
        errors = y_pred - y_true

        error_analysis = {
            "error_distribution": {
                "mean": float(np.mean(errors)),
                "std": float(np.std(errors)),
                "min": float(np.min(errors)),
                "max": float(np.max(errors)),
                "quantiles": {
                    "25%": float(np.percentile(errors, 25)),
                    "50%": float(np.percentile(errors, 50)),
                    "75%": float(np.percentile(errors, 75)),
                },
            }
        }

        if self.task_type == "classification":
            cm = confusion_matrix(y_true, y_pred)
            error_analysis["confusion_matrix"] = cm.tolist()

        self.evaluation_results["error_analysis"] = error_analysis

        # 生成错误分布图
        plt.figure(figsize=(10, 6))
        sns.histplot(errors, kde=True)
        plt.title("Error Distribution")
        plt.savefig(
            self.plots_dir
            / f"{self.model_name}_v{self.model_version}_error_distribution.png"
        )
        plt.close()

        if self.task_type == "classification":
            plt.figure(figsize=(8, 6))
            sns.heatmap(cm, annot=True, fmt="d", cmap="Blues")
            plt.title("Confusion Matrix")
            plt.savefig(
                self.plots_dir
                / f"{self.model_name}_v{self.model_version}_confusion_matrix.png"
            )
            plt.close()

    def _generate_evaluation_plots(self, y_true: np.ndarray, y_pred: np.ndarray):
        """生成评估图表"""
        # 真实值vs预测值散点图
        plt.figure(figsize=(10, 6))
        plt.scatter(y_true, y_pred, alpha=0.5)
        plt.plot(
            [y_true.min(), y_true.max()], [y_true.min(), y_true.max()], "r--", lw=2
        )
        plt.xlabel("True Values")
        plt.ylabel("Predictions")
        plt.title("True vs Predicted Values")
        plt.tight_layout()
        plt.savefig(
            self.plots_dir / f"{self.model_name}_v{self.model_version}_predictions.png"
        )
        plt.close()

        if self.task_type == "regression":
            # 残差图
            residuals = y_pred - y_true
            plt.figure(figsize=(10, 6))
            plt.scatter(y_pred, residuals, alpha=0.5)
            plt.xlabel("Predicted Values")
            plt.ylabel("Residuals")
            plt.title("Residual Plot")
            plt.axhline(y=0, color="r", linestyle="--")
            plt.tight_layout()
            plt.savefig(
                self.plots_dir
                / f"{self.model_name}_v{self.model_version}_residuals.png"
            )
            plt.close()

    def _validate_missing_values(self, data: pd.DataFrame) -> bool:
        """验证缺失值"""
        return data.isnull().sum().sum() == 0

    def _validate_value_range(self, y_true: pd.Series, y_pred: pd.Series) -> bool:
        """验证值范围"""
        if self.task_type == "classification":
            # 检查预测类别是否在实际类别范围内
            return set(y_pred).issubset(set(y_true))
        else:
            # 检查预测值是否在合理范围内
            pred_mean, pred_std = y_pred.mean(), y_pred.std()
            lower_bound = pred_mean - 3 * pred_std
            upper_bound = pred_mean + 3 * pred_std
            return ((y_pred >= lower_bound) & (y_pred <= upper_bound)).all()

    def _perform_statistical_tests(
        self, y_true: pd.Series, y_pred: pd.Series
    ) -> Dict[str, bool]:
        """执行统计检验"""
        from scipy import stats

        test_results = {}

        # Kolmogorov-Smirnov检验
        _, p_value = stats.ks_2samp(y_true, y_pred)
        test_results["ks_test"] = p_value > 0.05

        if self.task_type == "regression":
            # Shapiro-Wilk正态性检验
            _, p_value = stats.shapiro(y_pred - y_true)
            test_results["normality_test"] = p_value > 0.05

        return test_results

    def _validate_performance_threshold(
        self, y_true: pd.Series, y_pred: pd.Series, thresholds: Dict[str, float]
    ) -> Dict[str, bool]:
        """验证性能阈值"""
        results = {}
        metrics = self._calculate_metrics(y_true, y_pred)

        for metric_name, threshold in thresholds.items():
            if metric_name in metrics:
                results[metric_name] = metrics[metric_name] >= threshold

        return results

    def _save_evaluation_results(self):
        """保存评估结果"""
        results_path = (
            self.metrics_dir
            / f"{self.model_name}_v{self.model_version}_evaluation.json"
        )

        # 添加时间戳
        self.evaluation_results["timestamp"] = datetime.now().isoformat()

        with open(results_path, "w") as f:
            json.dump(self.evaluation_results, f, indent=2)
