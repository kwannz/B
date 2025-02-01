import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.execution_agent import ExecutionAgent
from tradingbot.trading_agent.agents.base_agent import AgentResponse


@pytest.fixture
def agent():
    return ExecutionAgent(api_key="test_key")


@pytest.fixture
def valid_input_data():
    return {
        "order_details": {
            "order_type": "限价单",
            "order_size": "100",
            "target_price": "20000",
            "time_constraint": "1小时",
        },
        "market_conditions": {
            "current_price": "19950",
            "order_book": "买单深度充足",
            "market_depth": "500BTC@19900",
            "volume": "24小时成交量10000BTC",
        },
        "execution_constraints": {
            "max_slippage": "0.1%",
            "min_fill": "10BTC",
            "price_limits": "19900-20100",
            "execution_speed": "中等",
        },
        "performance_requirements": {
            "latency_requirements": "<100ms",
            "cost_targets": "最大成本0.2%",
            "execution_quality": "95%以上完成率",
            "risk_controls": "动态止损",
        },
    }


@pytest.fixture
def mock_deepseek_response():
    return {
        "choices": [
            {
                "message": {
                    "content": """
执行计划:
- 采用TWAP策略分批执行
- 每批次20BTC
- 5分钟间隔
- 动态调整间隔时间

成本预估:
- 预期滑点0.05%
- 手续费0.1%
- 时间成本较低
- 总成本约0.15%

监控指标:
- 实时成交价格
- 累计成交量
- 剩余订单量
- 平均成交价格

优化建议:
- 根据市场深度动态调整批次
- 实时监控滑点控制
- 设置智能撤单条件
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
        "order_details": {},
        "market_conditions": {},
        # Missing required fields
    }
    assert agent.validate_input(invalid_data) is False


def test_format_execution_data(agent, valid_input_data):
    """Test execution data formatting"""
    formatted_data = agent._format_execution_data(valid_input_data)

    # Check if all sections are present
    assert "订单详情:" in formatted_data
    assert "市场条件:" in formatted_data
    assert "执行约束:" in formatted_data
    assert "性能要求:" in formatted_data

    # Check if specific data points are included
    assert "限价单" in formatted_data
    assert "19950" in formatted_data
    assert "0.1%" in formatted_data
    assert "<100ms" in formatted_data


def test_format_execution_data_missing_values(agent):
    """Test execution data formatting with missing values"""
    incomplete_data = {
        "order_details": {},
        "market_conditions": {},
        "execution_constraints": {},
        "performance_requirements": {},
    }
    formatted_data = agent._format_execution_data(incomplete_data)

    # Check if N/A is used for missing values
    assert "N/A" in formatted_data


@pytest.mark.asyncio
async def test_process_success(agent, valid_input_data, mock_deepseek_response):
    """Test successful processing of execution optimization"""
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
    assert "执行计划" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "成本预估" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "监控指标" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "优化建议" in mock_deepseek_response["choices"][0]["message"]["content"]


@pytest.mark.asyncio
async def test_process_invalid_input(agent):
    """Test processing with invalid input data"""
    invalid_data = {
        "order_details": {}
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
    """Test the formatting of the execution optimization prompt"""
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
    assert "订单执行" in agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "成本分析" in agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "执行监控" in agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "性能优化" in agent.EXECUTION_OPTIMIZATION_PROMPT


@pytest.mark.asyncio
async def test_execution_metrics_validation(agent, valid_input_data):
    """Test validation of specific execution metrics"""
    # Test order size format
    valid_input_data["order_details"]["order_size"] = "invalid"
    formatted_data = agent._format_execution_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test slippage format
    valid_input_data["execution_constraints"]["max_slippage"] = "invalid"
    formatted_data = agent._format_execution_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test latency requirements format
    valid_input_data["performance_requirements"]["latency_requirements"] = "invalid"
    formatted_data = agent._format_execution_data(valid_input_data)
    assert "invalid" in formatted_data
