import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
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
async def test_websocket_validation_message_schema():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"invalid": "schema"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test", "data": {"price": 100}}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        fragments = []
        async def handler(msg):
            messages.append(msg)
        async def fragment_handler(fragment):
            fragments.append(fragment)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_fragment_handler(fragment_handler)
        await asyncio.sleep(0.1)
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() >= 2
        
        assert len(messages) == 2
        assert messages[1]["event"] == "test"
        assert messages[1]["data"]["price"] == 100
        assert len(fragments) == 0

@pytest.mark.asyncio
async def test_websocket_validation_rate_limit():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    messages = [
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"part": 1}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"part": 2}', extra=True),
        WSMessage(type=WSMsgType.BINARY, data=b'binary data', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ]
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=messages)
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        received = []
        fragments = []
        binary = []
        async def handler(msg):
            received.append(msg)
        async def fragment_handler(fragment):
            fragments.append(fragment)
        async def binary_handler(data):
            binary.append(data)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_fragment_handler(fragment_handler)
        ws.add_binary_handler(binary_handler)
        await asyncio.sleep(0.1)
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() >= 1
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='continuation'
        )._value.get() >= 2
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='binary'
        )._value.get() >= 1
        
        assert len(received) == 1
        assert len(fragments) == 2
        assert len(binary) == 1
        assert binary[0] == b'binary data'

@pytest.mark.asyncio
async def test_websocket_validation_connection_limit():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(return_value=WSMessage(
        type=WSMsgType.TEXT,
        data='{"event": "test"}',
        extra=None
    ))
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        async def handler(msg):
            pass
        
        connections = []
        for _ in range(10):
            ws = await client.websocket('ws://test.com/ws/market', handler)
            connections.append(ws)
        
        await asyncio.sleep(0.1)
        
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='connected'
        )._value.get() >= 1
        
        assert metrics.active_connections.labels(
            type='websocket',
            status='active'
        )._value.get() <= config.max_connections

@pytest.mark.asyncio
async def test_websocket_validation_recovery():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test1"}', extra=None),
        RuntimeError("Connection lost"),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test2"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        reconnects = []
        errors = []
        
        async def handler(msg):
            messages.append(msg)
        async def reconnect_handler():
            reconnects.append(True)
        async def error_handler(error):
            errors.append(error)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_reconnect_handler(reconnect_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 2
        assert messages[0]["event"] == "test1"
        assert messages[1]["event"] == "test2"
        assert len(reconnects) >= 1
        assert len(errors) >= 1
        assert isinstance(errors[0], RuntimeError)
        
        assert metrics.websocket_reconnects.labels(
            path='ws://test.com/ws/market',
            status='retry'
        )._value.get() >= 1
        
        await ws.disconnect()
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='disconnected'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_cleanup():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        aiohttp.ClientError("Connection error"),
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
        
        assert len(messages) == 1
        assert len(errors) == 1
        assert isinstance(errors[0], aiohttp.ClientError)
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='receive_error'
        )._value.get() >= 1
        
        assert metrics.active_connections.labels(
            type='websocket',
            status='active'
        )._value.get() == 0

@pytest.mark.asyncio
async def test_websocket_validation_fragmentation():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    fragment1 = '{"event": "market_update", "data": {'
    fragment2 = '"price": 1000, "volume": 50'
    fragment3 = '}}'
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data=fragment1, extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data=fragment2, extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data=fragment3, extra=True),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        fragments = []
        
        async def handler(msg):
            messages.append(msg)
        async def fragment_handler(fragment):
            fragments.append(fragment)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_fragment_handler(fragment_handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 1
        assert messages[0]["event"] == "market_update"
        assert messages[0]["data"]["price"] == 1000
        assert messages[0]["data"]["volume"] == 50
        
        assert len(fragments) == 3
        assert fragments[0] == fragment1
        assert fragments[1] == fragment2
        assert fragments[2] == fragment3
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() >= 1
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='continuation'
        )._value.get() >= 2

@pytest.mark.asyncio
async def test_websocket_validation_binary():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    binary_data = b'{"type": "market_data", "content": "binary_content"}'
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.BINARY, data=binary_data, extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        binary_messages = []
        
        async def handler(msg):
            messages.append(msg)
        async def binary_handler(data):
            binary_messages.append(data)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_binary_handler(binary_handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 0
        assert len(binary_messages) == 1
        assert binary_messages[0] == binary_data
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='binary'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_state_transitions():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "connected"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra=None),
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
        
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='connected'
        )._value.get() >= 1
        
        await asyncio.sleep(0.1)
        
        assert len(messages) == 1
        assert len(errors) == 1
        
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='error'
        )._value.get() >= 1
        
        await ws.disconnect()
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/market',
            status='disconnected'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_error_propagation():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        RuntimeError("Handler error"),
        aiohttp.ClientError("Network error"),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        errors = []
        
        async def handler(msg):
            messages.append(msg)
            raise RuntimeError("Handler error")
        async def error_handler(error):
            errors.append(error)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 1
        assert len(errors) == 2
        assert isinstance(errors[0], RuntimeError)
        assert isinstance(errors[1], aiohttp.ClientError)
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='handler_error'
        )._value.get() >= 1
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='receive_error'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_connection_pool():
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
        connections = []
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        for _ in range(5):
            ws = await client.websocket('ws://test.com/ws/market', handler)
            connections.append(ws)
        
        await asyncio.sleep(0.1)
        
        assert metrics.active_connections.labels(
            type='websocket',
            status='active'
        )._value.get() == 5
        
        for ws in connections:
            await ws.disconnect()
        
        assert metrics.active_connections.labels(
            type='websocket',
            status='active'
        )._value.get() == 0

@pytest.mark.asyncio
async def test_websocket_validation_concurrent_messages():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test1"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test2"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test3"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        processing_times = []
        
        async def handler(msg):
            start = time.time()
            await asyncio.sleep(0.05)  # Simulate processing time
            processing_times.append(time.time() - start)
            messages.append(msg)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 3
        assert all(t >= 0.05 for t in processing_times)
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() == 3

@pytest.mark.asyncio
async def test_websocket_validation_backoff():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        aiohttp.ClientError("Connection error 1"),
        aiohttp.ClientError("Connection error 2"),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "success"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        errors = []
        backoff_times = []
        
        async def handler(msg):
            messages.append(msg)
        async def error_handler(error):
            errors.append(error)
            backoff_times.append(time.time())
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.3)
        
        assert len(messages) == 1
        assert len(errors) == 2
        assert len(backoff_times) == 2
        assert backoff_times[1] - backoff_times[0] >= 0.1  # Verify backoff delay
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='receive_error'
        )._value.get() >= 2
        
        assert metrics.websocket_reconnects.labels(
            path='ws://test.com/ws/market',
            status='retry'
        )._value.get() >= 2

