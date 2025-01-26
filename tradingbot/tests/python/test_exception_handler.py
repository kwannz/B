"""
异常处理器测试
"""

import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch

from tradingbot.shared.exception_handler import ExceptionHandler

# 测试数据
MOCK_CONTEXT = {
    "component": "test_component",
    "retry_func": AsyncMock(),
    "validate_func": AsyncMock(return_value=True),
    "fallback_func": AsyncMock(return_value=True),
}


@pytest.fixture
async def exception_handler():
    """创建异常处理器实例"""
    handler = ExceptionHandler()
    await handler.initialize()
    yield handler
    await handler.close()


@pytest.mark.asyncio
async def test_initialization(exception_handler):
    """测试初始化"""
    assert exception_handler.initialized
    assert exception_handler.max_retries == 3
    assert exception_handler.retry_delay == 1
    assert exception_handler.error_threshold == 10


@pytest.mark.asyncio
async def test_handle_connection_error(exception_handler):
    """测试连接错误处理"""
    # 模拟重试成功
    retry_func = AsyncMock()
    context = {"retry_func": retry_func}

    result = await exception_handler.handle_exception(
        ConnectionError("连接失败"), context
    )

    assert result["type"] == "ConnectionError"
    assert result["recovery_strategy"] == "retry"
    assert retry_func.call_count > 0


@pytest.mark.asyncio
async def test_handle_validation_error(exception_handler):
    """测试验证错误处理"""
    # 模拟验证成功
    validate_func = AsyncMock(return_value=True)
    context = {"validate_func": validate_func}

    result = await exception_handler.handle_exception(ValueError("无效数据"), context)

    assert result["type"] == "ValueError"
    assert result["recovery_strategy"] == "validate"
    assert validate_func.called


@pytest.mark.asyncio
async def test_failover_trigger(exception_handler):
    """测试故障转移触发"""
    # 制造多个错误触发故障转移
    context = {
        "component": "test_component",
        "fallback_func": AsyncMock(return_value=True),
    }

    for _ in range(exception_handler.error_threshold):
        await exception_handler.handle_exception(Exception("测试错误"), context)

    result = await exception_handler.handle_exception(
        Exception("触发故障转移"), context
    )

    assert result["recovery_strategy"] == "failover"
    assert context["fallback_func"].called


@pytest.mark.asyncio
async def test_error_statistics(exception_handler):
    """测试错误统计"""
    # 产生不同类型的错误
    errors = [ValueError("错误1"), ConnectionError("错误2"), TimeoutError("错误3")]

    for error in errors:
        await exception_handler.handle_exception(error, MOCK_CONTEXT)

    summary = await exception_handler.get_error_summary()

    assert summary["total_errors"] == 3
    assert len(summary["error_types"]) == 3
    assert len(summary["recent_errors"]) == 3


@pytest.mark.asyncio
async def test_component_status(exception_handler):
    """测试组件状态检查"""
    # 制造组件错误
    context = {"component": "failing_component"}

    for _ in range(exception_handler.error_threshold):
        await exception_handler.handle_exception(Exception("组件错误"), context)

    summary = await exception_handler.get_error_summary()
    status = summary["components_status"]

    assert "failing_component" in status
    assert status["failing_component"] == "failing"


@pytest.mark.asyncio
async def test_error_notification(exception_handler):
    """测试错误通知"""
    # 启用通知
    exception_handler.notification_enabled = True

    with patch.object(exception_handler, "_send_error_notification") as mock_notify:
        await exception_handler.handle_exception(
            Exception("需要通知的错误"), MOCK_CONTEXT
        )

        assert mock_notify.called


@pytest.mark.asyncio
async def test_recovery_failure(exception_handler):
    """测试恢复失败情况"""
    # 模拟恢复失败
    context = {"retry_func": AsyncMock(side_effect=Exception("恢复失败"))}

    result = await exception_handler.handle_exception(
        ConnectionError("初始错误"), context
    )

    assert not result["recovered"]
    assert "recovery_error" in result


if __name__ == "__main__":
    pytest.main(["-v", __file__])
