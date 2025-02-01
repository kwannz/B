from contextlib import asynccontextmanager
import pytest
from unittest.mock import AsyncMock, patch
from tradingbot.src.shared.ai_analyzer import AIAnalyzer

@asynccontextmanager
async def get_analyzer():
    """Context manager for AI Analyzer instance."""
    analyzer = AIAnalyzer()
    await analyzer.start()
    try:
        yield analyzer
    finally:
        await analyzer.stop()

@pytest.fixture
def mock_strategy_response():
    return {
        'strategy': {
            'name': 'momentum_breakout',
            'confidence': 0.92,
            'parameters': {
                'entry_threshold': 0.05,
                'exit_threshold': -0.03,
                'stop_loss': 0.02,
                'take_profit': 0.08,
                'position_size': 0.1
            },
            'indicators': {
                'rsi_period': 14,
                'ma_fast': 10,
                'ma_slow': 21
            },
            'timeframe': '1h'
        }
    }

@pytest.mark.asyncio
async def test_generate_strategy():
    market_conditions = {
        "price": 100,
        "volume": 1000,
        "volatility": 0.2,
        "trend": "bullish"
    }
    async with get_analyzer() as analyzer:
        result = await analyzer.generate_strategy(market_conditions)
        assert "strategy_type" in result
        assert "parameters" in result
        assert "confidence" in result
        assert 0 <= result["confidence"] <= 1

@pytest.mark.asyncio
async def test_generate_strategy_low_confidence():
    market_conditions = {
        "price": 100,
        "volume": 100,  # Low volume
        "volatility": 0.5,  # High volatility
        "trend": "unclear"
    }
    async with get_analyzer() as analyzer:
        result = await analyzer.generate_strategy(market_conditions)
        assert "strategy_type" in result
        assert "parameters" in result
        assert "confidence" in result
        assert result["confidence"] < 0.5  # Low confidence due to conditions

@pytest.mark.asyncio
async def test_evaluate_strategy():
    strategy = {
        "type": "momentum",
        "parameters": {
            "lookback_period": 20,
            "threshold": 0.02
        }
    }
    historical_data = [
        {"price": 100, "volume": 1000, "timestamp": "2024-01-01"},
        {"price": 102, "volume": 1100, "timestamp": "2024-01-02"}
    ]
    async with get_analyzer() as analyzer:
        result = await analyzer.evaluate_strategy(strategy, historical_data)
        assert "performance_metrics" in result
        assert "risk_metrics" in result
        assert "confidence" in result

@pytest.mark.asyncio
async def test_optimize_strategy_parameters():
    strategy = {
        "type": "mean_reversion",
        "parameters": {
            "window": 10,
            "entry_threshold": 2.0
        }
    }
    historical_data = [
        {"price": 100, "volume": 1000, "timestamp": "2024-01-01"},
        {"price": 98, "volume": 1100, "timestamp": "2024-01-02"}
    ]
    async with get_analyzer() as analyzer:
        result = await analyzer.optimize_strategy_parameters(strategy, historical_data)
        assert "optimized_parameters" in result
        assert "expected_improvement" in result

@pytest.mark.asyncio
async def test_validate_strategy():
    invalid_strategy = {
        "type": "invalid_type",
        "parameters": {}
    }
    async with get_analyzer() as analyzer:
        with pytest.raises(ValueError):
            await analyzer.validate_strategy(invalid_strategy)

@pytest.mark.asyncio
async def test_adapt_strategy():
    strategy = {
        "type": "trend_following",
        "parameters": {
            "trend_period": 30,
            "entry_threshold": 0.01
        }
    }
    market_changes = {
        "volatility_change": 0.5,
        "volume_change": -0.3,
        "trend_change": "sideways"
    }
    async with get_analyzer() as analyzer:
        result = await analyzer.adapt_strategy(strategy, market_changes)
        assert "adapted_parameters" in result
        assert "adaptation_reason" in result

@pytest.mark.asyncio
async def test_combine_strategies():
    strategies = [
        {
            "type": "momentum",
            "weight": 0.6,
            "parameters": {"lookback": 20}
        },
        {
            "type": "mean_reversion",
            "weight": 0.4,
            "parameters": {"window": 10}
        }
    ]
    async with get_analyzer() as analyzer:
        result = await analyzer.combine_strategies(strategies)
        assert "weights" in result
        assert "expected_performance" in result

@pytest.mark.asyncio
async def test_backtest_strategy():
    strategy = {
        "type": "momentum",
        "parameters": {
            "lookback": 20,
            "threshold": 0.02
        }
    }
    historical_data = [
        {"price": 100, "volume": 1000, "timestamp": "2024-01-01"},
        {"price": 102, "volume": 1100, "timestamp": "2024-01-02"},
        {"price": 103, "volume": 1200, "timestamp": "2024-01-03"}
    ]
    async with get_analyzer() as analyzer:
        result = await analyzer.backtest_strategy(strategy, historical_data)
        assert "total_returns" in result
        assert "trade_count" in result
        assert "win_rate" in result
        assert "profit_factor" in result
        assert "max_drawdown" in result
        assert "sharpe_ratio" in result