@pytest.mark.asyncio
async def test_websocket_validation_rate_limit():
    config = get_mock_network_config()
    config.rate_limit = 2  # 2 messages per second
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test1"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test2"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test3"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        start_time = time.time()
        
        async def handler(msg):
            messages.append((msg, time.time() - start_time))
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.3)
        
        assert len(messages) == 3
        
        # Verify rate limiting
        message_intervals = [t for _, t in messages[1:]]
        assert all(interval >= 0.5 for interval in message_intervals)
        
        assert metrics.websocket_rate_limit.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_custom_protocol():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"protocol": "v2", "event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        protocols = []
        
        async def handler(msg):
            messages.append(msg)
            protocols.append(msg.get('protocol'))
        
        ws = await client.websocket('ws://test.com/ws/market', handler, protocols=['v1', 'v2'])
        await asyncio.sleep(0.1)
        
        assert len(messages) == 1
        assert protocols[0] == 'v2'
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='text'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_compression():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    compressed_data = zlib.compress(b'{"event": "compressed_test"}')
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.BINARY, data=compressed_data, extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        compressed_messages = []
        
        async def handler(msg):
            messages.append(msg)
        async def compressed_handler(data):
            decompressed = zlib.decompress(data)
            compressed_messages.append(json.loads(decompressed))
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_compressed_handler(compressed_handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 0
        assert len(compressed_messages) == 1
        assert compressed_messages[0]["event"] == "compressed_test"
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='binary'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_ping_pong():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.PING, data=b'ping', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.pong = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        pings = []
        
        async def handler(msg):
            messages.append(msg)
        async def ping_handler():
            pings.append(True)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_ping_handler(ping_handler)
        await asyncio.sleep(0.1)
        
        assert len(messages) == 1
        assert len(pings) == 1
        assert mock_ws.pong.called
        
        assert metrics.websocket_messages.labels(
            path='ws://test.com/ws/market',
            type='ping'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_timeout():
    config = get_mock_network_config()
    config.timeout = 0.1
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        asyncio.TimeoutError(),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        timeouts = []
        
        async def handler(msg):
            messages.append(msg)
        async def timeout_handler():
            timeouts.append(True)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_timeout_handler(timeout_handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 1
        assert len(timeouts) == 1
        
        assert metrics.websocket_timeouts.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_heartbeat():
    config = get_mock_network_config()
    config.heartbeat_interval = 0.1
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "heartbeat"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "test"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "heartbeat"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        heartbeats = []
        
        async def handler(msg):
            if msg.get('type') != 'heartbeat':
                messages.append(msg)
        async def heartbeat_handler():
            heartbeats.append(time.time())
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_heartbeat_handler(heartbeat_handler)
        await asyncio.sleep(0.3)
        
        assert len(messages) == 1
        assert len(heartbeats) == 2
        assert mock_ws.send_str.call_count >= 2
        
        assert metrics.websocket_heartbeats.labels(
            path='ws://test.com/ws/market',
            status='success'
        )._value.get() >= 2

@pytest.mark.asyncio
async def test_websocket_validation_state_tracking():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"event": "connected"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "reconnected"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        states = []
        
        async def handler(msg):
            messages.append(msg)
        async def state_handler(state):
            states.append(state)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_state_handler(state_handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 2
        assert len(states) == 4  # connected -> error -> reconnected -> closed
        
        assert metrics.websocket_state_changes.labels(
            path='ws://test.com/ws/market',
            from_state='connected',
            to_state='error'
        )._value.get() >= 1
        
        assert metrics.websocket_state_changes.labels(
            path='ws://test.com/ws/market',
            from_state='error',
            to_state='connected'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_auth():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "auth_required"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "auth_success"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"event": "data"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        auth_states = []
        
        async def handler(msg):
            messages.append(msg)
        async def auth_handler(state):
            auth_states.append(state)
        
        ws = await client.websocket('ws://test.com/ws/market', handler, auth_token='test_token')
        ws.add_auth_handler(auth_handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 1
        assert len(auth_states) == 2
        assert mock_ws.send_str.call_args[0][0] == '{"type": "auth", "token": "test_token"}'
        
        assert metrics.websocket_auth.labels(
            path='ws://test.com/ws/market',
            status='success'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_subscription():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "sub_ack", "channel": "market"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"channel": "market", "data": "test1"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"channel": "market", "data": "test2"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        subs = []
        
        async def handler(msg):
            messages.append(msg)
        async def sub_handler(channel):
            subs.append(channel)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_subscription_handler(sub_handler)
        await ws.subscribe('market')
        await asyncio.sleep(0.2)
        
        assert len(messages) == 2
        assert len(subs) == 1
        assert subs[0] == 'market'
        assert mock_ws.send_str.call_args[0][0] == '{"type": "subscribe", "channel": "market"}'
        
        assert metrics.websocket_subscriptions.labels(
            path='ws://test.com/ws/market',
            channel='market',
            status='active'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_subscription_error():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "sub_error", "channel": "market", "error": "Invalid channel"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "sub_ack", "channel": "trades"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        errors = []
        subs = []
        
        async def error_handler(error):
            errors.append(error)
        async def sub_handler(channel):
            subs.append(channel)
        
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws.add_error_handler(error_handler)
        ws.add_subscription_handler(sub_handler)
        
        with pytest.raises(Exception):
            await ws.subscribe('market')
        
        await ws.subscribe('trades')
        await asyncio.sleep(0.1)
        
        assert len(errors) == 1
        assert len(subs) == 1
        assert subs[0] == 'trades'
        
        assert metrics.websocket_subscriptions.labels(
            path='ws://test.com/ws/market',
            channel='market',
            status='error'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_subscription_recovery():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "sub_ack", "channel": "market"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "sub_ack", "channel": "market"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"channel": "market", "data": "test"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        recoveries = []
        
        async def handler(msg):
            messages.append(msg)
        async def recovery_handler():
            recoveries.append(True)
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_recovery_handler(recovery_handler)
        await ws.subscribe('market')
        await asyncio.sleep(0.2)
        
        assert len(messages) == 1
        assert len(recoveries) == 1
        assert mock_ws.send_str.call_count == 2  # Initial sub + recovery
        
        assert metrics.websocket_recoveries.labels(
            path='ws://test.com/ws/market',
            status='success'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_message_ordering():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"seq": 1, "data": "first"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"seq": 3, "data": "third"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"seq": 2, "data": "second"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        sequences = []
        
        async def handler(msg):
            messages.append(msg)
            sequences.append(msg.get('seq'))
        async def sequence_handler(seq):
            if seq != sequences[-1] + 1:
                metrics.websocket_sequence_gaps.labels(
                    path='ws://test.com/ws/market'
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        ws.add_sequence_handler(sequence_handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 3
        assert sequences == [1, 3, 2]
        
        assert metrics.websocket_sequence_gaps.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_message_batching():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch", "messages": [{"id": 1}, {"id": 2}]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch", "messages": [{"id": 3}, {"id": 4}, {"id": 5}]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        batch_sizes = []
        
        async def handler(msg):
            if msg.get('type') == 'batch':
                batch = msg.get('messages', [])
                messages.extend(batch)
                batch_sizes.append(len(batch))
        
        ws = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 5
        assert batch_sizes == [2, 3]
        
        assert metrics.websocket_batch_size.labels(
            path='ws://test.com/ws/market'
        ).observe.call_count >= 2

@pytest.mark.asyncio
async def test_websocket_validation_throttling():
    config = get_mock_network_config()
    config.max_connections_per_host = 2
    config.connection_throttle = 0.1
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
        start_time = time.time()
        ws1 = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws2 = await client.websocket('ws://test.com/ws/market', lambda _: None)
        
        with pytest.raises(Exception):
            ws3 = await client.websocket('ws://test.com/ws/market', lambda _: None)
        
        duration = time.time() - start_time
        assert duration >= 0.1
        
        assert metrics.websocket_throttled.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_message_filtering():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "market", "price": 100}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "trade", "amount": 50}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "market", "price": 101}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        market_messages = []
        trade_messages = []
        filtered_count = 0
        
        async def market_handler(msg):
            if msg.get('type') == 'market':
                market_messages.append(msg)
            else:
                filtered_count += 1
        
        async def trade_handler(msg):
            if msg.get('type') == 'trade':
                trade_messages.append(msg)
        
        ws = await client.websocket('ws://test.com/ws/market', market_handler)
        ws.add_message_filter('trade', trade_handler)
        await asyncio.sleep(0.2)
        
        assert len(market_messages) == 2
        assert len(trade_messages) == 1
        assert filtered_count == 1
        
        assert metrics.websocket_messages_filtered.labels(
            path='ws://test.com/ws/market',
            filter_type='trade'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_cleanup_resources():
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
    mock_ws.ping = AsyncMock()
    mock_ws.send_str = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        cleanup_called = False
        ping_task = None
        heartbeat_task = None
        
        async def cleanup_handler():
            nonlocal cleanup_called
            cleanup_called = True
            if ping_task:
                ping_task.cancel()
            if heartbeat_task:
                heartbeat_task.cancel()
        
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws.add_cleanup_handler(cleanup_handler)
        
        ping_task = asyncio.create_task(ws._ping_loop())
        heartbeat_task = asyncio.create_task(ws._heartbeat_loop())
        
        await asyncio.sleep(0.1)
        await ws.disconnect()
        
        assert cleanup_called
        assert mock_ws.close.called
        assert not ping_task.cancelled()
        assert not heartbeat_task.cancelled()
        
        assert metrics.websocket_cleanup.labels(
            path='ws://test.com/ws/market',
            status='success'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_resource_limits():
    config = get_mock_network_config()
    config.max_message_size = 1024
    config.max_queue_size = 100
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"data": "' + 'x' * 2048 + '"}', extra=None),
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
        await asyncio.sleep(0.2)
        
        assert len(messages) == 1
        assert len(errors) == 1
        assert isinstance(errors[0], ValueError)
        assert "Message size exceeds limit" in str(errors[0])
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/market',
            error_type='message_size'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_state_management():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connected"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "ready"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Connection lost"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "reconnected"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        states = []
        state_changes = []
        
        async def state_handler(old_state, new_state):
            state_changes.append((old_state, new_state))
            states.append(new_state)
        
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws.add_state_change_handler(state_handler)
        await asyncio.sleep(0.2)
        
        assert len(states) == 5
        assert states == ['connected', 'ready', 'error', 'reconnected', 'closed']
        assert len(state_changes) == 5
        
        assert metrics.websocket_state_transitions.labels(
            path='ws://test.com/ws/market',
            from_state='ready',
            to_state='error'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_error_recovery():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connected"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Connection error"),
        asyncio.TimeoutError(),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "reconnected"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        recovery_attempts = []
        recovery_success = []
        
        async def recovery_handler(attempt):
            recovery_attempts.append(attempt)
        async def success_handler():
            recovery_success.append(True)
        
        ws = await client.websocket('ws://test.com/ws/market', lambda _: None)
        ws.add_recovery_attempt_handler(recovery_handler)
        ws.add_recovery_success_handler(success_handler)
        await asyncio.sleep(0.2)
        
        assert len(recovery_attempts) == 2
        assert len(recovery_success) == 1
        
        assert metrics.websocket_recovery_attempts.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 2
        assert metrics.websocket_recovery_success.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_connection_pooling():
    config = get_mock_network_config()
    config.max_pool_size = 2
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 1}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 2}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        ws1 = await client.websocket('ws://test.com/ws/market', handler)
        ws2 = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 2
        assert [msg.get('id') for msg in messages] == [1, 2]
        assert ws_connect_mock.call_count == 2
        
        assert metrics.websocket_pool_connections.labels(
            path='ws://test.com/ws/market'
        )._value.get() == 2

@pytest.mark.asyncio
async def test_websocket_validation_load_balancing():
    config = get_mock_network_config()
    config.max_pool_size = 2
    config.load_balance = True
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"server": "1", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"server": "1", "id": 2}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"server": "2", "id": 3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"server": "2", "id": 4}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        ws1 = await client.websocket('ws://test.com/ws/market', handler)
        ws2 = await client.websocket('ws://test.com/ws/market', handler)
        await asyncio.sleep(0.2)
        
        assert len(messages) == 4
        server_counts = {'1': 0, '2': 0}
        for msg in messages:
            server_counts[msg['server']] += 1
        
        assert server_counts['1'] == 2
        assert server_counts['2'] == 2
        
        assert metrics.websocket_load_balance.labels(
            path='ws://test.com/ws/market',
            server='1'
        )._value.get() == 2
        assert metrics.websocket_load_balance.labels(
            path='ws://test.com/ws/market',
            server='2'
        )._value.get() == 2

@pytest.mark.asyncio
async def test_websocket_validation_monitoring():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connected", "latency": 50}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "message", "size": 1024}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error", "code": 1001}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        monitoring_data = {
            'latency': [],
            'message_size': [],
            'errors': []
        }
        
        async def monitor_handler(msg):
            if msg.get('latency'):
                monitoring_data['latency'].append(msg['latency'])
            if msg.get('size'):
                monitoring_data['message_size'].append(msg['size'])
            if msg.get('code'):
                monitoring_data['errors'].append(msg['code'])
        
        ws = await client.websocket('ws://test.com/ws/market', monitor_handler)
        await asyncio.sleep(0.2)
        
        assert len(monitoring_data['latency']) == 1
        assert len(monitoring_data['message_size']) == 1
        assert len(monitoring_data['errors']) == 1
        
        assert metrics.websocket_latency.labels(
            path='ws://test.com/ws/market'
        ).observe.call_count >= 1
        assert metrics.websocket_message_size.labels(
            path='ws://test.com/ws/market'
        ).observe.call_count >= 1
        assert metrics.websocket_errors_total.labels(
            path='ws://test.com/ws/market',
            code='1001'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_performance():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "start"}', extra=None),
        *[WSMessage(type=WSMsgType.TEXT, data='{"type": "data"}', extra=None) for _ in range(100)],
        WSMessage(type=WSMsgType.TEXT, data='{"type": "end"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        start_time = time.time()
        message_count = 0
        processing_times = []
        
        async def performance_handler(msg):
            nonlocal message_count
            message_count += 1
            processing_time = time.time() - start_time
            processing_times.append(processing_time)
            
            if msg.get('type') == 'data':
                metrics.websocket_message_processing_time.labels(
                    path='ws://test.com/ws/market'
                ).observe(processing_time)
        
        ws = await client.websocket('ws://test.com/ws/market', performance_handler)
        await asyncio.sleep(0.5)
        
        assert message_count == 102
        assert len(processing_times) == 102
        
        avg_processing_time = sum(processing_times) / len(processing_times)
        assert metrics.websocket_message_processing_time.labels(
            path='ws://test.com/ws/market'
        ).observe.call_count >= 100
        
        assert metrics.websocket_message_rate.labels(
            path='ws://test.com/ws/market'
        )._value.get() >= 100

@pytest.mark.asyncio
async def test_websocket_validation_security():
    config = get_mock_network_config()
    config.ssl_verify = True
    config.ssl_cert = "/path/to/cert"
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "auth", "token": "valid_token"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "auth", "token": "invalid_token"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "payload": "sensitive"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        auth_successes = []
        auth_failures = []
        
        async def security_handler(msg):
            if msg.get('type') == 'auth':
                if msg.get('token') == 'valid_token':
                    auth_successes.append(msg)
                else:
                    auth_failures.append(msg)
                    raise ValueError("Invalid token")
        
        ws = await client.websocket('wss://test.com/ws/secure', security_handler)
        await asyncio.sleep(0.2)
        
        assert len(auth_successes) == 1
        assert len(auth_failures) == 1
        
        assert metrics.websocket_auth_success.labels(
            path='wss://test.com/ws/secure'
        )._value.get() >= 1
        assert metrics.websocket_auth_failure.labels(
            path='wss://test.com/ws/secure'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol():
    config = get_mock_network_config()
    config.protocols = ['v1', 'v2']
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"protocol": "v1", "type": "handshake"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"protocol": "v2", "type": "upgrade"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"protocol": "v3", "type": "invalid"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_messages = []
        protocol_errors = []
        
        async def protocol_handler(msg):
            if msg.get('protocol') in config.protocols:
                protocol_messages.append(msg)
            else:
                protocol_errors.append(msg)
                raise ValueError(f"Unsupported protocol: {msg.get('protocol')}")
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        await asyncio.sleep(0.2)
        
        assert len(protocol_messages) == 2
        assert len(protocol_errors) == 1
        
        assert metrics.websocket_protocol_upgrades.labels(
            path='ws://test.com/ws/protocol',
            from_version='v1',
            to_version='v2'
        )._value.get() >= 1
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='unsupported_protocol'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_metrics():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connect", "timestamp": 1234567890}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "message", "size": 512}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error", "code": "RATE_LIMIT"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        metrics_data = {
            'connect_time': None,
            'message_sizes': [],
            'errors': []
        }
        
        async def metrics_handler(msg):
            if msg.get('type') == 'connect':
                metrics_data['connect_time'] = msg['timestamp']
            elif msg.get('type') == 'message':
                metrics_data['message_sizes'].append(msg['size'])
            elif msg.get('type') == 'error':
                metrics_data['errors'].append(msg['code'])
        
        ws = await client.websocket('ws://test.com/ws/metrics', metrics_handler)
        await asyncio.sleep(0.2)
        
        assert metrics_data['connect_time'] == 1234567890
        assert metrics_data['message_sizes'] == [512]
        assert metrics_data['errors'] == ['RATE_LIMIT']
        
        assert metrics.websocket_connect_time.labels(
            path='ws://test.com/ws/metrics'
        )._value.get() >= 1234567890
        assert metrics.websocket_message_size_bytes.labels(
            path='ws://test.com/ws/metrics'
        ).observe.call_count >= 1
        assert metrics.websocket_errors_total.labels(
            path='ws://test.com/ws/metrics',
            error='RATE_LIMIT'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_advanced():
    config = get_mock_network_config()
    config.validation_rules = {
        'max_message_size': 1024,
        'required_fields': ['type', 'id'],
        'allowed_types': ['data', 'control']
    }
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "id": 1, "size": 512}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "control", "id": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "invalid"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 3}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        valid_messages = []
        validation_errors = []
        
        async def validation_handler(msg):
            try:
                if not all(field in msg for field in config.validation_rules['required_fields']):
                    raise ValueError("Missing required fields")
                if msg['type'] not in config.validation_rules['allowed_types']:
                    raise ValueError("Invalid message type")
                if msg.get('size', 0) > config.validation_rules['max_message_size']:
                    raise ValueError("Message too large")
                valid_messages.append(msg)
            except ValueError as e:
                validation_errors.append((msg, str(e)))
                raise
        
        ws = await client.websocket('ws://test.com/ws/validation', validation_handler)
        await asyncio.sleep(0.2)
        
        assert len(valid_messages) == 2
        assert len(validation_errors) == 2
        
        assert metrics.websocket_validation_errors.labels(
            path='ws://test.com/ws/validation',
            error='missing_required_fields'
        )._value.get() >= 1
        assert metrics.websocket_validation_errors.labels(
            path='ws://test.com/ws/validation',
            error='invalid_message_type'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_retry():
    config = get_mock_network_config()
    config.retry_attempts = 3
    config.retry_delay = 0.1
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    connection_attempts = 0
    
    async def mock_ws_connect(*args, **kwargs):
        nonlocal connection_attempts
        connection_attempts += 1
        if connection_attempts < 3:
            raise ClientError("Connection failed")
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(side_effect=[
            WSMessage(type=WSMsgType.TEXT, data='{"status": "connected"}', extra=None),
            WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
        ])
        mock_ws.closed = False
        mock_ws.close = AsyncMock()
        return mock_ws
    
    with patch('aiohttp.ClientSession.ws_connect', side_effect=mock_ws_connect):
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        ws = await client.websocket('ws://test.com/ws/retry', handler)
        await asyncio.sleep(0.3)
        
        assert connection_attempts == 3
        assert len(messages) == 1
        assert messages[0]['status'] == 'connected'
        
        assert metrics.websocket_retry_attempts.labels(
            path='ws://test.com/ws/retry'
        )._value.get() == 2
        assert metrics.websocket_retry_success.labels(
            path='ws://test.com/ws/retry'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_backoff():
    config = get_mock_network_config()
    config.backoff_factor = 2
    config.max_backoff = 1.0
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    connection_times = []
    
    async def mock_ws_connect(*args, **kwargs):
        connection_times.append(time.time())
        if len(connection_times) < 3:
            raise ClientError("Connection failed")
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(side_effect=[
            WSMessage(type=WSMsgType.TEXT, data='{"status": "connected"}', extra=None),
            WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
        ])
        mock_ws.closed = False
        mock_ws.close = AsyncMock()
        return mock_ws
    
    with patch('aiohttp.ClientSession.ws_connect', side_effect=mock_ws_connect):
        messages = []
        
        async def handler(msg):
            messages.append(msg)
        
        start_time = time.time()
        ws = await client.websocket('ws://test.com/ws/backoff', handler)
        await asyncio.sleep(0.5)
        
        assert len(connection_times) == 3
        assert len(messages) == 1
        
        delays = [t - connection_times[i-1] for i, t in enumerate(connection_times[1:], 1)]
        assert delays[1] >= delays[0] * config.backoff_factor
        
        assert metrics.websocket_backoff_delay.labels(
            path='ws://test.com/ws/backoff'
        ).observe.call_count >= 2

@pytest.mark.asyncio
async def test_websocket_validation_lifecycle():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "init", "session": "123"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "ready"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "shutdown"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        lifecycle_events = []
        
        async def lifecycle_handler(msg):
            lifecycle_events.append(msg.get('type'))
            if msg.get('type') == 'init':
                metrics.websocket_session_start.labels(
                    path='ws://test.com/ws/lifecycle',
                    session=msg['session']
                ).inc()
            elif msg.get('type') == 'shutdown':
                metrics.websocket_session_end.labels(
                    path='ws://test.com/ws/lifecycle',
                    session='123'
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/lifecycle', lifecycle_handler)
        await asyncio.sleep(0.2)
        
        assert lifecycle_events == ['init', 'ready', 'data', 'shutdown']
        
        assert metrics.websocket_session_start.labels(
            path='ws://test.com/ws/lifecycle',
            session='123'
        )._value.get() == 1
        assert metrics.websocket_session_end.labels(
            path='ws://test.com/ws/lifecycle',
            session='123'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_resource_management():
    config = get_mock_network_config()
    config.max_connections = 2
    config.max_message_queue = 100
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 1, "memory": 50}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 2, "memory": 75}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 3, "memory": 60}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 4, "memory": 85}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        resource_metrics = {
            'memory_usage': [],
            'connection_count': 0
        }
        
        async def resource_handler(msg):
            resource_metrics['memory_usage'].append(msg['memory'])
            metrics.websocket_memory_usage.labels(
                path='ws://test.com/ws/resources'
            ).observe(msg['memory'])
        
        ws1 = await client.websocket('ws://test.com/ws/resources', resource_handler)
        ws2 = await client.websocket('ws://test.com/ws/resources', resource_handler)
        await asyncio.sleep(0.2)
        
        assert len(resource_metrics['memory_usage']) == 4
        assert all(50 <= mem <= 85 for mem in resource_metrics['memory_usage'])
        
        assert metrics.websocket_memory_usage.labels(
            path='ws://test.com/ws/resources'
        ).observe.call_count >= 4
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/resources'
        )._value.get() == 2

@pytest.mark.asyncio
async def test_websocket_validation_concurrency():
    config = get_mock_network_config()
    config.max_concurrent_messages = 5
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 1, "delay": 0.1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 2, "delay": 0.2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 3, "delay": 0.1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 4, "delay": 0.3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"id": 5, "delay": 0.1}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        processing_times = []
        concurrent_tasks = set()
        
        async def concurrent_handler(msg):
            task_id = asyncio.current_task().get_name()
            concurrent_tasks.add(task_id)
            start_time = time.time()
            await asyncio.sleep(msg['delay'])
            processing_time = time.time() - start_time
            processing_times.append(processing_time)
            concurrent_tasks.remove(task_id)
            
            metrics.websocket_concurrent_tasks.labels(
                path='ws://test.com/ws/concurrent'
            ).set(len(concurrent_tasks))
        
        ws = await client.websocket('ws://test.com/ws/concurrent', concurrent_handler)
        await asyncio.sleep(1.0)
        
        assert len(processing_times) == 5
        assert all(0.1 <= t <= 0.4 for t in processing_times)
        
        assert metrics.websocket_concurrent_tasks.labels(
            path='ws://test.com/ws/concurrent'
        )._value.get() >= 0
        assert metrics.websocket_message_processing_time.labels(
            path='ws://test.com/ws/concurrent'
        ).observe.call_count >= 5

@pytest.mark.asyncio
async def test_websocket_validation_synchronization():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "lock", "resource": "A"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "lock", "resource": "B"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "unlock", "resource": "A"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "lock", "resource": "A"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "unlock", "resource": "B"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "unlock", "resource": "A"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        resource_locks = {}
        lock_events = []
        
        async def sync_handler(msg):
            resource = msg['resource']
            if msg['type'] == 'lock':
                if resource in resource_locks:
                    metrics.websocket_lock_conflicts.labels(
                        path='ws://test.com/ws/sync',
                        resource=resource
                    ).inc()
                    raise ValueError(f"Resource {resource} already locked")
                resource_locks[resource] = True
                lock_events.append(('lock', resource))
            else:
                if resource not in resource_locks:
                    metrics.websocket_unlock_errors.labels(
                        path='ws://test.com/ws/sync',
                        resource=resource
                    ).inc()
                    raise ValueError(f"Resource {resource} not locked")
                del resource_locks[resource]
                lock_events.append(('unlock', resource))
        
        ws = await client.websocket('ws://test.com/ws/sync', sync_handler)
        await asyncio.sleep(0.2)
        
        assert len(lock_events) == 6
        assert lock_events.count(('lock', 'A')) == 2
        assert lock_events.count(('unlock', 'A')) == 2
        assert lock_events.count(('lock', 'B')) == 1
        assert lock_events.count(('unlock', 'B')) == 1
        
        assert metrics.websocket_lock_conflicts.labels(
            path='ws://test.com/ws/sync',
            resource='A'
        )._value.get() == 0
        assert metrics.websocket_unlock_errors.labels(
            path='ws://test.com/ws/sync',
            resource='A'
        )._value.get() == 0

@pytest.mark.asyncio
async def test_websocket_validation_state_transitions_advanced():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"state": "connecting", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "authenticating", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "subscribing", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "ready", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "error", "id": 1, "error": "timeout"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "reconnecting", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "ready", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        state_transitions = []
        
        async def state_handler(msg):
            state = msg['state']
            state_transitions.append(state)
            metrics.websocket_state_transitions.labels(
                path='ws://test.com/ws/state',
                from_state=state_transitions[-2] if len(state_transitions) > 1 else 'none',
                to_state=state
            ).inc()
            
            if state == 'error':
                metrics.websocket_errors.labels(
                    path='ws://test.com/ws/state',
                    error=msg['error']
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/state', state_handler)
        await asyncio.sleep(0.2)
        
        expected_states = ['connecting', 'authenticating', 'subscribing', 'ready', 
                          'error', 'reconnecting', 'ready']
        assert state_transitions == expected_states
        
        assert metrics.websocket_state_transitions.labels(
            path='ws://test.com/ws/state',
            from_state='none',
            to_state='connecting'
        )._value.get() == 1
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/state',
            error='timeout'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_error_recovery_advanced():
    config = get_mock_network_config()
    config.recovery_attempts = 3
    config.recovery_delay = 0.1
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "seq": 1}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Connection lost"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "seq": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error", "code": "RATE_LIMIT"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "seq": 3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "seq": 4}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        messages = []
        errors = []
        
        async def recovery_handler(msg):
            if msg.get('type') == 'data':
                messages.append(msg['seq'])
            elif msg.get('type') == 'error':
                errors.append(msg['code'])
                metrics.websocket_errors.labels(
                    path='ws://test.com/ws/recovery',
                    error=msg['code']
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/recovery', recovery_handler)
        await asyncio.sleep(0.2)
        
        assert messages == [1, 2, 3, 4]
        assert errors == ['RATE_LIMIT']
        
        assert metrics.websocket_recovery_attempts.labels(
            path='ws://test.com/ws/recovery'
        )._value.get() >= 1
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/recovery',
            error='RATE_LIMIT'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_state_management_advanced():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"state": "init", "resources": ["A", "B"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "allocate", "resource": "A", "size": 100}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "allocate", "resource": "B", "size": 200}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "deallocate", "resource": "A"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "deallocate", "resource": "B"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "cleanup"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        resource_states = {}
        state_events = []
        
        async def state_handler(msg):
            state = msg['state']
            state_events.append(state)
            
            if state == 'init':
                for resource in msg['resources']:
                    resource_states[resource] = 0
                    metrics.websocket_resource_init.labels(
                        path='ws://test.com/ws/state_mgmt',
                        resource=resource
                    ).inc()
            elif state == 'allocate':
                resource = msg['resource']
                size = msg['size']
                resource_states[resource] = size
                metrics.websocket_resource_allocation.labels(
                    path='ws://test.com/ws/state_mgmt',
                    resource=resource
                ).observe(size)
            elif state == 'deallocate':
                resource = msg['resource']
                metrics.websocket_resource_deallocation.labels(
                    path='ws://test.com/ws/state_mgmt',
                    resource=resource
                ).inc()
                del resource_states[resource]
            elif state == 'cleanup':
                metrics.websocket_cleanup_complete.labels(
                    path='ws://test.com/ws/state_mgmt'
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/state_mgmt', state_handler)
        await asyncio.sleep(0.2)
        
        assert state_events == ['init', 'allocate', 'allocate', 'deallocate', 'deallocate', 'cleanup']
        assert len(resource_states) == 0
        
        assert metrics.websocket_resource_init.labels(
            path='ws://test.com/ws/state_mgmt',
            resource='A'
        )._value.get() == 1
        assert metrics.websocket_resource_allocation.labels(
            path='ws://test.com/ws/state_mgmt',
            resource='B'
        ).observe.call_count >= 1
        assert metrics.websocket_cleanup_complete.labels(
            path='ws://test.com/ws/state_mgmt'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_cleanup_advanced():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "open", "handle": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "write", "handle": 1, "size": 100}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "open", "handle": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "write", "handle": 2, "size": 200}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "close", "handle": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "close", "handle": 2}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Cleanup required"),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        open_handles = set()
        handle_sizes = {}
        
        async def cleanup_handler(msg):
            msg_type = msg['type']
            handle = msg.get('handle')
            
            if msg_type == 'open':
                open_handles.add(handle)
                metrics.websocket_handles_open.labels(
                    path='ws://test.com/ws/cleanup'
                ).inc()
            elif msg_type == 'write':
                size = msg['size']
                handle_sizes[handle] = size
                metrics.websocket_handle_writes.labels(
                    path='ws://test.com/ws/cleanup',
                    handle=str(handle)
                ).observe(size)
            elif msg_type == 'close':
                open_handles.remove(handle)
                del handle_sizes[handle]
                metrics.websocket_handles_closed.labels(
                    path='ws://test.com/ws/cleanup'
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/cleanup', cleanup_handler)
        await asyncio.sleep(0.2)
        
        assert len(open_handles) == 0
        assert len(handle_sizes) == 0
        
        assert metrics.websocket_handles_open.labels(
            path='ws://test.com/ws/cleanup'
        )._value.get() == 2
        assert metrics.websocket_handles_closed.labels(
            path='ws://test.com/ws/cleanup'
        )._value.get() == 2
        assert metrics.websocket_handle_writes.labels(
            path='ws://test.com/ws/cleanup',
            handle='1'
        ).observe.call_count >= 1

@pytest.mark.asyncio
async def test_websocket_validation_state_transitions_complex():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"state": "init", "session": "123"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "auth", "token": "xyz"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "subscribe", "channel": "market"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "error", "code": "RATE_LIMIT"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "backoff", "delay": 1000}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "retry", "attempt": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "subscribe", "channel": "market"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"state": "ready"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        state_sequence = []
        error_states = []
        
        async def state_handler(msg):
            state = msg['state']
            state_sequence.append(state)
            
            if state == 'error':
                error_states.append(msg['code'])
                metrics.websocket_errors.labels(
                    path='ws://test.com/ws/state_complex',
                    error=msg['code']
                ).inc()
            elif state == 'backoff':
                metrics.websocket_backoff_delay.labels(
                    path='ws://test.com/ws/state_complex'
                ).observe(msg['delay'])
            elif state == 'retry':
                metrics.websocket_retry_attempts.labels(
                    path='ws://test.com/ws/state_complex'
                ).inc()
            
            metrics.websocket_state_transitions.labels(
                path='ws://test.com/ws/state_complex',
                from_state=state_sequence[-2] if len(state_sequence) > 1 else 'none',
                to_state=state
            ).inc()
        
        ws = await client.websocket('ws://test.com/ws/state_complex', state_handler)
        await asyncio.sleep(0.2)
        
        expected_states = ['init', 'auth', 'subscribe', 'error', 'backoff', 'retry', 'subscribe', 'ready']
        assert state_sequence == expected_states
        assert error_states == ['RATE_LIMIT']
        
        assert metrics.websocket_errors.labels(
            path='ws://test.com/ws/state_complex',
            error='RATE_LIMIT'
        )._value.get() == 1
        assert metrics.websocket_retry_attempts.labels(
            path='ws://test.com/ws/state_complex'
        )._value.get() == 1
        assert metrics.websocket_backoff_delay.labels(
            path='ws://test.com/ws/state_complex'
        ).observe.call_count >= 1

@pytest.mark.asyncio
async def test_websocket_validation_resource_management_complex():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "allocate", "id": 1, "memory": 100, "cpu": 50}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "allocate", "id": 2, "memory": 200, "cpu": 75}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "scale", "id": 1, "memory": 150, "cpu": 60}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "monitor", "metrics": {"total_memory": 350, "total_cpu": 135}}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "deallocate", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "monitor", "metrics": {"total_memory": 200, "total_cpu": 75}}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "deallocate", "id": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "monitor", "metrics": {"total_memory": 0, "total_cpu": 0}}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        resources = {}
        monitor_events = []
        
        async def resource_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'allocate':
                resources[msg['id']] = {
                    'memory': msg['memory'],
                    'cpu': msg['cpu']
                }
                metrics.websocket_resource_allocation.labels(
                    path='ws://test.com/ws/resource',
                    resource_id=str(msg['id'])
                ).inc()
                metrics.websocket_memory_usage.labels(
                    path='ws://test.com/ws/resource'
                ).observe(msg['memory'])
                metrics.websocket_cpu_usage.labels(
                    path='ws://test.com/ws/resource'
                ).observe(msg['cpu'])
            elif msg_type == 'scale':
                resources[msg['id']].update({
                    'memory': msg['memory'],
                    'cpu': msg['cpu']
                })
                metrics.websocket_resource_scaling.labels(
                    path='ws://test.com/ws/resource',
                    resource_id=str(msg['id'])
                ).inc()
            elif msg_type == 'monitor':
                monitor_events.append(msg['metrics'])
                metrics.websocket_total_memory.labels(
                    path='ws://test.com/ws/resource'
                ).set(msg['metrics']['total_memory'])
                metrics.websocket_total_cpu.labels(
                    path='ws://test.com/ws/resource'
                ).set(msg['metrics']['total_cpu'])
            elif msg_type == 'deallocate':
                del resources[msg['id']]
                metrics.websocket_resource_deallocation.labels(
                    path='ws://test.com/ws/resource',
                    resource_id=str(msg['id'])
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/resource', resource_handler)
        await asyncio.sleep(0.2)
        
        assert len(resources) == 0
        assert len(monitor_events) == 3
        assert monitor_events[-1]['total_memory'] == 0
        assert monitor_events[-1]['total_cpu'] == 0
        
        assert metrics.websocket_resource_allocation.labels(
            path='ws://test.com/ws/resource',
            resource_id='1'
        )._value.get() == 1
        assert metrics.websocket_resource_scaling.labels(
            path='ws://test.com/ws/resource',
            resource_id='1'
        )._value.get() == 1
        assert metrics.websocket_total_memory.labels(
            path='ws://test.com/ws/resource'
        )._value.get() == 0

@pytest.mark.asyncio
async def test_websocket_validation_connection_pool_advanced():
    config = get_mock_network_config()
    config.max_pool_size = 2
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 1, "data": "conn1"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 2, "data": "conn2"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    mock_ws3 = AsyncMock()
    mock_ws3.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"id": 3, "data": "conn3"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws3.closed = False
    mock_ws3.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2, mock_ws3])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        received_messages = []
        
        async def pool_handler(msg):
            received_messages.append((msg['id'], msg['data']))
            metrics.websocket_messages_received.labels(
                path='ws://test.com/ws/pool',
                connection_id=str(msg['id'])
            ).inc()
        
        ws1 = await client.websocket('ws://test.com/ws/pool', pool_handler)
        ws2 = await client.websocket('ws://test.com/ws/pool', pool_handler)
        
        with pytest.raises(Exception):
            ws3 = await client.websocket('ws://test.com/ws/pool', pool_handler)
        
        await asyncio.sleep(0.2)
        
        assert len(received_messages) == 2
        assert ('1', 'conn1') in received_messages
        assert ('2', 'conn2') in received_messages
        
        assert metrics.websocket_pool_size.labels(
            path='ws://test.com/ws/pool'
        )._value.get() == 2
        assert metrics.websocket_pool_overflow.labels(
            path='ws://test.com/ws/pool'
        )._value.get() >= 1
        
        await ws1.disconnect()
        assert metrics.websocket_pool_size.labels(
            path='ws://test.com/ws/pool'
        )._value.get() == 1
        
        ws3 = await client.websocket('ws://test.com/ws/pool', pool_handler)
        assert metrics.websocket_pool_size.labels(
            path='ws://test.com/ws/pool'
        )._value.get() == 2
        assert metrics.websocket_pool_reuse.labels(
            path='ws://test.com/ws/pool'
        )._value.get() >= 1

