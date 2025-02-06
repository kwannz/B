import pytest
import pytest_asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from contextlib import asynccontextmanager

from backend.main import app

@pytest.fixture(scope="module")
def mock_monitoring():
    with patch("backend.main.monitoring_service") as mock:
        mock._running = True
        yield mock

@pytest_asyncio.fixture(scope="module")
async def mock_mongodb():
    mock_mongodb = MagicMock()
    mock_mongodb.admin = MagicMock()
    mock_mongodb.admin.command = AsyncMock(return_value={"ok": 1.0})
    
    app.state.mongodb = mock_mongodb
    yield mock_mongodb
    app.state.mongodb = None

@pytest.fixture(autouse=True)
def reset_mocks():
    if hasattr(app.state, "mongodb") and app.state.mongodb:
        app.state.mongodb.admin.command.reset_mock(side_effect=True)
        app.state.mongodb.admin.command.return_value = {"ok": 1.0}
    if hasattr(app.state, "monitoring_service") and app.state.monitoring_service:
        app.state.monitoring_service._running = True
    yield

@pytest.mark.asyncio
async def test_health_check(client, mock_mongodb):
    """Test the health check endpoint"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert "status" in data
    assert "timestamp" in data
    assert "services" in data
    assert "version" in data

    assert data["status"] == "healthy"
    assert data["services"]["database"] == "connected"
    assert data["services"]["monitoring"] == "running"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_health_check_database_failure(client, mock_mongodb):
    """Test health check when database is not available"""
    mock_mongodb.admin.command.side_effect = Exception("Database connection failed")
    app.state.db = mock_mongodb
    
    response = await client.get("/health")
    assert response.status_code == 503
    data = response.json()
    assert "detail" in data
    assert "Database connection failed" in data["detail"]


@pytest.mark.asyncio
async def test_health_check_monitoring_failure(client, mock_mongodb, mock_monitoring):
    """Test health check when monitoring service is not running"""
    mock_monitoring._running = False
    app.state.db = mock_mongodb
    app.state.monitoring_service = mock_monitoring
    
    response = await client.get("/health")
    assert response.status_code == 503
    data = response.json()
    assert "detail" in data
    assert data["detail"] == "Monitoring service not running"
