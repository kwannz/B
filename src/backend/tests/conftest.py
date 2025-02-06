import os
import sys
import asyncio
import multiprocessing
import threading
import uvicorn
import socket
import requests
import time
import logging
import json
import websockets
import httpx
import subprocess
from datetime import datetime
from datetime import timezone
from typing import Optional, AsyncGenerator
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from redis.asyncio import Redis
from motor.motor_asyncio import AsyncIOMotorClient
import bson
from bson import Decimal128, json_util
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
from bson.codec_options import CodecOptions, TypeRegistry

logger = logging.getLogger(__name__)

def wait_for_server(port, host='localhost', timeout=30.0, check_health=True):
    """Wait for server to start and become ready."""
    session = requests.Session()
    start_time = time.time()
    while True:
        try:
            with socket.create_connection((host, port), timeout=2.0):
                if check_health:
                    try:
                        response = session.get(f"http://{host}:{port}/health", timeout=2.0)
                        if response.status_code in (200, 503):
                            # Give the server a moment to fully initialize
                            time.sleep(1)
                            return True
                    except requests.RequestException:
                        pass
                else:
                    # Give the server a moment to fully initialize
                    time.sleep(1)
                    return True
        except (OSError, requests.RequestException):
            if time.time() - start_time >= timeout:
                return False
            time.sleep(1)

@pytest_asyncio.fixture(scope="function")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()
    asyncio.set_event_loop(None)

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.database import Base
from backend.main import app, monitoring_service

@pytest_asyncio.fixture(scope="function")
async def redis_client(event_loop) -> AsyncGenerator[Redis, None]:
    redis = Redis.from_url("redis://localhost:6379/1")
    try:
        await redis.ping()
        yield redis
    finally:
        await redis.close()

def create_mongodb_client():
    """Create a MongoDB client with proper configuration."""
    return AsyncIOMotorClient(
        "mongodb://localhost:27017/tradingbot_test",
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000,
        maxPoolSize=10,
        minPoolSize=1,
        waitQueueTimeoutMS=30000,
        retryWrites=True,
        retryReads=True,
        heartbeatFrequencyMS=10000,
        appname="tradingbot_test"
    )

@pytest_asyncio.fixture(scope="function")
async def mongodb_client() -> AsyncGenerator[AsyncIOMotorClient, None]:
    client = create_mongodb_client()
    retries = 3
    while retries > 0:
        try:
            await client.admin.command('ping')
            break
        except Exception as e:
            retries -= 1
            if retries == 0:
                raise RuntimeError(f"Failed to connect to MongoDB after 3 attempts: {e}")
            await asyncio.sleep(1)
    
    try:
        yield client
    finally:
        try:
            await client.close()
        except Exception:
            pass

@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_monitoring(event_loop, mongodb_client, redis_client):
    # Configure test-specific ports through environment variables
    os.environ["PROMETHEUS_PORT"] = "8125"
    os.environ["PORT"] = "8123"
    os.environ["MONITOR_PORT"] = "8124"

    # Initialize monitoring service
    try:
        # Initialize database and Redis first
        db = mongodb_client.get_database("tradingbot_test")
        await redis_client.ping()

        # Configure monitoring service
        monitoring_service.loop = event_loop
        monitoring_service.db = db
        monitoring_service.redis = redis_client
        monitoring_service._running = False

        # Initialize monitoring service
        await monitoring_service.initialize()
        if not monitoring_service._running:
            await monitoring_service.start()
            await asyncio.sleep(1)  # Give monitoring service time to start

        yield monitoring_service
    finally:
        if monitoring_service._running:
            try:
                await monitoring_service.stop()
                await asyncio.sleep(0.5)  # Give monitoring service time to stop
            except Exception:
                pass
        monitoring_service.db = None
        monitoring_service.redis = None
        monitoring_service._running = False
        # Clean up environment variables
        os.environ.pop("PROMETHEUS_PORT", None)
        os.environ.pop("PORT", None)
        os.environ.pop("MONITOR_PORT", None)

@pytest.fixture(scope="function")
def engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(engine):
    """Creates a new database session for each test function"""
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()

def convert_decimal(obj):
    if isinstance(obj, (Decimal, Decimal128)):
        try:
            return float(obj.to_decimal() if isinstance(obj, Decimal128) else obj)
        except (TypeError, ValueError):
            return None
    if isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [convert_decimal(v) for v in obj]
    if hasattr(obj, '__dict__'):
        return convert_decimal(obj.__dict__)
    return obj

