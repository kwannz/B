import pytest
import asyncio
from tradingbot.shared.ai_analyzer import AIAnalyzer

@pytest.fixture
def ai_analyzer():
    return AIAnalyzer()

@pytest.mark.asyncio
async def test_ai_analyzer_initialization(ai_analyzer):
    """Test AIAnalyzer initialization"""
    assert ai_analyzer.api_key is None
    assert ai_analyzer.api_url is None
    assert ai_analyzer.is_running is False
    assert ai_analyzer.retry_count == 3
    assert ai_analyzer.retry_delay == 1

@pytest.mark.asyncio
async def test_start_stop(ai_analyzer):
    """Test start and stop functionality"""
    await ai_analyzer.start()
    assert ai_analyzer.is_running is True
    
    await ai_analyzer.stop()
    assert ai_analyzer.is_running is False

@pytest.mark.asyncio
async def test_analyze_market_data_validation(ai_analyzer):
    """Test market data validation"""
    await ai_analyzer.start()
    
    # Test invalid input
    with pytest.raises(ValueError, match="Invalid market data"):
        await ai_analyzer.analyze_market_data(None)
    
    with pytest.raises(ValueError, match="Invalid market data"):
        await ai_analyzer.analyze_market_data("not a dict")
    
    with pytest.raises(ValueError, match="Missing required field: price"):
        await ai_analyzer.analyze_market_data({})
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_market_data_success(ai_analyzer):
    """Test successful market data analysis"""
    await ai_analyzer.start()
    
    market_data = {
        "price": 20000,
        "volume": 1000,
        "timestamp": "2024-01-24T12:00:00Z"
    }
    
    result = await ai_analyzer.analyze_market_data(market_data)
    
    assert isinstance(result, dict)
    assert "market_trend" in result
    assert "confidence" in result
    assert "indicators" in result
    assert isinstance(result["indicators"], dict)
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_market_trends(ai_analyzer):
    """Test market trends analysis"""
    await ai_analyzer.start()
    
    # Test with empty data
    with pytest.raises(ValueError, match="Insufficient historical data"):
        await ai_analyzer.analyze_market_trends([])
    
    # Test with valid data
    historical_data = [
        {"price": 19000, "timestamp": "2024-01-23T12:00:00Z"},
        {"price": 20000, "timestamp": "2024-01-24T12:00:00Z"}
    ]
    
    result = await ai_analyzer.analyze_market_trends(historical_data)
    
    assert isinstance(result, dict)
    assert "trend_analysis" in result
    assert "prediction" in result
    assert "confidence" in result
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_volume_profile(ai_analyzer):
    """Test volume profile analysis"""
    await ai_analyzer.start()
    
    volume_data = [
        {"price": 19000, "volume": 100},
        {"price": 20000, "volume": 200}
    ]
    
    result = await ai_analyzer.analyze_volume_profile(volume_data)
    
    assert isinstance(result, dict)
    assert "volume_by_price" in result
    assert "high_volume_nodes" in result
    assert "low_volume_nodes" in result
    assert isinstance(result["high_volume_nodes"], list)
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_market_depth(ai_analyzer):
    """Test market depth analysis"""
    await ai_analyzer.start()
    
    market_depth = {
        "bids": [[19000, 1.0], [18900, 2.0]],
        "asks": [[20000, 1.0], [20100, 2.0]]
    }
    
    result = await ai_analyzer.analyze_market_depth(market_depth)
    
    assert isinstance(result, dict)
    assert "bid_ask_ratio" in result
    assert "liquidity_score" in result
    assert "imbalance_indicator" in result
    assert isinstance(result["liquidity_score"], (int, float))
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_portfolio_risk(ai_analyzer):
    """Test portfolio risk analysis"""
    await ai_analyzer.start()
    
    portfolio = {
        "positions": [
            {"asset": "BTC", "amount": 1.0, "value": 20000},
            {"asset": "ETH", "amount": 10.0, "value": 30000}
        ],
        "total_value": 50000
    }
    
    result = await ai_analyzer.analyze_portfolio_risk(portfolio)
    
    assert isinstance(result, dict)
    assert "overall_risk_score" in result
    assert "market_risk" in result
    assert "position_risk" in result
    assert "recommendations" in result
    assert isinstance(result["recommendations"], list)
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_generate_strategy(ai_analyzer):
    """Test strategy generation"""
    await ai_analyzer.start()
    
    market_conditions = {
        "trend": "bullish",
        "volume": 1000,
        "volatility": 0.2
    }
    
    result = await ai_analyzer.generate_strategy(market_conditions)
    
    assert isinstance(result, dict)
    assert "name" in result
    assert "strategy_type" in result
    assert "confidence" in result
    assert "parameters" in result
    assert isinstance(result["parameters"], dict)
    assert isinstance(result["confidence"], (int, float))
    assert 0 <= result["confidence"] <= 1
    
    # Test with poor market conditions
    poor_conditions = {
        "trend": "unclear",
        "volume": 100,
        "volatility": 0.5
    }
    
    result = await ai_analyzer.generate_strategy(poor_conditions)
    assert result["confidence"] < 0.5
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_validate_strategy(ai_analyzer):
    """Test strategy validation"""
    await ai_analyzer.start()
    
    # Test invalid input
    with pytest.raises(ValueError, match="Invalid strategy configuration"):
        await ai_analyzer.validate_strategy(None)
    
    with pytest.raises(ValueError, match="Invalid strategy configuration"):
        await ai_analyzer.validate_strategy("not a dict")
    
    with pytest.raises(ValueError, match="Missing required strategy fields"):
        await ai_analyzer.validate_strategy({})
    
    # Test valid strategy
    valid_strategy = {
        "name": "test_strategy",
        "parameters": {
            "entry_threshold": 0.05,
            "exit_threshold": -0.03
        }
    }
    
    result = await ai_analyzer.validate_strategy(valid_strategy)
    assert result["is_valid"] is True
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_sentiment(ai_analyzer):
    """Test sentiment analysis"""
    await ai_analyzer.start()
    
    data_sources = {
        "news": [
            {"title": "Positive news", "sentiment": 0.8},
            {"title": "Neutral news", "sentiment": 0.0}
        ],
        "social_media": [
            {"text": "Bullish post", "sentiment": 0.9},
            {"text": "Bearish post", "sentiment": -0.7}
        ]
    }
    
    result = await ai_analyzer.analyze_market_sentiment(data_sources)
    
    assert isinstance(result, dict)
    assert "overall_sentiment" in result
    assert "confidence" in result
    assert "sources" in result
    assert isinstance(result["sources"], dict)
    assert 0 <= result["overall_sentiment"] <= 1
    assert 0 <= result["confidence"] <= 1
    
    await ai_analyzer.stop()
