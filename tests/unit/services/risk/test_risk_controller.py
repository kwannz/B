import os
import sys
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tradingbot.api_gateway.app.models.database import Position
from tradingbot.shared.risk_controller import RiskController


@pytest.fixture
async def mock_db():
    """Create mock database with async filter method"""
    mock_position = MagicMock(spec=Position)
    mock_position.symbol = "SOL/USD"
    mock_position.quantity = 1.0
    mock_position.current_price = 100.0
    mock_position.stop_loss = 90.0
    mock_position.closed_at = None
    mock_position.strategy = "test_strategy"
    mock_position.side = "long"
    mock_position.entry_price = 95.0
    mock_position.take_profit = 110.0
    mock_position.unrealized_pnl = 5.0
    mock_position.opened_at = datetime.utcnow()
    mock_position.position_metadata = {}

    mock_db = AsyncMock()
    mock_db.filter = AsyncMock(return_value=[mock_position])
    return mock_db


@pytest.fixture
async def risk_controller_db(mock_db):
    """Risk controller fixture with database mode"""
    with patch.dict(os.environ, {"USE_DB": "true"}):
        with patch("src.shared.risk_controller.db", mock_db):
            controller = RiskController()
            await controller.start()
            # Set test configuration
            await controller.update_risk_params(
                {"max_position_size": 1000.0, "stop_loss_threshold": 0.1}
            )
            yield controller
            await controller.stop()


@pytest.fixture
async def risk_controller_memory():
    """Risk controller fixture with in-memory mode"""
    with patch.dict(os.environ, {"USE_DB": "false"}):
        controller = RiskController()
        await controller.start()
        # Set test configuration
        await controller.update_risk_params(
            {"max_position_size": 1000.0, "stop_loss_threshold": 0.1}
        )
        yield controller
        await controller.stop()


@pytest.mark.asyncio
async def test_check_risk_db(risk_controller_db):
    """Test risk checking with database mode"""
    # Test valid trade data with low risk characteristics
    trade_data = {
        "symbol": "SOL/USD",
        "side": "buy",
        "quantity": 1.0,
        "price": 100.0,
        "timestamp": "2024-01-22T00:00:00Z",
        "position_size": 50.0,  # Lower position size (5% of portfolio)
        "portfolio_value": 1000.0,  # Total portfolio value
        "volatility": 0.1,  # Lower volatility
        "liquidity": 0.8,  # Higher liquidity
    }
    result = await risk_controller_db.check_risk(trade_data)
    assert result["allowed"] == True
    assert result["risk_level"] == "low"

    # Test invalid trade data
    invalid_trade = {"symbol": "", "side": "invalid", "quantity": -1, "price": 0}
    result = await risk_controller_db.check_risk(invalid_trade)
    assert result["allowed"] == False
    assert result["risk_level"] == "high"


@pytest.mark.asyncio
async def test_check_risk_memory(risk_controller_memory):
    """Test risk checking with in-memory mode"""
    # Test valid trade data with low risk characteristics
    trade_data = {
        "symbol": "SOL/USD",
        "side": "buy",
        "quantity": 1.0,
        "price": 100.0,
        "timestamp": "2024-01-22T00:00:00Z",
        "position_size": 50.0,  # Lower position size (5% of portfolio)
        "portfolio_value": 1000.0,  # Total portfolio value
        "volatility": 0.1,  # Lower volatility
        "liquidity": 0.8,  # Higher liquidity
    }
    result = await risk_controller_memory.check_risk(trade_data)
    assert result["allowed"] == True
    assert result["risk_level"] == "low"

    # Test invalid trade data
    invalid_trade = {"symbol": "", "side": "invalid", "quantity": -1, "price": 0}
    result = await risk_controller_memory.check_risk(invalid_trade)
    assert result["allowed"] == False
    assert result["risk_level"] == "high"


@pytest.mark.asyncio
async def test_get_risk_metrics_db(risk_controller_db, mock_db):
    """Test risk metrics with database mode"""
    metrics = await risk_controller_db.get_risk_metrics()

    # Verify the metrics structure and values
    assert metrics["current_risk_level"] in ["low", "medium", "high"]
    assert "total_exposure" in metrics
    assert isinstance(metrics["total_exposure"], float)
    assert "position_sizes" in metrics
    assert "stop_losses" in metrics
    assert isinstance(metrics["position_sizes"], dict)
    assert isinstance(metrics["stop_losses"], dict)

    # Verify the specific position data
    assert metrics["position_sizes"]["SOL/USD"] == 100.0  # quantity * current_price
    assert "SOL/USD" in metrics["stop_losses"]
    assert metrics["stop_losses"]["SOL/USD"]["stop_loss"] == 90.0


@pytest.mark.asyncio
async def test_get_risk_metrics_memory(risk_controller_memory):
    """Test risk metrics with in-memory mode"""
    # Add test position to in-memory storage
    risk_controller_memory.positions = {
        "SOL/USD": {"size": 1.0, "avg_price": 95.0, "current_price": 100.0}
    }
    risk_controller_memory.peak_value = 1000.0
    risk_controller_memory.current_value = 950.0

    metrics = await risk_controller_memory.get_risk_metrics()

    # Verify the metrics structure
    assert metrics["current_risk_level"] in ["low", "medium", "high"]
    assert "total_position_value" in metrics
    assert isinstance(metrics["total_position_value"], float)
    assert "position_sizes" in metrics
    assert "stop_losses" in metrics
    assert isinstance(metrics["position_sizes"], dict)
    assert isinstance(metrics["stop_losses"], dict)

    # Verify position data
    assert metrics["position_sizes"]["SOL/USD"]["size"] == 1.0
    assert metrics["position_sizes"]["SOL/USD"]["current_price"] == 100.0
    assert metrics["current_drawdown"] == 0.05  # (1000 - 950) / 1000
