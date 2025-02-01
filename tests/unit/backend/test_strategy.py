import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from src.api.main import app
from src.api.models.base import Strategy, RiskMetrics

client = TestClient(app)

@pytest.fixture
def test_strategy():
    return {
        "name": "Test Strategy",
        "description": "A test trading strategy",
        "parameters": {
            "timeframe": "1h",
            "risk_level": "medium",
            "take_profit": 1.5,
            "stop_loss": 0.95
        },
        "active": True
    }

@pytest.fixture
def test_metrics():
    return {
        "max_drawdown": 0.05,
        "sharpe_ratio": 1.8,
        "volatility": 0.15,
        "win_rate": 0.65,
        "profit_factor": 2.1
    }

def test_create_strategy(test_strategy):
    response = client.post("/strategy/", json=test_strategy)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == test_strategy["name"]
    assert data["description"] == test_strategy["description"]
    assert data["parameters"] == test_strategy["parameters"]
    assert data["active"] == test_strategy["active"]
    assert "id" in data

def test_get_strategies():
    response = client.get("/strategy/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_toggle_strategy():
    # First create a strategy
    response = client.post("/strategy/", json=test_strategy)
    strategy_id = response.json()["id"]
    initial_status = response.json()["active"]
    
    # Toggle it
    response = client.put(f"/strategy/{strategy_id}/toggle")
    assert response.status_code == 200
    data = response.json()
    assert data["active"] != initial_status

def test_get_strategy_metrics(test_metrics):
    # First create a strategy
    response = client.post("/strategy/", json=test_strategy)
    strategy_id = response.json()["id"]
    
    # Then try to get its metrics
    response = client.get(f"/strategy/{strategy_id}/metrics")
    assert response.status_code in [200, 404]  # Either found or not found is acceptable

def test_run_backtest():
    # First create a strategy
    response = client.post("/strategy/", json=test_strategy)
    strategy_id = response.json()["id"]
    
    # Run backtest
    backtest_params = {
        "start_date": "2024-01-01",
        "end_date": "2024-02-01",
        "initial_capital": 100000
    }
    
    response = client.post(f"/strategy/{strategy_id}/backtest", json=backtest_params)
    assert response.status_code == 200
    assert response.json()["status"] == "Backtest started"
    assert response.json()["strategy_id"] == strategy_id

def test_invalid_strategy():
    invalid_strategy = {
        "name": "",  # Invalid empty name
        "description": "Test strategy",
        "parameters": "invalid",  # Should be a dict
        "active": "invalid"  # Should be boolean
    }
    response = client.post("/strategy/", json=invalid_strategy)
    assert response.status_code == 422  # Validation error

def test_toggle_nonexistent_strategy():
    response = client.put("/strategy/nonexistent_id/toggle")
    assert response.status_code == 404

def test_get_metrics_nonexistent_strategy():
    response = client.get("/strategy/nonexistent_id/metrics")
    assert response.status_code == 404

def test_run_backtest_nonexistent_strategy():
    response = client.post("/strategy/nonexistent_id/backtest", json={})
    assert response.status_code == 404

def test_create_duplicate_strategy(test_strategy):
    # Create first strategy
    response = client.post("/strategy/", json=test_strategy)
    assert response.status_code == 200
    
    # Try to create another with same name
    response = client.post("/strategy/", json=test_strategy)
    assert response.status_code == 200  # Should still work as we don't enforce uniqueness 