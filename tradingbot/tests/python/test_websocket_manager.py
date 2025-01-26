"""
WebSocket管理器测试
"""

import os
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
from aiohttp import WSMsgType, WSMessage

from aiohttp import WSMsgType, WSMessage
from tradingbot.trading_agent.python.streams.websocket_manager import (
    WebSocketManager,
    ConnectionState,
    ConnectionMetrics,
)


@pytest.fixture
async def ws_manager():
    """创建WebSocket管理器实例"""
    from prometheus_client import CollectorRegistry

    registry = CollectorRegistry()
    manager = WebSocketManager(registry=registry)
    await manager.initialize()  # Initialize the manager
    yield manager
    # 清理所有连接
    for exchange in list(manager.connections.keys()):
        await manager.disconnect(exchange)


@pytest.fixture
async def mock_ws_response():
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
    ]
    message_index = 0

    async def mock_receive():
        nonlocal message_index
        await asyncio.sleep(0.1)  # Simulate network delay
        if message_index >= len(messages):
            return WSMessage(type=WSMsgType.CLOSE, data=None, extra=None)
        message = messages[message_index]
        message_index += 1
        return message

    # Create mock WebSocket with proper async context
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=mock_receive)
    mock_ws.closed = False
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()
    mock_ws.send_json = AsyncMock()
    mock_ws.send_str = AsyncMock()

    # Create mock session with proper async context
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.close = AsyncMock()

    return mock_session

    return mock_session


@pytest.mark.asyncio
async def test_connection_management(ws_manager):
    """Test connection management"""
    with patch("aiohttp.ClientSession") as mock_session:
        mock_ws = AsyncMock()
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None
        mock_ws.close = AsyncMock()
        mock_ws.send_json = AsyncMock()

        mock_session.return_value.ws_connect = AsyncMock(return_value=mock_ws)
        mock_session.return_value.__aenter__.return_value = mock_session.return_value
        mock_session.return_value.__aexit__.return_value = None
        mock_session.return_value.close = AsyncMock()

        # First attempt should fail
        success = await ws_manager.connect("binance", "ws://test.com")
        assert not success, "First connection attempt should fail"
        assert not ws_manager.connections.get("binance", False)
        assert ws_manager.connection_states["binance"].value == "ERROR"

        # Second attempt should succeed
        success = await ws_manager.connect("binance", "ws://test.com")
        assert success, "Second connection attempt should succeed"
        assert ws_manager.connections["binance"] is True
        assert ws_manager.connection_states["binance"].value == "CONNECTED"

        # Test disconnection
        success = await ws_manager.disconnect("binance")
        assert success is True
        assert not ws_manager.connections.get("binance", False)
        assert ws_manager.connection_states["binance"].value == "DISCONNECTED"


@pytest.mark.asyncio
async def test_message_handling(ws_manager):
    """Test message handling"""
    exchange = "binance"
    messages = []

    async def callback(data):
        messages.append(data)

    # Create mock WebSocket with message queue
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(
        side_effect=[
            WSMessage(
                type=WSMsgType.TEXT,
                data='{"stream":"trade","data":{"price":50000,"amount":1.0}}',
                extra=None,
            ),
            WSMessage(
                type=WSMsgType.TEXT,
                data='{"stream":"trade","data":{"price":50100,"amount":0.5}}',
                extra=None,
            ),
            WSMessage(type=WSMsgType.CLOSE, data=None, extra=None),
        ]
    )
    mock_ws.closed = False
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()
    mock_ws.send_json = AsyncMock()

    # Configure session mock
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.close = AsyncMock()

    # Mock connect method for exchange client
    stream = ws_manager.streams[exchange]
    stream.connect = AsyncMock(return_value=True)
    stream.close = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        # Connect and verify initial state
        await ws_manager.connect(exchange, "ws://test.com")
        assert ws_manager.connection_states[exchange] == ConnectionState.CONNECTED

        # Subscribe to trade channel
        await ws_manager.subscribe(exchange, "trade", callback)

        # Start listening
        listen_task = asyncio.create_task(ws_manager.start_listening(exchange))

        # Wait for message processing
        await asyncio.sleep(0.5)  # Increased wait time to ensure messages are processed

        # Verify message handling
        assert len(messages) == 2  # Should receive both messages
        assert messages[0]["price"] == 50000
        assert messages[0]["amount"] == 1.0
        assert messages[1]["price"] == 50100
        assert messages[1]["amount"] == 0.5
        assert ws_manager.connection_states[exchange] == ConnectionState.CONNECTED
        assert ws_manager.connection_metrics[exchange].messages_received == 2

        # Cleanup
        listen_task.cancel()
        try:
            await listen_task
        except asyncio.CancelledError:
            pass

        await ws_manager.disconnect(exchange)


