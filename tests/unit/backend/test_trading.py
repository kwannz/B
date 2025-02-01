import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from src.api.main import app
from src.api.models.base import BaseOrder, OrderType, OrderSide, OrderStatus

client = TestClient(app)


@pytest.fixture
def test_order():
    return {
        "symbol": "BTC/USD",
        "order_type": OrderType.MARKET,
        "side": OrderSide.BUY,
        "quantity": 1.0,
        "price": None,
        "status": OrderStatus.PENDING,
    }


def test_create_order(test_order):
    response = client.post("/trading/orders", json=test_order)
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == test_order["symbol"]
    assert data["order_type"] == test_order["order_type"]
    assert data["side"] == test_order["side"]
    assert data["quantity"] == test_order["quantity"]
    assert "id" in data


def test_get_orders():
    response = client.get("/trading/orders")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_order():
    # First create an order
    response = client.post("/trading/orders", json=test_order)
    order_id = response.json()["id"]

    # Then get it
    response = client.get(f"/trading/orders/{order_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == order_id


def test_cancel_order():
    # First create an order
    response = client.post("/trading/orders", json=test_order)
    order_id = response.json()["id"]

    # Then cancel it
    response = client.put(f"/trading/orders/{order_id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify it's cancelled
    response = client.get(f"/trading/orders/{order_id}")
    assert response.status_code == 200
    assert response.json()["status"] == OrderStatus.CANCELLED


def test_get_positions():
    response = client.get("/trading/positions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_position():
    symbol = "BTC/USD"
    response = client.get(f"/trading/positions/{symbol}")
    assert response.status_code in [200, 404]  # Either found or not found is acceptable


def test_invalid_order():
    invalid_order = {
        "symbol": "BTC/USD",
        "order_type": "INVALID_TYPE",  # Invalid order type
        "side": OrderSide.BUY,
        "quantity": -1.0,  # Invalid quantity
    }
    response = client.post("/trading/orders", json=invalid_order)
    assert response.status_code == 422  # Validation error


def test_order_not_found():
    response = client.get("/trading/orders/nonexistent_id")
    assert response.status_code == 404


def test_cancel_nonexistent_order():
    response = client.put("/trading/orders/nonexistent_id/cancel")
    assert response.status_code == 404
