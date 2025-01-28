import pytest
from tradingbot.trading_agent.ai.market_analysis_agent import MarketAnalysisAgent

@pytest.fixture
def market_agent():
    return MarketAnalysisAgent(api_key="test_key")

@pytest.fixture
def valid_market_data():
    return {
        "technical_indicators": {
            "trend_indicators": "上升趋势",
            "support_levels": "42000",
            "resistance_levels": "45000",
            "volume_analysis": "放量上涨"
        },
        "fundamental_data": {
            "project_status": "良好",
            "team_assessment": "专业团队",
            "market_position": "市场领先"
        },
        "sentiment_data": {
            "social_sentiment": "积极",
            "news_sentiment": "正面",
            "market_sentiment": "看涨"
        },
        "market_data": {
            "current_price": "43500",
            "24h_volume": "1.5B",
            "market_cap": "800B",
            "liquidity": "充足"
        }
    }

@pytest.fixture
def invalid_market_data():
    return {
        "technical_indicators": {},
        "fundamental_data": {}
    }

@pytest.mark.asyncio
async def test_validate_input_valid(market_agent, valid_market_data):
    assert market_agent.validate_input(valid_market_data) is True

@pytest.mark.asyncio
async def test_validate_input_invalid(market_agent, invalid_market_data):
    assert market_agent.validate_input(invalid_market_data) is False

@pytest.mark.asyncio
async def test_format_market_data(market_agent, valid_market_data):
    formatted_data = market_agent._format_market_data(valid_market_data)
    assert isinstance(formatted_data, str)
    assert "技术面数据:" in formatted_data
    assert "基本面数据:" in formatted_data
    assert "情绪面数据:" in formatted_data
    assert "市场数据:" in formatted_data
    assert "上升趋势" in formatted_data
    assert "良好" in formatted_data
    assert "积极" in formatted_data
    assert "43500" in formatted_data

@pytest.mark.asyncio
async def test_process_invalid_data(market_agent, invalid_market_data):
    response = await market_agent.process(invalid_market_data)
    assert response.success is False
    assert "Missing required fields" in response.error

@pytest.mark.asyncio
async def test_process_valid_data(market_agent, valid_market_data):
    response = await market_agent.process(valid_market_data)
    # Since we can't actually call the DeepSeek API in tests,
    # we expect this to fail with an API error
    assert response.success is False
    assert "Error" in response.error

@pytest.mark.asyncio
async def test_market_analysis_prompt_format(market_agent):
    assert "技术面分析" in market_agent.MARKET_ANALYSIS_PROMPT
    assert "基本面分析" in market_agent.MARKET_ANALYSIS_PROMPT
    assert "情绪面分析" in market_agent.MARKET_ANALYSIS_PROMPT
    assert "风险评估" in market_agent.MARKET_ANALYSIS_PROMPT 