@pytest.mark.asyncio
async def test_reconnection(ws_manager):
    """Test reconnection mechanism"""
    exchange = "binance"
    connection_attempts = 0

    async def mock_connect(*args, **kwargs):
        nonlocal connection_attempts
        connection_attempts += 1
        if connection_attempts == 1:
            raise aiohttp.ClientError("First connection attempt failed")
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT, data='{"type": "test", "data": {}}', extra=None
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None
        mock_ws.close = AsyncMock()
        mock_ws.send_json = AsyncMock()
        return mock_ws

    # Mock connect method for exchange client
    stream = ws_manager.streams[exchange]
    stream.connect = AsyncMock(side_effect=mock_connect)
    stream.close = AsyncMock()

    # Configure session mock
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(side_effect=mock_connect)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.close = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        # First attempt should fail
        success = await ws_manager.connect(exchange, "ws://test.com")
        assert not success, "First connection attempt should fail"
        assert ws_manager.connection_states[exchange] == ConnectionState.ERROR
        assert ws_manager.connection_metrics[exchange].failed_attempts == 1
        assert ws_manager.connection_metrics[exchange].errors_count == 1

        # Reset connection state
        ws_manager.connection_states[exchange] = ConnectionState.DISCONNECTED
        ws_manager.connection_metrics[exchange].reset()

        # Second attempt should succeed
        success = await ws_manager.connect(exchange, "ws://test.com")
        assert success, "Second connection attempt should succeed"
        assert ws_manager.connection_states[exchange] == ConnectionState.CONNECTED
        assert connection_attempts == 2
        assert ws_manager.connection_metrics[exchange].failed_attempts == 0
        assert ws_manager.connection_metrics[exchange].errors_count == 0

        # Cleanup
        await ws_manager.disconnect(exchange)


@pytest.mark.asyncio
async def test_rate_limiting(ws_manager, mock_ws_response):
    """测试速率限制"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        await ws_manager.connect("test_exchange", "ws://test.com")

        # 设置较低的速率限制
        await ws_manager.connect("binance", "ws://test.com")
        ws_manager.rate_limits["binance"] = {"messages_per_second": 2}

        # 快速发送多个消息
        messages = [{"type": "test"} for _ in range(10)]
        results = []

        # 发送消息不等待
        for msg in messages:
            result = await ws_manager.send_message("binance", msg)
            results.append(result)

        # 验证速率限制
        assert sum(results) < len(messages)  # 部分消息应该被限制


@pytest.mark.asyncio
async def test_error_handling(ws_manager):
    """测试错误处理"""
    exchange = "binance"
    initial_error_count = 0
    initial_counter_value = ws_manager.error_counter.labels(
        exchange=exchange, type="error"
    )._value.get()

    # Create mock WebSocket with error handling
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=Exception("Test error"))
    mock_ws.closed = False
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()

    # Configure session mock
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.close = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        # Connect and verify initial state
        await ws_manager.connect(exchange, "ws://test.com")
        assert ws_manager.connection_states[exchange] == ConnectionState.CONNECTED

        # Trigger error handling
        await ws_manager._handle_error(exchange, "Test error")

        # Verify error metrics increased
        assert (
            ws_manager.connection_metrics[exchange].errors_count > initial_error_count
        )
        assert (
            ws_manager.error_counter.labels(
                exchange=exchange, type="error"
            )._value.get()
            > initial_counter_value
        )

        # Verify connection state changed to ERROR
        assert ws_manager.connection_states[exchange] == ConnectionState.ERROR

        # Clean up
        await ws_manager.disconnect(exchange)


@pytest.mark.asyncio
async def test_concurrent_connections(ws_manager):
    """Test concurrent connections"""
    # Create mock WebSocket with proper async context
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(
        return_value=WSMessage(
            type=WSMsgType.TEXT, data='{"type": "test", "data": {}}', extra=None
        )
    )
    mock_ws.closed = False
    mock_ws.__aenter__.return_value = mock_ws
    mock_ws.__aexit__.return_value = None
    mock_ws.close = AsyncMock()
    mock_ws.send_json = AsyncMock()

    # Create mock session with proper async context
    mock_session = AsyncMock()
    mock_session.ws_connect = AsyncMock(return_value=mock_ws)
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.close = AsyncMock()

    # Mock connect method for each exchange client
    for exchange in ["binance", "uniswap", "jupiter"]:
        stream = ws_manager.streams[exchange]
        stream.connect = AsyncMock(return_value=True)
        stream.close = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        # Create multiple connections
        exchanges = ["binance", "uniswap", "jupiter"]
        tasks = [
            ws_manager.connect(exchange, f"ws://{exchange}.com")
            for exchange in exchanges
        ]

        # Connect concurrently
        results = await asyncio.gather(*tasks)

        # Verify all connections
        assert all(results)
        assert all(ws_manager.connections[exchange] for exchange in exchanges)
        assert all(
            ws_manager.connection_states[exchange] == ConnectionState.CONNECTED
            for exchange in exchanges
        )

        # Cleanup
        for exchange in exchanges:
            await ws_manager.disconnect(exchange)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
