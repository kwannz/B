"""
告警管理器测试
"""

import os
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock

from tradingbot.shared.alerts_manager import AlertsManager, Alert


@pytest.fixture
async def alerts_manager():
    """创建告警管理器实例"""
    manager = AlertsManager(test_mode=True)
    await manager.initialize()
    yield manager
    await manager.close()


@pytest.mark.asyncio
async def test_alerts_manager_initialization(alerts_manager):
    """测试告警管理器初始化"""
    assert alerts_manager.initialized is True
    assert isinstance(alerts_manager.error_rate_threshold, float)
    assert isinstance(alerts_manager.latency_threshold, float)
    assert isinstance(alerts_manager.alert_window, int)


@pytest.mark.asyncio
async def test_error_rate_alert(alerts_manager):
    """测试错误率告警"""
    # 模拟多个错误
    component = "test_component"
    for _ in range(30):  # 在5分钟内产生30个错误
        await alerts_manager.record_error(component, Exception("测试错误"))

    # 验证告警
    active_alerts = alerts_manager.get_active_alerts()
    assert len(active_alerts) == 1
    alert = active_alerts[0]
    assert alert.component == component
    assert alert.severity == "critical"
    assert "错误率过高" in alert.message


@pytest.mark.asyncio
async def test_latency_alert(alerts_manager):
    """测试延迟告警"""
    # 模拟高延迟
    component = "test_component"
    await alerts_manager.record_latency(component, 2.0)  # 2秒延迟

    # 验证告警
    active_alerts = alerts_manager.get_active_alerts()
    assert len(active_alerts) == 1
    alert = active_alerts[0]
    assert alert.component == component
    assert alert.severity == "warning"
    assert "延迟过高" in alert.message


@pytest.mark.asyncio
async def test_alert_resolution(alerts_manager):
    """测试告警解决"""
    # 创建告警
    component = "test_component"
    await alerts_manager.record_error(component, Exception("测试错误"))

    # 解决告警
    await alerts_manager.resolve_alert(component, "error_rate")

    # 验证告警已解决
    active_alerts = alerts_manager.get_active_alerts()
    assert len(active_alerts) == 0

    # 验证告警历史
    history = alerts_manager.get_alert_history()
    assert len(history) == 1
    assert history[0].resolved is True
    assert history[0].resolved_at is not None


@pytest.mark.asyncio
async def test_alert_callbacks(alerts_manager):
    """测试告警回调"""
    # Create async mock callback
    callback = AsyncMock()
    alerts_manager.register_callback(callback)

    # Trigger alert
    component = "test_component"
    error = Exception("Test error")
    await alerts_manager.record_error(component, error)

    # Wait for callback to be called
    await asyncio.sleep(0.1)

    # Verify callback was called with error alert
    callback.assert_called_once()
    alert = callback.call_args[0][0]
    assert isinstance(alert, Alert)
    assert alert.component == component
    assert alert.severity == "critical"
    assert not alert.resolved

    # Reset mock and resolve alert
    callback.reset_mock()
    resolved = await alerts_manager.resolve_alert(component, "error_rate")
    assert resolved

    # Wait for callback to be called
    await asyncio.sleep(0.1)

    # Verify callback was called with resolved alert
    callback.assert_called_once()
    resolved_alert = callback.call_args[0][0]
    assert isinstance(resolved_alert, Alert)
    assert resolved_alert.component == component
    assert resolved_alert.resolved
    assert resolved_alert.resolved_at is not None


@pytest.mark.asyncio
async def test_data_cleanup():
    """测试数据清理"""
    # 使用较短的告警窗口进行测试
    with patch.dict(os.environ, {"ALERT_WINDOW": "5"}):  # 5秒窗口
        manager = AlertsManager()
        await manager.initialize()

        # 记录一些数据
        component = "test_component"
        await manager.record_error(component, Exception("测试错误"))
        await manager.record_latency(component, 1.5)

        # 等待数据清理
        await asyncio.sleep(6)

        # 验证数据已清理 - 组件应该被完全移除
        assert component not in manager.component_errors
        assert component not in manager.component_latencies

        await manager.close()


@pytest.mark.asyncio
async def test_alert_history_filtering(alerts_manager):
    """测试告警历史过滤"""
    component = "test_component"

    # 创建不同严重程度的告警
    await alerts_manager.record_error(component, Exception("严重错误"))
    await alerts_manager.record_latency(component, 2.0)

    # 按严重程度过滤
    critical_alerts = alerts_manager.get_alert_history(severity="critical")
    warning_alerts = alerts_manager.get_alert_history(severity="warning")

    assert len(critical_alerts) == 1
    assert len(warning_alerts) == 1
    assert critical_alerts[0].severity == "critical"
    assert warning_alerts[0].severity == "warning"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