@pytest_asyncio.fixture(scope="function")
async def initialize_test_app(mongodb_client, redis_client, event_loop):
    """Initialize the FastAPI app for testing with proper cleanup."""
    import uvicorn
    import threading
    import time
    import subprocess
    import sys
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from contextlib import asynccontextmanager
    from tradingbot.api.websocket.handler import ConnectionManager

    @asynccontextmanager
    async def lifespan(app):
        try:
            # Initialize MongoDB
            app.state.mongodb = mongodb_client
            app.state.db = mongodb_client.get_database("tradingbot_test")
            await app.state.mongodb.admin.command('ping')

            # Initialize Redis
            app.state.redis = redis_client
            await app.state.redis.ping()

            # Initialize WebSocket manager
            app.state.websocket_manager = ConnectionManager()

            # Initialize monitoring service
            monitoring_service.loop = event_loop
            monitoring_service.db = app.state.db
            monitoring_service.redis = app.state.redis
            await monitoring_service.initialize()
            await monitoring_service.start()

            yield
        finally:
            if monitoring_service._running:
                await monitoring_service.stop()
            app.state.mongodb = None
            app.state.db = None
            app.state.redis = None

    # Create a new FastAPI instance for each test
    app_instance = FastAPI(lifespan=lifespan)
    
    # Set the event loop for the current context
    asyncio.set_event_loop(event_loop)
    app._loop = event_loop
    monitoring_service._loop = event_loop

    # Configure logging
    logging.basicConfig(level=logging.DEBUG)

    # Initialize app state
    app_instance.state.mongodb = mongodb_client
    app_instance.state.db = mongodb_client.get_database("tradingbot_test")
    app_instance.state.redis = redis_client
    app_instance.state.testing = True

    # Add CORS middleware first
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Copy routes from main app
    for route in app.routes:
        app_instance.router.routes.append(route)

    # Copy exception handlers
    app_instance.exception_handlers = app.exception_handlers.copy()

    # Initialize collections and create test data
    collections = ['trades', 'signals', 'strategies', 'agents', 'performance', 'accounts', 'limit_settings']
    for collection in collections:
        try:
            await app_instance.state.db.drop_collection(collection)
            await app_instance.state.db.create_collection(collection)
        except Exception:
            pass

    # Create test user account and agent
    await app_instance.state.db.accounts.insert_one({
        "user_id": "test_user",
        "username": "test",
        "balance": 10000.0
    })
    await app_instance.state.db.agents.insert_one({
        "type": "trading",
        "status": "running",
        "created_at": datetime.now(timezone.utc),
        "last_updated": datetime.now(timezone.utc)
    })

    # Initialize test server
    from tests.utils.test_server import TestServer
    app_instance.state.test_server = TestServer(app_instance)
    await app_instance.state.test_server.start()

    # Initialize test state
    app_instance.state.testing = True
    app_instance.state.websocket_client = websocket_client

    try:
        yield app_instance
    finally:
        # Stop test server
        try:
            if hasattr(app_instance.state, 'test_server'):
                await app_instance.state.test_server.stop()
        except Exception as e:
            logger.error(f"Error stopping test server: {e}")

        # Cleanup connections
        try:
            if hasattr(app_instance.state, 'mongodb') and app_instance.state.mongodb:
                await app_instance.state.mongodb.close()
            if hasattr(app_instance.state, 'redis') and app_instance.state.redis:
                await app_instance.state.redis.close()
        except Exception as e:
            logger.error(f"Error cleaning up connections: {e}")

        # Reset app state
        app_instance.state.db = None
        app_instance.state.mongodb = None
        app_instance.state.redis = None
        app_instance.state.test_server = None
        app_instance.state.websocket_client = None
        app_instance.dependency_overrides.clear()
        app_instance.state.testing = False

        # Give connections time to close
        await asyncio.sleep(0.1)

@pytest_asyncio.fixture(scope="function")
async def client(initialize_test_app, event_loop):
    """Creates a new AsyncClient for testing with proper async support"""
    import httpx
    from backend.database import get_db
    import asyncio

    # Use real server URL since we're running a real server
    base_url = "http://127.0.0.1:8123"
    
    # Create client with direct HTTP connection
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=30.0,
        follow_redirects=True
    ) as client:
        yield client

@pytest.fixture(scope="function")
def test_db(db_session):
    """Provides a database session for tests that need direct database access"""
    yield db_session

