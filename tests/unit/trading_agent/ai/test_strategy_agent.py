import pytest
from tradingbot.trading_agent.ai.strategy_agent import StrategyAgent


@pytest.fixture
def strategy_agent():
    return StrategyAgent(api_key="test_key")


@pytest.fixture
def valid_strategy_data():
    return {
        "market_environment": {
            "market_state": "上升趋势",
            "trend_strength": "强",
            "volatility": "中等",
            "liquidity": "充足",
        },
        "historical_data": {
            "price_data": "过去30天数据",
            "volume_data": "日均成交量增长",
            "historical_volatility": "20%",
            "correlations": "低相关性",
        },
        "risk_parameters": {
            "risk_tolerance": "中等",
            "max_drawdown": "10%",
            "stop_loss_levels": "5%",
            "risk_diversification": "已分散",
        },
        "performance_metrics": {
            "historical_returns": "15%",
            "sharpe_ratio": "2.1",
            "information_ratio": "1.8",
            "win_rate": "65%",
        },
    }


@pytest.fixture
def invalid_strategy_data():
    return {"market_environment": {}, "historical_data": {}}


@pytest.mark.asyncio
async def test_validate_input_valid(strategy_agent, valid_strategy_data):
    assert strategy_agent.validate_input(valid_strategy_data) is True


@pytest.mark.asyncio
async def test_validate_input_invalid(strategy_agent, invalid_strategy_data):
    assert strategy_agent.validate_input(invalid_strategy_data) is False


@pytest.mark.asyncio
async def test_format_strategy_data(strategy_agent, valid_strategy_data):
    formatted_data = strategy_agent._format_strategy_data(valid_strategy_data)
    assert isinstance(formatted_data, str)
    assert "市场环境数据:" in formatted_data
    assert "历史数据:" in formatted_data
    assert "风险参数:" in formatted_data
    assert "性能指标:" in formatted_data
    assert "上升趋势" in formatted_data
    assert "过去30天数据" in formatted_data
    assert "中等" in formatted_data
    assert "15%" in formatted_data


@pytest.mark.asyncio
async def test_process_invalid_data(strategy_agent, invalid_strategy_data):
    response = await strategy_agent.process(invalid_strategy_data)
    assert response.success is False
    assert "Missing required fields" in response.error


@pytest.mark.asyncio
async def test_process_valid_data(strategy_agent, valid_strategy_data):
    response = await strategy_agent.process(valid_strategy_data)
    # Since we can't actually call the DeepSeek API in tests,
    # we expect this to fail with an API error
    assert response.success is False
    assert "Error" in response.error


@pytest.mark.asyncio
async def test_strategy_generation_prompt_format(strategy_agent):
    assert "策略选择" in strategy_agent.STRATEGY_GENERATION_PROMPT
    assert "参数优化" in strategy_agent.STRATEGY_GENERATION_PROMPT
    assert "执行计划" in strategy_agent.STRATEGY_GENERATION_PROMPT
    assert "策略调整" in strategy_agent.STRATEGY_GENERATION_PROMPT
