from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Override the get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)


def setup_module():
    """Create tables in the test database"""
    Base.metadata.create_all(bind=engine)


def teardown_module():
    """Drop tables in the test database"""
    Base.metadata.drop_all(bind=engine)


def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    # Check response structure
    assert "status" in data
    assert "timestamp" in data
    assert "database" in data
    assert "version" in data

    # Check values
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["version"] == "1.0.0"


def test_health_check_database_failure(mocker):
    """Test health check when database is not available"""

    # Mock the database session to raise an exception
    def mock_db():
        raise Exception("Database connection failed")

    app.dependency_overrides[get_db] = mock_db

    response = client.get("/health")
    assert response.status_code == 503
    data = response.json()
    assert "detail" in data
    assert "Service unhealthy" in data["detail"]
    assert "Database connection failed" in data["detail"]

    # Restore the original database session
    app.dependency_overrides[get_db] = override_get_db


def test_health_check_performance():
    """Test health check endpoint performance"""
    import time

    start_time = time.time()
    response = client.get("/health")
    end_time = time.time()

    # Health check should respond within 500ms
    assert end_time - start_time < 0.5
    assert response.status_code == 200
