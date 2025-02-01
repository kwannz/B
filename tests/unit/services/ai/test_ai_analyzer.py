import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest
from aiohttp.client_reqrep import ClientResponse
from aiohttp.helpers import TimerNoop
from yarl import URL


def create_mock_response(status=200, body=None):
    response = AsyncMock()
    response.status = status
    response.json = AsyncMock(return_value=body)
    response.text = AsyncMock(return_value=str(body))
    response.__aenter__ = AsyncMock(return_value=response)
    response.__aexit__ = AsyncMock(return_value=None)
    return response


# Mock the strategy_analyzer module before importing AIAnalyzer
import sys

mock_strategy_analyzer = MagicMock()
sys.modules["src.trading_agent.analysis.strategy_analyzer"] = mock_strategy_analyzer

# Now import AIAnalyzer after mocking
from tradingbot.trading_agent.analysis.ai_analyzer import AIAnalyzer


class MockConfig:
    def __init__(self):
        self.api_key = "test_key"
        self.model_name = "deepseek-chat"
        self.log_level = "INFO"
        self.metrics_enabled = True
        self.database = {"path": "data/trading_agent.db"}

    def get(self, key, default=None):
        if key == "database.path":
            return self.database["path"]
        if key == "database.echo":
            return False
        return default


class MockDatabaseManager:
    async def start(self):
        pass

    async def stop(self):
        pass


@pytest.fixture(autouse=True)
def mock_env_and_config():
    with (
        patch.dict(os.environ, {"DEEPSEEK_API_KEY": "test_key"}),
        patch("src.trading_agent.utils.config.config", MockConfig()),
        patch(
            "src.trading_agent.models.manager.DatabaseManager",
            return_value=MockDatabaseManager(),
        ),
        patch("src.trading_agent.models.manager.db", MockDatabaseManager()),
    ):
        yield


@pytest.fixture
async def analyzer():
    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    with patch("aiohttp.ClientSession", return_value=mock_session):
        analyzer = AIAnalyzer()
        await analyzer.initialize()
        yield analyzer
        await analyzer.close()


@pytest.mark.asyncio
async def test_analyze_market_includes_promoted_words():
    """Test that analyze_market includes promoted words in analysis"""
    analyzer = AIAnalyzer()

    market_data = {
        "current_price": 100.0,
        "volume_24h": 1000000.0,
        "price_change_24h": 5.0,
        "promoted_words": "test strategy keywords",
    }

    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.post = AsyncMock(
        return_value=create_mock_response(
            status=200,
            body={
                "choices": [
                    {
                        "message": {
                            "content": '{"trend_analysis": "up", "technical_analysis": "good", "action": "buy", "confidence": 0.8, "stop_loss": 95, "take_profit": 110, "risk_assessment": "low"}'
                        }
                    }
                ]
            },
        )
    )

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_market(market_data)
        await analyzer.close()

        # Verify promoted words were included in prompt
        prompt = analyzer._prepare_market_prompt(market_data)
        assert "test strategy keywords" in prompt
        assert result is not None
        assert "trend_analysis" in result


@pytest.mark.asyncio
async def test_analyze_market_handles_errors():
    """Test that analyze_market properly handles errors"""
    analyzer = AIAnalyzer()

    market_data = {
        "current_price": 100.0,
        "volume_24h": 1000000.0,
        "price_change_24h": 5.0,
    }

    mock_session = AsyncMock()
    mock_session.post = AsyncMock(side_effect=Exception("API Error"))
    mock_session.close = AsyncMock()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_market(market_data)
        await analyzer.close()

        assert result is not None
        assert "error" in result
        assert "timestamp" in result
        assert "market_data" in result


@pytest.mark.asyncio
async def test_analyze_market_api_error():
    """Test handling of API errors during market analysis"""
    analyzer = AIAnalyzer()

    market_data = {
        "current_price": 100.0,
        "volume_24h": 1000000.0,
        "price_change_24h": 5.0,
    }

    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.post = AsyncMock(
        return_value=create_mock_response(status=500, body="Internal Server Error")
    )

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_market(market_data)
        await analyzer.close()

        assert result is not None
        assert "error" in result
        assert "API Error" in result["error"]


@pytest.mark.asyncio
async def test_analyze_market_invalid_response():
    """Test handling of invalid API response format"""
    analyzer = AIAnalyzer()

    market_data = {
        "current_price": 100.0,
        "volume_24h": 1000000.0,
        "price_change_24h": 5.0,
    }

    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.post = AsyncMock(
        return_value=create_mock_response(
            status=200,
            body={"choices": [{"message": {"content": "invalid json content"}}]},
        )
    )

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_market(market_data)
        await analyzer.close()

        assert result is not None
        assert "error" in result
        assert "分析结果解析失败" in result["error"]


@pytest.mark.asyncio
async def test_analyze_market_missing_fields():
    """Test handling of missing required fields in market data"""
    analyzer = AIAnalyzer()

    market_data = {
        # Missing required fields
    }

    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.post = AsyncMock(
        return_value=create_mock_response(
            status=200,
            body={"choices": [{"message": {"content": '{"trend_analysis": "up"}'}}]},
        )
    )

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_market(market_data)
        await analyzer.close()

        assert result is not None
        assert "error" in result
        assert "分析结果解析失败" in result["error"]


@pytest.mark.asyncio
async def test_validate_strategy():
    """Test strategy validation"""
    analyzer = AIAnalyzer()
    await analyzer.initialize()

    # Test valid strategy
    valid_strategy = {"confidence": 0.8, "risk_assessment": "low"}
    assert await analyzer.validate_strategy(valid_strategy) is True

    # Test low confidence strategy
    low_confidence_strategy = {"confidence": 0.5, "risk_assessment": "low"}
    assert await analyzer.validate_strategy(low_confidence_strategy) is False

    # Test high risk strategy
    high_risk_strategy = {"confidence": 0.8, "risk_assessment": "high"}
    assert await analyzer.validate_strategy(high_risk_strategy) is False

    await analyzer.close()


@pytest.mark.asyncio
async def test_analyze_historical_data():
    """Test historical data analysis"""
    analyzer = AIAnalyzer()

    historical_data = [
        {
            "timestamp": "2024-01-01T00:00:00",
            "price": 100.0,
            "amount": 1.0,
            "type": "buy",
            "result": "profit",
        },
        {
            "timestamp": "2024-01-02T00:00:00",
            "price": 110.0,
            "amount": 1.0,
            "type": "sell",
            "result": "profit",
        },
    ]

    mock_session = AsyncMock()
    mock_session.close = AsyncMock()
    mock_session.post = AsyncMock(
        return_value=create_mock_response(
            status=200,
            body={
                "choices": [
                    {
                        "message": {
                            "content": '{"trend_analysis": "up", "technical_analysis": "good", "action": "buy", "confidence": 0.8, "stop_loss": 95, "take_profit": 110, "risk_assessment": "low"}'
                        }
                    }
                ]
            },
        )
    )

    with patch("aiohttp.ClientSession", return_value=mock_session):
        await analyzer.initialize()
        result = await analyzer.analyze_historical_data(historical_data)
        await analyzer.close()

        assert result is not None
        assert "trend_analysis" in result
        assert result["confidence"] == 0.8
