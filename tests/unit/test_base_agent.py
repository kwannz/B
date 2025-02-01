import pytest
import aiohttp
import json
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.base_agent import BaseAgent, AgentResponse
from prometheus_client import REGISTRY


# Test implementation of BaseAgent since it's abstract
class TestAgent(BaseAgent):
    async def process(self, input_data):
        return AgentResponse(success=True, data=input_data)

    def validate_input(self, input_data):
        return True


@pytest.fixture
def agent():
    return TestAgent(api_key="test_key")


@pytest.fixture
def mock_response():
    return {"choices": [{"message": {"content": "test response"}}]}


@pytest.mark.asyncio
async def test_agent_init():
    """Test agent initialization"""
    agent = TestAgent(api_key="test_key", model_name="test-model")
    assert agent.api_key == "test_key"
    assert agent.model_name == "test-model"
    assert agent.session is None
    assert agent.agent_type == "TestAgent"


@pytest.mark.asyncio
async def test_context_manager():
    """Test async context manager methods"""
    async with TestAgent(api_key="test_key") as agent:
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
