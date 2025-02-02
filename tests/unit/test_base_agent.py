import asyncio
import json
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import aiohttp
import pytest
from prometheus_client import REGISTRY

from tradingbot.backend.trading_agent.agents.base_agent import AgentResponse, BaseAgent
from tradingbot.shared.models.errors import TradingError


# Test implementation of BaseAgent since it's abstract
class TestAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="test_agent", agent_type="test", config={"test_config": "value"}
        )
        self.cache_hit_count = 0
        self.cache_miss_count = 0
        self.error_count = 0

    async def process_request(self, request: Dict[str, Any]) -> AgentResponse:
        if not request:
            raise TradingError("Empty request")
        return AgentResponse(success=True, data=request)

    async def start(self):
        """Start the agent"""
        pass

    async def stop(self):
        """Stop the agent"""
        pass

    async def update_config(self, config: Dict[str, Any]):
        """Update agent configuration"""
        pass


@pytest.fixture
def agent():
    return TestAgent()


@pytest.fixture
def mock_response():
    return {"choices": [{"message": {"content": "test response"}}]}


@pytest.mark.asyncio
async def test_agent_init():
    """Test agent initialization"""
    agent = TestAgent()
    assert agent.session is None
    assert agent.agent_type == "TestAgent"


@pytest.mark.asyncio
async def test_context_manager():
    """Test async context manager methods"""
    async with TestAgent() as agent:
        assert isinstance(agent.session, aiohttp.ClientSession)
        assert not agent.session.closed
    assert agent.session.closed


@pytest.mark.asyncio
async def test_call_deepseek_success(agent, mock_response):
    """Test successful API call to DeepSeek"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_response)

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent._call_deepseek("test prompt")

    assert response.success
    assert response.data == "test response"
    assert response.error is None


@pytest.mark.asyncio
async def test_call_deepseek_api_error(agent):
    """Test API error handling"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 400
    mock_response_obj.text = AsyncMock(return_value="API Error")

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent._call_deepseek("test prompt")

    assert not response.success
    assert response.data is None
    assert "API Error" in response.error


@pytest.mark.asyncio
async def test_call_deepseek_connection_error(agent):
    """Test connection error handling"""
    mock_session = MagicMock()
    mock_session.post = MagicMock(side_effect=Exception("Connection Error"))

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent._call_deepseek("test prompt")

    assert not response.success
    assert response.data is None
    assert "Connection Error" in response.error


def test_parse_response_json(agent):
    """Test parsing JSON response"""
    json_str = '{"key": "value"}'
    result = agent._parse_response(json_str)
    assert result == {"key": "value"}


def test_parse_response_text(agent):
    """Test parsing non-JSON response"""
    text = "plain text response"
    result = agent._parse_response(text)
    assert result == {"text": text}


def test_format_prompt_success(agent):
    """Test successful prompt formatting"""
    template = "Hello {name}!"
    result = agent._format_prompt(template, name="World")
    assert result == "Hello World!"


def test_format_prompt_error(agent):
    """Test prompt formatting error"""
    template = "Hello {name}!"
    with pytest.raises(ValueError):
        agent._format_prompt(template, wrong_param="World")


@pytest.mark.asyncio
async def test_handle_error(agent):
    """Test error handling"""
    error = Exception("Test Error")
    response = await agent._handle_error(error)
    assert not response.success
    assert response.data is None
    assert "Test Error" in response.error


@pytest.mark.asyncio
async def test_metrics_tracking(agent, mock_response):
    """Test Prometheus metrics tracking"""
    # Get initial metric values
    initial_requests = (
        REGISTRY.get_sample_value(
            "ai_agent_requests_total", {"agent_type": "TestAgent", "status": "success"}
        )
        or 0
    )

    initial_errors = (
        REGISTRY.get_sample_value(
            "ai_agent_api_errors_total",
            {"agent_type": "TestAgent", "error_type": "api_error"},
        )
        or 0
    )

    # Make successful API call
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_response)

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await agent._call_deepseek("test prompt")

    # Verify metrics were updated
    final_requests = (
        REGISTRY.get_sample_value(
            "ai_agent_requests_total", {"agent_type": "TestAgent", "status": "success"}
        )
        or 0
    )

    assert final_requests > initial_requests

    # Test error metrics
    mock_response_obj.status = 400
    mock_response_obj.text = AsyncMock(return_value="API Error")

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await agent._call_deepseek("test prompt")

    final_errors = (
        REGISTRY.get_sample_value(
            "ai_agent_api_errors_total",
            {"agent_type": "TestAgent", "error_type": "api_error"},
        )
        or 0
    )

    assert final_errors > initial_errors


@pytest.mark.asyncio
async def test_agent_response_dataclass():
    """Test AgentResponse dataclass"""
    # Test successful response
    response = AgentResponse(success=True, data={"test": "data"})
    assert response.success
    assert response.data == {"test": "data"}
    assert response.error is None

    # Test error response
    response = AgentResponse(success=False, data=None, error="Test error")
    assert not response.success
    assert response.data is None
    assert response.error == "Test error"


@pytest.mark.asyncio
async def test_base_agent_request_validation():
    agent = TestAgent()

    # Test empty request
    with pytest.raises(TradingError):
        await agent.process_request({})

    # Test valid request
    request = {"test": "data"}
    response = await agent.process_request(request)
    assert response.success
    assert response.data == request


@pytest.mark.asyncio
async def test_base_agent_cache_operations_advanced():
    agent = TestAgent()

    # Test cache operations with different data types
    test_cases = [
        ("key1", "value1"),
        ("key2", 123),
        ("key3", {"nested": "data"}),
        ("key4", None),
    ]

    for key, value in test_cases:
        # Test cache set
        await agent.set_cache(key, value)

        # Test cache get
        result = await agent.get_cache(key)
        if value is None:
            assert result == {}
        else:
            assert result == value


@pytest.mark.asyncio
async def test_base_agent_metrics_detailed():
    agent = TestAgent()

    # Simulate mixed cache hits and misses
    await agent.set_cache("key1", "value1")
    await agent.get_cache("key1")  # Hit
    await agent.get_cache("key2")  # Miss

    metrics = agent.get_metrics()
    assert metrics["cache_hit_count"] >= 1
    assert metrics["cache_miss_count"] >= 1
    assert metrics["error_count"] == 0


@pytest.mark.asyncio
async def test_base_agent_concurrent_cache_access():
    agent = TestAgent()

    # Test concurrent cache operations
    await agent.set_cache("concurrent_key", "value")

    # Simulate multiple concurrent reads
    results = await asyncio.gather(
        *[agent.get_cache("concurrent_key") for _ in range(5)]
    )

    # Verify all reads return the same value
    assert all(result == "value" for result in results)
