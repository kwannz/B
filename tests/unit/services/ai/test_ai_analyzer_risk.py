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
async def test_analyze_portfolio_risk():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0},
                {"symbol": "ETH", "amount": 10.0},
            ],
            "total_value": 50000,
        }

        result = await analyzer.analyze_portfolio_risk(portfolio)

        assert isinstance(result, dict)
        assert "overall_risk_score" in result
        assert "market_risk" in result
        assert "position_risk" in result
        assert "recommendations" in result
        assert isinstance(result["overall_risk_score"], float)
        assert 0 <= result["overall_risk_score"] <= 1


@pytest.mark.asyncio
async def test_analyze_position_risk():
    async with get_analyzer() as analyzer:
        position = {"symbol": "BTC", "size": 1.5, "entry_price": 20000}
        market_data = {"price": 19000, "volatility": 0.5}

        result = await analyzer.analyze_position_risk(position, market_data)

        assert isinstance(result, dict)
        assert "risk_score" in result
        assert "risk_factors" in result
        assert "max_loss" in result
        assert "recommended_size" in result
        assert isinstance(result["risk_score"], float)
        assert 0 <= result["risk_score"] <= 1


@pytest.mark.asyncio
async def test_analyze_market_risk():
    async with get_analyzer() as analyzer:
        market_data = {"price": 19000, "volatility": 0.5, "volume": 1000000}

        result = await analyzer.analyze_market_risk(market_data)

        assert isinstance(result, dict)
        assert "risk_level" in result
        assert "risk_factors" in result
        assert "market_conditions" in result
        assert isinstance(result["risk_level"], float)
        assert 0 <= result["risk_level"] <= 1


@pytest.mark.asyncio
async def test_calculate_var():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0},
                {"symbol": "ETH", "amount": 10.0},
            ],
            "total_value": 50000,
        }
        confidence_level = 0.95
        time_horizon = "1d"

        result = await analyzer.calculate_var(portfolio, confidence_level, time_horizon)

        assert isinstance(result, dict)
        assert "var_value" in result
        assert "confidence_level" in result
        assert "time_horizon" in result
        assert isinstance(result["var_value"], (int, float))
        assert result["confidence_level"] == confidence_level
        assert result["time_horizon"] == time_horizon


@pytest.mark.asyncio
async def test_analyze_correlation_risk():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0},
                {"symbol": "ETH", "amount": 10.0},
            ]
        }
        historical_data = {"BTC": [19000, 19500, 20000], "ETH": [1500, 1550, 1600]}

        result = await analyzer.analyze_correlation_risk(portfolio, historical_data)

        assert isinstance(result, dict)
        assert "correlation_matrix" in result
        assert "diversification_score" in result
        assert "high_correlation_pairs" in result
        assert isinstance(result["correlation_matrix"], list)
        assert isinstance(result["diversification_score"], float)
        assert 0 <= result["diversification_score"] <= 1


@pytest.mark.asyncio
async def test_generate_risk_report():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0},
                {"symbol": "ETH", "amount": 10.0},
            ]
        }
        market_data = {
            "BTC": {"price": 19000, "volatility": 0.5},
            "ETH": {"price": 1500, "volatility": 0.4},
        }

        result = await analyzer.generate_risk_report(portfolio, market_data)

        assert isinstance(result, dict)
        assert "overall_risk" in result
        assert "risk_breakdown" in result
        assert "recommendations" in result
        assert "metrics" in result
        assert isinstance(result["overall_risk"], float)
        assert 0 <= result["overall_risk"] <= 1


@pytest.mark.asyncio
async def test_analyze_drawdown_risk():
    async with get_analyzer() as analyzer:
        historical_data = [
            {"price": 100, "timestamp": "2024-01-01"},
            {"price": 90, "timestamp": "2024-01-02"},
            {"price": 95, "timestamp": "2024-01-03"},
        ]

        result = await analyzer.analyze_drawdown_risk(historical_data)

        assert isinstance(result, dict)
        assert "max_drawdown" in result
        assert "drawdown_periods" in result
        assert "recovery_analysis" in result
        assert isinstance(result["max_drawdown"], float)
        assert 0 <= result["max_drawdown"] <= 1


@pytest.mark.asyncio
async def test_stress_test_portfolio():
    async with get_analyzer() as analyzer:
        portfolio = {
            "assets": [
                {"symbol": "BTC", "amount": 1.0},
                {"symbol": "ETH", "amount": 10.0},
            ]
        }
        scenarios = [
            {"name": "market_crash", "price_change": -0.3},
            {"name": "high_volatility", "volatility": 0.5},
        ]

        result = await analyzer.stress_test_portfolio(portfolio, scenarios)

        assert isinstance(result, dict)
        assert "scenario_results" in result
        assert "worst_case_loss" in result
        assert "risk_tolerance_breach" in result
        assert isinstance(result["worst_case_loss"], float)
        assert isinstance(result["scenario_results"], list)
        assert len(result["scenario_results"]) == len(scenarios)
