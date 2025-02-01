import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from src.backend.data_infrastructure.feature_engineering import FeatureEngineer


@pytest.fixture
def sample_market_data():
    """创建示例市场数据"""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="1min")
    data = {
        "timestamp": dates,
        "open": np.random.normal(100, 10, 100),
        "high": np.random.normal(105, 10, 100),
        "low": np.random.normal(95, 10, 100),
        "close": np.random.normal(100, 10, 100),
        "volume": np.random.normal(1000, 100, 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def sample_trading_data():
    """创建示例交易数据"""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="1min")
    data = {
        "timestamp": dates,
        "trade_id": range(100),
        "price": np.random.normal(100, 10, 100),
        "amount": np.random.normal(1, 0.1, 100),
        "side": np.random.choice(["buy", "sell"], 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def sample_social_data():
    """创建示例社交媒体数据"""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="1min")
    data = {
        "timestamp": dates,
        "text": ["Test message " + str(i) for i in range(100)],
        "sentiment": np.random.normal(0, 0.5, 100),
        "influence_score": np.random.uniform(0, 1, 100),
        "platform": np.random.choice(["twitter", "reddit", "discord", "telegram"], 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def feature_engineer():
    """创建FeatureEngineer实例"""
    config = {
        "window_sizes": [5, 10, 20],
        "volatility_windows": [5, 10],
        "correlation_threshold": 0.8,
    }
    return FeatureEngineer(config)


class TestFeatureEngineer:
    def test_market_feature_generation(self, feature_engineer, sample_market_data):
        """测试市场特征生成"""
        df = feature_engineer.generate_market_features(sample_market_data)

        # 验证技术分析特征
        assert all(col in df.columns for col in ["ADX", "RSI", "ATR"])

        # 验证自定义特征
        assert all(
            col in df.columns
            for col in [
                "return_5",
                "log_return_5",
                "momentum_5",
                "realized_vol_5",
                "parkinson_vol_5",
            ]
        )

        # 验证价格形态特征
        assert all(
            col in df.columns for col in ["upper_shadow", "lower_shadow", "body"]
        )

    def test_trading_feature_generation(
        self, feature_engineer, sample_trading_data, sample_market_data
    ):
        """测试交易特征生成"""
        df = feature_engineer.generate_trading_features(
            sample_trading_data, sample_market_data
        )

        # 验证基本交易特征
        assert all(
            col in df.columns
            for col in [
                "volume_change_5",
                "volume_ma_5",
                "volume_std_5",
                "trade_interval",
                "trade_freq",
            ]
        )

        # 验证买卖压力特征
        assert all(
            col in df.columns
            for col in ["buy_ratio", "sell_ratio", "buy_pressure_5", "sell_pressure_5"]
        )

        # 验证市场相关特征
        assert all(
            col in df.columns
            for col in ["price_deviation", "effective_spread", "transaction_cost"]
        )

    def test_social_feature_generation(
        self, feature_engineer, sample_social_data, sample_market_data
    ):
        """测试社交媒体特征生成"""
        df = feature_engineer.generate_social_features(
            sample_social_data, sample_market_data
        )

        # 验证情绪特征
        assert all(
            col in df.columns
            for col in [
                "sentiment_ma_5",
                "sentiment_std_5",
                "sentiment_momentum_5",
                "extreme_sentiment_5",
            ]
        )

        # 验证情绪分布特征
        assert all(col in df.columns for col in ["sentiment_skew", "sentiment_kurt"])

        # 验证社交网络特征
        assert any(col.endswith("_ratio") for col in df.columns)
        assert "high_influence" in df.columns

    def test_dimension_reduction(self, feature_engineer, sample_market_data):
        """测试降维功能"""
        # 添加一些随机特征
        for i in range(10):
            sample_market_data[f"random_feature_{i}"] = np.random.normal(0, 1, 100)

        df_pca = feature_engineer.reduce_dimensions(sample_market_data, n_components=5)

        # 验证降维结果
        assert len(df_pca.columns) < len(sample_market_data.columns)
        assert all(col.startswith("PC") for col in df_pca.columns if col != "timestamp")
        assert len([col for col in df_pca.columns if col.startswith("PC")]) == 5

    def test_feature_selection(self, feature_engineer, sample_market_data):
        """测试特征选择功能"""
        # 添加目标变量
        sample_market_data["target"] = np.random.normal(0, 1, 100)

        # 添加一些随机特征
        for i in range(10):
            sample_market_data[f"random_feature_{i}"] = np.random.normal(0, 1, 100)

        selected_features = feature_engineer.select_features(
            sample_market_data, "target", n_features=5
        )

        # 验证特征选择结果
        assert len(selected_features) == 5
        assert all(isinstance(feature, str) for feature in selected_features)
        assert all(
            feature in sample_market_data.columns for feature in selected_features
        )

    def test_correlation_removal(self, feature_engineer, sample_market_data):
        """测试相关性去除功能"""
        # 添加高度相关的特征
        sample_market_data["highly_corr_1"] = sample_market_data[
            "close"
        ] + np.random.normal(0, 0.1, 100)
        sample_market_data["highly_corr_2"] = sample_market_data[
            "close"
        ] + np.random.normal(0, 0.1, 100)

        df = feature_engineer._remove_highly_correlated(sample_market_data)

        # 验证结果
        assert len(df.columns) < len(sample_market_data.columns)

        # 验证剩余特征的相关性
        corr_matrix = df.corr().abs()
        upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
        assert not any(
            any(x > feature_engineer.correlation_threshold for x in row)
            for row in upper.values
        )

    def test_error_handling(self, feature_engineer):
        """测试错误处理"""
        # 测试空数据框
        empty_df = pd.DataFrame()
        assert feature_engineer.generate_market_features(empty_df).empty
        assert feature_engineer.generate_trading_features(empty_df).empty
        assert feature_engineer.generate_social_features(empty_df).empty

        # 测试缺失必要列的数据框
        invalid_df = pd.DataFrame({"A": [1, 2, 3]})
        assert len(feature_engineer.select_features(invalid_df, "B")) == 0

    def test_window_calculations(self, feature_engineer, sample_market_data):
        """测试窗口计算"""
        df = feature_engineer._add_custom_market_features(sample_market_data)

        # 验证不同窗口大小的特征
        for window in feature_engineer.window_sizes:
            assert f"return_{window}" in df.columns
            assert f"ma_{window}" in df.columns
            assert not df[f"return_{window}"].isna().all()
            assert not df[f"ma_{window}"].isna().all()

    def test_feature_combinations(
        self,
        feature_engineer,
        sample_market_data,
        sample_trading_data,
        sample_social_data,
    ):
        """测试特征组合"""
        # 生成所有特征
        market_features = feature_engineer.generate_market_features(sample_market_data)
        trading_features = feature_engineer.generate_trading_features(
            sample_trading_data, sample_market_data
        )
        social_features = feature_engineer.generate_social_features(
            sample_social_data, sample_market_data
        )

        # 验证特征数量
        assert len(market_features.columns) > len(sample_market_data.columns)
        assert len(trading_features.columns) > len(sample_trading_data.columns)
        assert len(social_features.columns) > len(sample_social_data.columns)

        # 验证特征质量
        assert not market_features.isna().all().any()
        assert not trading_features.isna().all().any()
        assert not social_features.isna().all().any()
