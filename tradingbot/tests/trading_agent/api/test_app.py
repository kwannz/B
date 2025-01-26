"""
Tests for the Trading Agent API app
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import jwt
from jwt.exceptions import InvalidTokenError
from tradingbot.src.trading_agent.api.app import (
    app,
    SECRET_KEY,
    ALGORITHM,
    User,
    Strategy,
    Position,
    create_access_token,
)

client = TestClient(app)

@pytest.fixture
def test_user():
    return {
        "username": "testuser",
        "email": "testuser@example.com",
        "full_name": "Test User",
        "password": "testpass"
    }

@pytest.fixture
def test_token(test_user):
    access_token = create_access_token(
        data={"sub": test_user["username"]},
        expires_delta=timedelta(minutes=30)
    )
    return access_token

@pytest.fixture
def authorized_client(test_token):
    client = TestClient(app)
    client.headers = {
        "Authorization": f"Bearer {test_token}"
    }
    return client

def test_create_access_token():
    data = {"sub": "testuser"}
    token = create_access_token(data)
    assert token is not None
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "testuser"
    assert "exp" in payload

def test_login_for_access_token():
    response = client.post(
        "/token",
        data={"username": "testuser", "password": "testpass"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_read_users_me(authorized_client, test_user):
    response = authorized_client.get("/users/me")
    assert response.status_code == 200
    assert response.json()["username"] == test_user["username"]

def test_get_strategies(authorized_client):
    response = authorized_client.get("/strategies")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_strategy(authorized_client):
    strategy_data = {
        "id": "test-strategy",
        "name": "Test Strategy",
        "description": "Test strategy description",
        "enabled": True,
        "config": {}
    }
    response = authorized_client.post("/strategies", json=strategy_data)
    assert response.status_code == 200
    assert response.json()["name"] == strategy_data["name"]

def test_get_strategy(authorized_client):
    strategy_id = "test-strategy"
    response = authorized_client.get(f"/strategies/{strategy_id}")
    assert response.status_code == 200
    assert response.json()["id"] == strategy_id

def test_update_strategy(authorized_client):
    strategy_id = "test-strategy"
    strategy_data = {
        "id": strategy_id,
        "name": "Updated Strategy",
        "description": "Updated description",
        "enabled": False,
        "config": {"param": "value"}
    }
    response = authorized_client.put(
        f"/strategies/{strategy_id}",
        json=strategy_data
    )
    assert response.status_code == 200
    assert response.json()["name"] == strategy_data["name"]

def test_delete_strategy(authorized_client):
    strategy_id = "test-strategy"
    response = authorized_client.delete(f"/strategies/{strategy_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_positions(authorized_client):
    response = authorized_client.get("/positions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_position(authorized_client):
    position_id = "test-position"
    response = authorized_client.get(f"/positions/{position_id}")
    assert response.status_code == 200
    assert response.json()["id"] == position_id

def test_start_strategy(authorized_client):
    strategy_id = "test-strategy"
    response = authorized_client.post(f"/strategies/{strategy_id}/start")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_stop_strategy(authorized_client):
    strategy_id = "test-strategy"
    response = authorized_client.post(f"/strategies/{strategy_id}/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_metrics(authorized_client):
    response = authorized_client.get("/metrics")
    assert response.status_code == 200
    metrics = response.json()
    assert "total_pnl" in metrics
    assert "win_rate" in metrics
    assert "sharpe_ratio" in metrics
    assert "max_drawdown" in metrics

# Error cases
@patch('tradingbot.src.trading_agent.api.app.authenticate_user')
def test_login_with_invalid_credentials(mock_auth):
    mock_auth.return_value = False
    response = client.post(
        "/token",
        data={"username": "wronguser", "password": "wrongpass"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username or password"

def test_unauthorized_access():
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"

def test_invalid_token():
    client.headers = {"Authorization": "Bearer invalid_token"}
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"
