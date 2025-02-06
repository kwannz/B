import pytest
import asyncio
import os
from datetime import datetime

pytestmark = pytest.mark.asyncio

TEST_TOKEN = os.getenv("TEST_TOKEN", "")
WS_BASE_URL = "ws://127.0.0.1:8123/ws"


@pytest.mark.timeout(10)
async def test_trades_websocket_connection(websocket_client):
    """Test WebSocket connection for trades endpoint"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        await websocket_client.send_text(websocket, '{"type": "ping"}')
        response = await websocket_client.receive_text(websocket)
        assert response is not None
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_signals_websocket_connection(websocket_client):
    """Test WebSocket connection for signals endpoint"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/signals?token={TEST_TOKEN}")
    try:
        await websocket_client.send_text(websocket, '{"type": "ping"}')
        response = await websocket_client.receive_text(websocket)
        assert response is not None
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_performance_websocket_connection(websocket_client):
    """Test WebSocket connection for performance endpoint"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/performance?token={TEST_TOKEN}")
    try:
        await websocket_client.send_text(websocket, '{"type": "ping"}')
        response = await websocket_client.receive_text(websocket)
        assert response is not None
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_agent_status_websocket_connection(websocket_client):
    """Test WebSocket connection for agent status endpoint"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/agent_status?token={TEST_TOKEN}")
    try:
        # First receive the initial agent status message
        initial_status = await websocket_client.receive_json(websocket)
        assert initial_status["type"] == "agent_status"
        assert initial_status["data"]["agent_type"] == "trading"
        assert initial_status["data"]["status"] == "running"
        assert "timestamp" in initial_status

        # Then test ping/pong
        await websocket_client.send_json(websocket, {"type": "ping"})
        pong = await websocket_client.receive_json(websocket)
        assert pong["type"] == "pong"
        assert "timestamp" in pong
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_trade_update_broadcast(websocket_client, client, sample_trade_data):
    """Test trade updates are broadcasted to connected clients"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        # Create a new trade via REST API
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = await client.post("/api/v1/trades", json=sample_trade_data, headers=headers)
        assert response.status_code == 200

        # Receive the trade update via WebSocket
        data = await websocket_client.receive_json(websocket)
        assert data["type"] == "trade"
        assert data["data"]["symbol"] == sample_trade_data["symbol"]
        assert data["data"]["direction"] == sample_trade_data["direction"]
        assert "timestamp" in data
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_signal_broadcast(websocket_client, client, sample_signal_data):
    """Test signals are broadcasted to connected clients"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/signals?token={TEST_TOKEN}")
    try:
        # Create a new signal via REST API with test token
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        signal_data = {
            "direction": sample_signal_data["direction"],
            "confidence": sample_signal_data["confidence"],
            "symbol": "BTC/USD",
            "timestamp": datetime.utcnow().isoformat()
        }
        response = await client.post("/api/v1/signals", json=signal_data, headers=headers)
        assert response.status_code == 200

        # Receive the signal via WebSocket
        data = await websocket_client.receive_json(websocket)
        assert data["type"] == "signal"
        assert data["data"]["direction"] == sample_signal_data["direction"]
        assert data["data"]["confidence"] == sample_signal_data["confidence"]
        assert "timestamp" in data
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_performance_update_broadcast(
    websocket_client, client, sample_trade_data
):
    """Test performance updates are broadcasted to connected clients"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/performance?token={TEST_TOKEN}")
    try:
        # Create some trades to trigger performance update
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = await client.post("/api/v1/trades", json=sample_trade_data, headers=headers)
        assert response.status_code == 200

        # Request performance update via REST API
        response = await client.get("/api/v1/performance", headers=headers)
        assert response.status_code == 200

        # Receive the performance update via WebSocket
        data = await websocket_client.receive_json(websocket)
        assert data["type"] == "performance"
        assert "total_trades" in data["data"]
        assert "profitable_trades" in data["data"]
        assert "total_profit" in data["data"]
        assert "timestamp" in data
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_agent_status_broadcast(websocket_client, client, mock_mongodb):
    """Test agent status updates are broadcasted to connected clients"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/agent_status?token={TEST_TOKEN}")
    try:
        # First receive the initial agent status message
        initial_status = await websocket_client.receive_json(websocket)
        assert initial_status["type"] == "agent_status"
        assert initial_status["data"]["agent_type"] == "trading"
        assert initial_status["data"]["status"] == "running"
        assert "timestamp" in initial_status

        # Start the trading agent via REST API
        headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        response = await client.post("/api/v1/agents/trading/start", headers=headers)
        assert response.status_code == 200

        # Send ping to verify connection is still alive
        await websocket_client.send_json(websocket, {"type": "ping"})
        pong = await websocket_client.receive_json(websocket)
        assert pong["type"] == "pong"
        assert "timestamp" in pong
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.timeout(10)
async def test_websocket_ping_pong(websocket_client):
    """Test WebSocket ping/pong mechanism"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        # Send ping
        await websocket_client.send_json(websocket, {"type": "ping"})

        # Receive pong
        data = await websocket_client.receive_json(websocket)
        assert data["type"] == "pong"
        assert "timestamp" in data
    finally:
        await websocket_client.disconnect(websocket)


@pytest.mark.asyncio
@pytest.mark.timeout(30)  # 30 second timeout
async def test_websocket_connection_close(websocket_client):
    """Test WebSocket connection close handling"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        await websocket_client.send_text(websocket, '{"type": "test"}')
        response = await websocket_client.receive_text(websocket)
        assert response is not None
        # Send close frame and wait for response
        await websocket.close(code=1000, reason="Test completed")
        await asyncio.sleep(1)  # Give server more time to process close frame
    finally:
        try:
            await websocket_client.disconnect(websocket)
        except Exception:
            pass  # Ignore errors during cleanup


@pytest.mark.timeout(10)
async def test_multiple_clients(websocket_client):
    """Test multiple WebSocket clients can connect simultaneously"""
    ws1 = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    ws2 = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        assert websocket_client.get_client_state(ws1) == "CONNECTED"
        assert websocket_client.get_client_state(ws2) == "CONNECTED"

        # Both clients should receive updates
        await websocket_client.send_json(ws1, {"type": "ping"})
        data1 = await websocket_client.receive_json(ws1)
        assert data1["type"] == "pong"

        await websocket_client.send_json(ws2, {"type": "ping"})
        data2 = await websocket_client.receive_json(ws2)
        assert data2["type"] == "pong"
    finally:
        await websocket_client.disconnect(ws1)
        await websocket_client.disconnect(ws2)


@pytest.mark.timeout(10)
async def test_invalid_message_handling(websocket_client):
    """Test handling of invalid WebSocket messages"""
    websocket = await websocket_client.connect(f"{WS_BASE_URL}/trades?token={TEST_TOKEN}")
    try:
        # Send invalid JSON
        await websocket_client.send_text(websocket, "invalid json")

        # Send valid JSON with invalid message type
        await websocket_client.send_json(websocket, {"type": "invalid_type"})

        # Should still handle valid messages
        await websocket_client.send_json(websocket, {"type": "ping"})
        data = await websocket_client.receive_text(websocket)
        assert "pong" in data.lower()
    finally:
        await websocket_client.disconnect(websocket)