@pytest.mark.asyncio
async def test_websocket_validation_load_balancing_advanced():
    config = get_mock_network_config()
    config.max_connections = 3
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "market", "load": 30, "node": "A"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "trade", "size": 100}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "stats", "load": 45}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "market", "load": 20, "node": "B"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "trade", "size": 200}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "stats", "load": 35}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    mock_ws3 = AsyncMock()
    mock_ws3.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "market", "load": 50, "node": "C"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "trade", "size": 150}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "stats", "load": 65}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws3.closed = False
    mock_ws3.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2, mock_ws3])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        node_loads = {}
        trade_sizes = []
        
        async def load_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'market':
                node_loads[msg['node']] = msg['load']
                metrics.websocket_node_load.labels(
                    path='ws://test.com/ws/load',
                    node=msg['node']
                ).set(msg['load'])
            elif msg_type == 'trade':
                trade_sizes.append(msg['size'])
                metrics.websocket_trade_size.labels(
                    path='ws://test.com/ws/load'
                ).observe(msg['size'])
            elif msg_type == 'stats':
                metrics.websocket_load_stats.labels(
                    path='ws://test.com/ws/load'
                ).observe(msg['load'])
        
        connections = []
        for _ in range(3):
            ws = await client.websocket('ws://test.com/ws/load', load_handler)
            connections.append(ws)
        
        await asyncio.sleep(0.2)
        
        assert len(node_loads) == 3
        assert len(trade_sizes) == 3
        assert node_loads['B'] == min(node_loads.values())
        
        total_load = sum(node_loads.values())
        assert metrics.websocket_total_load.labels(
            path='ws://test.com/ws/load'
        )._value.get() == total_load
        
        for ws in connections:
            await ws.disconnect()
        
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/load',
            status='closed'
        )._value.get() == 3

