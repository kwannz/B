"""
实时监控器测试
"""

import os
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch

from tradingbot.shared.real_time_monitor import RealTimeMonitor


@pytest.fixture
async def monitor():
    """创建监控器实例"""
    monitor = RealTimeMonitor()
    await monitor.initialize()
    yield monitor
    await monitor.close()


@pytest.mark.asyncio
async def test_monitor_initialization(monitor):
    """测试监控器初始化"""
    assert monitor.initialized is True
    assert isinstance(monitor.metrics_interval, int)
    assert isinstance(monitor.components, list)
    assert len(monitor.components) > 0


@pytest.mark.asyncio
async def test_system_metrics_collection(monitor):
    """测试系统指标收集"""
    metrics = await monitor.get_system_metrics()

    # 验证基本字段
    assert "timestamp" in metrics
    assert "cpu_usage" in metrics
    assert "memory_usage" in metrics
    assert "active_connections" in metrics
    assert "open_files" in metrics

    # 验证数值类型和范围
    assert isinstance(metrics["cpu_usage"], float)
    assert isinstance(metrics["memory_usage"], float)
    assert isinstance(metrics["active_connections"], int)
    assert 0 <= metrics["cpu_usage"] <= 100
    assert metrics["memory_usage"] >= 0
    assert metrics["active_connections"] >= 0


@pytest.mark.asyncio
async def test_component_health_checks(monitor):
    """测试组件健康检查"""
    health_status = await monitor.check_component_health()

    # 验证所有组件都有状态
    for component in monitor.components:
        assert component in health_status
        assert isinstance(health_status[component], bool)


@pytest.mark.asyncio
async def test_performance_stats_collection(monitor):
    """测试性能统计收集"""
    # 记录一些测试数据
    await monitor.record_request("news_collector", 0.5)
    await monitor.record_request("news_collector", 0.7, is_error=True)
    await monitor.record_request("ai_analyzer", 1.2)

    stats = await monitor.get_performance_stats()

    # 验证基本字段
    assert "timestamp" in stats
    assert "response_times" in stats
    assert "error_rates" in stats
    assert "throughput" in stats

    # 验证响应时间统计
    rt = stats["response_times"].get("news_collector", {})
    if rt:
        assert "avg" in rt
        assert "max" in rt
        assert "min" in rt
        assert rt["min"] <= rt["avg"] <= rt["max"]

    # 验证错误率
    assert 0 <= stats["error_rates"].get("news_collector", 0) <= 1.0

    # 验证吞吐量
    assert stats["throughput"].get("news_collector", 0) >= 0


@pytest.mark.asyncio
async def test_prometheus_integration():
    """测试Prometheus集成"""
    # 启用Prometheus
    with patch.dict(os.environ, {"USE_PROMETHEUS": "true"}):
        monitor = RealTimeMonitor()
        await monitor.initialize()

        # 验证Prometheus配置
        assert monitor.use_prometheus is True

        # 记录一些指标
        await monitor.record_request("test_component", 0.5)

        # 获取指标（应该不会抛出异常）
        try:
            await monitor.get_system_metrics()
            await monitor.check_component_health()
            await monitor.get_performance_stats()
        except Exception as e:
            pytest.fail(f"Prometheus集成测试失败: {str(e)}")

        await monitor.close()


@pytest.mark.asyncio
async def test_metrics_collection_periodic():
    """测试定期指标收集"""
    # 设置较短的收集间隔
    with patch.dict(os.environ, {"METRICS_INTERVAL": "1"}):
        monitor = RealTimeMonitor()
        await monitor.initialize()

        # 等待几个收集周期
        await asyncio.sleep(2)

        # 验证指标已被收集
        assert len(monitor.response_times) >= 0
        assert isinstance(monitor.last_metrics_time, float)

        await monitor.close()


@pytest.mark.asyncio
async def test_error_handling(monitor):
    """测试错误处理"""
    # 模拟组件检查失败
    with patch.object(monitor, "_check_component", side_effect=Exception("测试异常")):
        health_status = await monitor.check_component_health()

        # 验证错误处理
        assert all(status is False for status in health_status.values())

    # 模拟指标收集失败
    with patch("resource.getrusage", side_effect=Exception("资源访问失败")):
        metrics = await monitor.get_system_metrics()

        # 验证错误响应格式
        assert "timestamp" in metrics
        assert "error" in metrics


@pytest.mark.asyncio
async def test_request_recording_limits(monitor):
    """测试请求记录限制"""
    # 添加超过限制的请求
    component = "test_component"
    for _ in range(1100):  # 超过1000的限制
        await monitor.record_request(component, 0.1)

    # 验证列表被截断
    assert len(monitor.response_times[component]) <= 1000


if __name__ == "__main__":
    pytest.main(["-v", __file__])
