import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import plotly.graph_objects as go
from src.backend.data_infrastructure.data_visualizer import DataVisualizer


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
        "MA5": np.random.normal(100, 5, 100),
        "MA10": np.random.normal(100, 5, 100),
        "MA20": np.random.normal(100, 5, 100),
        "MACD": np.random.normal(0, 1, 100),
        "MACD_signal": np.random.normal(0, 1, 100),
        "MACD_hist": np.random.normal(0, 1, 100),
        "RSI": np.random.uniform(0, 100, 100),
        "BB_upper": np.random.normal(110, 5, 100),
        "BB_middle": np.random.normal(100, 5, 100),
        "BB_lower": np.random.normal(90, 5, 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def sample_trading_data():
    """创建示例交易数据"""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="1min")
    data = {
        "timestamp": dates,
        "price": np.random.normal(100, 10, 100),
        "amount": np.random.normal(1, 0.1, 100),
        "buy_sell_ratio": np.random.normal(1, 0.2, 100),
        "trade_interval": np.random.exponential(60, 100),
        "price_change": np.random.normal(0, 0.01, 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def sample_social_data():
    """创建示例社交媒体数据"""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="1min")
    data = {
        "timestamp": dates,
        "sentiment": np.random.normal(0, 0.5, 100),
        "sentiment_mean": np.random.normal(0, 0.3, 100),
        "sentiment_std": np.random.uniform(0.1, 0.5, 100),
        "influence_score": np.random.uniform(0, 1, 100),
        "platform": np.random.choice(["twitter", "reddit", "discord", "telegram"], 100),
    }
    return pd.DataFrame(data)


@pytest.fixture
def data_visualizer():
    """创建DataVisualizer实例"""
    config = {"theme": "plotly_dark", "default_height": 600, "default_width": 1000}
    return DataVisualizer(config)


class TestDataVisualizer:
    def test_plot_market_overview(self, data_visualizer, sample_market_data):
        """测试市场概览图生成"""
        fig = data_visualizer.plot_market_overview(sample_market_data)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) >= 4  # K线图 + 3个MA + 成交量

        # 验证子图
        assert len(fig.layout.annotations) == 2  # Price和Volume标题

    def test_plot_technical_indicators(self, data_visualizer, sample_market_data):
        """测试技术指标图生成"""
        fig = data_visualizer.plot_technical_indicators(sample_market_data)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) >= 7  # MACD(3) + RSI(1) + BB(3)

        # 验证子图
        assert len(fig.layout.annotations) == 3  # MACD、RSI和BB标题

    def test_plot_trading_analysis(self, data_visualizer, sample_trading_data):
        """测试交易分析图生成"""
        fig = data_visualizer.plot_trading_analysis(sample_trading_data)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) >= 4  # 散点图、买卖比例、间隔分布、价格变化分布

        # 验证子图
        assert len(fig.layout.annotations) == 4

    def test_plot_sentiment_analysis(self, data_visualizer, sample_social_data):
        """测试情绪分析图生成"""
        fig = data_visualizer.plot_sentiment_analysis(sample_social_data)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) >= 5  # 趋势(3) + 分布(1) + 散点图(1)

        # 验证子图
        assert len(fig.layout.annotations) == 4

    def test_plot_correlation_matrix(self, data_visualizer, sample_market_data):
        """测试相关性矩阵图生成"""
        fig = data_visualizer.plot_correlation_matrix(sample_market_data)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) == 1  # 热力图
        assert isinstance(fig.data[0], go.Heatmap)

    def test_plot_feature_importance(self, data_visualizer):
        """测试特征重要性图生成"""
        importance_dict = {"feature1": 0.3, "feature2": 0.2, "feature3": 0.5}

        fig = data_visualizer.plot_feature_importance(importance_dict)

        # 验证图形对象
        assert isinstance(fig, go.Figure)
        assert len(fig.data) == 1  # 条形图
        assert isinstance(fig.data[0], go.Bar)
        assert len(fig.data[0].x) == 3
        assert len(fig.data[0].y) == 3

    def test_save_figure(self, data_visualizer, sample_market_data, tmp_path):
        """测试图形保存功能"""
        save_path = tmp_path / "test_figure.html"

        # 保存图形
        data_visualizer.plot_market_overview(
            sample_market_data, save_path=str(save_path)
        )

        # 验证文件是否存在
        assert save_path.exists()
        assert save_path.stat().st_size > 0