@pytest.mark.asyncio
async def test_websocket_validation_performance_monitoring():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "latency", "value": 50}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "throughput", "messages": 1000, "bytes": 50000}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error_rate", "errors": 5, "total": 1000}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "memory", "used": 512, "total": 1024}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "cpu", "usage": 75}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        performance_metrics = {}
        
        async def perf_handler(msg):
            msg_type = msg['type']
            performance_metrics[msg_type] = msg
            
            if msg_type == 'latency':
                metrics.websocket_latency.labels(
                    path='ws://test.com/ws/perf'
                ).observe(msg['value'])
            elif msg_type == 'throughput':
                metrics.websocket_message_throughput.labels(
                    path='ws://test.com/ws/perf'
                ).observe(msg['messages'])
                metrics.websocket_byte_throughput.labels(
                    path='ws://test.com/ws/perf'
                ).observe(msg['bytes'])
            elif msg_type == 'error_rate':
                error_rate = (msg['errors'] / msg['total']) * 100
                metrics.websocket_error_rate.labels(
                    path='ws://test.com/ws/perf'
                ).observe(error_rate)
            elif msg_type == 'memory':
                memory_usage = (msg['used'] / msg['total']) * 100
                metrics.websocket_memory_usage.labels(
                    path='ws://test.com/ws/perf'
                ).observe(memory_usage)
            elif msg_type == 'cpu':
                metrics.websocket_cpu_usage.labels(
                    path='ws://test.com/ws/perf'
                ).observe(msg['usage'])
        
        ws = await client.websocket('ws://test.com/ws/perf', perf_handler)
        await asyncio.sleep(0.2)
        
        assert len(performance_metrics) == 5
        assert performance_metrics['latency']['value'] == 50
        assert performance_metrics['throughput']['messages'] == 1000
        assert performance_metrics['error_rate']['errors'] == 5
        assert performance_metrics['memory']['used'] == 512
        assert performance_metrics['cpu']['usage'] == 75
        
        assert metrics.websocket_latency.labels(
            path='ws://test.com/ws/perf'
        ).observe.call_count >= 1
        assert metrics.websocket_message_throughput.labels(
            path='ws://test.com/ws/perf'
        ).observe.call_count >= 1
        assert metrics.websocket_error_rate.labels(
            path='ws://test.com/ws/perf'
        ).observe.call_count >= 1
        assert metrics.websocket_memory_usage.labels(
            path='ws://test.com/ws/perf'
        ).observe.call_count >= 1
        assert metrics.websocket_cpu_usage.labels(
            path='ws://test.com/ws/perf'
        ).observe.call_count >= 1

