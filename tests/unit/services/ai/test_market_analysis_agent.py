import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.market_analysis_agent import MarketAnalysisAgent
from tradingbot.trading_agent.agents.base_agent import AgentResponse


@pytest.fixture
def agent():
    return MarketAnalysisAgent(api_key="test_key")


@pytest.fixture
def valid_input_data():
    return {
        "technical_indicators": {
            "trend_indicators": "上升趋势",
            "support_levels": "19000, 18500",
            "resistance_levels": "21000, 22000",
            "volume_analysis": "成交量增加",
        },
        "fundamental_data": {
            "project_status": "稳定发展",
            "team_assessment": "团队经验丰富",
            "market_position": "市场领先",
        },
        "sentiment_data": {
            "social_sentiment": "积极",
            "news_sentiment": "中性",
            "market_sentiment": "看涨",
        },
        "market_data": {
            "current_price": "20000",
            "24h_volume": "1000000",
            "market_cap": "1000000000",
            "liquidity": "充足",
        },
    }


@pytest.fixture
def mock_deepseek_response():
    return {
        "choices": [
            {
                "message": {
                    "content": """
综合分析结果:
- 市场整体呈现上升趋势
- 基本面稳健
- 情绪面偏向积极

趋势预测:
- 短期看涨
- 中期震荡上行

风险评分: 7/10

建议操作:
- 建议逢低买入
- 设置止损位
"""
                }
            }
        ]
    }


def test_validate_input_valid(agent, valid_input_data):
    """Test input validation with valid data"""
    assert agent.validate_input(valid_input_data) is True


def test_validate_input_invalid(agent):
    """Test input validation with invalid data"""
    invalid_data = {
        "technical_indicators": {},
        "fundamental_data": {},
        # Missing required fields
    }
    assert agent.validate_input(invalid_data) is False


def test_format_market_data(agent, valid_input_data):
    """Test market data formatting"""
    formatted_data = agent._format_market_data(valid_input_data)

    # Check if all sections are present
    assert "技术面数据:" in formatted_data
    assert "基本面数据:" in formatted_data
    assert "情绪面数据:" in formatted_data
    assert "市场数据:" in formatted_data

    # Check if specific data points are included
    assert "上升趋势" in formatted_data
    assert "稳定发展" in formatted_data
    assert "积极" in formatted_data
    assert "20000" in formatted_data


def test_format_market_data_missing_values(agent):
    """Test market data formatting with missing values"""
    incomplete_data = {
        "technical_indicators": {},
        "fundamental_data": {},
        "sentiment_data": {},
        "market_data": {},
    }
    formatted_data = agent._format_market_data(incomplete_data)

    # Check if N/A is used for missing values
    assert "N/A" in formatted_data


@pytest.mark.asyncio
async def test_process_success(agent, valid_input_data, mock_deepseek_response):
    """Test successful processing of market analysis"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_deepseek_response)

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent.process(valid_input_data)

    assert response.success
    assert response.data is not None
    assert response.error is None

    # Verify response contains expected sections
    assert isinstance(response.data, dict)
    assert "综合分析结果" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "趋势预测" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "风险评分" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "建议操作" in mock_deepseek_response["choices"][0]["message"]["content"]


@pytest.mark.asyncio
async def test_process_invalid_input(agent):
    """Test processing with invalid input data"""
    invalid_data = {
        "technical_indicators": {}
        # Missing required fields
    }

    response = await agent.process(invalid_data)
    assert not response.success
    assert response.data is None
    assert "Missing required fields" in response.error


@pytest.mark.asyncio
async def test_process_api_error(agent, valid_input_data):
    """Test handling of API errors during processing"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 500
    mock_response_obj.text = AsyncMock(return_value="Internal Server Error")

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent.process(valid_input_data)

    assert not response.success
    assert response.data is None
    assert "API Error" in response.error


@pytest.mark.asyncio
async def test_process_exception(agent, valid_input_data):
    """Test handling of general exceptions during processing"""
    mock_session = MagicMock()
    mock_session.post = MagicMock(side_effect=Exception("Unexpected error"))

    with patch("aiohttp.ClientSession", return_value=mock_session):
        response = await agent.process(valid_input_data)

    assert not response.success
    assert response.data is None
    assert "Unexpected error" in response.error


@pytest.mark.asyncio
async def test_prompt_formatting(agent, valid_input_data):
    """Test the formatting of the analysis prompt"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(
        return_value={"choices": [{"message": {"content": "test"}}]}
    )

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(
        return_value=mock_response_obj
    )
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await agent.process(valid_input_data)

    # Verify the prompt was formatted correctly
    calls = mock_session.post.call_args_list
    assert len(calls) > 0

    # Check if the formatted prompt contains key sections
    sent_data = calls[0].kwargs["json"]["messages"][0]["content"]
    assert "技术面分析" in agent.MARKET_ANALYSIS_PROMPT
    assert "基本面分析" in agent.MARKET_ANALYSIS_PROMPT
    assert "情绪面分析" in agent.MARKET_ANALYSIS_PROMPT
    assert "风险评估" in agent.MARKET_ANALYSIS_PROMPT
