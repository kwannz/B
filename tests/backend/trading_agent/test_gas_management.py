from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import numpy as np
import pytest

from src.backend.trading_agent.gas_analyzer import GasAnalyzer
from src.backend.trading_agent.gas_manager import GasManager
from src.backend.trading_agent.gas_predictor import GasPredictor
from src.shared.models.alerts import AlertLevel


@pytest.fixture
def mock_web3():
    with patch("web3.Web3") as mock:
        # 模拟区块数据
        mock.eth.get_block.return_value = {
            "baseFeePerGas": 50 * 1e9,  # 50 Gwei
            "gasUsed": 12_000_000,
            "gasLimit": 15_000_000,
            "timestamp": int(datetime.now().timestamp()),
        }
        mock.eth.block_number = 1_000_000
        yield mock


@pytest.fixture
def gas_manager(mock_web3):
    config = {
        "eth_rpc_url": "http://localhost:8545",
        "base_fee_multiplier": 1.125,
        "max_priority_fee": 3.0,
        "min_priority_fee": 1.0,
    }
    return GasManager(config)


@pytest.fixture
def gas_predictor():
    config = {
        "model_params": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3}
    }
    return GasPredictor(config)


@pytest.fixture
def gas_analyzer():
    config = {
        "analysis_window": 24,
        "alert_thresholds": {
            "high_fee": 100,
            "high_volatility": 0.5,
            "congestion": 0.8,
        },
    }
    return GasAnalyzer(config)


class TestGasManager:
    async def test_estimate_gas_price(self, gas_manager):
        # 测试标准交易类型
        result = await gas_manager.estimate_gas_price("standard")
        assert "base_fee" in result
        assert "max_fee_per_gas" in result
        assert "max_priority_fee_per_gas" in result
        assert result["base_fee"] == 50  # 由mock_web3提供

        # 测试快速交易类型
        fast_result = await gas_manager.estimate_gas_price("fast")
        assert fast_result["max_fee_per_gas"] > result["max_fee_per_gas"]

        # 测试紧急交易类型
        urgent_result = await gas_manager.estimate_gas_price("urgent")
        assert urgent_result["max_fee_per_gas"] > fast_result["max_fee_per_gas"]

    async def test_update_gas_stats(self, gas_manager):
        await gas_manager.update_gas_stats()
        stats = gas_manager.get_gas_stats()

        assert "current_stats" in stats
        assert "avg_base_fee" in stats["current_stats"]
        assert "avg_gas_used_ratio" in stats["current_stats"]

    async def test_optimize_gas_settings(self, gas_manager):
        # 添加模拟历史数据
        gas_manager.gas_price_history = [
            {"estimated_cost": 50, "success": True},
            {"estimated_cost": 60, "success": True},
            {"estimated_cost": 40, "success": False},
        ]

        initial_multiplier = gas_manager.base_fee_multiplier
        await gas_manager.optimize_gas_settings()

        assert gas_manager.base_fee_multiplier != initial_multiplier


class TestGasPredictor:
    async def test_model_training(self, gas_predictor):
        # 准备训练数据
        historical_data = [
            {
                "timestamp": datetime.now() - timedelta(hours=i),
                "base_fee": 50 + np.random.normal(0, 5),
                "priority_fee": 1.5,
                "gas_used_ratio": 0.8,
            }
            for i in range(200)
        ]

        await gas_predictor.train(historical_data)
        assert gas_predictor.is_trained
        assert gas_predictor.last_training_time is not None

    async def test_prediction(self, gas_predictor):
        # 先训练模型
        await self.test_model_training(gas_predictor)

        # 测试预测
        current_state = {"base_fee": 55, "priority_fee": 1.5, "gas_used_ratio": 0.75}

        result = await gas_predictor.predict(current_state)
        assert "base_fee" in result
        assert "confidence" in result
        assert result["source"] == "model"

    def test_feature_preparation(self, gas_predictor):
        data = [
            {
                "timestamp": datetime.now(),
                "base_fee": 50,
                "priority_fee": 1.5,
                "gas_used_ratio": 0.8,
            }
        ]

        df = gas_predictor.prepare_features(data)
        assert all(col in df.columns for col in gas_predictor.feature_columns)


class TestGasAnalyzer:
    async def test_fee_analysis(self, gas_analyzer):
        new_data = {"base_fee": 60, "gas_used_ratio": 0.75}

        result = await gas_analyzer.analyze_fees(new_data)
        assert "current_fee" in result
        assert "trend" in result
        assert "congestion_level" in result

    async def test_alert_generation(self, gas_analyzer):
        # 测试高费用告警
        high_fee_data = {"base_fee": 150, "gas_used_ratio": 0.5}  # 超过告警阈值
        await gas_analyzer.analyze_fees(high_fee_data)

        # 检查是否生成了告警
        assert len(gas_analyzer.alerts) > 0
        assert any(a.level == AlertLevel.HIGH for a in gas_analyzer.alerts)

    def test_trend_prediction(self, gas_analyzer):
        # 准备趋势数据
        df = pd.DataFrame(
            {
                "base_fee": [40, 45, 50, 55, 60],  # 上升趋势
                "timestamp": [
                    datetime.now() - timedelta(minutes=i * 5) for i in range(5)
                ],
            }
        )

        result = gas_analyzer._predict_trend(df)
        assert result["trend_prediction"] == "up"
        assert 0 <= result["confidence"] <= 1

    def test_analysis_summary(self, gas_analyzer):
        summary = gas_analyzer.get_analysis_summary()
        assert "window_size" in summary
        assert "alert_thresholds" in summary
        assert "recent_alerts" in summary
