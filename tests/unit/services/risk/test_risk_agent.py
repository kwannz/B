import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.risk_agent import RiskAgent
from tradingbot.trading_agent.agents.base_agent import AgentResponse


@pytest.fixture
def agent():
    return RiskAgent(api_key="test_key")


@pytest.fixture
def valid_input_data():
    return {
        "portfolio_data": {
            "position_distribution": "分散投资",
            "asset_correlation": "低相关性",
            "concentration_metrics": "适中",
            "risk_exposure": "可控范围内",
        },
        "market_risk_data": {
            "volatility_metrics": "20日波动率15%",
            "liquidity_metrics": "日均成交量充足",
            "price_impact": "较小",
            "market_depth": "充足",
        },
        "counterparty_data": {
            "counterparty_rating": "A级",
            "credit_risk_metrics": "低风险",
            "default_probability": "0.1%",
        },
        "systemic_risk_data": {
            "market_environment": "稳定",
            "macro_indicators": "经济增长",
            "system_vulnerability": "低",
            "stress_scenarios": "通过压力测试",
        },
    }


@pytest.fixture
def mock_deepseek_response():
    return {
        "choices": [
            {
                "message": {
                    "content": """
风险评分:
- 总体风险: 3/10
- 投资组合风险: 2/10
- 市场风险: 3/10
- 对手方风险: 2/10
- 系统性风险: 4/10

风险分解:
- 主要风险来自市场波动
- 投资组合分散度良好
- 对手方信用风险可控

预警信号:
- 市场波动率略有上升
- 需要关注宏观经济变化

对冲建议:
- 保持当前分散投资策略
- 适当增加对冲工具
- 动态调整风险敞口
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
        "portfolio_data": {},
        "market_risk_data": {},
        # Missing required fields
    }
    assert agent.validate_input(invalid_data) is False


def test_format_risk_data(agent, valid_input_data):
    """Test risk data formatting"""
    formatted_data = agent._format_risk_data(valid_input_data)

    # Check if all sections are present
    assert "投资组合风险数据:" in formatted_data
    assert "市场风险数据:" in formatted_data
    assert "对手方风险数据:" in formatted_data
    assert "系统性风险数据:" in formatted_data

    # Check if specific data points are included
    assert "分散投资" in formatted_data
    assert "20日波动率15%" in formatted_data
    assert "A级" in formatted_data
    assert "稳定" in formatted_data


def test_format_risk_data_missing_values(agent):
    """Test risk data formatting with missing values"""
    incomplete_data = {
        "portfolio_data": {},
        "market_risk_data": {},
        "counterparty_data": {},
        "systemic_risk_data": {},
    }
    formatted_data = agent._format_risk_data(incomplete_data)

    # Check if N/A is used for missing values
    assert "N/A" in formatted_data


@pytest.mark.asyncio
async def test_process_success(agent, valid_input_data, mock_deepseek_response):
    """Test successful processing of risk analysis"""
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
    assert "风险评分" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "风险分解" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "预警信号" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "对冲建议" in mock_deepseek_response["choices"][0]["message"]["content"]


@pytest.mark.asyncio
async def test_process_invalid_input(agent):
    """Test processing with invalid input data"""
    invalid_data = {
        "portfolio_data": {}
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
    """Test the formatting of the risk analysis prompt"""
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
    assert "投资组合风险" in agent.RISK_ANALYSIS_PROMPT
    assert "市场风险" in agent.RISK_ANALYSIS_PROMPT
    assert "对手方风险" in agent.RISK_ANALYSIS_PROMPT
    assert "系统性风险" in agent.RISK_ANALYSIS_PROMPT


@pytest.mark.asyncio
async def test_risk_metrics_validation(agent, valid_input_data):
    """Test validation of specific risk metrics"""
    # Test volatility metrics format
    valid_input_data["market_risk_data"]["volatility_metrics"] = "invalid"
    formatted_data = agent._format_risk_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test counterparty rating format
    valid_input_data["counterparty_data"]["counterparty_rating"] = "invalid"
    formatted_data = agent._format_risk_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test market environment format
    valid_input_data["systemic_risk_data"]["market_environment"] = "invalid"
    formatted_data = agent._format_risk_data(valid_input_data)
    assert "invalid" in formatted_data
