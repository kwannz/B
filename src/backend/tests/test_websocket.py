import pytest
from datetime import datetime

pytestmark = pytest.mark.asyncio


async def test_trades_websocket_connection(websocket_client):
    """Test WebSocket connection for trades endpoint"""
    async with websocket_client.connect("/ws/trades") as websocket:
        assert websocket.client.application_state == 3  # Connected


async def test_signals_websocket_connection(websocket_client):
    """Test WebSocket connection for signals endpoint"""
    async with websocket_client.connect("/ws/signals") as websocket:
        assert websocket.client.application_state == 3  # Connected


async def test_performance_websocket_connection(websocket_client):
    """Test WebSocket connection for performance endpoint"""
    async with websocket_client.connect("/ws/performance") as websocket:
        assert websocket.client.application_state == 3  # Connected


async def test_agent_status_websocket_connection(websocket_client):
    """Test WebSocket connection for agent status endpoint"""
    async with websocket_client.connect("/ws/agent_status") as websocket:
        assert websocket.client.application_state == 3  # Connected


async def test_trade_update_broadcast(websocket_client, client, sample_trade_data):
    """Test trade updates are broadcasted to connected clients"""
    async with websocket_client.connect("/ws/trades") as websocket:
        # Create a new trade via REST API
        response = client.post("/api/v1/trades", json=sample_trade_data)
        assert response.status_code == 200

        # Receive the trade update via WebSocket
        data = await websocket.receive_json()
        assert data["type"] == "trade_update"
        assert data["data"]["symbol"] == sample_trade_data["symbol"]
        assert data["data"]["direction"] == sample_trade_data["direction"]
        assert "timestamp" in data


async def test_signal_broadcast(websocket_client, client, sample_signal_data):
    """Test signals are broadcasted to connected clients"""
    async with websocket_client.connect("/ws/signals") as websocket:
        # Create a new signal via REST API
        response = client.post("/api/v1/signals", json=sample_signal_data)
        assert response.status_code == 200

        # Receive the signal via WebSocket
        data = await websocket.receive_json()
        assert data["type"] == "new_signal"
        assert data["data"]["direction"] == sample_signal_data["direction"]
        assert data["data"]["confidence"] == sample_signal_data["confidence"]
        assert "timestamp" in data


async def test_performance_update_broadcast(
    websocket_client, client, sample_trade_data
):
    """Test performance updates are broadcasted to connected clients"""
    async with websocket_client.connect("/ws/performance") as websocket:
        # Create some trades to trigger performance update
        response = client.post("/api/v1/trades", json=sample_trade_data)
        assert response.status_code == 200

        # Request performance update via REST API
        response = client.get("/api/v1/performance")
        assert response.status_code == 200

        # Receive the performance update via WebSocket
        data = await websocket.receive_json()
        assert data["type"] == "performance_update"
        assert "total_trades" in data["data"]
        assert "profitable_trades" in data["data"]
        assert "total_profit" in data["data"]
        assert "timestamp" in data


async def test_agent_status_broadcast(websocket_client, client):
    """Test agent status updates are broadcasted to connected clients"""
    async with websocket_client.connect("/ws/agent_status") as websocket:
        # Start the trading agent via REST API
        response = client.post("/api/v1/agents/trading/start")
        assert response.status_code == 200

        # Receive the agent status update via WebSocket
        data = await websocket.receive_json()
        assert data["type"] == "agent_status"
        assert data["data"]["agent_type"] == "trading"
        assert data["data"]["status"] == "running"
        assert "timestamp" in data


async def test_websocket_ping_pong(websocket_client):
    """Test WebSocket ping/pong mechanism"""
    async with websocket_client.connect("/ws/trades") as websocket:
        # Send ping
        await websocket.send_json({"type": "ping"})

        # Receive pong
        data = await websocket.receive_json()
        assert data["type"] == "pong"
        assert "timestamp" in data


async def test_websocket_connection_close(websocket_client):
    """Test WebSocket connection close handling"""
    websocket = await websocket_client.connect("/ws/trades")
    assert websocket.client.application_state == 3  # Connected

    await websocket.close()
    assert websocket.client.application_state == 4  # Closed


async def test_multiple_clients(websocket_client):
    """Test multiple WebSocket clients can connect simultaneously"""
    async with websocket_client.connect("/ws/trades") as ws1:
        async with websocket_client.connect("/ws/trades") as ws2:
            assert ws1.client.application_state == 3  # Connected
            assert ws2.client.application_state == 3  # Connected

            # Both clients should receive updates
            await ws1.send_json({"type": "ping"})
            data1 = await ws1.receive_json()
            assert data1["type"] == "pong"

            await ws2.send_json({"type": "ping"})
            data2 = await ws2.receive_json()
            assert data2["type"] == "pong"


async def test_invalid_message_handling(websocket_client):
    """Test handling of invalid WebSocket messages"""
    async with websocket_client.connect("/ws/trades") as websocket:
        # Send invalid JSON
        await websocket.send_text("invalid json")

        # Send valid JSON with invalid message type
        await websocket.send_json({"type": "invalid_type"})

        # Connection should remain open
        assert websocket.client.application_state == 3  # Connected

        # Should still handle valid messages
        await websocket.send_json({"type": "ping"})
        data = await websocket.receive_json()
        assert data["type"] == "pong"
