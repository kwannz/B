import pytest
import asyncio
from datetime import datetime
import numpy as np
from unittest.mock import Mock, AsyncMock, patch
from src.backend.data_infrastructure.dex_monitor import DexMonitor, DexMetrics


@pytest.fixture
def config():
    return {
        "rpc_url": "http://localhost:8545",
        "update_interval": 1,
        "volatility_window": 24,
        "alert_threshold": 0.1,
        "min_liquidity": 1000,
    }


@pytest.fixture
async def dex_monitor(config):
    monitor = DexMonitor(config)
    yield monitor


class TestDexMonitor:

    @pytest.mark.asyncio
    async def test_metrics_initialization(self, dex_monitor):
        """测试指标初始化"""
        metrics = dex_monitor.metrics

        assert metrics.liquidity_depth._value.get() == 0
        assert metrics.volume_24h._value.get() == 0
        assert metrics.tvl._value.get() == 0
        assert metrics.volatility._value.get() == 0

    @pytest.mark.asyncio
    async def test_metrics_update(self, dex_monitor):
        """测试指标更新"""
        # 模拟池子数据
        mock_data = {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": 1000.0,
        }

        with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
            await dex_monitor._update_metrics()

            metrics = dex_monitor.metrics
            assert metrics.liquidity_depth._value.get() == mock_data["liquidity"]
            assert metrics.tvl._value.get() == mock_data["tvl"]
            assert metrics.volume_24h._value.get() == mock_data["volume_24h"]

    @pytest.mark.asyncio
    async def test_volatility_calculation(self, dex_monitor):
        """测试波动率计算"""
        # 模拟价格数据
        prices = [100.0 * (1 + 0.01 * i) for i in range(10)]  # 1%增长

        for price in prices:
            mock_data = {
                "liquidity": 1000000,
                "tvl": 5000000,
                "volume_24h": 500000,
                "swap_count": 100,
                "price": price,
            }
            with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
                await dex_monitor._update_metrics()

        # 验证波动率计算
        volatility = dex_monitor.metrics.volatility._value.get()
        assert volatility > 0

    @pytest.mark.asyncio
    async def test_alert_generation(self, dex_monitor):
        """测试告警生成"""
        # 模拟低流动性
        mock_data = {
            "liquidity": 500,  # 低于最小流动性阈值
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": 1000.0,
        }

        with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
            await dex_monitor._update_metrics()
            await dex_monitor._check_alerts()

            alerts = dex_monitor.get_alerts()
            assert len(alerts) > 0
            assert any(alert["type"] == "liquidity" for alert in alerts)

    @pytest.mark.asyncio
    async def test_price_change_alerts(self, dex_monitor):
        """测试价格变化告警"""
        # 模拟价格大幅变化
        initial_price = 1000.0
        new_price = initial_price * 1.2  # 20%涨幅

        mock_data_1 = {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": initial_price,
        }

        mock_data_2 = {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": new_price,
        }

        with patch.object(
            dex_monitor, "_get_pool_data", side_effect=[mock_data_1, mock_data_2]
        ):
            await dex_monitor._update_metrics()
            await dex_monitor._update_metrics()
            await dex_monitor._check_alerts()

            alerts = dex_monitor.get_alerts()
            assert any(alert["type"] == "price_change" for alert in alerts)

    @pytest.mark.asyncio
    async def test_metrics_summary(self, dex_monitor):
        """测试指标摘要"""
        mock_data = {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": 1000.0,
        }

        with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
            await dex_monitor._update_metrics()

            summary = dex_monitor.get_metrics_summary()
            assert "liquidity_depth" in summary
            assert "volume_24h" in summary
            assert "tvl" in summary
            assert "volatility" in summary
            assert "price_change" in summary

    @pytest.mark.asyncio
    async def test_error_handling(self, dex_monitor):
        """测试错误处理"""
        # 模拟数据获取错误
        with patch.object(
            dex_monitor, "_get_pool_data", side_effect=Exception("Test error")
        ):
            await dex_monitor._update_metrics()

            metrics = dex_monitor.metrics
            assert metrics.liquidity_depth._value.get() == 0
            assert metrics.tvl._value.get() == 0

    @pytest.mark.asyncio
    async def test_monitoring_lifecycle(self, dex_monitor):
        """测试监控生命周期"""
        # 创建监控任务
        monitor_task = asyncio.create_task(dex_monitor.start_monitoring())

        # 等待几个更新周期
        await asyncio.sleep(2)

        # 取消任务
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

        # 验证指标更新
        assert hasattr(dex_monitor, "price_history")

    @pytest.mark.asyncio
    async def test_high_volatility_detection(self, dex_monitor):
        """测试高波动率检测"""
        # 模拟高波动率价格序列
        prices = [1000.0]
        for _ in range(10):
            prices.append(prices[-1] * (1 + np.random.normal(0, 0.1)))

        for price in prices:
            mock_data = {
                "liquidity": 1000000,
                "tvl": 5000000,
                "volume_24h": 500000,
                "swap_count": 100,
                "price": price,
            }
            with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
                await dex_monitor._update_metrics()

        await dex_monitor._check_alerts()
        alerts = dex_monitor.get_alerts()
        assert any(alert["type"] == "volatility" for alert in alerts)

    @pytest.mark.asyncio
    async def test_performance_under_load(self, dex_monitor):
        """测试负载下的性能"""
        # 记录开始时间
        start_time = datetime.now()

        # 快速更新多次
        update_count = 100
        mock_data = {
            "liquidity": 1000000,
            "tvl": 5000000,
            "volume_24h": 500000,
            "swap_count": 100,
            "price": 1000.0,
        }

        with patch.object(dex_monitor, "_get_pool_data", return_value=mock_data):
            for _ in range(update_count):
                await dex_monitor._update_metrics()
                await dex_monitor._check_alerts()

        # 计算处理时间
        duration = (datetime.now() - start_time).total_seconds()

        # 验证性能
        assert duration < update_count * 0.01  # 每次更新平均耗时小于10ms
