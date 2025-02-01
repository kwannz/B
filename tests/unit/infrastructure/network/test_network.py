"""
Unit tests for network optimizations.
"""

import pytest
import asyncio
import json
import ssl
from typing import Dict, Any
from unittest.mock import AsyncMock, MagicMock
from tradingbot.core.network import (
    NetworkConfig,
    HttpClient,
    WebSocketManager,
    NetworkMetrics,
    init_network,
)


@pytest.fixture
def network_config():
    """Network configuration fixture."""
    return NetworkConfig(
        base_url="https://api.example.com",
        timeout=30,
        max_retries=3,
        pool_size=100,
        rate_limit=100,
        ssl_verify=True,
    )


@pytest.fixture
async def http_client(network_config):
    """HTTP client fixture."""
    client = await init_network(network_config)
    async with client:
        yield client


@pytest.mark.asyncio
async def test_http_client_request(http_client, mocker):
    """Test HTTP client request functionality."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = AsyncMock(return_value={"status": "success"})

    mock_session = MagicMock()
    mock_session.request = AsyncMock(return_value=mock_response)
    http_client.session = mock_session

    # Test successful request
    result = await http_client.request("GET", "/test")
    assert result == {"status": "success"}

    # Verify rate limiting
    assert http_client.rate_limiter.tokens < http_client.rate_limiter.rate_limit


@pytest.mark.asyncio
async def test_http_client_retry(http_client, mocker):
    """Test HTTP client retry mechanism."""
    fail_count = 0

    async def mock_request(*args, **kwargs):
        nonlocal fail_count
        if fail_count < 2:
            fail_count += 1
            raise Exception("Temporary failure")
        return MagicMock(
            raise_for_status=MagicMock(),
            json=AsyncMock(return_value={"status": "success"}),
        )

    mock_session = MagicMock()
    mock_session.request = mock_request
    http_client.session = mock_session

    # Should succeed after retries
    result = await http_client.request("GET", "/test")
    assert result == {"status": "success"}
    assert fail_count == 2


@pytest.mark.asyncio
async def test_websocket_manager():
    """Test WebSocket manager functionality."""
    ws_manager = WebSocketManager("ws://localhost:8080/ws")

    # Mock WebSocket connection
    mock_ws = MagicMock()
    mock_ws.connect = AsyncMock()
    mock_ws.send = AsyncMock()
    mock_ws.recv = AsyncMock(return_value='{"type": "test"}')
    mock_ws.close = AsyncMock()
    mock_ws.ping = AsyncMock()

    mocker.patch("websockets.connect", return_value=mock_ws)

    # Test connection
    await ws_manager.connect()
    assert ws_manager.ws is not None

    # Test message sending
    await ws_manager.send({"type": "test"})
    mock_ws.send.assert_called_once_with('{"type": "test"}')

    # Test message handling
    message_received = False

    async def message_handler(data):
        nonlocal message_received
        assert data == {"type": "test"}
        message_received = True

    ws_manager.add_message_handler(message_handler)
    await ws_manager._handle_message('{"type": "test"}')
    assert message_received

    # Test disconnection
    await ws_manager.disconnect()
    mock_ws.close.assert_called_once()


@pytest.mark.asyncio
async def test_websocket_reconnection():
    """Test WebSocket reconnection mechanism."""
    ws_manager = WebSocketManager(
        "ws://localhost:8080/ws", reconnect_interval=0.1, max_reconnects=2
    )

    connect_count = 0

    async def mock_connect():
        nonlocal connect_count
        connect_count += 1
        if connect_count < 2:
            raise Exception("Connection failed")
        return MagicMock(send=AsyncMock(), close=AsyncMock())

    mocker.patch("websockets.connect", side_effect=mock_connect)

    # Should succeed after retry
    await ws_manager.connect()
    assert connect_count == 2
    assert ws_manager.ws is not None


@pytest.mark.asyncio
async def test_network_metrics():
    """Test network metrics collection."""
    metrics = NetworkMetrics()

    # Record some metrics
    await metrics.record_request(0.1, 1000, 2000)
    await metrics.record_request(0.2, 1500, 2500)
    await metrics.record_error()

    # Test average request time
    avg_time = metrics.get_average_request_time()
    assert avg_time == 0.15  # (0.1 + 0.2) / 2

    # Test error rate
    error_rate = metrics.get_error_rate()
    assert error_rate == 1 / 3  # 1 error out of 3 total requests

    # Test throughput
    throughput = metrics.get_throughput()
    assert throughput["sent"] == 2500 / 0.3  # Total bytes / total time
    assert throughput["received"] == 4500 / 0.3


@pytest.mark.asyncio
async def test_ssl_verification(network_config):
    """Test SSL verification configuration."""
    # Test with SSL verification enabled
    client = HttpClient(network_config)
    assert client.ssl_context is not None
    assert isinstance(client.ssl_context, ssl.SSLContext)

    # Test with SSL verification disabled
    network_config.ssl_verify = False
    client = HttpClient(network_config)
    assert client.ssl_context is None


@pytest.mark.asyncio
async def test_rate_limiting(http_client):
    """Test rate limiting functionality."""
    start_time = asyncio.get_event_loop().time()

    # Make requests at rate limit
    tasks = []
    for _ in range(10):
        tasks.append(http_client.rate_limiter.acquire())

    await asyncio.gather(*tasks)
    duration = asyncio.get_event_loop().time() - start_time

    # Should have been rate limited
    assert duration >= 0.1  # At least 100ms for 10 requests at 100/s


@pytest.mark.asyncio
async def test_cached_request(http_client, mocker):
    """Test cached request functionality."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = AsyncMock(return_value={"data": "test"})

    mock_session = MagicMock()
    mock_session.request = AsyncMock(return_value=mock_response)
    http_client.session = mock_session

    # First request should hit API
    result1 = await http_client.cached_get("/test")
    assert result1 == {"data": "test"}
    assert mock_session.request.call_count == 1

    # Second request should hit cache
    result2 = await http_client.cached_get("/test")
    assert result2 == {"data": "test"}
    assert mock_session.request.call_count == 1


@pytest.mark.asyncio
async def test_concurrent_requests(http_client, mocker):
    """Test concurrent request handling."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json = AsyncMock(return_value={"status": "success"})

    mock_session = MagicMock()
    mock_session.request = AsyncMock(return_value=mock_response)
    http_client.session = mock_session

    # Make concurrent requests
    tasks = []
    for i in range(10):
        tasks.append(http_client.request("GET", f"/test/{i}"))

    results = await asyncio.gather(*tasks)
    assert len(results) == 10
    assert all(r["status"] == "success" for r in results)
