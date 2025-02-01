import pytest
from tradingbot.trading_agent.ai.monitoring_agent import MonitoringAgent


@pytest.fixture
def monitoring_agent():
    return MonitoringAgent(api_key="test_key")


@pytest.fixture
def valid_monitoring_data():
    return {
        "performance_metrics": {
            "cpu_usage": "45%",
            "memory_usage": "60%",
            "response_time": "50ms",
            "throughput": "1000 TPS",
        },
        "trading_metrics": {
            "order_success_rate": "98%",
            "average_slippage": "0.05%",
            "position_changes": "稳定",
            "pnl_status": "盈利",
        },
        "risk_metrics": {
            "risk_exposure": "低",
            "warning_status": "正常",
            "anomaly_events": "无",
            "risk_score": "85",
        },
        "health_metrics": {
            "api_status": "正常",
            "database_status": "正常",
            "queue_status": "正常",
            "error_logs": "无严重错误",
        },
    }


@pytest.fixture
def invalid_monitoring_data():
    return {"performance_metrics": {}, "trading_metrics": {}}


@pytest.mark.asyncio
async def test_validate_input_valid(monitoring_agent, valid_monitoring_data):
    assert monitoring_agent.validate_input(valid_monitoring_data) is True


@pytest.mark.asyncio
async def test_validate_input_invalid(monitoring_agent, invalid_monitoring_data):
    assert monitoring_agent.validate_input(invalid_monitoring_data) is False


@pytest.mark.asyncio
async def test_format_monitoring_data(monitoring_agent, valid_monitoring_data):
    formatted_data = monitoring_agent._format_monitoring_data(valid_monitoring_data)
    assert isinstance(formatted_data, str)
    assert "性能指标:" in formatted_data
    assert "交易指标:" in formatted_data
    assert "风险指标:" in formatted_data
    assert "健康状态:" in formatted_data
    assert "45%" in formatted_data
    assert "98%" in formatted_data
    assert "低" in formatted_data
    assert "正常" in formatted_data


@pytest.mark.asyncio
async def test_process_invalid_data(monitoring_agent, invalid_monitoring_data):
    response = await monitoring_agent.process(invalid_monitoring_data)
    assert response.success is False
    assert "Missing required fields" in response.error


@pytest.mark.asyncio
async def test_process_valid_data(monitoring_agent, valid_monitoring_data):
    response = await monitoring_agent.process(valid_monitoring_data)
    # Since we can't actually call the DeepSeek API in tests,
    # we expect this to fail with an API error
    assert response.success is False
    assert "Error" in response.error


@pytest.mark.asyncio
async def test_monitoring_analysis_prompt_format(monitoring_agent):
    assert "性能监控" in monitoring_agent.MONITORING_ANALYSIS_PROMPT
    assert "交易监控" in monitoring_agent.MONITORING_ANALYSIS_PROMPT
    assert "风险监控" in monitoring_agent.MONITORING_ANALYSIS_PROMPT
    assert "健康检查" in monitoring_agent.MONITORING_ANALYSIS_PROMPT
