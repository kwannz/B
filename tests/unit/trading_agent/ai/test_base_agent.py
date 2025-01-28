import pytest
from typing import Dict, Any
from tradingbot.trading_agent.ai.base_agent import BaseAgent, AgentResponse

class TestAgent(BaseAgent):
    """Test implementation of BaseAgent for testing"""
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        return True

    async def process(self, input_data: Dict[str, Any]) -> AgentResponse:
        return AgentResponse(success=True, data=input_data)

@pytest.fixture
def test_agent():
    return TestAgent(api_key="test_key")

@pytest.mark.asyncio
async def test_agent_initialization(test_agent):
    assert test_agent.api_key == "test_key"
    assert test_agent.model_name == "deepseek-chat"
    assert test_agent.session is None

@pytest.mark.asyncio
async def test_context_manager():
    async with TestAgent(api_key="test_key") as agent:
        assert agent.session is not None
    assert agent.session.closed

@pytest.mark.asyncio
async def test_format_prompt(test_agent):
    template = "Test {value1} and {value2}"
    result = test_agent._format_prompt(template, value1="hello", value2="world")
    assert result == "Test hello and world"

@pytest.mark.asyncio
async def test_format_prompt_missing_param(test_agent):
    template = "Test {value1} and {value2}"
    with pytest.raises(ValueError):
        test_agent._format_prompt(template, value1="hello")

@pytest.mark.asyncio
async def test_parse_response(test_agent):
    # Test JSON response
    json_response = '{"key": "value"}'
    result = test_agent._parse_response(json_response)
    assert result == {"key": "value"}

    # Test text response
    text_response = "Not a JSON response"
    result = test_agent._parse_response(text_response)
    assert result == {"text": "Not a JSON response"}

@pytest.mark.asyncio
async def test_handle_error(test_agent):
    error = Exception("Test error")
    response = await test_agent._handle_error(error)
    assert response.success is False
    assert response.error == "Test error"
    assert response.data is None

@pytest.mark.asyncio
async def test_call_deepseek_error(test_agent):
    # Test API error response
    response = await test_agent._call_deepseek("test prompt")
    assert response.success is False
    assert "Error" in response.error 