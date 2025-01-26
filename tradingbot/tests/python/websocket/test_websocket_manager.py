"""
WebSocket管理器测试
"""

import os
import json
import pytest
import asyncio
import logging
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
from aiohttp import WSMsgType, WSMessage

from tradingbot.trading_agent.python.streams.websocket_manager import WebSocketManager


@pytest.fixture
async def ws_manager():
    """创建WebSocket管理器实例"""
    manager = WebSocketManager()
    yield manager
    # 清理所有连接
    for exchange in list(manager.connections.keys()):
        await manager.disconnect(exchange)


@pytest.fixture
def mock_ws_response():
    """模拟WebSocket响应"""
    messages = [
        WSMessage(
            type=WSMsgType.TEXT,
            data='{"type": "trade", "data": {"price": 50000, "amount": 1.0}}',
            extra=None,
        ),
        WSMessage(
            type=WSMsgType.TEXT,
            data='{"type": "trade", "data": {"price": 50100, "amount": 0.5}}',
            extra=None,
        ),
        WSMessage(type=WSMsgType.CLOSE, data=None, extra=None),
    ]

    class AsyncIterator:
        def __init__(self, messages):
            self.messages = messages
            self.index = 0

        async def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                await asyncio.sleep(0.1)  # Simulate network delay
                if self.index >= len(self.messages):
                    raise StopAsyncIteration
                message = self.messages[self.index]
                self.index += 1
                return message
            except IndexError:
                raise StopAsyncIteration

    # Create mock WebSocket
    mock_ws = AsyncMock()
    mock_ws.closed = False
    mock_ws.receive = AsyncMock(side_effect=messages)
    mock_ws.__aiter__ = lambda: AsyncIterator(messages)
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()

    # Create mock session
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None

    return mock_session


@pytest.mark.asyncio
async def test_connection_management(ws_manager):
    """测试连接管理"""
    with patch(
        "aiohttp.ClientSession.ws_connect", new_callable=AsyncMock
    ) as mock_connect:
        mock_connect.return_value = AsyncMock()

        # 测试连接
        success = await ws_manager.connect("test_exchange", "ws://test.com")
        assert success is True
        assert "test_exchange" in ws_manager.connections
        assert ws_manager.is_connected["test_exchange"] is True

        # 测试断开连接
        success = await ws_manager.disconnect("test_exchange")
        assert success is True
        assert ws_manager.is_connected["test_exchange"] is False


@pytest.mark.asyncio
@pytest.mark.timeout(10)  # 10秒超时
async def test_message_handling(ws_manager, mock_ws_response, caplog):
    """测试消息处理"""
    caplog.set_level(logging.DEBUG)

    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        # 设置回调
        messages = []
        message_received = asyncio.Event()

        async def callback(data):
            try:
                if isinstance(data, str):
                    data = json.loads(data)
                logging.debug(f"Callback received data: {data}")
                messages.append(data)
                if len(messages) >= 2:  # 期望接收2条消息
                    logging.debug("Received enough messages, setting event")
                    message_received.set()
            except Exception as e:
                logging.error(f"Callback error: {str(e)}", exc_info=True)

        # 连接并订阅
        await ws_manager.connect("test_exchange", "ws://test.com")
        await ws_manager.subscribe("test_exchange", "trade", callback)

        # 启动消息监听
        listen_task = asyncio.create_task(ws_manager.start_listening("test_exchange"))

        try:
            # 等待消息处理完成或超时
            await asyncio.wait_for(message_received.wait(), timeout=5.0)

            # 验证消息处理
            assert len(messages) == 2
            assert "price" in messages[0]["data"]
            assert messages[0]["data"]["price"] == 50000
            assert messages[1]["data"]["price"] == 50100

        finally:
            # 清理
            listen_task.cancel()
            try:
                await listen_task
            except asyncio.CancelledError:
                pass


@pytest.mark.asyncio
async def test_reconnection(ws_manager):
    """测试重连机制"""
    connection_attempts = 0

    async def mock_connect(*args, **kwargs):
        nonlocal connection_attempts
        connection_attempts += 1
        if connection_attempts == 1:
            raise aiohttp.ClientError("连接失败")
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock()
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None
        mock_ws.close = AsyncMock()
        return mock_ws

    with patch("aiohttp.ClientSession") as mock_session_class:
        mock_session = AsyncMock()
        mock_session.ws_connect = AsyncMock(side_effect=mock_connect)
        mock_session_class.return_value = mock_session
        # 第一次连接失败
        success = await ws_manager.connect("test_exchange", "ws://test.com")
        assert success is False

        # 第二次连接成功
        success = await ws_manager.connect("test_exchange", "ws://test.com")
        assert success is True
        assert connection_attempts == 2


@pytest.mark.asyncio
async def test_rate_limiting(ws_manager, mock_ws_response):
    """测试速率限制"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        await ws_manager.connect("test_exchange", "ws://test.com")

        # 设置较低的速率限制
        ws_manager.rate_limits["test_exchange"] = {"messages_per_second": 2}

        # 快速发送多个消息
        messages = [{"type": "test"} for _ in range(10)]
        results = []

        # 发送消息不等待
        for msg in messages:
            result = await ws_manager.send_message("test_exchange", msg)
            results.append(result)

        # 验证速率限制
        assert sum(results) < len(messages)  # 部分消息应该被限制


@pytest.mark.asyncio
async def test_error_handling(ws_manager):
    """测试错误处理"""
    error_count = 0

    error_count = 0

    async def mock_receive():
        nonlocal error_count
        error_count += 1
        raise Exception("测试错误")

    # Create mock WebSocket
    mock_ws = AsyncMock()
    mock_ws.receive = mock_receive
    mock_ws.closed = False
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()

    # Create mock session
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await ws_manager.connect("test_exchange", "ws://test.com")

        # 启动消息监听
        listen_task = asyncio.create_task(ws_manager.start_listening("test_exchange"))

        # 等待错误处理
        await asyncio.sleep(2.0)  # 增加等待时间以确保错误处理完成

        # 验证错误处理
        assert error_count > 0

        # 清理
        listen_task.cancel()
        try:
            await listen_task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_concurrent_connections(ws_manager, mock_ws_response):
    """测试并发连接"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        # 创建多个连接
        exchanges = ["exchange1", "exchange2", "exchange3"]
        tasks = [
            ws_manager.connect(exchange, f"ws://{exchange}.com")
            for exchange in exchanges
        ]

        # 并发连接
        results = await asyncio.gather(*tasks)

        # 验证所有连接
        assert all(results)
        assert all(ws_manager.is_connected[exchange] for exchange in exchanges)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
