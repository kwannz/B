import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from src.backend.data_infrastructure.data_processor import DataProcessor


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
        "platform": np.random.choice(["twitter", "reddit"], 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def data_processor():
    """创建DataProcessor实例"""
    config = {"resample_rule": "1min", "window_size": 20, "outlier_std": 3}
    return DataProcessor(config)


class TestDataProcessor:
    def test_market_data_processing(self, data_processor, sample_market_data):
        """测试市场数据处理"""
        df = data_processor.process_market_data(sample_market_data)

        # 验证基本处理
        assert not df.empty
        assert "timestamp" in df.columns
        assert all(
            col in df.columns for col in ["open", "high", "low", "close", "volume"]
        )

        # 验证技术指标
        assert all(col in df.columns for col in ["MA5", "MA10", "MA20", "RSI"])
        assert all(col in df.columns for col in ["MACD", "MACD_signal", "MACD_hist"])
        assert all(col in df.columns for col in ["BB_upper", "BB_middle", "BB_lower"])

    def test_trading_data_processing(self, data_processor, sample_trading_data):
        """测试交易数据处理"""
        df = data_processor.process_trading_data(sample_trading_data)

        # 验证基本处理
        assert not df.empty
        assert "trade_id" in df.columns
        assert all(col in df.columns for col in ["price", "amount", "side"])

        # 验证统计特征
        assert all(col in df.columns for col in ["volume_mean", "volume_std"])
        assert all(col in df.columns for col in ["price_mean", "price_std"])
        assert "buy_sell_ratio" in df.columns

        # 验证时间特征
        assert all(col in df.columns for col in ["hour", "day_of_week"])

    def test_social_data_processing(self, data_processor, sample_social_data):
        """测试社交媒体数据处理"""
        df = data_processor.process_social_data(sample_social_data)

        # 验证基本处理
        assert not df.empty
        assert "timestamp" in df.columns
        assert "sentiment_mean" in df.columns
        assert "weighted_sentiment" in df.columns

        # 验证情绪特征
        assert "sentiment_momentum" in df.columns
        assert "sentiment_volatility" in df.columns
        assert "sentiment_trend" in df.columns

    def test_data_cleaning(self, data_processor, sample_market_data):
        """测试数据清洗"""
        # 添加一些异常值
        sample_market_data.loc[0, "close"] = 1000000  # 异常高价
        sample_market_data.loc[1, "volume"] = -1000  # 异常成交量

        df = data_processor._clean_market_data(sample_market_data)

        # 验证异常值处理
        assert df["close"].max() < 1000000
        assert df["volume"].min() >= 0

    def test_data_resampling(self, data_processor, sample_market_data):
        """测试数据重采样"""
        df = data_processor._resample_data(sample_market_data)

        # 验证重采样结果
        assert not df.empty
        assert isinstance(df.index, pd.DatetimeIndex)
        assert all(
            col in df.columns for col in ["open", "high", "low", "close", "volume"]
        )

    def test_technical_indicators(self, data_processor, sample_market_data):
        """测试技术指标计算"""
        df = data_processor._add_technical_indicators(sample_market_data)

        # 验证移动平均线
        assert all(col in df.columns for col in ["MA5", "MA10", "MA20"])
        assert not df["MA5"].isna().all()

        # 验证MACD
        assert all(col in df.columns for col in ["MACD", "MACD_signal", "MACD_hist"])
        assert not df["MACD"].isna().all()

        # 验证RSI
        assert "RSI" in df.columns
        assert not df["RSI"].isna().all()

    def test_trade_features(self, data_processor, sample_trading_data):
        """测试交易特征计算"""
        df = data_processor._add_trade_features(sample_trading_data)

        # 验证价格和成交量变化
        assert "price_change" in df.columns
        assert "volume_change" in df.columns

        # 验证交易间隔
        assert "trade_interval" in df.columns
        assert df["trade_interval"].dtype == np.float64

    def test_sentiment_aggregation(self, data_processor, sample_social_data):
        """测试情绪数据聚合"""
        df = data_processor._aggregate_sentiment(sample_social_data)

        # 验证聚合结果
        assert "sentiment_mean" in df.columns
        assert "sentiment_std" in df.columns
        assert "weighted_sentiment" in df.columns

    def test_data_combination(
        self,
        data_processor,
        sample_market_data,
        sample_trading_data,
        sample_social_data,
    ):
        """测试数据合并"""
        df = data_processor.combine_data(
            sample_market_data, sample_trading_data, sample_social_data
        )

        # 验证合并结果
        assert not df.empty
        assert isinstance(df.index, pd.DatetimeIndex)
        assert len(df.columns) > 0

    def test_feature_importance(self, data_processor, sample_market_data):
        """测试特征重要性计算"""
        # 添加目标变量
        sample_market_data["target"] = np.random.normal(0, 1, len(sample_market_data))

        importance = data_processor.get_feature_importance(sample_market_data, "target")

        # 验证特征重要性
        assert isinstance(importance, dict)
        assert len(importance) > 0
        assert all(isinstance(v, float) for v in importance.values())
        assert all(0 <= v <= 1 for v in importance.values())
