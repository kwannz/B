import logging
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import MinMaxScaler, StandardScaler


class FeaturePipeline(BaseEstimator, TransformerMixin):
    """特征预处理流水线"""

    def __init__(
        self,
        numerical_features: List[str],
        categorical_features: List[str],
        technical_indicators: List[str],
        scaling_method: str = "standard",
        handle_missing: str = "mean",
    ):
        self.numerical_features = numerical_features
        self.categorical_features = categorical_features
        self.technical_indicators = technical_indicators
        self.scaling_method = scaling_method
        self.handle_missing = handle_missing
        self.logger = logging.getLogger(__name__)

        # 初始化转换器
        self.num_scaler = (
            StandardScaler() if scaling_method == "standard" else MinMaxScaler()
        )
        self.imputer = SimpleImputer(strategy=handle_missing)

        # 特征工程状态
        self.feature_stats = {}
        self.feature_names_ = []

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None):
        """拟合特征转换器"""
        try:
            # 数值特征处理
            num_data = X[self.numerical_features]
            self.imputer.fit(num_data)
            num_data_imputed = self.imputer.transform(num_data)
            self.num_scaler.fit(num_data_imputed)

            # 计算特征统计信息
            self.feature_stats = {
                "numerical": {
                    "mean": num_data.mean().to_dict(),
                    "std": num_data.std().to_dict(),
                    "missing_ratio": (
                        num_data.isnull().sum() / len(num_data)
                    ).to_dict(),
                },
                "categorical": {
                    feat: X[feat].value_counts().to_dict()
                    for feat in self.categorical_features
                },
            }

            # 技术指标特征
            if self.technical_indicators:
                self._calculate_technical_indicators(X)

            # 更新特征名称
            self.feature_names_ = (
                self.numerical_features
                + [
                    f"{feat}_{val}"
                    for feat in self.categorical_features
                    for val in X[feat].unique()
                ]
                + self.technical_indicators
            )

            return self

        except Exception as e:
            self.logger.error(f"特征流水线拟合失败: {str(e)}")
            raise

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """转换特征"""
        try:
            features = []

            # 数值特征转换
            num_data = X[self.numerical_features]
            num_data_imputed = self.imputer.transform(num_data)
            num_data_scaled = self.num_scaler.transform(num_data_imputed)
            features.append(num_data_scaled)

            # 类别特征转换
            for feat in self.categorical_features:
                cat_dummies = pd.get_dummies(X[feat], prefix=feat)
                features.append(cat_dummies.values)

            # 技术指标计算
            if self.technical_indicators:
                tech_features = self._calculate_technical_indicators(X)
                features.append(tech_features)

            return np.hstack(features)

        except Exception as e:
            self.logger.error(f"特征转换失败: {str(e)}")
            raise

    def _calculate_technical_indicators(self, data: pd.DataFrame) -> np.ndarray:
        """计算技术指标"""
        tech_features = []

        for indicator in self.technical_indicators:
            if indicator == "RSI":
                tech_features.append(self._calculate_rsi(data))
            elif indicator == "MACD":
                tech_features.append(self._calculate_macd(data))
            elif indicator == "BB":
                tech_features.append(self._calculate_bollinger_bands(data))

        return np.column_stack(tech_features) if tech_features else np.array([])

    def _calculate_rsi(self, data: pd.DataFrame, period: int = 14) -> np.ndarray:
        """计算RSI指标"""
        close_diff = data["close"].diff()
        gain = close_diff.where(close_diff > 0, 0).rolling(window=period).mean()
        loss = -close_diff.where(close_diff < 0, 0).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50).values.reshape(-1, 1)

    def _calculate_macd(
        self,
        data: pd.DataFrame,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> np.ndarray:
        """计算MACD指标"""
        ema_fast = data["close"].ewm(span=fast_period).mean()
        ema_slow = data["close"].ewm(span=slow_period).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal_period).mean()
        macd_hist = macd_line - signal_line
        return np.column_stack([macd_line.values, signal_line.values, macd_hist.values])

    def _calculate_bollinger_bands(
        self, data: pd.DataFrame, period: int = 20, num_std: float = 2.0
    ) -> np.ndarray:
        """计算布林带指标"""
        rolling_mean = data["close"].rolling(window=period).mean()
        rolling_std = data["close"].rolling(window=period).std()
        upper_band = rolling_mean + (rolling_std * num_std)
        lower_band = rolling_mean - (rolling_std * num_std)
        return np.column_stack(
            [rolling_mean.values, upper_band.values, lower_band.values]
        )

    def get_feature_names(self) -> List[str]:
        """获取特征名称列表"""
        return self.feature_names_

    def get_feature_stats(self) -> Dict[str, Any]:
        """获取特征统计信息"""
        return self.feature_stats