@pytest.fixture(scope="function")
def mock_mongodb(mocker):
    """Provides a mocked MongoDB database for testing"""
    mock_db = mocker.MagicMock()
    mock_db.trades = mocker.MagicMock()
    mock_db.signals = mocker.MagicMock()
    mock_db.strategies = mocker.MagicMock()
    mock_db.agents = mocker.MagicMock()
    mock_db.performance = mocker.MagicMock()
    mock_db.accounts = mocker.MagicMock()
    mock_db.limit_settings = mocker.MagicMock()
    return mock_db

@pytest_asyncio.fixture(scope="function")
async def websocket_client():
    """Creates a WebSocket test client"""
    class WSTestClient:
        def __init__(self):
            self._active_connections = set()

        async def connect(self, url: str):
            try:
                # Convert relative URL to absolute WebSocket URL
                if url.startswith("/"):
                    url = f"ws://127.0.0.1:8123{url}"
                ws = await websockets.connect(
                    url,
                    ping_interval=None,  # Disable automatic ping
                    ping_timeout=None,   # Disable ping timeout
                    close_timeout=5,     # 5 seconds to close
                    max_size=2**20,      # 1MB max message size
                    read_limit=2**16,    # 64KB read buffer
                    write_limit=2**16    # 64KB write buffer
                )
                self._active_connections.add(ws)
                return ws
            except Exception as e:
                logger.error(f"WebSocket connection error: {e}")
                raise

        async def disconnect(self, websocket):
            try:
                if websocket and not websocket.closed:
                    await websocket.close()
                self._active_connections.discard(websocket)
            except Exception as e:
                logger.error(f"WebSocket disconnect error: {e}")
            finally:
                self._active_connections.discard(websocket)

        async def send_text(self, websocket, text: str):
            try:
                await websocket.send(text)
            except Exception as e:
                logger.error(f"WebSocket send error: {e}")
                raise

        async def send_json(self, websocket, data: dict):
            try:
                await websocket.send(json.dumps(data))
            except Exception as e:
                logger.error(f"WebSocket send error: {e}")
                raise

        async def receive_text(self, websocket):
            try:
                return await websocket.recv()
            except Exception as e:
                logger.error(f"WebSocket receive error: {e}")
                raise

        async def receive_json(self, websocket):
            try:
                data = await websocket.recv()
                return json.loads(data)
            except Exception as e:
                logger.error(f"WebSocket receive error: {e}")
                raise

        def get_client_state(self, websocket):
            """Get WebSocket client state"""
            return "CONNECTED" if not websocket.closed else "DISCONNECTED"

        async def cleanup(self):
            for ws in list(self._active_connections):
                await self.disconnect(ws)

    client = WSTestClient()
    yield client
    await client.cleanup()

@pytest.fixture
def sample_trade_data():
    return {
        "symbol": "BTC/USD",
        "direction": "long",
        "entry_time": "2025-02-02T10:00:00",
        "entry_price": 50000.0,
        "quantity": 1.0,
        "leverage": 1.0,
        "metadata": {},
        "status": "open"
    }

@pytest.fixture
def sample_signal_data():
    return {
        "timestamp": "2025-02-02T10:00:00",
        "direction": "long",
        "confidence": 0.85,
        "symbol": "BTC/USD",
        "indicators": {"rsi": 70.0, "macd": 1.5},
        "status": "active"
    }

@pytest.fixture
def sample_strategy_data():
    return {
        "name": "Test Strategy",
        "type": "momentum",
        "parameters": {
            "rsi_period": 14.0,
            "rsi_overbought": 70.0,
            "rsi_oversold": 30.0,
            "timeframe": "1h"
        },
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

@pytest.fixture
def mock_connection_manager(mocker):
    class MockConnectionManager:
        async def connect(self, websocket, connection_type):
            pass

        async def disconnect(self, websocket, connection_type):
            pass

        async def broadcast_to_type(self, message, connection_type):
            pass

        async def send_personal_message(self, message, websocket):
            pass

    return MockConnectionManager()

@pytest.fixture(autouse=True)
def env_setup(monkeypatch):
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("POSTGRES_DB", "tradingbot_test")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres")
    monkeypatch.setenv("POSTGRES_HOST", "localhost")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("MONGODB_URL", "mongodb://localhost:27017/tradingbot_test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/1")
    monkeypatch.setenv("PORT", "8123")
    monkeypatch.setenv("MONITOR_PORT", "8124")
    monkeypatch.setenv("PROMETHEUS_PORT", "8125")
