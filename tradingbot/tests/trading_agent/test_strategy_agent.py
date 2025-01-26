import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.strategy_agent import StrategyAgent
from tradingbot.trading_agent.agents.base_agent import AgentResponse

@pytest.fixture
def agent():
    return StrategyAgent(api_key="test_key")

@pytest.fixture
def valid_input_data():
    return {
        "market_environment": {
            "market_state": "上升趋势",
            "trend_strength": "强",
            "volatility": "中等",
            "liquidity": "充足"
        },
        "historical_data": {
            "price_data": "最近30天数据",
            "volume_data": "日均成交量增加",
            "historical_volatility": "20%",
            "correlations": "与大盘相关性0.7"
        },
        "risk_parameters": {
            "risk_tolerance": "中等",
            "max_drawdown": "15%",
            "stop_loss_levels": "5%",
            "risk_diversification": "多策略组合"
        },
        "performance_metrics": {
            "historical_returns": "年化25%",
            "sharpe_ratio": "2.1",
            "information_ratio": "1.5",
            "win_rate": "65%"
        }
    }

@pytest.fixture
def mock_deepseek_response():
    return {
        "choices": [
            {
                "message": {
                    "content": """
策略建议:
- 采用趋势跟踪策略
- 结合动量指标
- 分批建仓以分散风险

参数配置:
- 趋势确认周期: 14天
- 动量指标参数: RSI(14)
- 建仓比例: 30%-40%-30%

执行计划:
- 突破确认后入场
- 分3次建仓
- 跟踪止损5%

风险控制措施:
- 单次仓位不超过20%
- 总敞口控制在50%以内
- 设置移动止损
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
        "market_environment": {},
        "historical_data": {}
        # Missing required fields
    }
    assert agent.validate_input(invalid_data) is False

def test_format_strategy_data(agent, valid_input_data):
    """Test strategy data formatting"""
    formatted_data = agent._format_strategy_data(valid_input_data)
    
    # Check if all sections are present
    assert "市场环境数据:" in formatted_data
    assert "历史数据:" in formatted_data
    assert "风险参数:" in formatted_data
    assert "性能指标:" in formatted_data
    
    # Check if specific data points are included
    assert "上升趋势" in formatted_data
    assert "20%" in formatted_data
    assert "中等" in formatted_data
    assert "2.1" in formatted_data

def test_format_strategy_data_missing_values(agent):
    """Test strategy data formatting with missing values"""
    incomplete_data = {
        "market_environment": {},
        "historical_data": {},
        "risk_parameters": {},
        "performance_metrics": {}
    }
    formatted_data = agent._format_strategy_data(incomplete_data)
    
    # Check if N/A is used for missing values
    assert "N/A" in formatted_data

@pytest.mark.asyncio
async def test_process_success(agent, valid_input_data, mock_deepseek_response):
    """Test successful processing of strategy generation"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_deepseek_response)

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(return_value=mock_response_obj)
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)
    
    with patch('aiohttp.ClientSession', return_value=mock_session):
        response = await agent.process(valid_input_data)
    
    assert response.success
    assert response.data is not None
    assert response.error is None
    
    # Verify response contains expected sections
    assert isinstance(response.data, dict)
    assert "策略建议" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "参数配置" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "执行计划" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "风险控制措施" in mock_deepseek_response["choices"][0]["message"]["content"]

@pytest.mark.asyncio
async def test_process_invalid_input(agent):
    """Test processing with invalid input data"""
    invalid_data = {
        "market_environment": {}
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
    mock_session.post.return_value.__aenter__ = AsyncMock(return_value=mock_response_obj)
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)
    
    with patch('aiohttp.ClientSession', return_value=mock_session):
        response = await agent.process(valid_input_data)
    
    assert not response.success
    assert response.data is None
    assert "API Error" in response.error

@pytest.mark.asyncio
async def test_process_exception(agent, valid_input_data):
    """Test handling of general exceptions during processing"""
    mock_session = MagicMock()
    mock_session.post = MagicMock(side_effect=Exception("Unexpected error"))
    
    with patch('aiohttp.ClientSession', return_value=mock_session):
        response = await agent.process(valid_input_data)
    
    assert not response.success
    assert response.data is None
    assert "Unexpected error" in response.error

@pytest.mark.asyncio
async def test_prompt_formatting(agent, valid_input_data):
    """Test the formatting of the strategy generation prompt"""
    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value={"choices": [{"message": {"content": "test"}}]})

    mock_session = MagicMock()
    mock_session.post = MagicMock()
    mock_session.post.return_value.__aenter__ = AsyncMock(return_value=mock_response_obj)
    mock_session.post.return_value.__aexit__ = AsyncMock(return_value=None)
    
    with patch('aiohttp.ClientSession', return_value=mock_session):
        await agent.process(valid_input_data)
    
    # Verify the prompt was formatted correctly
    calls = mock_session.post.call_args_list
    assert len(calls) > 0
    
    # Check if the formatted prompt contains key sections
    sent_data = calls[0].kwargs['json']['messages'][0]['content']
    assert "策略选择" in agent.STRATEGY_GENERATION_PROMPT
    assert "参数优化" in agent.STRATEGY_GENERATION_PROMPT
    assert "执行计划" in agent.STRATEGY_GENERATION_PROMPT
    assert "策略调整" in agent.STRATEGY_GENERATION_PROMPT

@pytest.mark.asyncio
async def test_strategy_metrics_validation(agent, valid_input_data):
    """Test validation of specific strategy metrics"""
    # Test trend strength format
    valid_input_data["market_environment"]["trend_strength"] = "invalid"
    formatted_data = agent._format_strategy_data(valid_input_data)
    assert "invalid" in formatted_data
    
    # Test historical volatility format
    valid_input_data["historical_data"]["historical_volatility"] = "invalid"
    formatted_data = agent._format_strategy_data(valid_input_data)
    assert "invalid" in formatted_data
    
    # Test sharpe ratio format
    valid_input_data["performance_metrics"]["sharpe_ratio"] = "invalid"
    formatted_data = agent._format_strategy_data(valid_input_data)
    assert "invalid" in formatted_data
