import pytest
from unittest.mock import patch, AsyncMock
import json
from datetime import datetime


@pytest.mark.asyncio
async def test_local_sentiment_analysis():
    with (
        patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"),
        patch("tradingbot.shared.config.ai_model.LOCAL_MODEL_NAME", "test-model"),
        patch(
            "tradingbot.shared.config.ai_model.LOCAL_MODEL_ENDPOINT",
            "http://localhost:11434",
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from tradingbot.shared.sentiment.sentiment_analyzer import analyze_text

        mock_response = {"response": json.dumps({"score": 0.9, "label": "positive"})}
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )
        mock_post.return_value = mock_context

        result = await analyze_text("This is a positive message")

        assert result["score"] == 0.9
        assert result["sentiment"] == "positive"
        assert result["language"] == "en"
        assert "timestamp" in result
        assert isinstance(result["timestamp"], str)


@pytest.mark.asyncio
async def test_remote_sentiment_analysis():
    with (
        patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "REMOTE"),
        patch("tradingbot.shared.config.ai_model.REMOTE_MODEL_NAME", "test-model"),
        patch(
            "tradingbot.shared.config.ai_model.REMOTE_MODEL_ENDPOINT",
            "https://api.test.com",
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from tradingbot.shared.sentiment.sentiment_analyzer import analyze_text

        mock_response = {"choices": [{"score": 0.2}]}
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )
        mock_post.return_value = mock_context

        result = await analyze_text("This is a negative message")

        assert result["score"] == 0.2
        assert result["sentiment"] == "negative"
        assert result["language"] == "en"
        assert "timestamp" in result
        assert isinstance(result["timestamp"], str)


@pytest.mark.asyncio
async def test_error_handling():
    with (
        patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"),
        patch("tradingbot.shared.config.ai_model.LOCAL_MODEL_NAME", "test-model"),
        patch(
            "tradingbot.shared.config.ai_model.LOCAL_MODEL_ENDPOINT",
            "http://localhost:11434",
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from tradingbot.shared.sentiment.sentiment_analyzer import analyze_text

        mock_response = {"invalid": "response"}
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )
        mock_post.return_value = mock_context

        result = await analyze_text("Test message")

        assert result["score"] == 0.5
        assert result["sentiment"] == "neutral"
        assert result["language"] == "en"
        assert "timestamp" in result
        assert isinstance(result["timestamp"], str)
