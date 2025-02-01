import pytest
import asyncio
import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import WebSocket, WebSocketDisconnect
from src.api.websocket.handler import (
    ConnectionManager,
    handle_websocket,
    broadcast_trade_update,
)
from src.utils.security import create_ws_token, validate_ws_token
from src.models.metrics import WebSocketMetrics
import psutil
import os


class MockWebSocket:
    def __init__(self):
        self.sent_messages = []
        self.closed = False
        self.accepted = False
        self.headers = {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
        }
        # 创建一个有效的测试token
        test_data = {"user_id": "test_user", "permissions": ["trades"]}
        token = create_ws_token(test_data, timedelta(minutes=5))
        self.query_params = {"token": token, "channel": "trades"}

    async def accept(self):
        self.accepted = True

    async def send_json(self, data: dict):
        self.sent_messages.append(data)

    async def receive_text(self):
        return json.dumps({"type": "test", "data": "test_data"})

    async def close(self):
        self.closed = True

    def get_header(self, key: str) -> str:
        return self.headers.get(key)


@pytest.fixture
def mock_websocket():
    return MockWebSocket()


@pytest.fixture
def connection_manager():
    return ConnectionManager()


@pytest.mark.asyncio
class TestWebSocketHandler:

    async def test_connection_lifecycle(self, mock_websocket, connection_manager):
        """测试WebSocket连接的完整生命周期"""
        # 测试连接建立
        await connection_manager.connect(mock_websocket, "trades")
        assert mock_websocket.accepted
        assert len(connection_manager.active_connections["trades"]) == 1

        # 测试连接断开
        connection_manager.disconnect(mock_websocket, "trades")
        assert len(connection_manager.active_connections["trades"]) == 0

    async def test_message_validation(self, mock_websocket, connection_manager):
        """测试消息验证和处理"""
        with patch("src.utils.security.validate_ws_token") as mock_validate:
            mock_validate.return_value = True

            # 测试有效消息
            valid_message = {
                "type": "trade",
                "data": {"symbol": "BTC/USD", "price": 50000, "amount": 1.0},
            }

            await connection_manager.connect(mock_websocket, "trades")
            await connection_manager.broadcast(valid_message, "trades")

            assert len(mock_websocket.sent_messages) == 1
            assert mock_websocket.sent_messages[0]["type"] == "trade"

            # 测试无效消息
            invalid_message = {"type": "invalid"}
            with pytest.raises(Exception, match="Invalid message format"):
                await connection_manager.broadcast(invalid_message, "trades")

            # 测试消息格式
            assert len(mock_websocket.sent_messages) == 1  # 不应该广播无效消息

    async def test_error_handling(self, mock_websocket, connection_manager):
        """测试错误处理和恢复机制"""
        # 测试连接错误
        with pytest.raises(WebSocketDisconnect):
            mock_websocket.accept = AsyncMock(side_effect=WebSocketDisconnect)
            await connection_manager.connect(mock_websocket, "trades")

        # 测试消息发送错误
        await connection_manager.connect(mock_websocket, "trades")
        mock_websocket.send_json = AsyncMock(side_effect=Exception("Send error"))
        await connection_manager.broadcast({"type": "test"}, "trades")
        assert (
            len(connection_manager.active_connections["trades"]) == 0
        )  # 应该移除失败的连接

    async def test_concurrent_connections(self, connection_manager):
        """测试并发连接处理"""
        num_connections = 10
        mock_sockets = [MockWebSocket() for _ in range(num_connections)]

        # 并发建立连接
        await asyncio.gather(
            *[connection_manager.connect(ws, "trades") for ws in mock_sockets]
        )

        assert len(connection_manager.active_connections["trades"]) == num_connections

        # 广播消息到所有连接
        test_message = {"type": "broadcast", "data": "test"}
        await connection_manager.broadcast(test_message, "trades")

        for ws in mock_sockets:
            assert len(ws.sent_messages) == 1
            assert ws.sent_messages[0] == test_message

    async def test_channel_isolation(self, connection_manager):
        """测试不同频道之间的隔离性"""
        trades_ws = MockWebSocket()
        positions_ws = MockWebSocket()

        await connection_manager.connect(trades_ws, "trades")
        await connection_manager.connect(positions_ws, "positions")

        # 测试消息隔离
        trades_message = {"type": "trade", "data": "trade_data"}
        positions_message = {"type": "position", "data": "position_data"}

        await connection_manager.broadcast(trades_message, "trades")
        await connection_manager.broadcast(positions_message, "positions")

        assert len(trades_ws.sent_messages) == 1
        assert trades_ws.sent_messages[0] == trades_message
        assert len(positions_ws.sent_messages) == 1
        assert positions_ws.sent_messages[0] == positions_message

    @pytest.mark.performance
    async def test_broadcast_performance(self, connection_manager):
        """测试广播性能"""
        num_connections = 100
        num_messages = 1000

        # 创建多个连接
        mock_sockets = [MockWebSocket() for _ in range(num_connections)]
        await asyncio.gather(
            *[connection_manager.connect(ws, "trades") for ws in mock_sockets]
        )

        # 记录开始时间
        start_time = datetime.now()

        # 广播多条消息
        for i in range(num_messages):
            message = {"type": "test", "data": f"message_{i}"}
            await connection_manager.broadcast(message, "trades")

        # 计算总耗时和消息处理率
        duration = (datetime.now() - start_time).total_seconds()
        messages_per_second = (num_connections * num_messages) / duration

        # 验证性能指标
        assert messages_per_second > 1000  # 每秒至少处理1000条消息

    async def test_security_validation(self, mock_websocket, connection_manager):
        """测试安全性验证"""
        with patch("src.utils.security.validate_ws_token") as mock_validate:
            # 测试无效token
            mock_validate.return_value = False
            with pytest.raises(Exception, match="Invalid authentication token"):
                await connection_manager.connect(mock_websocket, "trades")

            # 测试有效token
            mock_validate.return_value = True
            await connection_manager.connect(mock_websocket, "trades")
            assert mock_websocket.accepted

    async def test_metrics_collection(self, connection_manager):
        """测试指标收集"""
        mock_ws = MockWebSocket()

        # 使用连接管理器的共享指标实例
        metrics = connection_manager.shared_metrics

        # 重置指标
        metrics.total_connections = 0
        metrics.messages_sent = 0
        metrics.error_count = 0
        metrics.active_connections.clear()

        # 连接建立指标
        await connection_manager.connect(mock_ws, "trades")
        assert metrics.total_connections == 1
        assert metrics.active_connections["trades"] == 1

        # 消息处理指标
        message = {"type": "test", "data": "test"}
        await connection_manager.broadcast(message, "trades")
        assert metrics.messages_sent == 1
        assert metrics.message_rate > 0

        # 错误指标
        mock_ws.send_json = AsyncMock(side_effect=Exception("Error"))
        await connection_manager.broadcast(message, "trades")
        assert metrics.error_count == 1

    async def test_reconnection_mechanism(self, connection_manager):
        """测试WebSocket重连机制"""
        mock_ws = MockWebSocket()
        max_retries = 3
        retry_delay = 0.1  # 100ms

        # 模拟连接断开和重连
        for attempt in range(max_retries + 1):
            if attempt < max_retries:
                # 模拟连接失败
                mock_ws.accept = AsyncMock(side_effect=WebSocketDisconnect)
                with pytest.raises(WebSocketDisconnect):
                    await connection_manager.connect(mock_ws, "trades")
                await asyncio.sleep(retry_delay)
            else:
                # 最后一次尝试成功
                mock_ws.accept = AsyncMock()
                await connection_manager.connect(mock_ws, "trades")
                assert mock_ws.accepted

        # 验证重连计数
        assert connection_manager.reconnect_attempts["trades"] == max_retries

    async def test_message_backpressure(self, connection_manager):
        """测试消息队列和背压处理"""
        mock_ws = MockWebSocket()
        queue_size = 1000
        message_delay = 0.001  # 1ms处理延迟

        await connection_manager.connect(mock_ws, "trades")

        # 模拟消息处理延迟
        original_send = mock_ws.send_json

        async def delayed_send(data):
            await asyncio.sleep(message_delay)
            await original_send(data)

        mock_ws.send_json = delayed_send

        # 快速发送大量消息
        messages = [
            {
                "type": "test",
                "data": f"message_{i}",
                "timestamp": datetime.now().isoformat(),
            }
            for i in range(queue_size)
        ]

        # 记录开始时间
        start_time = datetime.now()

        # 并发发送消息
        await asyncio.gather(
            *[connection_manager.broadcast(msg, "trades") for msg in messages]
        )

        # 验证所有消息都被处理
        assert len(mock_ws.sent_messages) == queue_size

        # 验证消息顺序
        for i, msg in enumerate(mock_ws.sent_messages):
            assert msg["data"] == f"message_{i}"

        # 验证处理时间在合理范围内
        duration = (datetime.now() - start_time).total_seconds()
        assert duration < queue_size * message_delay * 2  # 允许2倍的处理时间

    async def test_memory_usage(self, connection_manager):
        """测试WebSocket连接的内存使用情况"""
        num_connections = 100
        message_size = 1024  # 1KB
        num_messages = 1000

        # 创建测试数据
        test_data = {
            "type": "test",
            "data": "x" * message_size,
            "timestamp": datetime.now().isoformat(),
        }

        # 创建多个连接
        mock_sockets = [MockWebSocket() for _ in range(num_connections)]
        await asyncio.gather(
            *[connection_manager.connect(ws, "trades") for ws in mock_sockets]
        )

        # 发送大量消息
        start_memory = psutil.Process().memory_info().rss
        for _ in range(num_messages):
            await connection_manager.broadcast(test_data, "trades")

        end_memory = psutil.Process().memory_info().rss
        memory_increase = end_memory - start_memory

        # 验证内存使用是否在合理范围内
        expected_memory = num_connections * message_size * num_messages
        assert memory_increase < expected_memory * 2  # 允许2倍的内存开销

        # 清理连接
        for ws in mock_sockets:
            connection_manager.disconnect(ws, "trades")

    async def test_protocol_compatibility(self, connection_manager):
        """测试WebSocket协议兼容性"""
        test_cases = [
            {
                "version": "13",  # RFC 6455
                "headers": {
                    "Upgrade": "websocket",
                    "Connection": "Upgrade",
                    "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
                    "Sec-WebSocket-Version": "13",
                },
            },
            {
                "version": "8",  # 旧版本
                "headers": {
                    "Upgrade": "websocket",
                    "Connection": "Upgrade",
                    "Sec-WebSocket-Key1": "4 @1  46546xW%0l 1 5",
                    "Sec-WebSocket-Key2": "12998 5 Y3 1  .P00",
                },
            },
        ]

        for case in test_cases:
            mock_ws = MockWebSocket()
            mock_ws.headers = case["headers"]

            if case["version"] == "13":
                await connection_manager.connect(mock_ws, "trades")
                assert mock_ws.accepted
            else:
                with pytest.raises(Exception):
                    await connection_manager.connect(mock_ws, "trades")

    async def test_rate_limiting(self, connection_manager):
        """测试WebSocket消息速率限制"""
        mock_ws = MockWebSocket()
        await connection_manager.connect(mock_ws, "trades")

        # 配置速率限制
        rate_limit = 100  # 每秒消息数
        burst_limit = 10  # 突发消息数
        window_size = 1.0  # 1秒窗口

        # 测试正常速率
        start_time = datetime.now()
        messages_sent = 0

        for i in range(rate_limit):
            message = {"type": "test", "sequence": i}
            await connection_manager.broadcast(message, "trades")
            messages_sent += 1

        duration = (datetime.now() - start_time).total_seconds()
        assert messages_sent == rate_limit
        assert duration >= window_size

        # 测试突发限制
        start_time = datetime.now()
        burst_messages = 0

        for i in range(burst_limit * 2):
            try:
                message = {"type": "test", "sequence": i}
                await connection_manager.broadcast(message, "trades")
                burst_messages += 1
            except Exception as e:
                assert str(e).startswith("Rate limit exceeded")
                break

        assert burst_messages <= burst_limit

    async def test_message_serialization(self, connection_manager):
        """测试WebSocket消息序列化和反序列化"""
        mock_ws = MockWebSocket()
        await connection_manager.connect(mock_ws, "trades")

        test_messages = [
            {
                "type": "trade",
                "data": {
                    "symbol": "BTC/USD",
                    "price": 50000.0,
                    "amount": 1.5,
                    "timestamp": datetime.now().isoformat(),
                },
            },
            {
                "type": "market",
                "data": {
                    "indicators": {
                        "rsi": 65.5,
                        "macd": {"value": 100.5, "signal": 95.5, "histogram": 5.0},
                    },
                    "timestamp": datetime.now().isoformat(),
                },
            },
        ]

        for message in test_messages:
            # 测试序列化
            await connection_manager.broadcast(message, "trades")
            assert len(mock_ws.sent_messages) > 0

            # 验证消息格式
            last_message = mock_ws.sent_messages[-1]
            assert isinstance(last_message, dict)
            assert "type" in last_message
            assert "data" in last_message
            assert "timestamp" in last_message["data"]

    async def test_security(self, connection_manager):
        """测试WebSocket安全性"""
        mock_ws = MockWebSocket()

        # 测试认证
        with patch("src.utils.security.validate_ws_token") as mock_validate:
            mock_validate.return_value = False
            with pytest.raises(Exception, match="Invalid authentication token"):
                await connection_manager.connect(mock_ws, "trades")

        # 测试消息注入
        await connection_manager.connect(mock_ws, "trades")
        malicious_messages = [
            {"type": "trade", "data": {"__proto__": {"malicious": True}}},
            {"type": "trade", "data": {"constructor": {"malicious": True}}},
            {"type": "trade", "data": "<script>alert('xss')</script>"},
            {"type": "trade", "data": "'; DROP TABLE trades; --"},
        ]

        for message in malicious_messages:
            with pytest.raises(Exception, match="Invalid message format"):
                await connection_manager.broadcast(message, "trades")

        # 测试权限控制
        restricted_channels = ["admin", "system"]
        for channel in restricted_channels:
            with pytest.raises(Exception, match="Access to this channel is restricted"):
                await connection_manager.connect(mock_ws, channel)
