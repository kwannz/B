import asyncio
import json
import httpx
import websockets
import sys
import os
from datetime import datetime, timedelta
import pytest

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.main import app

PORT = os.getenv("PORT", "8123")
BASE_URL = "http://testserver"  # Use testserver for ASGI transport
WS_URL = "ws://testserver/ws"   # Use testserver for WebSocket tests


@pytest.mark.asyncio
async def test_complete_trading_flow():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        # 1. User authentication
        auth_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "test", "password": "test"},
            timeout=30.0,
        )
        assert auth_response.status_code == 200
        token = auth_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get market data
        market_data = await client.get(
            "/api/v1/market/data", headers=headers, timeout=30.0
        )
        assert market_data.status_code == 200
        assert "BTC/USD" in market_data.json()["data"]

        # 3. Create trade order
        order = await client.post(
            "/api/v1/trades",
            headers=headers,
            timeout=30.0,
            json={
                "symbol": "BTC/USD",
                "side": "buy",
                "type": "limit",
                "quantity": 0.1,
                "price": 50000,
            },
        )
    assert order.status_code == 200
    order_id = order.json()["order_id"]

    # 4. WebSocket 实时更新测试
    async with websockets.connect(f"{WS_URL}/orders?token={token}") as websocket:
        # 发送订阅消息
        await websocket.send(
            json.dumps(
                {"action": "subscribe", "channel": "orders", "symbols": ["BTC-USD"]}
            )
        )

        # 等待确认消息
        response = await websocket.recv()
        assert json.loads(response)["status"] == "subscribed"

        # 等待订单更新
        for _ in range(3):  # 等待最多3条消息
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(msg)
                if data["order_id"] == order_id and data["status"] == "filled":
                    break
            except asyncio.TimeoutError:
                continue

        # 5. Query order history
        history = await client.get(
            "/api/v1/trades/history", headers=headers, timeout=30.0
        )
        assert history.status_code == 200
        orders = history.json()["orders"]
        assert any(order["order_id"] == order_id for order in orders)

        # 6. Query account balance
        balance = await client.get(
            "/api/v1/account/balance", headers=headers, timeout=30.0
        )
        assert balance.status_code == 200
        assert "BTC" in balance.json()["balances"]
        assert "USD" in balance.json()["balances"]


@pytest.mark.asyncio
async def test_market_data_streaming():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        # Get authentication token
        auth_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "test", "password": "test"},
            timeout=30.0,
        )
        assert auth_response.status_code == 200
        token = auth_response.json()["token"]

        # Connect to WebSocket with token
        async with websockets.connect(f"{WS_URL}/market?token={token}") as websocket:
            # Subscribe to market data
            await websocket.send(
                json.dumps(
                    {
                        "action": "subscribe",
                        "channel": "market",
                        "symbols": ["BTC/USD", "ETH/USD"],
                    }
                )
            )

            # Verify subscription confirmation
            response = await websocket.recv()
            assert json.loads(response)["status"] == "subscribed"

            # Verify data stream
            received_data = set()
            start_time = datetime.now()
            while (datetime.now() - start_time) < timedelta(seconds=10):
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(msg)
                    received_data.add(data["symbol"])
                    if len(received_data) >= 2:  # Received data for all subscribed symbols
                        break
                except asyncio.TimeoutError:
                    continue

            assert "BTC/USD" in received_data
            assert "ETH/USD" in received_data


@pytest.mark.asyncio
async def test_error_handling():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        # 1. Test invalid token
        response = await client.get(
            "/api/v1/account/balance",
            headers={"Authorization": "Bearer invalid_token"},
            timeout=30.0,
        )
        assert response.status_code == 401

        # 2. Test invalid order
        auth_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "test", "password": "test"},
            timeout=30.0,
        )
        token = auth_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await client.post(
            "/api/v1/trades",
            headers=headers,
            timeout=30.0,
            json={
                "symbol": "INVALID/PAIR",
                "side": "buy",
                "type": "limit",
                "quantity": 0.1,
                "price": 50000,
            },
        )
        assert response.status_code == 400

    # 3. Test WebSocket error handling
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url=BASE_URL,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        # Get authentication token first
        auth_response = await client.post(
            "/api/v1/auth/login",
            json={"username": "test", "password": "test"},
            timeout=30.0,
        )
        assert auth_response.status_code == 200
        token = auth_response.json()["token"]

        # Test WebSocket with invalid action
        async with websockets.connect(f"{WS_URL}/market?token={token}") as websocket:
            await websocket.send(
                json.dumps({"action": "invalid_action", "channel": "market"})
            )
            response = await websocket.recv()
            assert json.loads(response)["status"] == "error"
