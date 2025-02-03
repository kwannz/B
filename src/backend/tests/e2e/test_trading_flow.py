import pytest
import requests
import websockets
import asyncio
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"


@pytest.mark.asyncio
async def test_complete_trading_flow():
    # 1. 用户认证
    auth_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "test_user", "password": "test_password"},
    )
    assert auth_response.status_code == 200
    token = auth_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 获取市场数据
    market_data = requests.get(f"{BASE_URL}/api/v1/market/data", headers=headers)
    assert market_data.status_code == 200
    assert "BTC-USD" in market_data.json()["data"]

    # 3. 创建交易订单
    order = requests.post(
        f"{BASE_URL}/api/v1/trade/order",
        headers=headers,
        json={
            "symbol": "BTC-USD",
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

    # 5. 查询订单历史
    history = requests.get(f"{BASE_URL}/api/v1/trade/history", headers=headers)
    assert history.status_code == 200
    orders = history.json()["orders"]
    assert any(order["order_id"] == order_id for order in orders)

    # 6. 查询账户余额
    balance = requests.get(f"{BASE_URL}/api/v1/account/balance", headers=headers)
    assert balance.status_code == 200
    assert "BTC" in balance.json()["balances"]
    assert "USD" in balance.json()["balances"]


@pytest.mark.asyncio
async def test_market_data_streaming():
    async with websockets.connect(f"{WS_URL}/market") as websocket:
        # 订阅市场数据
        await websocket.send(
            json.dumps(
                {
                    "action": "subscribe",
                    "channel": "market",
                    "symbols": ["BTC-USD", "ETH-USD"],
                }
            )
        )

        # 验证订阅确认
        response = await websocket.recv()
        assert json.loads(response)["status"] == "subscribed"

        # 验证数据流
        received_data = set()
        start_time = datetime.now()
        while (datetime.now() - start_time) < timedelta(seconds=10):
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                data = json.loads(msg)
                received_data.add(data["symbol"])
                if len(received_data) >= 2:  # 收到了所有订阅的symbol的数据
                    break
            except asyncio.TimeoutError:
                continue

        assert "BTC-USD" in received_data
        assert "ETH-USD" in received_data


@pytest.mark.asyncio
async def test_error_handling():
    # 1. 测试无效token
    response = requests.get(
        f"{BASE_URL}/api/v1/account/balance",
        headers={"Authorization": "Bearer invalid_token"},
    )
    assert response.status_code == 401

    # 2. 测试无效订单
    auth_response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"username": "test_user", "password": "test_password"},
    )
    token = auth_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.post(
        f"{BASE_URL}/api/v1/trade/order",
        headers=headers,
        json={
            "symbol": "INVALID-PAIR",
            "side": "buy",
            "type": "limit",
            "quantity": 0.1,
            "price": 50000,
        },
    )
    assert response.status_code == 400

    # 3. 测试WebSocket错误处理
    async with websockets.connect(f"{WS_URL}/market") as websocket:
        await websocket.send(
            json.dumps({"action": "invalid_action", "channel": "market"})
        )
        response = await websocket.recv()
        assert json.loads(response)["status"] == "error"
