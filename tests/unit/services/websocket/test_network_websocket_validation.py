import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch
from aiohttp import WSMessage, WSMsgType, ClientError
from prometheus_client import REGISTRY
from tradingbot.core.network import HttpClient, NetworkMetrics
from tests.unit.mocks.network_mocks import get_mock_network_config
from tests.unit.mocks.metrics_mocks import clear_metrics

@pytest.fixture(autouse=True)
def setup_metrics():
    clear_metrics()
    yield
    clear_metrics()

@pytest.mark.asyncio
async def test_websocket_validation_message_format():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='invalid json', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        errors = []
        
        async def handler(msg):
            messages.append(msg)
        async def error_handler(error):
            errors.append(error)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.1)
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='json_decode'
        )._value.get() >= 1
        
        assert len(messages) == 1
        assert messages[0] == {"event": "test"}
        assert len(errors) == 1
        assert isinstance(errors[0], json.JSONDecodeError)

@pytest.mark.asyncio
async def test_websocket_validation_connection_error():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=ClientError("Connection error"))
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        errors = []
        
        async def error_handler(error):
            errors.append(error)
        
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.1)
        
        assert len(errors) == 1
        assert isinstance(errors[0], ClientError)
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='connection_error'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_message_handling():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test1"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test2"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 2
        assert messages[0]["event"] == "test1"
        assert messages[1]["event"] == "test2"
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() == 2

@pytest.mark.asyncio
async def test_websocket_validation_cleanup():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        await asyncio.sleep(0.1)
        await ws.disconnect()
        
        assert mock_ws.close.called
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='disconnected'
        )._value.get() >= 1

if __name__ == '__main__':
    pytest.main(['-v', __file__])
