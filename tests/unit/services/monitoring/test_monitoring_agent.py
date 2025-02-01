import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.trading_agent.agents.monitoring_agent import MonitoringAgent
from tradingbot.trading_agent.agents.base_agent import AgentResponse


@pytest.fixture
def agent():
    return MonitoringAgent(api_key="test_key")


@pytest.fixture
def valid_input_data():
    return {
        "performance_metrics": {
            "cpu_usage": "45%",
            "memory_usage": "60%",
            "response_time": "150ms",
            "throughput": "1000 TPS",
        },
        "trading_metrics": {
            "order_success_rate": "98%",
            "average_slippage": "0.1%",
            "position_changes": "稳定",
            "pnl_status": "盈利中",
        },
        "risk_metrics": {
            "risk_exposure": "中等",
            "warning_status": "正常",
            "anomaly_events": "无",
            "risk_score": "75/100",
        },
        "health_metrics": {
            "api_status": "正常",
            "database_status": "正常",
            "queue_status": "正常",
            "error_logs": "无严重错误",
        },
    }


@pytest.fixture
def mock_deepseek_response():
    return {
        "choices": [
            {
                "message": {
                    "content": """
系统状态评估:
- 系统整体运行正常
- 性能指标良好
- 风险控制有效

异常检测结果:
- 未发现严重异常
- 所有组件正常运行

性能分析:
- CPU和内存使用率在正常范围
- 响应时间达标
- 吞吐量充足

优化建议:
- 继续监控内存使用趋势
- 考虑优化数据库查询
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
        "performance_metrics": {},
        "trading_metrics": {},
        # Missing required fields
    }
    assert agent.validate_input(invalid_data) is False


def test_format_monitoring_data(agent, valid_input_data):
    """Test monitoring data formatting"""
    formatted_data = agent._format_monitoring_data(valid_input_data)

    # Check if all sections are present
    assert "性能指标:" in formatted_data
    assert "交易指标:" in formatted_data
    assert "风险指标:" in formatted_data
    assert "健康状态:" in formatted_data

    # Check if specific data points are included
    assert "45%" in formatted_data
    assert "98%" in formatted_data
    assert "中等" in formatted_data
    assert "正常" in formatted_data


def test_format_monitoring_data_missing_values(agent):
    """Test monitoring data formatting with missing values"""
    incomplete_data = {
        "performance_metrics": {},
        "trading_metrics": {},
        "risk_metrics": {},
        "health_metrics": {},
    }
    formatted_data = agent._format_monitoring_data(incomplete_data)

    # Check if N/A is used for missing values
    assert "N/A" in formatted_data


@pytest.mark.asyncio
async def test_process_success(agent, valid_input_data, mock_deepseek_response):
    """Test successful processing of monitoring data"""
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
    assert "系统状态评估" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "异常检测结果" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "性能分析" in mock_deepseek_response["choices"][0]["message"]["content"]
    assert "优化建议" in mock_deepseek_response["choices"][0]["message"]["content"]


@pytest.mark.asyncio
async def test_process_invalid_input(agent):
    """Test processing with invalid input data"""
    invalid_data = {
        "performance_metrics": {}
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
    """Test the formatting of the monitoring prompt"""
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
    assert "性能监控" in agent.MONITORING_ANALYSIS_PROMPT
    assert "交易监控" in agent.MONITORING_ANALYSIS_PROMPT
    assert "风险监控" in agent.MONITORING_ANALYSIS_PROMPT
    assert "健康检查" in agent.MONITORING_ANALYSIS_PROMPT


@pytest.mark.asyncio
async def test_monitoring_metrics_validation(agent, valid_input_data):
    """Test validation of specific monitoring metrics"""
    # Test CPU usage format
    valid_input_data["performance_metrics"]["cpu_usage"] = "invalid"
    formatted_data = agent._format_monitoring_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test response time format
    valid_input_data["performance_metrics"]["response_time"] = "invalid"
    formatted_data = agent._format_monitoring_data(valid_input_data)
    assert "invalid" in formatted_data

    # Test risk score format
    valid_input_data["risk_metrics"]["risk_score"] = "invalid"
    formatted_data = agent._format_monitoring_data(valid_input_data)
    assert "invalid" in formatted_data
