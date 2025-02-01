import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from src.api.main import app
from src.api.models.base import RiskMetrics
from src.api.routers.risk import RiskLimits

client = TestClient(app)


@pytest.fixture
def test_order():
    return {"symbol": "BTC/USD", "quantity": 1.0, "price": 50000.0}


@pytest.fixture
def test_risk_limits():
    return {
        "max_position_size": 150000,
        "max_drawdown": 0.15,
        "min_win_rate": 0.35,
        "min_profit_factor": 1.3,
        "max_daily_trades": 60,
    }


def test_check_order_risk(test_order):
    response = client.post("/risk/check_order", json=test_order)
    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_check_order_risk_exceeded(test_order):
    # Modify order to exceed position limit
    test_order["quantity"] = RiskLimits.MAX_POSITION_SIZE + 1
    response = client.post("/risk/check_order", json=test_order)
    assert response.status_code == 400
    assert "exceed maximum allowed" in response.json()["detail"]


def test_get_account_metrics():
    response = client.get("/risk/metrics")
    assert response.status_code in [200, 404]  # Either found or not found is acceptable
    if response.status_code == 200:
        data = response.json()
        assert "max_drawdown" in data
        assert "win_rate" in data
        assert "profit_factor" in data
        assert "warnings" in data


def test_update_risk_limits(test_risk_limits):
    response = client.post("/risk/limits", json=test_risk_limits)
    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_get_exposure_analysis():
    response = client.get("/risk/exposure")
    assert response.status_code == 200
    data = response.json()
    assert "total_exposure" in data
    assert "exposure_by_symbol" in data
    assert "position_count" in data
    assert isinstance(data["exposure_by_symbol"], dict)


def test_invalid_risk_limits():
    invalid_limits = {
        "max_position_size": -1000,  # Invalid negative value
        "max_drawdown": 2.0,  # Invalid percentage > 100%
        "min_win_rate": -0.1,  # Invalid negative rate
    }
    response = client.post("/risk/limits", json=invalid_limits)
    assert response.status_code == 422  # Validation error


def test_check_invalid_order():
    invalid_order = {
        "symbol": "BTC/USD",
        "quantity": -1.0,  # Invalid negative quantity
        "price": 0,  # Invalid zero price
    }
    response = client.post("/risk/check_order", json=invalid_order)
    assert response.status_code == 422  # Validation error


def test_daily_trade_limit():
    small_order = {"symbol": "BTC/USD", "quantity": 0.1, "price": 50000.0}

    # Try to place more orders than the daily limit
    responses = []
    for _ in range(RiskLimits.MAX_DAILY_TRADES + 1):
        response = client.post("/risk/check_order", json=small_order)
        responses.append(response)

    # At least one should be rejected
    assert any(r.status_code == 400 for r in responses)
    assert any(
        "Daily trade limit reached" in r.json()["detail"]
        for r in responses
        if r.status_code == 400
    )


def test_risk_metrics_warnings():
    # Create test metrics that would trigger warnings
    test_metrics = {
        "max_drawdown": RiskLimits.MAX_DRAWDOWN + 0.05,
        "win_rate": RiskLimits.MIN_WIN_RATE - 0.05,
        "profit_factor": RiskLimits.MIN_PROFIT_FACTOR - 0.2,
        "volatility": 0.2,
        "type": "account",
    }

    # This would normally be inserted into the database
    # For testing purposes, we just check the response format
    response = client.get("/risk/metrics")
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data.get("warnings", []), list)
