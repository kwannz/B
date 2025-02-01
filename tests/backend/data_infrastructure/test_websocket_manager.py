import pytest
import asyncio
from datetime import datetime
import json
from unittest.mock import Mock, AsyncMock, patch
from src.backend.data_infrastructure.websocket_manager import (
    WebSocketManager,
    WebSocketMetrics,
)


@pytest.fixture
def config():
    return {
        "batch_size": 10,
        "batch_timeout": 0.1,
        "max_queue_size": 100,
        "connection_pool_size": 5,
        "default_rate_limit": 100,
        "default_burst_limit": 10,
    }


@pytest.fixture
def mock_connection():
    connection = AsyncMock()
    connection.send_json = AsyncMock()
    connection.close = AsyncMock()
    return connection


@pytest.fixture
async def ws_manager(config):
    manager = WebSocketManager(config)
    await manager.start()
    yield manager
    await manager.stop()


class TestWebSocketManager:

    @pytest.mark.asyncio
    async def test_connection_management(self, ws_manager, mock_connection):
        """测试连接管理功能"""
        channel = "test_channel"

        # 添加连接
        await ws_manager.add_connection(channel, mock_connection)
        assert ws_manager.get_connection_count(channel) == 1

        # 移除连接
        await ws_manager.remove_connection(channel, mock_connection)
        assert ws_manager.get_connection_count(channel) == 0

    @pytest.mark.asyncio
    async def test_message_batching(self, ws_manager, mock_connection):
        """测试消息批处理"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 发送多条消息
        messages = [{"id": i, "data": f"test_{i}"} for i in range(5)]
        for msg in messages:
            await ws_manager.send_message(channel, msg)

        # 等待批处理
        await asyncio.sleep(0.2)

        # 验证批量发送
        assert mock_connection.send_json.called
        call_args = mock_connection.send_json.call_args[0][0]
        assert call_args["type"] == "batch"
        assert len(call_args["messages"]) > 0

    @pytest.mark.asyncio
    async def test_rate_limiting(self, ws_manager, mock_connection):
        """测试速率限制"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 快速发送超过burst_limit的消息
        results = []
        for i in range(20):
            result = await ws_manager.send_message(channel, {"id": i})
            results.append(result)

        # 验证部分消息被限制
        assert False in results

    @pytest.mark.asyncio
    async def test_backpressure_handling(self, ws_manager, mock_connection):
        """测试背压处理"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 模拟发送延迟
        mock_connection.send_json = AsyncMock(side_effect=lambda x: asyncio.sleep(0.1))

        # 快速发送大量消息
        messages = [{"id": i} for i in range(200)]
        results = []

        for msg in messages:
            result = await ws_manager.send_message(channel, msg)
            results.append(result)

        # 验证队列满时的行为
        assert False in results

    @pytest.mark.asyncio
    async def test_error_handling(self, ws_manager, mock_connection):
        """测试错误处理"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 模拟发送错误
        mock_connection.send_json.side_effect = Exception("Test error")

        # 发送消息
        await ws_manager.send_message(channel, {"test": "data"})
        await asyncio.sleep(0.2)

        # 验证错误计数
        assert ws_manager.metrics.error_rate._value.get() > 0

    @pytest.mark.asyncio
    async def test_metrics_collection(self, ws_manager, mock_connection):
        """测试指标收集"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 发送消息并验证指标
        await ws_manager.send_message(channel, {"test": "data"})
        await asyncio.sleep(0.2)

        assert ws_manager.metrics.connection_count._value.get() > 0
        assert ws_manager.metrics.message_rate._value.get() > 0
        assert ws_manager.metrics.message_latency._count.get() > 0

    @pytest.mark.asyncio
    async def test_broadcast(self, ws_manager):
        """测试广播功能"""
        channel = "test_channel"
        connections = [AsyncMock() for _ in range(3)]

        # 添加多个连接
        for conn in connections:
            await ws_manager.add_connection(channel, conn)

        # 广播消息
        message = {"type": "broadcast", "data": "test"}
        await ws_manager.broadcast(channel, message)
        await asyncio.sleep(0.2)

        # 验证所有连接都收到消息
        for conn in connections:
            assert conn.send_json.called

    @pytest.mark.asyncio
    async def test_connection_cleanup(self, ws_manager, mock_connection):
        """测试连接清理"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 停止管理器
        await ws_manager.stop()

        # 验证连接被关闭
        assert mock_connection.close.called

    @pytest.mark.asyncio
    async def test_high_concurrency(self, ws_manager, mock_connection):
        """测试高并发场景"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 并发发送消息
        async def send_messages():
            for i in range(10):
                await ws_manager.send_message(channel, {"id": i})

        # 创建多个并发任务
        tasks = [send_messages() for _ in range(5)]
        await asyncio.gather(*tasks)
        await asyncio.sleep(0.2)

        # 验证消息处理
        assert mock_connection.send_json.called
        assert ws_manager.get_queue_size(channel) == 0

    @pytest.mark.asyncio
    async def test_performance_under_load(self, ws_manager, mock_connection):
        """测试负载下的性能"""
        channel = "test_channel"
        await ws_manager.add_connection(channel, mock_connection)

        # 记录开始时间
        start_time = datetime.now()

        # 发送大量消息
        message_count = 1000
        for i in range(message_count):
            await ws_manager.send_message(channel, {"id": i})

        # 等待处理完成
        while ws_manager.get_queue_size(channel) > 0:
            await asyncio.sleep(0.1)

        # 计算处理时间
        duration = (datetime.now() - start_time).total_seconds()

        # 验证性能
        assert duration < message_count * 0.001  # 每条消息平均处理时间小于1ms
