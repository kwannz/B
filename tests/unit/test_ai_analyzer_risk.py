import pytest
from tradingbot.shared.ai_analyzer import AIAnalyzer

@pytest.fixture
def ai_analyzer():
    return AIAnalyzer()

@pytest.mark.asyncio
async def test_analyze_drawdown_risk(ai_analyzer):
    """Test drawdown risk analysis"""
    await ai_analyzer.start()
    
    # Test with empty data
    with pytest.raises(ValueError, match="Insufficient historical data"):
        await ai_analyzer.analyze_drawdown_risk([])
    
    # Test with valid data
    historical_data = [
        {"price": 20000, "timestamp": "2024-01-01T00:00:00Z"},
        {"price": 19000, "timestamp": "2024-01-02T00:00:00Z"},
        {"price": 18000, "timestamp": "2024-01-03T00:00:00Z"},
        {"price": 19500, "timestamp": "2024-01-04T00:00:00Z"}
    ]
    
    result = await ai_analyzer.analyze_drawdown_risk(historical_data)
    
    assert isinstance(result, dict)
    assert "max_drawdown" in result
    assert "drawdown_periods" in result
    assert "recovery_analysis" in result
    assert isinstance(result["drawdown_periods"], list)
    assert isinstance(result["recovery_analysis"], dict)
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_stress_test_portfolio(ai_analyzer):
    """Test portfolio stress testing"""
    await ai_analyzer.start()
    
    portfolio = {
        "positions": [
            {"asset": "BTC", "amount": 1.0, "value": 20000},
            {"asset": "ETH", "amount": 10.0, "value": 30000}
        ]
    }
    
    scenarios = [
        {"name": "market_crash", "severity": "high"},
        {"name": "high_volatility", "severity": "medium"}
    ]
    
    # Test with invalid inputs
    with pytest.raises(ValueError, match="Invalid portfolio or scenarios"):
        await ai_analyzer.stress_test_portfolio(None, scenarios)
    
    with pytest.raises(ValueError, match="Invalid portfolio or scenarios"):
        await ai_analyzer.stress_test_portfolio(portfolio, None)
    
    # Test with valid inputs
    result = await ai_analyzer.stress_test_portfolio(portfolio, scenarios)
    
    assert isinstance(result, dict)
    assert "scenario_results" in result
    assert "worst_case_loss" in result
    assert "risk_tolerance_breach" in result
    assert isinstance(result["scenario_results"], list)
    assert len(result["scenario_results"]) == len(scenarios)
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_position_risk(ai_analyzer):
    """Test position risk analysis"""
    await ai_analyzer.start()
    
    position = {
        "asset": "BTC",
        "amount": 1.0,
        "entry_price": 20000,
        "current_price": 21000,
        "leverage": 2.0
    }
    
    result = await ai_analyzer.analyze_position_risk(position)
    
    assert isinstance(result, dict)
    assert "risk_score" in result
    assert "factors" in result
    assert "max_loss" in result
    assert "recommended_size" in result
    assert isinstance(result["factors"], list)
    assert isinstance(result["max_loss"], (int, float))
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_calculate_var(ai_analyzer):
    """Test Value at Risk calculation"""
    await ai_analyzer.start()
    
    portfolio = {
        "positions": [
            {"asset": "BTC", "amount": 1.0, "value": 20000},
            {"asset": "ETH", "amount": 10.0, "value": 30000}
        ],
        "total_value": 50000
    }
    
    result = await ai_analyzer.calculate_var(portfolio)
    
    assert isinstance(result, dict)
    assert "value" in result
    assert "confidence" in result
    assert "horizon" in result
    assert isinstance(result["value"], (int, float))
    assert 0 <= result["confidence"] <= 1
    
    # Test with custom parameters
    result = await ai_analyzer.calculate_var(
        portfolio, 
        confidence_level=0.99,
        horizon='5d'
    )
    assert result["confidence"] == 0.99
    assert result["horizon"] == '5d'
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_correlation_risk(ai_analyzer):
    """Test correlation risk analysis"""
    await ai_analyzer.start()
    
    assets = ["BTC", "ETH", "SOL"]
    
    result = await ai_analyzer.analyze_correlation_risk(assets)
    
    assert isinstance(result, dict)
    assert "matrix" in result
    assert "diversification" in result
    assert "high_correlation" in result
    assert isinstance(result["matrix"], list)
    assert isinstance(result["high_correlation"], list)
    assert 0 <= result["diversification"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_generate_risk_report(ai_analyzer):
    """Test risk report generation"""
    await ai_analyzer.start()
    
    portfolio = {
        "positions": [
            {"asset": "BTC", "amount": 1.0, "value": 20000},
            {"asset": "ETH", "amount": 10.0, "value": 30000}
        ],
        "total_value": 50000,
        "leverage": 1.5
    }
    
    result = await ai_analyzer.generate_risk_report(portfolio)
    
    assert isinstance(result, dict)
    assert "risk_level" in result
    assert "breakdown" in result
    assert "recommendations" in result
    assert "metrics" in result
    assert isinstance(result["breakdown"], dict)
    assert isinstance(result["recommendations"], list)
    assert isinstance(result["metrics"], dict)
    assert 0 <= result["risk_level"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_market_risk(ai_analyzer):
    """Test market risk analysis"""
    await ai_analyzer.start()
    
    market_data = {
        "price": 20000,
        "volume": 1000,
        "volatility": 0.2,
        "liquidity": 0.8,
        "market_cap": 500000000
    }
    
    result = await ai_analyzer.analyze_market_risk(market_data)
    
    assert isinstance(result, dict)
    assert "risk_level" in result
    assert "factors" in result
    assert "conditions" in result
    assert isinstance(result["factors"], list)
    assert isinstance(result["risk_level"], (int, float))
    assert 0 <= result["risk_level"] <= 1
    
    await ai_analyzer.stop()
