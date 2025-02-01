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


@pytest.fixture
def mock_deepseek_response():
    return {
        "analysis": {
            "market_trend": "bullish",
            "confidence": 0.85,
            "indicators": {"rsi": 65, "macd": "positive", "volume": "increasing"},
            "support_levels": [19500, 19000],
            "resistance_levels": [20500, 21000],
        }
    }


@pytest.mark.asyncio
async def test_analyze_market_data():
    async with get_analyzer() as analyzer:
        market_data = {"price": 100, "volume": 1000, "timestamp": "2024-01-01"}

        result = await analyzer.analyze_market_data(market_data)

        assert isinstance(result, dict)
        assert "market_trend" in result
        assert "confidence" in result
        assert isinstance(result["confidence"], float)
        assert 0 <= result["confidence"] <= 1


@pytest.mark.asyncio
async def test_analyze_market_data_low_confidence():
    async with get_analyzer() as analyzer:
        market_data = {
            "price": 100,
            "volume": 100,  # Low volume
            "timestamp": "2024-01-01",
        }

        result = await analyzer.analyze_market_data(market_data)

        assert isinstance(result, dict)
        assert "confidence" in result
        assert result["confidence"] < 0.9  # Lower confidence due to low volume


@pytest.mark.asyncio
async def test_analyze_market_data_api_error():
    async with get_analyzer() as analyzer:
        with pytest.raises(ValueError):
            await analyzer.analyze_market_data(None)


@pytest.mark.asyncio
async def test_analyze_market_data_invalid_input():
    async with get_analyzer() as analyzer:
        with pytest.raises(ValueError):
            await analyzer.analyze_market_data({})  # Missing price field


@pytest.mark.asyncio
async def test_analyze_market_data_missing_price():
    async with get_analyzer() as analyzer:
        with pytest.raises(ValueError) as exc_info:
            await analyzer.analyze_market_data(
                {"volume": 1000000, "timestamp": "2024-01-24T12:00:00Z"}
            )
        assert "Missing required field: price" in str(exc_info.value)


@pytest.mark.asyncio
async def test_analyze_market_trends():
    async with get_analyzer() as analyzer:
        historical_data = [
            {"price": 100, "timestamp": "2024-01-01"},
            {"price": 105, "timestamp": "2024-01-02"},
            {"price": 110, "timestamp": "2024-01-03"},
        ]

        result = await analyzer.analyze_market_trends(historical_data)

        assert isinstance(result, dict)
        assert "trend_analysis" in result
        assert "prediction" in result
        assert "confidence" in result
        assert isinstance(result["confidence"], float)
        assert 0 <= result["confidence"] <= 1


@pytest.mark.asyncio
async def test_analyze_volume_profile():
    async with get_analyzer() as analyzer:
        volume_data = [
            {"price": 100, "volume": 1000},
            {"price": 105, "volume": 1200},
            {"price": 110, "volume": 800},
        ]

        result = await analyzer.analyze_volume_profile(volume_data)

        assert isinstance(result, dict)
        assert "volume_by_price" in result
        assert "high_volume_nodes" in result
        assert "low_volume_nodes" in result
        assert isinstance(result["high_volume_nodes"], list)
        assert isinstance(result["low_volume_nodes"], list)


@pytest.mark.asyncio
async def test_analyze_market_depth():
    async with get_analyzer() as analyzer:
        market_depth = {
            "bids": [{"price": 100, "volume": 1000}],
            "asks": [{"price": 105, "volume": 800}],
        }

        result = await analyzer.analyze_market_depth(market_depth)

        assert isinstance(result, dict)
        assert "bid_ask_ratio" in result
        assert "liquidity_score" in result
        assert "imbalance_indicator" in result
        assert isinstance(result["liquidity_score"], float)
        assert 0 <= result["liquidity_score"] <= 1