@pytest.mark.asyncio
async def test_websocket_validation_error_recovery_advanced():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws1 = AsyncMock()
    mock_ws1.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connect", "id": 1}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Connection lost"),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws1.closed = False
    mock_ws1.close = AsyncMock()
    
    mock_ws2 = AsyncMock()
    mock_ws2.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "connect", "id": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "value": "success"}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws2.closed = False
    mock_ws2.close = AsyncMock()
    
    ws_connect_mock = AsyncMock(side_effect=[mock_ws1, mock_ws2])
    
    with patch('aiohttp.ClientSession.ws_connect', ws_connect_mock):
        connection_ids = []
        recovery_attempts = 0
        success_messages = []
        
        async def recovery_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'connect':
                connection_ids.append(msg['id'])
                metrics.websocket_connections.labels(
                    path='ws://test.com/ws/recovery',
                    status='connected'
                ).inc()
            elif msg_type == 'data':
                success_messages.append(msg['value'])
                metrics.websocket_messages_received.labels(
                    path='ws://test.com/ws/recovery'
                ).inc()
        
        async def error_handler(error):
            nonlocal recovery_attempts
            recovery_attempts += 1
            metrics.websocket_recovery_attempts.labels(
                path='ws://test.com/ws/recovery'
            ).inc()
        
        ws = await client.websocket('ws://test.com/ws/recovery', recovery_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(connection_ids) == 2
        assert recovery_attempts == 1
        assert len(success_messages) == 1
        assert success_messages[0] == 'success'
        
        assert metrics.websocket_connections.labels(
            path='ws://test.com/ws/recovery',
            status='connected'
        )._value.get() == 2
        assert metrics.websocket_recovery_attempts.labels(
            path='ws://test.com/ws/recovery'
        )._value.get() == 1
        assert metrics.websocket_messages_received.labels(
            path='ws://test.com/ws/recovery'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_negotiation():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression", "encryption"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "compressed", "data": "eJzT0yMAAGTvBe8="}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        compressed_messages = []
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=msg['version']
                ).inc()
                for feature in msg['features']:
                    metrics.websocket_protocol_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                for feature in msg['selected']:
                    metrics.websocket_protocol_active_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'compressed':
                compressed_messages.append(msg['data'])
                metrics.websocket_compressed_messages.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        await asyncio.sleep(0.2)
        
        assert protocol_state['version'] == '1.0'
        assert 'compression' in protocol_state['features']
        assert 'compression' in protocol_state['selected']
        assert protocol_state['status'] == 'active'
        assert len(compressed_messages) == 1
        
        assert metrics.websocket_protocol_version.labels(
            path='ws://test.com/ws/protocol',
            version='1.0'
        )._value.get() == 1
        assert metrics.websocket_protocol_features.labels(
            path='ws://test.com/ws/protocol',
            feature='compression'
        )._value.get() == 1
        assert metrics.websocket_protocol_active_features.labels(
            path='ws://test.com/ws/protocol',
            feature='compression'
        )._value.get() == 1
        assert metrics.websocket_protocol_status.labels(
            path='ws://test.com/ws/protocol',
            status='active'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_error_handling():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "2.0", "features": ["unknown"]}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Protocol version not supported"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_errors = []
        protocol_state = {}
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                version = msg['version']
                if version != '1.0':
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='version_not_supported'
                    ).inc()
                    protocol_errors.append(f"Version {version} not supported")
                    return
                
                protocol_state['version'] = version
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=version
                ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def error_handler(error):
            protocol_errors.append(str(error))
            metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='protocol_error'
            ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(protocol_errors) == 2
        assert protocol_state['version'] == '1.0'
        assert protocol_state['status'] == 'active'
        
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='version_not_supported'
        )._value.get() == 1
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='protocol_error'
        )._value.get() == 1
        assert metrics.websocket_protocol_negotiation.labels(
            path='ws://test.com/ws/protocol',
            status='success'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_negotiation_advanced():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression", "encryption", "batching"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression", "batching"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_start", "size": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "compressed", "data": "eJzT0yMAAGTvBe8="}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "compressed", "data": "fJzT1yMAAGTvBf9="}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_end", "count": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression", "batching"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        batch_messages = []
        compressed_messages = []
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                for feature in msg['features']:
                    metrics.websocket_protocol_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                for feature in msg['selected']:
                    metrics.websocket_protocol_active_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'batch_start':
                batch_messages.append({'size': msg['size']})
                metrics.websocket_batch_started.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'compressed':
                compressed_messages.append(msg['data'])
                metrics.websocket_compressed_messages.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'batch_end':
                batch_messages[-1]['count'] = msg['count']
                metrics.websocket_batch_completed.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        await asyncio.sleep(0.2)
        
        assert len(protocol_state['features']) == 3
        assert len(protocol_state['selected']) == 2
        assert len(compressed_messages) == 2
        assert len(batch_messages) == 1
        assert batch_messages[0]['size'] == batch_messages[0]['count'] == 2
        
        assert metrics.websocket_protocol_features.labels(
            path='ws://test.com/ws/protocol',
            feature='compression'
        )._value.get() == 1
        assert metrics.websocket_protocol_active_features.labels(
            path='ws://test.com/ws/protocol',
            feature='batching'
        )._value.get() == 1
        assert metrics.websocket_batch_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_batch_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_compressed_messages.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2

@pytest.mark.asyncio
async def test_websocket_validation_protocol_negotiation_failure():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["unknown"]}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Feature negotiation failed"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "compressed", "data": "eJzT0yMAAGTvBe8="}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        negotiation_errors = []
        compressed_messages = []
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=msg['version']
                ).inc()
            elif msg_type == 'negotiate':
                selected = msg['selected']
                if not all(feature in protocol_state['features'] for feature in selected):
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='feature_not_supported'
                    ).inc()
                    negotiation_errors.append("Unsupported feature requested")
                    return
                
                protocol_state['selected'] = selected
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
            elif msg_type == 'compressed':
                compressed_messages.append(msg['data'])
                metrics.websocket_compressed_messages.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def error_handler(error):
            negotiation_errors.append(str(error))
            metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='negotiation_failed'
            ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(negotiation_errors) == 2
        assert len(compressed_messages) == 1
        assert protocol_state['status'] == 'active'
        assert protocol_state['selected'] == ['compression']
        
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='feature_not_supported'
        )._value.get() == 1
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='negotiation_failed'
        )._value.get() == 1
        assert metrics.websocket_protocol_negotiation.labels(
            path='ws://test.com/ws/protocol',
            status='success'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_batching_error():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["batching"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["batching"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_start", "size": 3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "value": 1}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "value": 2}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Batch incomplete"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_start", "size": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "value": 3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "data", "value": 4}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_end", "count": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["batching"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        batch_errors = []
        batch_messages = []
        current_batch = None
        
        async def protocol_handler(msg):
            nonlocal current_batch
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=msg['version']
                ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
            elif msg_type == 'batch_start':
                current_batch = {'size': msg['size'], 'messages': []}
                metrics.websocket_batch_started.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'data':
                if current_batch is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='batch_state_error'
                    ).inc()
                    batch_errors.append("Data received outside batch")
                    return
                
                current_batch['messages'].append(msg['value'])
            elif msg_type == 'batch_end':
                if current_batch is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='batch_state_error'
                    ).inc()
                    batch_errors.append("Batch end without start")
                    return
                
                if len(current_batch['messages']) != msg['count']:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='batch_count_mismatch'
                    ).inc()
                    batch_errors.append("Batch count mismatch")
                    return
                
                batch_messages.append(current_batch)
                current_batch = None
                metrics.websocket_batch_completed.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def error_handler(error):
            batch_errors.append(str(error))
            if current_batch is not None:
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='batch_incomplete'
                ).inc()
                current_batch = None
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(batch_errors) == 1
        assert len(batch_messages) == 1
        assert batch_messages[0]['size'] == 2
        assert len(batch_messages[0]['messages']) == 2
        assert protocol_state['status'] == 'active'
        
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='batch_incomplete'
        )._value.get() == 1
        assert metrics.websocket_batch_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
        assert metrics.websocket_batch_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_fragmentation():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["fragmentation"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["fragmentation"]}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"type": "fragment_start", "id": "msg1", "total": 3}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"part": 1, "data": "Hello"}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"part": 2, "data": " "}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"part": 3, "data": "World"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "fragment_end", "id": "msg1"}', extra=None),
        WSMessage(type=WSMsgType.CONTINUATION, data='{"type": "fragment_start", "id": "msg2", "total": 2}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Fragment incomplete"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["fragmentation"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        fragment_errors = []
        fragments = {}
        current_fragment = None
        
        async def protocol_handler(msg):
            nonlocal current_fragment
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=msg['version']
                ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
            elif msg_type == 'fragment_start':
                current_fragment = {
                    'id': msg['id'],
                    'total': msg['total'],
                    'parts': {},
                    'received': 0
                }
                metrics.websocket_fragment_started.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif 'part' in msg:
                if current_fragment is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_state_error'
                    ).inc()
                    fragment_errors.append("Fragment part received outside fragment")
                    return
                
                part_num = msg['part']
                current_fragment['parts'][part_num] = msg['data']
                current_fragment['received'] += 1
                
                metrics.websocket_fragment_parts.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'fragment_end':
                if current_fragment is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_state_error'
                    ).inc()
                    fragment_errors.append("Fragment end without start")
                    return
                
                if current_fragment['received'] != current_fragment['total']:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_incomplete'
                    ).inc()
                    fragment_errors.append("Fragment incomplete")
                    return
                
                fragments[current_fragment['id']] = ''.join(
                    current_fragment['parts'][i] 
                    for i in range(1, current_fragment['total'] + 1)
                )
                current_fragment = None
                metrics.websocket_fragment_completed.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def error_handler(error):
            fragment_errors.append(str(error))
            if current_fragment is not None:
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='fragment_error'
                ).inc()
                current_fragment = None
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(fragment_errors) == 1
        assert len(fragments) == 1
        assert fragments['msg1'] == 'Hello World'
        assert protocol_state['status'] == 'active'
        
        assert metrics.websocket_fragment_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
        assert metrics.websocket_fragment_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_fragment_parts.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 3
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='fragment_error'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_compression():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.BINARY, data=b'x\x9c\xf3H\xcd\xc9\xc9\x07\x00\x05\x8b\x01\xf5', extra=None),
        WSMessage(type=WSMsgType.BINARY, data=b'x\x9c\x0b\xcf\x2f\xca\x49\x01\x00\x08\x98\x02\x37', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Compression error"),
        WSMessage(type=WSMsgType.BINARY, data=b'x\x9c\xf3H\xcd\xc9\xc9\x07\x00\x05\x8b\x01\xf5', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        compression_errors = []
        compressed_messages = []
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                protocol_state['version'] = msg['version']
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=msg['version']
                ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def binary_handler(data):
            try:
                import zlib
                decompressed = zlib.decompress(data)
                compressed_messages.append(decompressed.decode())
                metrics.websocket_compressed_messages.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            except zlib.error:
                compression_errors.append("Compression error")
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='compression_error'
                ).inc()
        
        async def error_handler(error):
            compression_errors.append(str(error))
            metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='protocol_error'
            ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_binary_handler(binary_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(compression_errors) == 2
        assert len(compressed_messages) == 2
        assert compressed_messages[0] == 'Hello'
        assert compressed_messages[1] == 'Hello'
        assert protocol_state['status'] == 'active'
        
        assert metrics.websocket_compressed_messages.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='compression_error'
        )._value.get() == 1
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='protocol_error'
        )._value.get() == 1

