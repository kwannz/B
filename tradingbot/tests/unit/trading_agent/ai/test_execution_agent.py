import pytest
from tradingbot.trading_agent.ai.execution_agent import ExecutionAgent

@pytest.fixture
def execution_agent():
    return ExecutionAgent(api_key="test_key")

@pytest.fixture
def valid_execution_data():
    return {
        "order_details": {
            "order_type": "限价单",
            "order_size": "10 BTC",
            "target_price": "43500",
            "time_constraint": "1小时"
        },
        "market_conditions": {
            "current_price": "43400",
            "order_book": "深度充足",
            "market_depth": "良好",
            "volume": "活跃"
        },
        "execution_constraints": {
            "max_slippage": "0.1%",
            "min_fill": "1 BTC",
            "price_limits": "±0.5%",
            "execution_speed": "中等"
        },
        "performance_requirements": {
            "latency_requirements": "<100ms",
            "cost_targets": "最小化",
            "execution_quality": "高",
            "risk_controls": "严格"
        }
    }

@pytest.fixture
def invalid_execution_data():
    return {
        "order_details": {},
        "market_conditions": {}
    }

@pytest.mark.asyncio
async def test_validate_input_valid(execution_agent, valid_execution_data):
    assert execution_agent.validate_input(valid_execution_data) is True

@pytest.mark.asyncio
async def test_validate_input_invalid(execution_agent, invalid_execution_data):
    assert execution_agent.validate_input(invalid_execution_data) is False

@pytest.mark.asyncio
async def test_format_execution_data(execution_agent, valid_execution_data):
    formatted_data = execution_agent._format_execution_data(valid_execution_data)
    assert isinstance(formatted_data, str)
    assert "订单详情:" in formatted_data
    assert "市场条件:" in formatted_data
    assert "执行约束:" in formatted_data
    assert "性能要求:" in formatted_data
    assert "限价单" in formatted_data
    assert "43400" in formatted_data
    assert "0.1%" in formatted_data
    assert "<100ms" in formatted_data

@pytest.mark.asyncio
async def test_process_invalid_data(execution_agent, invalid_execution_data):
    response = await execution_agent.process(invalid_execution_data)
    assert response.success is False
    assert "Missing required fields" in response.error

@pytest.mark.asyncio
async def test_process_valid_data(execution_agent, valid_execution_data):
    response = await execution_agent.process(valid_execution_data)
    # Since we can't actually call the DeepSeek API in tests,
    # we expect this to fail with an API error
    assert response.success is False
    assert "Error" in response.error

@pytest.mark.asyncio
async def test_execution_optimization_prompt_format(execution_agent):
    assert "订单执行" in execution_agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "成本分析" in execution_agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "执行监控" in execution_agent.EXECUTION_OPTIMIZATION_PROMPT
    assert "性能优化" in execution_agent.EXECUTION_OPTIMIZATION_PROMPT 