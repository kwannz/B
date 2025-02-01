"""Fixtures for tool tests"""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# File system fixtures
@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing"""
    with tempfile.TemporaryDirectory() as tmpdirname:
        original_dir = os.getcwd()
        os.chdir(tmpdirname)
        yield Path(tmpdirname)
        os.chdir(original_dir)


@pytest.fixture
def sample_files(temp_dir):
    """Create sample files for testing"""
    files = {
        "text.txt": "Sample text content",
        "data.json": '{"key": "value"}',
        "config.yaml": "setting: value",
    }
    for name, content in files.items():
        (temp_dir / name).write_text(content)
    return temp_dir


# Network fixtures
@pytest.fixture
def mock_response():
    """Mock HTTP response"""
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"status": "success"}
    response.text = "Response text"
    return response


@pytest.fixture
def mock_session(mock_response):
    """Mock aiohttp session"""
    session = MagicMock()
    session.get = MagicMock(return_value=mock_response)
    session.post = MagicMock(return_value=mock_response)
    return session


# Security fixtures
@pytest.fixture
def ssl_context():
    """SSL context for testing"""
    context = MagicMock()
    context.verify_mode = "CERT_REQUIRED"
    context.check_hostname = True
    return context


@pytest.fixture
def mock_certificate():
    """Mock SSL certificate"""
    cert = MagicMock()
    cert.has_expired.return_value = False
    cert.get_subject().CN = "example.com"
    return cert


# Cache fixtures
@pytest.fixture
def mock_cache():
    """Mock cache implementation"""
    cache = MagicMock()
    cache.get = MagicMock(return_value=None)
    cache.set = MagicMock(return_value=True)
    cache.delete = MagicMock(return_value=True)
    return cache


# Metrics fixtures
@pytest.fixture
def sample_metrics():
    """Sample metrics data"""
    return {"requests": 100, "errors": 5, "latency": 0.1, "success_rate": 0.95}


@pytest.fixture
def mock_prometheus():
    """Mock Prometheus client"""
    client = MagicMock()
    client.Counter = MagicMock()
    client.Gauge = MagicMock()
    client.Histogram = MagicMock()
    return client
