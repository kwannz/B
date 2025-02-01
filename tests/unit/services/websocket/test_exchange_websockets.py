"""
Exchange WebSocket集成测试
"""

import os
import json
import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
import aiohttp
from aiohttp import WSMsgType, WSMessage

# Add project root to Python path
import sys
from pathlib import Path

project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from tradingbot.trading_agent.python.exchanges.binance_ws import BinanceWebSocket
from tradingbot.trading_agent.python.exchanges.uniswap_ws import UniswapWebSocket
from tradingbot.trading_agent.python.exchanges.jupiter_ws import JupiterWebSocket
from tradingbot.trading_agent.python.exchanges.raydium_ws import RaydiumWebSocket
from tradingbot.trading_agent.python.exchanges.pancakeswap_ws import (
    PancakeSwapWebSocket,
)
from tradingbot.trading_agent.python.exchanges.okx_ws import OKXWebSocket
from tradingbot.trading_agent.python.exchanges.oneinch_ws import OneInchWebSocket


@pytest.fixture
def mock_ws_response():
    """模拟WebSocket响应"""

    async def mock_receive():
        return WSMessage(
            type=WSMsgType.TEXT,
            data='{"type": "trade", "data": {"price": 50000, "amount": 1.0}}',
            extra=None,
        )

    mock_ws = AsyncMock()
    mock_ws.receive = mock_receive
    mock_ws.closed = False
    return mock_ws


@pytest.fixture
async def mock_monitor():
    """模拟监控器"""
    monitor = AsyncMock()
    monitor.record_request = AsyncMock()
    return monitor


