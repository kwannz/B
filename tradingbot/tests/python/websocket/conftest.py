"""
WebSocket测试配置
独立的WebSocket测试环境，避免依赖主应用程序的其他模块
"""

import os
import sys
import json
import pytest
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, AsyncMock
from aiohttp import WSMsgType, WSMessage

# Add project root to Python path
project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

# Configure logging
logging.basicConfig(level=logging.DEBUG)


# Mock WebSocket Classes
class AsyncWebSocketMock:
    """Async WebSocket mock for testing"""

    def __init__(self):
        self.messages = [
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
        self.message_index = 0
        self._closed = False
        self.sent_messages = []

    async def receive(self):
        if self.closed:
            return WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
        await asyncio.sleep(0.1)  # Simulate network delay
        if self.message_index >= len(self.messages):
            return WSMessage(type=WSMsgType.CLOSE, data=None, extra=None)
        message = self.messages[self.message_index]
        self.message_index += 1
        return message

    async def send_json(self, data):
        if self.closed:
            raise ConnectionError("WebSocket is closed")
        self.sent_messages.append(data)
        return True

    async def send_str(self, data):
        if self.closed:
            raise ConnectionError("WebSocket is closed")
        self.sent_messages.append(data)
        return True

    async def close(self):
        self.closed = True

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.closed:
            raise StopAsyncIteration
        if self.message_index >= len(self.messages):
            raise StopAsyncIteration
        message = self.messages[self.message_index]
        self.message_index += 1
        return message

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    @property
    def closed(self):
        return self._closed

    @closed.setter
    def closed(self, value):
        self._closed = value


class MockWebSocketManager:
    """Mock WebSocket Manager for testing"""

    def __init__(self):
        self.connections = {}
        self.is_connected = {}
        self.callbacks = {}
        self.ws_mocks = {}

    async def connect(self, exchange, url, headers=None):
        ws_mock = AsyncWebSocketMock()
        self.ws_mocks[exchange] = ws_mock
        self.connections[exchange] = True
        self.is_connected[exchange] = True
        return True

    async def disconnect(self, exchange):
        if exchange in self.connections:
            if exchange in self.ws_mocks:
                await self.ws_mocks[exchange].close()
                del self.ws_mocks[exchange]
            del self.connections[exchange]
            self.is_connected[exchange] = False
        return True

    async def send_message(self, exchange, message):
        if exchange in self.ws_mocks:
            return await self.ws_mocks[exchange].send_json(message)
        return False

    async def subscribe(self, exchange, channel, callback):
        if exchange not in self.callbacks:
            self.callbacks[exchange] = {}
        if channel not in self.callbacks[exchange]:
            self.callbacks[exchange][channel] = []
        self.callbacks[exchange][channel].append(callback)
        return True

    async def start_listening(self, exchange):
        if exchange not in self.ws_mocks:
            return

        ws = self.ws_mocks[exchange]
        while not ws.closed:
            try:
                message = await ws.receive()
                if message.type == WSMsgType.CLOSE:
                    break

                if message.type == WSMsgType.TEXT:
                    for callbacks in self.callbacks.get(exchange, {}).values():
                        for callback in callbacks:
                            try:
                                await callback(json.loads(message.data))
                            except Exception as e:
                                logging.error(f"Callback error: {str(e)}")

                await asyncio.sleep(0.1)  # Prevent tight loop
            except Exception as e:
                logging.error(f"Listening error: {str(e)}")
                break

    def get_connection_status(self, exchange):
        ws = self.ws_mocks.get(exchange)
        return {
            "connected": self.is_connected.get(exchange, False),
            "last_message": datetime.utcnow().isoformat(),
            "messages_received": ws.message_index if ws else 0,
            "messages_sent": len(ws.sent_messages) if ws else 0,
        }


@pytest.fixture
async def ws_manager():
    """创建模拟WebSocket管理器实例"""
    manager = MockWebSocketManager()
    yield manager
    # 清理所有连接
    for exchange in list(manager.connections.keys()):
        await manager.disconnect(exchange)


@pytest.fixture
def mock_ws_message():
    """创建模拟WebSocket消息"""

    def create_message(data, msg_type=WSMsgType.TEXT):
        return WSMessage(type=msg_type, data=data, extra=None)

    return create_message


@pytest.fixture(autouse=True)
def setup_test_env():
    """设置测试环境变量"""
    original_env = dict(os.environ)
    os.environ.update(
        {
            "TESTING": "true",
            "LOG_LEVEL": "DEBUG",
            "PYTHONPATH": project_root,
        }
    )
    yield
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def event_loop():
    """创建事件循环"""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# Pytest配置
def pytest_configure(config):
    """配置测试会话"""
    config.addinivalue_line("markers", "websocket: 标记为WebSocket测试")


def pytest_collection_modifyitems(config, items):
    """修改测试收集"""
    for item in items:
        if "websocket" in item.keywords:
            item.add_marker(pytest.mark.asyncio)
