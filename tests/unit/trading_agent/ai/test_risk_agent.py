import pytest
from tradingbot.trading_agent.ai.risk_agent import RiskAgent

@pytest.fixture
def risk_agent():
    return RiskAgent(api_key="test_key")

@pytest.fixture
def valid_risk_data():
    return {
        "portfolio_data": {
            "position_distribution": "分散持仓",
            "asset_correlation": "低相关性",
            "concentration_metrics": "适中",
            "risk_exposure": "可控"
        },
        "market_risk_data": {
            "volatility_metrics": "中等波动",
            "liquidity_metrics": "充足",
            "price_impact": "较小",
            "market_depth": "良好"
        },
        "counterparty_data": {
            "counterparty_rating": "A+",
            "credit_risk_metrics": "低风险",
            "default_probability": "0.1%"
        },
        "systemic_risk_data": {
            "market_environment": "稳定",
            "macro_indicators": "良好",
            "system_vulnerability": "低",
            "stress_scenarios": "通过压力测试"
        }
    }

@pytest.fixture
def invalid_risk_data():
    return {
        "portfolio_data": {},
        "market_risk_data": {}
    }

@pytest.mark.asyncio
async def test_validate_input_valid(risk_agent, valid_risk_data):
    assert risk_agent.validate_input(valid_risk_data) is True

@pytest.mark.asyncio
async def test_validate_input_invalid(risk_agent, invalid_risk_data):
    assert risk_agent.validate_input(invalid_risk_data) is False

@pytest.mark.asyncio
async def test_format_risk_data(risk_agent, valid_risk_data):
    formatted_data = risk_agent._format_risk_data(valid_risk_data)
    assert isinstance(formatted_data, str)
    assert "投资组合风险数据:" in formatted_data
    assert "市场风险数据:" in formatted_data
    assert "对手方风险数据:" in formatted_data
    assert "系统性风险数据:" in formatted_data
    assert "分散持仓" in formatted_data
    assert "中等波动" in formatted_data
    assert "A+" in formatted_data
    assert "稳定" in formatted_data

@pytest.mark.asyncio
async def test_process_invalid_data(risk_agent, invalid_risk_data):
    response = await risk_agent.process(invalid_risk_data)
    assert response.success is False
    assert "Missing required fields" in response.error

@pytest.mark.asyncio
async def test_process_valid_data(risk_agent, valid_risk_data):
    response = await risk_agent.process(valid_risk_data)
    # Since we can't actually call the DeepSeek API in tests,
    # we expect this to fail with an API error
    assert response.success is False
    assert "Error" in response.error

@pytest.mark.asyncio
async def test_risk_analysis_prompt_format(risk_agent):
    assert "投资组合风险" in risk_agent.RISK_ANALYSIS_PROMPT
    assert "市场风险" in risk_agent.RISK_ANALYSIS_PROMPT
    assert "对手方风险" in risk_agent.RISK_ANALYSIS_PROMPT
    assert "系统性风险" in risk_agent.RISK_ANALYSIS_PROMPT 