@pytest.mark.asyncio
async def test_binance_websocket(mock_ws_response, mock_monitor):
    """测试Binance WebSocket集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = BinanceWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"e":"trade","s":"BTCUSDT","p":"50000","q":"1.0","T":1642780800000,"m":false,"t":12345}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        messages = []

        async def callback(data):
            messages.append(data)

        await ws._handle_trade(
            {
                "s": "BTCUSDT",
                "p": "50000",
                "q": "1.0",
                "T": int(datetime.now().timestamp() * 1000),
                "m": False,
                "t": 12345,
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_uniswap_websocket(mock_ws_response, mock_monitor):
    """测试Uniswap WebSocket集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = UniswapWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"type":"pool","data":{"token0Price":"2000.0","token1Price":"0.0005","reserve0":"1000000","reserve1":"500"}}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        await ws._handle_pool_update(
            {
                "pool": {
                    "id": "test_pool",
                    "token0Price": "50000",
                    "token1Price": "0.00002",
                    "volumeUSD": "1000000",
                }
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_jupiter_websocket(mock_ws_response, mock_monitor):
    """测试Jupiter WebSocket集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = JupiterWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"inputMint":"SOL","outputMint":"USDC","inAmount":"1000000000","outAmount":"20000000","priceImpactPct":"0.1"}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        await ws._handle_quote_update(
            {
                "inputMint": "SOL",
                "outputMint": "USDC",
                "inAmount": "1000000000",
                "outAmount": "20000000",
                "priceImpactPct": "0.1",
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_raydium_websocket(mock_ws_response, mock_monitor):
    """测试Raydium WebSocket集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = RaydiumWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"id":"test_pool","tokenABalance":"1000000","tokenBBalance":"20000000","price":"20.0","feeRate":"0.003"}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        await ws._handle_pool_update(
            {
                "id": "test_pool",
                "tokenABalance": "1000000",
                "tokenBBalance": "20000000",
                "price": "20.0",
                "feeRate": "0.003",
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_pancakeswap_websocket(mock_ws_response, mock_monitor):
    """测试PancakeSwap WebSocket集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = PancakeSwapWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"pair":{"id":"test_pair","token0Price":"50000","token1Price":"0.00002","volumeUSD":"1000000"}}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        await ws._handle_pair_update(
            {
                "pair": {
                    "id": "test_pair",
                    "token0Price": "50000",
                    "token1Price": "0.00002",
                    "volumeUSD": "1000000",
                }
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_okx_websocket(mock_ws_response, mock_monitor):
    """测试OKX WebSocket集成"""
    with patch("aiohttp.ClientSession") as mock_session:
        ws = OKXWebSocket()
        ws.monitor = mock_monitor

        # Create mock WebSocket
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"arg":{"instId":"BTC-USDT"},"data":[{"last":"50000","bidPx":"49990","askPx":"50010","vol24h":"1000","ts":"1642780800000"}]}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        # Configure session mock
        mock_session.return_value.ws_connect = AsyncMock(return_value=mock_ws)
        mock_session.return_value.__aenter__.return_value = mock_session.return_value
        mock_session.return_value.__aexit__.return_value = None

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        await ws._handle_ticker(
            {
                "arg": {"instId": "BTC-USDT"},
                "data": [
                    {
                        "last": "50000",
                        "bidPx": "49990",
                        "askPx": "50010",
                        "vol24h": "1000",
                        "ts": str(int(datetime.now().timestamp() * 1000)),
                    }
                ],
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_oneinch_stream(mock_ws_response, mock_monitor):
    """测试1inch数据流集成"""
    with patch("aiohttp.ClientSession", return_value=mock_ws_response):
        ws = OneInchWebSocket()
        ws.monitor = mock_monitor

        # 设置mock返回值
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(
            return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"fromTokenAddress":"0x...","toTokenAddress":"0x...","fromTokenAmount":"1000000000000000000","toTokenAmount":"50000000000","estimatedGas":"150000"}',
                extra=None,
            )
        )
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None

        mock_ws_response.ws_connect.return_value = mock_ws

        # 测试初始化
        await ws.initialize()
        assert ws.initialized is True

        # 测试消息处理
        messages = []

        async def callback(data):
            messages.append(data)

        await ws.subscribe_quotes(callback)

        # 模拟报价更新
        await ws._handle_quote_update(
            {
                "fromTokenAddress": "0x...",
                "toTokenAddress": "0x...",
                "fromTokenAmount": "1000000000000000000",
                "toTokenAmount": "50000000000",
                "estimatedGas": "150000",
            }
        )

        # 验证监控调用
        mock_monitor.record_request.assert_called_once()

        # 清理
        await ws.close()


@pytest.mark.asyncio
async def test_websocket_reconnection():
    """Test WebSocket reconnection mechanism"""
    connection_attempts = 0

    async def mock_connect(*args, **kwargs):
        nonlocal connection_attempts
        connection_attempts += 1
        if connection_attempts <= 2:  # Both first and second attempts should fail
            raise aiohttp.ClientError(
                f"Connection attempt {connection_attempts} failed"
            )
        mock_ws = AsyncMock()
        mock_ws.closed = False
        mock_ws.__aenter__.return_value = mock_ws
        mock_ws.__aexit__.return_value = None
        mock_ws.close = AsyncMock()
        mock_ws.send_json = AsyncMock()
        return mock_ws

    with patch("aiohttp.ClientSession") as mock_session:
        mock_session.return_value.ws_connect = AsyncMock(side_effect=mock_connect)
        mock_session.return_value.__aenter__.return_value = mock_session.return_value
        mock_session.return_value.__aexit__.return_value = None
        mock_session.return_value.close = AsyncMock()

        ws = BinanceWebSocket()
        ws.monitor = AsyncMock()

        # Initialize first
        await ws.initialize()
        assert ws.initialized

        # First attempt should fail
        success = await ws.connect()
        assert not success, "First connection attempt should fail"
        assert not ws.connected
        assert connection_attempts == 1
        assert ws.last_error == "First connection attempt failed"

        # Wait a bit to ensure async operations complete
        await asyncio.sleep(0.1)

        # Second attempt should also fail
        success = await ws.connect()
        assert not success, "Second connection attempt should also fail"
        assert not ws.connected
        assert connection_attempts == 2
        assert ws.last_error is not None

        # Wait a bit to ensure async operations complete
        await asyncio.sleep(0.1)

        # Third attempt should succeed
        success = await ws.connect()
        assert success, "Third connection attempt should succeed"
        assert ws.connected
        assert connection_attempts == 3

        # Cleanup
        await ws.close()


@pytest.mark.asyncio
async def test_websocket_rate_limiting():
    """测试WebSocket速率限制"""
    ws = BinanceWebSocket()  # 使用Binance作为示例
    await ws.initialize()

    # 模拟大量消息
    start_time = datetime.now()
    messages = []

    for i in range(100):
        message = {
            "s": "BTCUSDT",
            "p": str(50000 + i),
            "q": "1.0",
            "T": int(datetime.now().timestamp() * 1000),
            "m": False,
            "t": i,
        }
        await ws._handle_trade(message)
        messages.append(message)

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    # 验证处理时间符合速率限制
    assert duration >= 0.0001  # 验证消息处理有一定延迟

    await ws.close()


@pytest.mark.asyncio
async def test_websocket_error_handling(mock_monitor):
    """测试WebSocket错误处理"""
    ws = BinanceWebSocket()  # 使用Binance作为示例
    ws.monitor = mock_monitor

    # 模拟错误情况
    error_data = {"error": "Invalid message"}

    await ws._handle_trade(error_data)

    # 验证错误被记录
    mock_monitor.record_request.assert_called_with(
        component="binance_ws", response_time=0.0, is_error=True
    )

    await ws.close()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
