import pytest
from contextlib import asynccontextmanager
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


@pytest.mark.asyncio
async def test_analyze_drawdown_risk():
    async with get_analyzer() as analyzer:
        historical_data = [
            {"price": 100, "timestamp": "2024-01-01"},
            {"price": 90, "timestamp": "2024-01-02"},  # 10% drawdown
            {"price": 95, "timestamp": "2024-01-03"},  # Recovery
            {"price": 85, "timestamp": "2024-01-04"},  # New drawdown
        ]

        result = await analyzer.analyze_drawdown_risk(historical_data)

        assert isinstance(result, dict)
        assert "max_drawdown" in result
        assert "drawdown_periods" in result
        assert "recovery_analysis" in result
        assert isinstance(result["drawdown_periods"], list)
        assert isinstance(result["recovery_analysis"], dict)


@pytest.mark.asyncio
async def test_stress_test_portfolio():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0, "value": 40000},
                {"symbol": "ETH", "amount": 10.0, "value": 20000},
            ],
            "total_value": 60000,
        }
        scenarios = [
            {"name": "market_crash", "price_change": -0.3, "probability": 0.1},
            {"name": "high_volatility", "volatility_increase": 0.5, "probability": 0.2},
        ]

        result = await analyzer.stress_test_portfolio(portfolio, scenarios)

        assert isinstance(result, dict)
        assert "scenario_results" in result
        assert "worst_case_loss" in result
        assert "risk_tolerance_breach" in result
        assert isinstance(result["scenario_results"], list)
        assert isinstance(result["worst_case_loss"], (int, float))
        assert isinstance(result["risk_tolerance_breach"], bool)


@pytest.mark.asyncio
async def test_combine_strategies():
    async with get_analyzer() as analyzer:
        strategies = [
            {"name": "momentum", "weight": 0.6, "parameters": {"lookback": 20}},
            {"name": "mean_reversion", "weight": 0.4, "parameters": {"window": 10}},
        ]

        result = await analyzer.combine_strategies(strategies)

        assert isinstance(result, dict)
        assert "weights" in result
        assert "expected_performance" in result
        assert len(result["weights"]) == len(strategies)
        assert "sharpe_ratio" in result["expected_performance"]
        assert "max_drawdown" in result["expected_performance"]


@pytest.mark.asyncio
async def test_backtest_strategy():
    async with get_analyzer() as analyzer:
        strategy = {
            "name": "momentum",
            "parameters": {"lookback": 20, "threshold": 0.02},
        }
        historical_data = [
            {"price": 100, "volume": 1000, "timestamp": "2024-01-01"},
            {"price": 102, "volume": 1100, "timestamp": "2024-01-02"},
            {"price": 103, "volume": 1200, "timestamp": "2024-01-03"},
        ]

        result = await analyzer.backtest_strategy(strategy, historical_data)

        assert isinstance(result, dict)
        assert "total_returns" in result
        assert "trade_count" in result
        assert "win_rate" in result
        assert "profit_factor" in result
        assert "max_drawdown" in result
        assert "sharpe_ratio" in result
        assert 0 <= result["win_rate"] <= 1
        assert result["profit_factor"] > 0
        assert 0 <= result["max_drawdown"] <= 1


@pytest.mark.asyncio
async def test_backtest_strategy_empty_data():
    async with get_analyzer() as analyzer:
        strategy = {"name": "momentum", "parameters": {"lookback": 20}}
        with pytest.raises(ValueError) as exc_info:
            await analyzer.backtest_strategy(strategy, [])
        assert "Insufficient historical data" in str(exc_info.value)


@pytest.mark.asyncio
async def test_backtest_strategy_invalid_strategy():
    async with get_analyzer() as analyzer:
        historical_data = [{"price": 100, "volume": 1000, "timestamp": "2024-01-01"}]
        with pytest.raises(ValueError) as exc_info:
            await analyzer.backtest_strategy({}, historical_data)
        assert "Invalid strategy configuration" in str(exc_info.value)
