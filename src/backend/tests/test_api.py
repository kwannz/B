import pytest
from datetime import datetime, timedelta


def test_create_trade(client, sample_trade_data):
    """Test creating a new trade"""
    response = client.post("/api/v1/trades", json=sample_trade_data)
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == sample_trade_data["symbol"]
    assert data["direction"] == sample_trade_data["direction"]
    assert data["entry_price"] == sample_trade_data["entry_price"]
    assert data["status"] == "open"


def test_get_trades(client, sample_trade_data):
    """Test retrieving trades"""
    # Create a trade first
    client.post("/api/v1/trades", json=sample_trade_data)

    # Get all trades
    response = client.get("/api/v1/trades")
    assert response.status_code == 200
    data = response.json()
    assert "trades" in data
    assert len(data["trades"]) > 0
    assert data["trades"][0]["symbol"] == sample_trade_data["symbol"]


def test_create_signal(client, sample_signal_data):
    """Test creating a new signal"""
    response = client.post("/api/v1/signals", json=sample_signal_data)
    assert response.status_code == 200
    data = response.json()
    assert data["direction"] == sample_signal_data["direction"]
    assert data["confidence"] == sample_signal_data["confidence"]
    assert data["indicators"] == sample_signal_data["indicators"]


def test_get_signals(client, sample_signal_data):
    """Test retrieving signals"""
    # Create a signal first
    client.post("/api/v1/signals", json=sample_signal_data)

    # Get all signals
    response = client.get("/api/v1/signals")
    assert response.status_code == 200
    data = response.json()
    assert "signals" in data
    assert len(data["signals"]) > 0
    assert data["signals"][0]["direction"] == sample_signal_data["direction"]


def test_create_strategy(client, sample_strategy_data):
    """Test creating a new strategy"""
    response = client.post("/api/v1/strategies", json=sample_strategy_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == sample_strategy_data["name"]
    assert data["type"] == sample_strategy_data["type"]
    assert data["parameters"] == sample_strategy_data["parameters"]
    assert data["status"] == sample_strategy_data["status"]


def test_get_strategies(client, sample_strategy_data):
    """Test retrieving strategies"""
    # Create a strategy first
    client.post("/api/v1/strategies", json=sample_strategy_data)

    # Get all strategies
    response = client.get("/api/v1/strategies")
    assert response.status_code == 200
    data = response.json()
    assert "strategies" in data
    assert len(data["strategies"]) > 0
    assert data["strategies"][0]["name"] == sample_strategy_data["name"]


def test_agent_status_lifecycle(client):
    """Test agent status lifecycle (start/stop)"""
    # Get initial status
    response = client.get("/api/v1/agents/trading/status")
    assert response.status_code == 200
    assert response.json()["status"] == "stopped"

    # Start agent
    response = client.post("/api/v1/agents/trading/start")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

    # Stop agent
    response = client.post("/api/v1/agents/trading/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "stopped"


def test_performance_metrics(client, sample_trade_data):
    """Test performance metrics calculation"""
    # Create some trades
    profitable_trade = {
        **sample_trade_data,
        "exit_time": (datetime.now() + timedelta(hours=1)).isoformat(),
        "exit_price": sample_trade_data["entry_price"] * 1.1,  # 10% profit
    }
    losing_trade = {
        **sample_trade_data,
        "exit_time": (datetime.now() + timedelta(hours=2)).isoformat(),
        "exit_price": sample_trade_data["entry_price"] * 0.9,  # 10% loss
    }

    client.post("/api/v1/trades", json=profitable_trade)
    client.post("/api/v1/trades", json=losing_trade)

    # Get performance metrics
    response = client.get("/api/v1/performance")
    assert response.status_code == 200
    data = response.json()

    assert data["total_trades"] == 2
    assert data["profitable_trades"] == 1
    assert data["win_rate"] == 0.5
    assert "total_profit" in data
    assert "average_profit" in data
    assert "max_drawdown" in data


def test_invalid_trade_data(client):
    """Test handling of invalid trade data"""
    invalid_data = {
        "symbol": "BTC/USD",
        "direction": "invalid",  # Should be 'long' or 'short'
        "entry_price": -100,  # Should be positive
        "quantity": 0,  # Should be positive
    }

    response = client.post("/api/v1/trades", json=invalid_data)
    assert response.status_code == 422  # Validation error


def test_invalid_signal_data(client):
    """Test handling of invalid signal data"""
    invalid_data = {
        "direction": "invalid",  # Should be 'long' or 'short'
        "confidence": 2.0,  # Should be between 0 and 1
        "indicators": "not_a_dict",  # Should be a dictionary
    }

    response = client.post("/api/v1/signals", json=invalid_data)
    assert response.status_code == 422  # Validation error


def test_invalid_strategy_data(client):
    """Test handling of invalid strategy data"""
    invalid_data = {
        "name": "",  # Should not be empty
        "type": None,  # Should be a string
        "parameters": "not_a_dict",  # Should be a dictionary
        "status": "invalid",  # Should be 'active' or 'inactive'
    }

    response = client.post("/api/v1/strategies", json=invalid_data)
    assert response.status_code == 422  # Validation error


def test_nonexistent_agent(client):
    """Test handling of requests for nonexistent agent"""
    response = client.get("/api/v1/agents/nonexistent/status")
    assert response.status_code == 200  # Should create new agent
    assert response.json()["status"] == "stopped"