@pytest.mark.asyncio
async def test_websocket_validation_protocol_version_negotiation():
    config = get_mock_network_config()
    client = HttpClient(config)
    metrics = NetworkMetrics()
    
    mock_ws = AsyncMock()
    mock_ws.receive = AsyncMock(side_effect=[
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching", "fragmentation", "encryption"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error", "code": "version_not_supported"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.5", "features": ["compression", "batching", "encryption"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "error", "code": "version_not_supported"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "protocol", "version": "1.0", "features": ["compression", "batching", "fragmentation"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "negotiate", "selected": ["compression", "batching"]}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_start", "size": 2}', extra=None),
        WSMessage(type=WSMsgType.BINARY, data=b'x\x9c\xf3H\xcd\xc9\xc9\x07\x00\x05\x8b\x01\xf5', extra=None),
        WSMessage(type=WSMsgType.BINARY, data=b'x\x9c\x0b\xcf\x2f\xca\x49\x01\x00\x08\x98\x02\x37', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "batch_end", "count": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "fragment_start", "id": "msg1", "total": 2}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"part": 1, "data": "Hello"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"part": 2, "data": "World"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "fragment_end", "id": "msg1"}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "fragment_start", "id": "msg2", "total": 3}', extra=None),
        WSMessage(type=WSMsgType.TEXT, data='{"part": 1, "data": "Multi"}', extra=None),
        WSMessage(type=WSMsgType.ERROR, data=None, extra="Fragment incomplete"),
        WSMessage(type=WSMsgType.TEXT, data='{"type": "status", "protocol": "active", "features": ["compression", "batching"]}', extra=None),
        WSMessage(type=WSMsgType.CLOSED, data=None, extra=None)
    ])
    mock_ws.closed = False
    mock_ws.close = AsyncMock()
    
    with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
        protocol_state = {}
        version_errors = []
        attempted_versions = []
        batch_messages = []
        compressed_messages = []
        fragments = {}
        current_fragment = None
        
        async def protocol_handler(msg):
            msg_type = msg['type']
            
            if msg_type == 'protocol':
                version = msg['version']
                attempted_versions.append(version)
                protocol_state['version'] = version
                protocol_state['features'] = msg['features']
                metrics.websocket_protocol_version.labels(
                    path='ws://test.com/ws/protocol',
                    version=version
                ).inc()
                for feature in msg['features']:
                    metrics.websocket_protocol_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'error':
                if msg['code'] == 'version_not_supported':
                    version_errors.append(f"Version {protocol_state['version']} not supported")
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='version_not_supported'
                    ).inc()
            elif msg_type == 'negotiate':
                protocol_state['selected'] = msg['selected']
                metrics.websocket_protocol_negotiation.labels(
                    path='ws://test.com/ws/protocol',
                    status='success'
                ).inc()
                for feature in msg['selected']:
                    metrics.websocket_protocol_active_features.labels(
                        path='ws://test.com/ws/protocol',
                        feature=feature
                    ).inc()
            elif msg_type == 'batch_start':
                batch_messages.append({'size': msg['size'], 'messages': []})
                metrics.websocket_batch_started.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'batch_end':
                if len(batch_messages[-1]['messages']) != msg['count']:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='batch_count_mismatch'
                    ).inc()
                    return
                metrics.websocket_batch_completed.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'fragment_start':
                current_fragment = {
                    'id': msg['id'],
                    'total': msg['total'],
                    'parts': {},
                    'received': 0
                }
                metrics.websocket_fragment_started.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif 'part' in msg:
                if current_fragment is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_state_error'
                    ).inc()
                    return
                
                part_num = msg['part']
                current_fragment['parts'][part_num] = msg['data']
                current_fragment['received'] += 1
                
                metrics.websocket_fragment_parts.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'fragment_end':
                if current_fragment is None:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_state_error'
                    ).inc()
                    return
                
                if current_fragment['received'] != current_fragment['total']:
                    metrics.websocket_protocol_errors.labels(
                        path='ws://test.com/ws/protocol',
                        error='fragment_incomplete'
                    ).inc()
                    return
                
                fragments[current_fragment['id']] = ''.join(
                    current_fragment['parts'][i] 
                    for i in range(1, current_fragment['total'] + 1)
                )
                current_fragment = None
                metrics.websocket_fragment_completed.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            elif msg_type == 'status':
                protocol_state['status'] = msg['protocol']
                metrics.websocket_protocol_status.labels(
                    path='ws://test.com/ws/protocol',
                    status=msg['protocol']
                ).inc()
        
        async def binary_handler(data):
            try:
                import zlib
                decompressed = zlib.decompress(data)
                compressed_messages.append(decompressed.decode())
                if batch_messages:
                    batch_messages[-1]['messages'].append(decompressed.decode())
                metrics.websocket_compressed_messages.labels(
                    path='ws://test.com/ws/protocol'
                ).inc()
            except zlib.error:
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='compression_error'
                ).inc()

        async def error_handler(error):
            if "Fragment incomplete" in str(error):
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='fragment_incomplete'
                ).inc()
            else:
                metrics.websocket_protocol_errors.labels(
                    path='ws://test.com/ws/protocol',
                    error='protocol_error'
                ).inc()
        
        ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
        ws.add_binary_handler(binary_handler)
        ws.add_error_handler(error_handler)
        await asyncio.sleep(0.2)
        
        assert len(version_errors) == 2
        assert len(attempted_versions) == 3
        assert attempted_versions == ['2.0', '1.5', '1.0']
        assert protocol_state['version'] == '1.0'
        assert protocol_state['status'] == 'active'
        assert len(compressed_messages) == 2
        assert len(batch_messages) == 1
        assert batch_messages[0]['size'] == 2
        assert len(batch_messages[0]['messages']) == 2
        assert len(fragments) == 1
        assert fragments['msg1'] == 'HelloWorld'
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='fragment_incomplete'
        )._value.get() == 1
        
        assert metrics.websocket_protocol_version.labels(
            path='ws://test.com/ws/protocol',
            version='2.0'
        )._value.get() == 1
        assert metrics.websocket_protocol_version.labels(
            path='ws://test.com/ws/protocol',
            version='1.5'
        )._value.get() == 1
        assert metrics.websocket_protocol_version.labels(
            path='ws://test.com/ws/protocol',
            version='1.0'
        )._value.get() == 1
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='version_not_supported'
        )._value.get() == 2
        assert metrics.websocket_protocol_negotiation.labels(
            path='ws://test.com/ws/protocol',
            status='success'
        )._value.get() == 1
        assert metrics.websocket_fragment_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
        assert metrics.websocket_fragment_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_fragment_parts.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 3
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='fragment_incomplete'
        )._value.get() == 2
        
        # Verify protocol feature support tracking
        assert metrics.websocket_protocol_features.labels(
            path='ws://test.com/ws/protocol',
            feature='encryption'
        )._value.get() == 2  # From 2.0 and 1.5 versions
        
        assert metrics.websocket_protocol_features.labels(
            path='ws://test.com/ws/protocol',
            feature='fragmentation'
        )._value.get() == 2  # From 2.0 and 1.0 versions
        
        # Verify active features after negotiation
        assert metrics.websocket_protocol_active_features.labels(
            path='ws://test.com/ws/protocol',
            feature='compression'
        )._value.get() == 1
        
        assert metrics.websocket_protocol_active_features.labels(
            path='ws://test.com/ws/protocol',
            feature='batching'
        )._value.get() == 1
        
        # Verify fragment handling metrics
        assert metrics.websocket_fragment_parts.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 3  # 2 parts from msg1, 1 part from incomplete msg2
        
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='fragment_state_error'
        )._value.get() == 0  # No fragment state errors occurred
        
        # Test encryption feature negotiation
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(return_value=WSMessage(
            type=WSMsgType.TEXT,
            data='{"type": "protocol", "version": "2.0", "features": ["encryption", "compression"]}',
            extra=None
        ))
        mock_ws.closed = False
        
        with patch('aiohttp.ClientSession.ws_connect', return_value=mock_ws):
            ws = await client.websocket('ws://test.com/ws/protocol', protocol_handler)
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_features.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption'
            )._value.get() == 3  # Initial 2 + new connection
            
            assert metrics.websocket_protocol_version.labels(
                path='ws://test.com/ws/protocol',
                version='2.0'
            )._value.get() == 2  # Initial + new connection
            
            assert protocol_state['version'] == '2.0'
            assert 'encryption' in protocol_state['features']
            
            # Test encryption feature activation
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"type": "negotiate", "selected": ["encryption", "compression"], "encryption_key": "test_key"}',
                extra=None
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_active_features.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption'
            )._value.get() == 1
            
            # Test encrypted message handling
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.BINARY,
                data=b'encrypted_data',
                extra=None
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_encrypted_messages.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 1
            
            # Test encryption error handling
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.ERROR,
                data=None,
                extra="Encryption error"
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='encryption_error'
            )._value.get() == 1
            
            # Test protocol version downgrade
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"type": "protocol", "version": "1.5", "features": ["compression"]}',
                extra=None
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_version.labels(
                path='ws://test.com/ws/protocol',
                version='1.5'
            )._value.get() == 2
            
            assert metrics.websocket_protocol_transitions.labels(
                path='ws://test.com/ws/protocol',
                from_version='2.0',
                to_version='1.5'
            )._value.get() == 1
            
            # Test protocol error recovery
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.ERROR,
                data=None,
                extra="Protocol version mismatch"
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='version_mismatch'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_recovery_attempts.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() >= 1
            
            # Test protocol feature validation
            mock_ws.receive = AsyncMock(return_value=WSMessage(
                type=WSMsgType.TEXT,
                data='{"type": "protocol", "version": "1.0", "features": ["unknown_feature"]}',
                extra=None
            ))
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_errors.labels(
                path='ws://test.com/ws/protocol',
                error='invalid_feature'
            )._value.get() == 1
            
            # Test protocol version fallback chain
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "error": "unsupported"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "1.5", "error": "unsupported"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "1.0", "features": ["compression"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_fallbacks.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 2  # Two fallbacks before success
            
            assert metrics.websocket_protocol_version.labels(
                path='ws://test.com/ws/protocol',
                version='1.0'
            )._value.get() == 2
            
            # Test protocol state after fallback
            assert protocol_state['version'] == '1.0'
            assert set(protocol_state['features']) == {'compression'}
            assert metrics.websocket_protocol_active_features.labels(
                path='ws://test.com/ws/protocol',
                feature='compression'
            )._value.get() == 1
            
            # Test protocol recovery with multiple handlers
            recovery_attempts = []
            async def recovery_handler(error):
                recovery_attempts.append(error)
                return True
            
            ws.add_error_handler(recovery_handler)
            
            # Test multiple protocol errors
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Protocol error 1"
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Protocol error 2"
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "1.0", "features": ["compression"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert len(recovery_attempts) == 2
            assert metrics.websocket_protocol_recovery_attempts.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() >= 2
            
            assert metrics.websocket_protocol_recovery_success.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() >= 1
            
            # Test protocol version negotiation with multiple features
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression", "batching"], "batch_size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "batch_start", "size": 3}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "message", "id": 1}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "message", "id": 2}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "message", "id": 3}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "batch_end", "count": 3}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_features.labels(
                path='ws://test.com/ws/protocol',
                feature='batching'
            )._value.get() >= 1
            
            assert metrics.websocket_batch_messages.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 3
            
            assert metrics.websocket_protocol_active_features.labels(
                path='ws://test.com/ws/protocol',
                feature='batching'
            )._value.get() == 1
            
            # Test protocol version negotiation with concurrent feature activation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression", "batching"], "batch_size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 9}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.BINARY,
                    data=b'compressed_data_1',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.BINARY,
                    data=b'compressed_data_2',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_activation.labels(
                path='ws://test.com/ws/protocol',
                feature='compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_activation.labels(
                path='ws://test.com/ws/protocol',
                feature='batching'
            )._value.get() == 1
            
            assert metrics.websocket_compressed_messages.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 2
            
            # Test protocol version negotiation with feature dependencies
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "dependencies": {"encryption": ["compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 9}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependencies.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                dependency='compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_activation_order.labels(
                path='ws://test.com/ws/protocol',
                first='compression',
                second='encryption'
            )._value.get() == 1
            
            # Test protocol version negotiation with error recovery chain
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "3.0", "features": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Version 3.0 not supported"
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression"], "level": 6}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_version_fallback.labels(
                path='ws://test.com/ws/protocol',
                from_version='3.0',
                to_version='2.0'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_negotiation_success.labels(
                path='ws://test.com/ws/protocol',
                version='2.0'
            )._value.get() == 1
            
            # Test protocol error handler chain
            error_chain = []
            
            async def error_handler_1(error):
                error_chain.append('handler1')
                raise Exception("Handler 1 failed")
            
            async def error_handler_2(error):
                error_chain.append('handler2')
                raise Exception("Handler 2 failed")
            
            async def error_handler_3(error):
                error_chain.append('handler3')
                return True
            
            ws.add_error_handler(error_handler_1)
            ws.add_error_handler(error_handler_2)
            ws.add_error_handler(error_handler_3)
            
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Test error chain"
                )
            ])
            await asyncio.sleep(0.1)
            
            assert error_chain == ['handler1', 'handler2', 'handler3']
            assert metrics.websocket_error_handler_chain.labels(
                path='ws://test.com/ws/protocol',
                handlers=3,
                recovered=True
            )._value.get() == 1
            
            # Test protocol version negotiation failure with multiple fallbacks
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "3.0", "features": ["compression", "encryption", "batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Version 3.0 not supported"
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Version 2.0 encryption not available"
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "1.0", "features": ["compression"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression"], "level": 6}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_version_fallback_chain.labels(
                path='ws://test.com/ws/protocol',
                versions='3.0,2.0,1.0'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_reduction.labels(
                path='ws://test.com/ws/protocol',
                initial_features=3,
                final_features=1
            )._value.get() == 1
            
            # Test protocol version negotiation with concurrent error handlers
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Concurrent handler test"
                )
            ])
            
            handler_results = []
            async def concurrent_handler_1(error):
                await asyncio.sleep(0.05)
                handler_results.append('handler1')
                return False
                
            async def concurrent_handler_2(error):
                await asyncio.sleep(0.02)
                handler_results.append('handler2')
                return False
                
            async def concurrent_handler_3(error):
                handler_results.append('handler3')
                return True
                
            ws.add_error_handler(concurrent_handler_1)
            ws.add_error_handler(concurrent_handler_2)
            ws.add_error_handler(concurrent_handler_3)
            
            await asyncio.sleep(0.1)
            
            assert handler_results == ['handler3', 'handler2', 'handler1']
            assert metrics.websocket_error_handler_concurrent.labels(
                path='ws://test.com/ws/protocol',
                handlers=3
            )._value.get() == 1
            
            # Test protocol version negotiation with feature activation timing
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "activation_order": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_ready", "features": ["compression", "encryption"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_activation_timing.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                order=1
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_activation_timing.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                order=2
            )._value.get() == 1
            
            # Test protocol version negotiation with feature deactivation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_deactivate", "feature": "encryption", "reason": "performance"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_deactivation.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                reason='performance'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_active_features.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature reactivation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_deactivate", "feature": "compression", "reason": "error"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 4}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_reactivation.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                previous_level=6,
                new_level=4
            )._value.get() == 1
            
            # Test protocol version negotiation with feature dependency chain
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "dependencies": {"batching": ["compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_deactivate", "feature": "compression", "reason": "error"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_deactivate", "feature": "batching", "reason": "dependency_lost"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_chain.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                dependency='compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_deactivation.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                dependency='compression'
            )._value.get() == 1
            
            # Test protocol version negotiation with circular dependency detection
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "dependencies": {"batching": ["compression"], "compression": ["encryption"], "encryption": ["batching"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Circular dependency detected"
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_error.labels(
                path='ws://test.com/ws/protocol',
                error_type='circular_dependency'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature version mismatch
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "feature_versions": {"compression": "2.1", "encryption": "1.0"}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_mismatch", "feature": "compression", "required": "2.1", "available": "2.0"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_version_mismatch.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                required_version='2.1',
                available_version='2.0'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_fallback.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                reason='version_mismatch'
            )._value.get() == 1
            
            # Test protocol version negotiation with partial feature support
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "partial_support": {"compression": ["level_6", "level_4"], "encryption": ["aes-256-gcm"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 4}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Feature not fully supported"
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_partial_support.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                supported_options='level_6,level_4'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_activation_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                error_type='not_fully_supported'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature priority
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "priorities": {"compression": 1, "encryption": 2, "batching": 3}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_priority.labels(
                path='ws://test.com/ws/protocol',
                feature='compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_priority.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption'
            )._value.get() == 2
            
            assert metrics.websocket_protocol_feature_priority.labels(
                path='ws://test.com/ws/protocol',
                feature='batching'
            )._value.get() == 3
            
            # Test protocol version negotiation with feature group activation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "feature_groups": {"high_performance": ["compression", "batching"], "security": ["encryption"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "group_activate", "group": "high_performance"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_group_activation.labels(
                path='ws://test.com/ws/protocol',
                group='high_performance',
                features='compression,batching'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_group_active_features.labels(
                path='ws://test.com/ws/protocol',
                group='high_performance'
            )._value.get() == 2
            
            # Test protocol version negotiation with feature conflict resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "conflicts": {"compression": ["encryption"], "batching": ["compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict", "feature": "compression", "conflicts_with": "encryption"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict", "feature": "batching", "conflicts_with": "compression"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_conflict.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                conflicts_with='encryption'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_conflict_resolution.labels(
                path='ws://test.com/ws/protocol',
                resolved_feature='encryption',
                blocked_feature='compression'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature rollback
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "rollback_support": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_error", "feature": "compression", "error": "resource_limit_exceeded"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_rollback", "feature": "compression", "reason": "resource_limit"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_rollback.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                reason='resource_limit'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                error_type='resource_limit_exceeded'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature transition states
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "transitions": {"compression": ["initializing", "configuring", "active"], "encryption": ["initializing", "key_exchange", "active"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "compression", "state": "initializing"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "compression", "state": "configuring"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "compression", "state": "active"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "encryption", "state": "initializing"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "encryption", "state": "key_exchange"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state", "feature": "encryption", "state": "active"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_state.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                state='active'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_state.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                state='active'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_transition_time.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='initializing',
                to_state='active'
            )._value.get() > 0
            
            # Test protocol version negotiation with feature dependency validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "dependencies": {"batching": ["compression"], "compression": ["encryption"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "encryption", "method": "aes-256-gcm"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "compression", "level": 6}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_activate", "feature": "batching", "size": 100}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_error", "feature": "batching", "missing": ["compression"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_validation.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                dependency='compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                missing_dependency='compression'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature version compatibility
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": {"compression": "1.1", "encryption": "2.0", "batching": "1.0"}, "min_versions": {"compression": "1.0", "encryption": "1.5", "batching": "1.0"}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_check", "feature": "compression", "version": "1.1", "compatible": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_check", "feature": "encryption", "version": "1.0", "compatible": false}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_error", "feature": "encryption", "required": "1.5", "available": "1.0"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_version_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                version='1.1',
                result='compatible'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_version_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                required_version='1.5',
                available_version='1.0'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature capability discovery
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "capabilities": {"compression": ["zlib", "gzip", "brotli"], "encryption": ["aes-256-gcm", "chacha20-poly1305"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "compression", "capability": "zlib", "supported": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "encryption", "capability": "aes-256-gcm", "supported": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_error", "feature": "compression", "capability": "brotli", "error": "not_implemented"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_capability_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                capability='zlib',
                result='supported'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_capability_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                capability='brotli',
                error='not_implemented'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature group activation order
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "groups": {"security": ["encryption"], "performance": ["compression", "batching"]}, "activation_order": ["security", "performance"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "group_activate", "group": "security", "features": ["encryption"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "group_activate", "group": "performance", "features": ["compression", "batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "group_error", "group": "performance", "error": "partial_activation", "activated": ["compression"], "failed": ["batching"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_group_activation.labels(
                path='ws://test.com/ws/protocol',
                group='security',
                result='success'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_group_error.labels(
                path='ws://test.com/ws/protocol',
                group='performance',
                error='partial_activation'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_group_feature_status.labels(
                path='ws://test.com/ws/protocol',
                group='performance',
                feature='compression',
                status='activated'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature fallback chains
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "fallbacks": {"compression": ["zlib", "gzip", "none"], "encryption": ["aes-256-gcm", "chacha20", "none"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback", "feature": "compression", "from": "zlib", "to": "gzip", "reason": "performance"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback", "feature": "encryption", "from": "aes-256-gcm", "to": "chacha20", "reason": "compatibility"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback_error", "feature": "compression", "from": "gzip", "to": "none", "error": "minimum_requirement_not_met"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_fallback.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_value='zlib',
                to_value='gzip',
                reason='performance'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_fallback_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                error='minimum_requirement_not_met'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature priority handling
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "priorities": {"compression": 1, "encryption": 2, "batching": 3}, "resource_limits": {"max_concurrent_features": 2}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "encryption", "priority": 2, "active": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "compression", "priority": 1, "active": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_error", "feature": "batching", "priority": 3, "reason": "resource_limit_exceeded"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_priority.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                priority='2'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_priority_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                reason='resource_limit_exceeded'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature dependency resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "dependencies": {"batching": ["compression"], "encryption": []}, "resolution_order": ["compression", "encryption", "batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "compression", "dependencies": [], "satisfied": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "batching", "dependencies": ["compression"], "satisfied": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_error", "feature": "batching", "missing": ["compression"], "error": "dependency_activation_failed"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_check.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                result='satisfied'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                error='dependency_activation_failed'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature state transitions
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "states": {"compression": "initializing", "encryption": "active"}, "transitions": {"compression": ["initializing", "configuring", "active"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "initializing", "to": "configuring", "timestamp": 1234567890}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "configuring", "to": "active", "timestamp": 1234567891}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_error", "feature": "encryption", "current": "active", "attempted": "reconfiguring", "error": "invalid_transition"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_state_transition.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='initializing',
                to_state='configuring'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_state_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                error='invalid_transition'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature conflict resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "conflicts": {"compression": ["encryption"], "batching": ["compression"]}, "resolution_priority": ["encryption", "compression", "batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_check", "feature": "compression", "conflicts": ["encryption"], "resolution": "disable_compression"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_check", "feature": "batching", "conflicts": ["compression"], "resolution": "disable_batching"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_error", "feature": "compression", "conflicts": ["encryption"], "error": "unresolvable_conflict"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_conflict_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                resolution='disable_compression'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_conflict_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                error='unresolvable_conflict'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature capability discovery
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "capabilities": {"compression": ["zlib", "gzip"], "encryption": ["aes-256-gcm", "chacha20"]}, "discovery_mode": "active"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "compression", "capability": "zlib", "available": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "encryption", "capability": "aes-256-gcm", "available": false}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_error", "feature": "encryption", "capability": "aes-256-gcm", "error": "unsupported_capability"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_capability_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                capability='zlib',
                result='available'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_capability_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                capability='aes-256-gcm',
                error='unsupported_capability'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature group activation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "groups": {"performance": ["compression"], "security": ["encryption"]}, "activation_order": ["security", "performance"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_activation", "group": "security", "features": ["encryption"], "status": "activated"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_activation", "group": "performance", "features": ["compression"], "status": "pending"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_error", "group": "performance", "features": ["compression"], "error": "activation_timeout"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_group_activation.labels(
                path='ws://test.com/ws/protocol',
                group='security',
                status='activated'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_group_error.labels(
                path='ws://test.com/ws/protocol',
                group='performance',
                error='activation_timeout'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature dependency resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "dependencies": {"batching": ["compression"], "compression": ["encryption"]}, "resolution_order": ["encryption", "compression", "batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "batching", "dependency": "compression", "status": "satisfied"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "compression", "dependency": "encryption", "status": "unsatisfied"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_error", "feature": "compression", "dependency": "encryption", "error": "dependency_unavailable"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_check.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                dependency='compression',
                status='satisfied'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                dependency='encryption',
                error='dependency_unavailable'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature version compatibility
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "versions": {"compression": ["1.0", "2.0"], "encryption": ["1.0"]}, "compatibility": {"compression": {"min": "1.0", "max": "2.0"}, "encryption": {"min": "1.0", "max": "1.0"}}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_check", "feature": "compression", "version": "2.0", "compatible": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_check", "feature": "encryption", "version": "2.0", "compatible": false}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_error", "feature": "encryption", "version": "2.0", "error": "version_incompatible"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_version_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                version='2.0',
                result='compatible'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_version_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                version='2.0',
                error='version_incompatible'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature fallback chain
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression"], "fallbacks": {"compression": ["zlib", "gzip", "none"]}, "current": {"compression": "zlib"}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback_check", "feature": "compression", "from": "zlib", "to": "gzip", "reason": "performance_degraded"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback_check", "feature": "compression", "from": "gzip", "to": "none", "reason": "resource_constraint"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_fallback_error", "feature": "compression", "current": "none", "error": "fallback_chain_exhausted"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_fallback_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='zlib',
                to_state='gzip',
                reason='performance_degraded'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_fallback_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                error='fallback_chain_exhausted'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature priority management
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "priorities": {"compression": 1, "encryption": 2, "batching": 3}, "resource_limits": {"max_active_features": 2}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "encryption", "priority": 2, "active": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "compression", "priority": 1, "active": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_error", "feature": "batching", "priority": 3, "error": "resource_limit_exceeded"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_priority_check.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                priority='2',
                result='active'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_priority_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                error='resource_limit_exceeded'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature capability discovery
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "capabilities": {"compression": ["zlib", "gzip"], "encryption": ["aes-256-gcm", "chacha20"]}, "required": {"compression": ["zlib"], "encryption": ["aes-256-gcm"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "compression", "capability": "zlib", "available": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "encryption", "capability": "aes-256-gcm", "available": false}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_error", "feature": "encryption", "capability": "aes-256-gcm", "error": "capability_unavailable"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_capability_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                capability='zlib',
                result='available'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_capability_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                capability='aes-256-gcm',
                error='capability_unavailable'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature state transitions
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression"], "states": {"compression": ["disabled", "initializing", "active", "error"]}, "current": {"compression": "disabled"}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "disabled", "to": "initializing", "reason": "activation_requested"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "initializing", "to": "active", "reason": "initialization_complete"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_error", "feature": "compression", "from": "active", "to": "error", "error": "internal_error"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_state_transition.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='disabled',
                to_state='initializing',
                reason='activation_requested'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_state_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='active',
                to_state='error',
                error='internal_error'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature conflict resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "conflicts": {"compression": ["encryption"], "encryption": ["compression"]}, "resolution": {"priority": ["encryption", "compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_check", "feature": "compression", "conflicts_with": "encryption", "resolution": "deactivate"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_resolution", "feature": "encryption", "status": "active", "deactivated": ["compression"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_error", "feature": "compression", "error": "conflict_unresolvable"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_conflict_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                conflicts_with='encryption',
                resolution='deactivate'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_conflict_error.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                error='conflict_unresolvable'
            )._value.get() == 1
            
            # Test protocol version negotiation with feature group activation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "groups": {"security": ["encryption", "authentication"], "performance": ["compression", "batching"]}, "dependencies": {"batching": ["compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_activation", "group": "security", "features": ["encryption", "authentication"], "status": "activating"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_activation", "group": "performance", "features": ["compression"], "status": "partial", "failed": ["batching"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_error", "group": "performance", "error": "dependency_failure", "details": {"feature": "batching", "missing": ["compression"]}}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_group_activation.labels(
                path='ws://test.com/ws/protocol',
                group='security',
                status='activating'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_group_error.labels(
                path='ws://test.com/ws/protocol',
                group='performance',
                error='dependency_failure'
            )._value.get() == 1
            
            # Test protocol version compatibility and feature capability discovery
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "capabilities": {"compression": ["zlib", "gzip"], "encryption": ["aes-256-gcm"]}, "required": {"compression": "zlib", "encryption": "aes-256-gcm"}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "compression", "capability": "zlib", "status": "available"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "encryption", "capability": "aes-256-gcm", "status": "unavailable"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_error", "feature": "encryption", "capability": "aes-256-gcm", "error": "unsupported_version"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_capability_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                capability='zlib',
                status='available'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_capability_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                capability='aes-256-gcm',
                error='unsupported_version'
            )._value.get() == 1
            
            # Test protocol version compatibility and feature priority management
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "priorities": {"compression": 1, "encryption": 2, "batching": 3}, "resource_limits": {"max_active_features": 2}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "compression", "priority": 1, "status": "active"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "encryption", "priority": 2, "status": "active"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_error", "feature": "batching", "priority": 3, "error": "resource_limit_exceeded"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_priority_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                priority='1',
                status='active'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_priority_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                priority='3',
                error='resource_limit_exceeded'
            )._value.get() == 1
            
            # Test protocol version compatibility and dependency validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching"], "dependencies": {"batching": ["compression", "encryption"]}, "versions": {"compression": ["1.0", "2.0"], "batching": ["1.0"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_check", "feature": "compression", "version": "2.0", "status": "compatible"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "batching", "missing": ["encryption"], "status": "incomplete"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_error", "feature": "batching", "version": "1.0", "error": "dependency_missing"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_version_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                version='2.0',
                status='compatible'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_version_error.labels(
                path='ws://test.com/ws/protocol',
                feature='batching',
                version='1.0',
                error='dependency_missing'
            )._value.get() == 1
            
            # Test protocol version compatibility and dependency chain validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching", "encryption"], "dependency_chain": {"compression": [], "batching": ["compression"], "encryption": ["compression", "batching"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_chain_check", "feature": "encryption", "chain": ["compression", "batching"], "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_chain_check", "feature": "batching", "chain": ["compression"], "status": "invalid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_chain_error", "feature": "encryption", "chain": ["compression", "batching"], "error": "chain_broken"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_chain_check.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                chain_length='2',
                status='valid'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_chain_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                chain_length='2',
                error='chain_broken'
            )._value.get() == 1
            
            # Test protocol feature state transitions and validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "states": {"compression": "inactive", "encryption": "inactive"}, "transitions": {"compression": ["inactive", "activating", "active"], "encryption": ["inactive", "activating", "active"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "inactive", "to": "activating", "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_transition", "feature": "compression", "from": "activating", "to": "active", "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_error", "feature": "encryption", "from": "inactive", "to": "active", "error": "invalid_transition"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_state_transition.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                from_state='inactive',
                to_state='activating',
                status='valid'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_state_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                from_state='inactive',
                to_state='active',
                error='invalid_transition'
            )._value.get() == 1
            
            # Test protocol feature state validation and conflict resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "states": {"compression": "active", "encryption": "inactive"}, "conflicts": {"compression": ["encryption"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_state_validation", "feature": "compression", "state": "active", "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_check", "feature": "encryption", "conflicts": ["compression"], "status": "conflict_detected"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_conflict_resolution", "feature": "encryption", "resolution": "deactivate_conflicting", "status": "resolved"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_state_validation.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                state='active',
                status='valid'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_conflict_resolution.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                resolution='deactivate_conflicting',
                status='resolved'
            )._value.get() == 1
            
            # Test protocol version compatibility and resource management
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "resources": {"memory": 1024, "cpu": 2}, "feature_resources": {"compression": {"memory": 256, "cpu": 1}, "encryption": {"memory": 512, "cpu": 1}}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_resource_check", "feature": "compression", "resources": {"memory": 256, "cpu": 1}, "status": "available"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_resource_check", "feature": "encryption", "resources": {"memory": 512, "cpu": 1}, "status": "insufficient"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_resource_error", "feature": "encryption", "resource": "memory", "required": 512, "available": 256, "error": "insufficient_memory"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_resource_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                status='available'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_resource_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                resource='memory',
                error='insufficient_memory'
            )._value.get() == 1
            
            # Test protocol feature capability discovery and version compatibility
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "capabilities": {"compression": {"versions": ["1.0", "2.0"], "modes": ["fast", "best"]}, "encryption": {"versions": ["1.0"], "modes": ["aes256"]}}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_check", "feature": "compression", "version": "2.0", "mode": "fast", "status": "supported"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_version_compatibility", "feature": "encryption", "client_version": "2.0", "server_version": "1.0", "status": "incompatible"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_capability_error", "feature": "encryption", "version": "2.0", "error": "version_mismatch"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_capability_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                version='2.0',
                mode='fast',
                status='supported'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_capability_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                version='2.0',
                error='version_mismatch'
            )._value.get() == 1
            
            # Test protocol feature group activation and validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "groups": {"basic": ["compression"], "advanced": ["encryption", "compression"]}, "group_dependencies": {"advanced": ["basic"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_activation", "group": "basic", "features": ["compression"], "status": "activated"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_validation", "group": "advanced", "missing_dependencies": ["basic"], "status": "invalid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_group_error", "group": "advanced", "error": "missing_dependencies", "details": {"missing": ["basic"]}}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_group_activation.labels(
                path='ws://test.com/ws/protocol',
                group='basic',
                feature_count='1',
                status='activated'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_group_error.labels(
                path='ws://test.com/ws/protocol',
                group='advanced',
                error='missing_dependencies'
            )._value.get() == 1
            
            # Test protocol feature priority management and validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "priorities": {"compression": 1, "encryption": 2}, "resource_limits": {"max_active_features": 1}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_check", "feature": "compression", "priority": 1, "status": "allowed"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_validation", "feature": "encryption", "priority": 2, "status": "blocked", "reason": "resource_limit"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_priority_error", "feature": "encryption", "priority": 2, "error": "exceeds_resource_limit"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_priority_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                priority='1',
                status='allowed'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_priority_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                priority='2',
                error='exceeds_resource_limit'
            )._value.get() == 1
            
            # Test protocol feature dependency validation and resolution
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "fragmentation"], "dependencies": {"encryption": ["compression"], "fragmentation": ["compression", "encryption"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_check", "feature": "compression", "dependencies": [], "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_validation", "feature": "fragmentation", "missing": ["compression", "encryption"], "status": "invalid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_dependency_error", "feature": "fragmentation", "error": "missing_dependencies", "details": {"missing": ["compression", "encryption"]}}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_dependency_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                status='valid'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_dependency_error.labels(
                path='ws://test.com/ws/protocol',
                feature='fragmentation',
                error='missing_dependencies'
            )._value.get() == 1
            
            # Test protocol feature activation sequence validation
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption"], "activation_sequence": {"compression": 1, "encryption": 2}, "sequence_constraints": {"encryption": ["compression"]}}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_sequence_check", "feature": "compression", "sequence": 1, "status": "valid"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_sequence_validation", "feature": "encryption", "sequence": 2, "status": "invalid", "reason": "dependency_not_activated"}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_sequence_error", "feature": "encryption", "sequence": 2, "error": "invalid_activation_order"}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_feature_sequence_check.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                sequence='1',
                status='valid'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_sequence_error.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption',
                sequence='2',
                error='invalid_activation_order'
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            )._value.get() == 1
            
            # Test protocol version negotiation with partial feature support
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "encryption", "batching"], "partial_support": true}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "feature_support", "compression": true, "encryption": "partial", "batching": false}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression"], "partial": ["encryption"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_partial_feature_support.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_feature_availability.labels(
                path='ws://test.com/ws/protocol',
                feature='compression',
                status='full'
            )._value.get() == 1
            )._value.get() == 1
            
            # Test protocol version negotiation with partial feature support
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "2.0", "features": ["compression", "batching", "encryption", "fragmentation"]}',
                    extra=None
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "negotiate", "selected": ["compression", "batching"], "unsupported": ["encryption", "fragmentation"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_unsupported_features.labels(
                path='ws://test.com/ws/protocol',
                feature='encryption'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_unsupported_features.labels(
                path='ws://test.com/ws/protocol',
                feature='fragmentation'
            )._value.get() == 1
            
            # Test protocol version negotiation failure recovery
            mock_ws.receive = AsyncMock(side_effect=[
                WSMessage(
                    type=WSMsgType.ERROR,
                    data=None,
                    extra="Protocol negotiation failed"
                ),
                WSMessage(
                    type=WSMsgType.TEXT,
                    data='{"type": "protocol", "version": "1.0", "features": ["compression"]}',
                    extra=None
                )
            ])
            await asyncio.sleep(0.1)
            
            assert metrics.websocket_protocol_negotiation_failures.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() == 1
            
            assert metrics.websocket_protocol_recovery_success.labels(
                path='ws://test.com/ws/protocol'
            )._value.get() >= 1
        
        # Verify compression metrics
        assert metrics.websocket_compressed_messages.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
        
        # Verify batch processing metrics
        assert metrics.websocket_batch_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        
        assert metrics.websocket_batch_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        
        # Verify protocol negotiation sequence
        assert protocol_state['version'] == '1.0'
        assert set(protocol_state['selected']) == {'compression', 'batching'}
        assert 'encryption' not in protocol_state['selected']
        
        # Verify error handling metrics
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='version_not_supported'
        )._value.get() == 2
        
        # Verify fragment handling
        assert fragments['msg1'] == 'HelloWorld'
        assert 'msg2' not in fragments  # Incomplete fragment should not be stored
        
        # Verify error handler was called for incomplete fragment
        assert metrics.websocket_protocol_errors.labels(
            path='ws://test.com/ws/protocol',
            error='fragment_incomplete'
        )._value.get() == 2  # One from direct error, one from error handler
        assert metrics.websocket_protocol_features.labels(
            path='ws://test.com/ws/protocol',
            feature='compression'
        )._value.get() == 3
        assert metrics.websocket_protocol_active_features.labels(
            path='ws://test.com/ws/protocol',
            feature='batching'
        )._value.get() == 1
        assert metrics.websocket_batch_started.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_batch_completed.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 1
        assert metrics.websocket_compressed_messages.labels(
            path='ws://test.com/ws/protocol'
        )._value.get() == 2
