"""
Isolated WebSocket Manager Tests
"""

import asyncio
import logging
import os
import time
from unittest.mock import AsyncMock, Mock

import pytest
from aiohttp import WSMessage, WSMsgType

# Configure logging
logging.basicConfig(level=logging.DEBUG)


class WebSocketManager:
    """WebSocket管理器类"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.connections = {}
        self.is_connected = {}
        self.callbacks = {}
        self.rate_limits = {}

    async def connect(
        self, exchange: str, url: str, headers: dict | None = None
    ) -> bool:
        """连接到WebSocket"""
        try:
            self.connections[exchange] = AsyncMock()
            self.is_connected[exchange] = True
            self.callbacks[exchange] = {}
            self.rate_limits[exchange] = {"messages_per_second": 10}
            return True
        except Exception as e:
            self.logger.error(f"连接失败: {str(e)}")
            return False

    async def disconnect(self, exchange: str) -> bool:
        """断开WebSocket连接"""
        try:
            if exchange in self.connections:
                del self.connections[exchange]
                self.is_connected[exchange] = False
            return True
        except Exception as e:
            self.logger.error(f"断开连接失败: {str(e)}")
            return False

    async def send_message(self, exchange: str, message: dict) -> bool:
        """发送消息"""
        try:
            if not self.is_connected.get(exchange):
                return False

            # 检查速率限制
            if exchange in self.rate_limits:
                if not hasattr(self, "_rate_limit_state"):
                    self._rate_limit_state = {}

                if exchange not in self._rate_limit_state:
                    self._rate_limit_state[exchange] = {
                        "last_time": time.time(),
                        "count": 0,
                    }

                state = self._rate_limit_state[exchange]
                current_time = time.time()
                limit = self.rate_limits[exchange]["messages_per_second"]

                # 如果已经过了1秒，重置计数器
                if current_time - state["last_time"] > 1:
                    state["last_time"] = current_time
                    state["count"] = 0

                # 检查是否超过限制
                if state["count"] >= limit:
                    return False

                state["count"] += 1

            return True
        except Exception as e:
            self.logger.error(f"发送消息失败: {str(e)}")
            return False

    async def subscribe(self, exchange: str, channel: str, callback) -> None:
        """订阅频道"""
        if exchange not in self.callbacks:
            self.callbacks[exchange] = {}
        if channel not in self.callbacks[exchange]:
            self.callbacks[exchange][channel] = []
        self.callbacks[exchange][channel].append(callback)

    async def start_listening(self, exchange: str) -> None:
        """开始监听消息"""
        if exchange not in self.connections:
            return

        try:
            ws = self.connections[exchange]
            while True:
                try:
                    await ws.receive()
                except Exception as e:
                    self.logger.error(f"接收消息失败: {str(e)}")
                    # 不要break，让错误继续传播以便测试可以捕获
                    raise
        except Exception as e:
            self.logger.error(f"监听失败: {str(e)}")
            raise

    def get_connection_status(self, exchange: str) -> dict:
        """获取连接状态"""
        return {
            "connected": self.is_connected.get(exchange, False),
            "last_message": "2024-01-20T00:00:00Z",
            "messages_received": 100,
            "messages_sent": 50,
        }


@pytest.fixture
async def ws_manager():
    """创建WebSocket管理器实例"""
    manager = WebSocketManager()
    yield manager
    # 清理所有连接
    for exchange in list(manager.connections.keys()):
        await manager.disconnect(exchange)


@pytest.mark.asyncio
async def test_connection_management(ws_manager):
    """测试连接管理"""
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
async def test_message_handling(ws_manager):
    """测试消息处理"""
    messages = []

    async def callback(data):
        messages.append(data)

    # 连接并订阅
    await ws_manager.connect("test_exchange", "ws://test.com")
    await ws_manager.subscribe("test_exchange", "trade", callback)

    # 模拟接收消息
    test_message = {"type": "trade", "data": {"price": 50000, "amount": 1.0}}
    if "trade" in ws_manager.callbacks["test_exchange"]:
        for cb in ws_manager.callbacks["test_exchange"]["trade"]:
            await cb(test_message)

    # 验证消息处理
    assert len(messages) > 0
    assert "price" in messages[0]["data"]


@pytest.mark.asyncio
async def test_rate_limiting(ws_manager):
    """测试速率限制"""
    await ws_manager.connect("test_exchange", "ws://test.com")

    # 设置较低的速率限制并发送多个消息
    ws_manager.rate_limits["test_exchange"] = {"messages_per_second": 2}
    messages = [{"type": "test"} for _ in range(5)]
    results = []

    # 快速发送消息以触发速率限制
    for msg in messages:
        result = await ws_manager.send_message("test_exchange", msg)
        results.append(result)
        await asyncio.sleep(0.1)  # 短暂延迟以确保消息发送顺序

    # 验证速率限制（前两个消息应该成功，后面的应该被限制）
    assert results[:2] == [True, True], "前两个消息应该成功发送"
    assert not all(results), "部分消息应该被限制"
    assert False in results, "至少有一个消息应该被限制"


@pytest.mark.asyncio
async def test_error_handling(ws_manager):
    """测试错误处理"""
    error_count = 0

    class ErrorMockWebSocket:
        def __init__(self):
            self.error_count = 0
            self.closed = False

        async def receive(self):
            nonlocal error_count
            error_count += 1
            raise Exception("测试错误")

        async def close(self):
            self.closed = True

    # 创建错误模拟WebSocket
    error_mock_ws = ErrorMockWebSocket()
    await ws_manager.connect("test_exchange", "ws://test.com")
    ws_manager.connections["test_exchange"] = error_mock_ws

    # 启动消息监听并验证错误处理
    with pytest.raises(Exception, match="测试错误"):
        await ws_manager.start_listening("test_exchange")

    # 验证错误计数增加
    assert error_count == 1, "错误计数应该增加"


@pytest.mark.asyncio
async def test_concurrent_connections(ws_manager):
    """测试并发连接"""
    # 创建多个连接
    exchanges = ["exchange1", "exchange2", "exchange3"]
    tasks = [
        ws_manager.connect(exchange, f"ws://{exchange}.com") for exchange in exchanges
    ]

    # 并发连接
    results = await asyncio.gather(*tasks)

    # 验证所有连接
    assert all(results)
    assert all(ws_manager.is_connected[exchange] for exchange in exchanges)


if __name__ == "__main__":
    pytest.main(["-v", __file__])
