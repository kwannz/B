import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import json
import asyncio
from src.api.main import app
from src.api.websocket import manager, broadcast_trade_update, broadcast_position_update, broadcast_metrics_update

client = TestClient(app)

def test_websocket_connection():
    with client.websocket_connect("/ws/trades") as websocket:
        # Connection should be established
        pass

def test_websocket_disconnection():
    with client.websocket_connect("/ws/trades") as websocket:
        # Connection should be closed automatically after the with block
        pass
    # Verify the connection is removed from the manager
    assert len(manager.active_connections["trades"]) == 0

def test_websocket_multiple_channels():
    with client.websocket_connect("/ws/trades") as trades_ws, \
         client.websocket_connect("/ws/positions") as positions_ws, \
         client.websocket_connect("/ws/metrics") as metrics_ws:
        # All connections should be established
        pass

def test_websocket_invalid_channel():
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/invalid"):
            pass

@pytest.mark.asyncio
async def test_broadcast_trade():
    trade_data = {
        "symbol": "BTC/USD",
        "price": 50000.0,
        "quantity": 1.0,
        "side": "buy"
    }
    
    with client.websocket_connect("/ws/trades") as websocket:
        await broadcast_trade_update(trade_data)
        data = websocket.receive_json()
        assert data["type"] == "trade"
        assert data["data"] == trade_data
        assert "timestamp" in data

@pytest.mark.asyncio
async def test_broadcast_position():
    position_data = {
        "symbol": "BTC/USD",
        "quantity": 1.0,
        "entry_price": 50000.0,
        "current_price": 51000.0,
        "pnl": 1000.0
    }
    
    with client.websocket_connect("/ws/positions") as websocket:
        await broadcast_position_update(position_data)
        data = websocket.receive_json()
        assert data["type"] == "position"
        assert data["data"] == position_data
        assert "timestamp" in data

@pytest.mark.asyncio
async def test_broadcast_metrics():
    metrics_data = {
        "active_strategies": 5,
        "total_positions": 10,
        "total_pnl": 15000.0,
        "win_rate": 0.65
    }
    
    with client.websocket_connect("/ws/metrics") as websocket:
        await broadcast_metrics_update(metrics_data)
        data = websocket.receive_json()
        assert data["type"] == "metrics"
        assert data["data"] == metrics_data
        assert "timestamp" in data

@pytest.mark.asyncio
async def test_multiple_clients():
    message = {"test": "message"}
    clients = []
    
    # Connect multiple clients
    for _ in range(3):
        client = client.websocket_connect("/ws/trades")
        clients.append(client)
    
    try:
        # Broadcast message
        await broadcast_trade_update(message)
        
        # Verify all clients received the message
        for ws in clients:
            data = ws.receive_json()
            assert data["type"] == "trade"
            assert data["data"] == message
    finally:
        # Clean up connections
        for ws in clients:
            ws.close()

@pytest.mark.asyncio
async def test_client_disconnect_handling():
    with client.websocket_connect("/ws/trades") as websocket:
        # Force disconnect
        websocket.close()
        
        # Try to broadcast after disconnect
        await broadcast_trade_update({"test": "message"})
        
        # Verify the connection was removed
        assert len(manager.active_connections["trades"]) == 0

@pytest.mark.asyncio
async def test_periodic_metrics():
    with client.websocket_connect("/ws/metrics") as websocket:
        # Wait for periodic update
        data = websocket.receive_json()
        assert data["type"] == "metrics"
        assert "active_strategies" in data["data"]
        assert "total_positions" in data["data"]
        assert "total_pnl" in data["data"]
        assert "win_rate" in data["data"] 