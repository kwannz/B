import pytest
from tradingbot.shared.ai_analyzer import AIAnalyzer

@pytest.fixture
def ai_analyzer():
    return AIAnalyzer()

@pytest.mark.asyncio
async def test_combine_strategies(ai_analyzer):
    """Test strategy combination"""
    await ai_analyzer.start()
    
    # Test invalid inputs
    with pytest.raises(ValueError, match="Invalid strategies list"):
        await ai_analyzer.combine_strategies(None)
    
    with pytest.raises(ValueError, match="Invalid strategies list"):
        await ai_analyzer.combine_strategies("not a list")
    
    # Test missing strategy name/type
    invalid_strategy = [{"weight": 0.5}]
    with pytest.raises(KeyError, match="Strategy missing both 'name' and 'type' fields"):
        await ai_analyzer.combine_strategies(invalid_strategy)
    
    # Test valid strategies
    strategies = [
        {
            "name": "trend_following",
            "weight": 0.6,
            "parameters": {
                "ma_period": 20,
                "threshold": 0.02
            }
        },
        {
            "type": "mean_reversion",
            "weight": 0.4,
            "parameters": {
                "lookback": 10,
                "std_dev": 2
            }
        }
    ]
    
    result = await ai_analyzer.combine_strategies(strategies)
    
    assert isinstance(result, dict)
    assert "weights" in result
    assert "expected_performance" in result
    assert isinstance(result["weights"], dict)
    assert isinstance(result["expected_performance"], dict)
    assert len(result["weights"]) == len(strategies)
    assert "return" in result["expected_performance"]
    assert "sharpe" in result["expected_performance"]
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_backtest_strategy(ai_analyzer):
    """Test strategy backtesting"""
    await ai_analyzer.start()
    
    strategy = {
        "name": "momentum",
        "parameters": {
            "lookback": 20,
            "threshold": 0.02,
            "stop_loss": 0.05
        }
    }
    
    historical_data = [
        {"timestamp": "2024-01-01T00:00:00Z", "price": 19000, "volume": 1000},
        {"timestamp": "2024-01-02T00:00:00Z", "price": 20000, "volume": 1200},
        {"timestamp": "2024-01-03T00:00:00Z", "price": 21000, "volume": 900}
    ]
    
    # Test invalid inputs
    with pytest.raises(ValueError, match="Invalid strategy configuration"):
        await ai_analyzer.backtest_strategy(None, historical_data)
    
    with pytest.raises(ValueError, match="Invalid strategy configuration"):
        await ai_analyzer.backtest_strategy("not a dict", historical_data)
    
    with pytest.raises(ValueError, match="Insufficient historical data"):
        await ai_analyzer.backtest_strategy(strategy, [])
    
    with pytest.raises(ValueError, match="Insufficient historical data"):
        await ai_analyzer.backtest_strategy(strategy, "not a list")
    
    # Test valid inputs
    result = await ai_analyzer.backtest_strategy(strategy, historical_data)
    
    assert isinstance(result, dict)
    assert "total_returns" in result
    assert "trade_count" in result
    assert "win_rate" in result
    assert "profit_factor" in result
    assert "max_drawdown" in result
    assert "sharpe_ratio" in result
    assert isinstance(result["trade_count"], int)
    assert 0 <= result["win_rate"] <= 1
    assert result["profit_factor"] > 0
    assert 0 <= result["max_drawdown"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_evaluate_strategy(ai_analyzer):
    """Test strategy evaluation"""
    await ai_analyzer.start()
    
    strategy = {
        "name": "breakout",
        "parameters": {
            "period": 20,
            "multiplier": 2,
            "stop_loss": 0.05
        }
    }
    
    historical_data = [
        {"timestamp": "2024-01-01T00:00:00Z", "price": 19000, "volume": 1000},
        {"timestamp": "2024-01-02T00:00:00Z", "price": 20000, "volume": 1200},
        {"timestamp": "2024-01-03T00:00:00Z", "price": 21000, "volume": 900}
    ]
    
    result = await ai_analyzer.evaluate_strategy(strategy, historical_data)
    
    assert isinstance(result, dict)
    assert "win_rate" in result
    assert "profit_factor" in result
    assert "sharpe_ratio" in result
    assert "max_drawdown" in result
    assert 0 <= result["win_rate"] <= 1
    assert result["profit_factor"] > 0
    assert 0 <= result["max_drawdown"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_optimize_strategy_parameters(ai_analyzer):
    """Test strategy parameter optimization"""
    await ai_analyzer.start()
    
    strategy = {
        "name": "mean_reversion",
        "parameters": {
            "lookback": 20,
            "entry_threshold": 2.0,
            "exit_threshold": 0.5,
            "stop_loss": 0.05
        }
    }
    
    historical_data = [
        {"timestamp": "2024-01-01T00:00:00Z", "price": 19000, "volume": 1000},
        {"timestamp": "2024-01-02T00:00:00Z", "price": 20000, "volume": 1200},
        {"timestamp": "2024-01-03T00:00:00Z", "price": 21000, "volume": 900}
    ]
    
    result = await ai_analyzer.optimize_strategy_parameters(strategy, historical_data)
    
    assert isinstance(result, dict)
    assert "parameters" in result
    assert "improvement" in result
    assert "iterations" in result
    assert isinstance(result["parameters"], dict)
    assert isinstance(result["iterations"], int)
    assert 0 <= result["improvement"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_adapt_strategy(ai_analyzer):
    """Test strategy adaptation"""
    await ai_analyzer.start()
    
    strategy = {
        "name": "trend_following",
        "parameters": {
            "ma_fast": 10,
            "ma_slow": 20,
            "stop_loss": 0.05
        }
    }
    
    market_changes = {
        "volatility_change": 0.5,
        "volume_change": -0.2,
        "trend_strength": 0.8
    }
    
    result = await ai_analyzer.adapt_strategy(strategy, market_changes)
    
    assert isinstance(result, dict)
    assert "adapted_parameters" in result
    assert "adaptation_reason" in result
    assert "confidence" in result
    assert isinstance(result["adapted_parameters"], dict)
    assert isinstance(result["adaptation_reason"], str)
    assert 0 <= result["confidence"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_generate_strategy(ai_analyzer):
    """Test strategy generation with different market conditions"""
    await ai_analyzer.start()
    
    # Test with favorable market conditions
    good_conditions = {
        "trend": "bullish",
        "volume": 1000,
        "volatility": 0.2
    }
    
    result = await ai_analyzer.generate_strategy(good_conditions)
    
    assert isinstance(result, dict)
    assert "name" in result
    assert "strategy_type" in result
    assert "confidence" in result
    assert "parameters" in result
    assert "indicators" in result
    assert result["confidence"] > 0.8  # High confidence for good conditions
    
    # Test with unfavorable market conditions
    poor_conditions = {
        "trend": "unclear",
        "volume": 100,
        "volatility": 0.5
    }
    
    result = await ai_analyzer.generate_strategy(poor_conditions)
    
    assert isinstance(result, dict)
    assert result["confidence"] < 0.5  # Lower confidence for poor conditions
    
    # Verify strategy parameters
    params = result["parameters"]
    assert "entry_threshold" in params
    assert "exit_threshold" in params
    assert "stop_loss" in params
    assert "take_profit" in params
    assert "position_size" in params
    
    # Verify indicators
    indicators = result["indicators"]
    assert "ma_fast" in indicators
    assert "ma_slow" in indicators
    assert "rsi_period" in indicators
    
    await ai_analyzer.stop()
