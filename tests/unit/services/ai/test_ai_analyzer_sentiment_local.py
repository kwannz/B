import pytest
from unittest.mock import patch, AsyncMock
import json
from datetime import datetime


@pytest.mark.asyncio
async def test_local_sentiment_analysis():
    with (
        patch("src.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"),
        patch("src.shared.config.ai_model.LOCAL_MODEL_NAME", "deepseek-coder:1.5b"),
        patch(
            "src.shared.config.ai_model.LOCAL_MODEL_ENDPOINT", "http://localhost:11434"
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from src.shared.sentiment.sentiment_analyzer import analyze_text

        mock_response = {"response": json.dumps({"score": 0.9, "label": "positive"})}
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(
            return_value=mock_response
        )
        mock_post.return_value = mock_context

        result = await analyze_text("Bitcoin price hits new all-time high!")

        assert result["score"] == 0.9
        assert result["sentiment"] == "positive"
        assert result["language"] == "en"
        assert "timestamp" in result


@pytest.mark.asyncio
async def test_local_model_error_handling():
    with (
        patch("src.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"),
        patch("src.shared.config.ai_model.LOCAL_MODEL_NAME", "deepseek-coder:1.5b"),
        patch(
            "src.shared.config.ai_model.LOCAL_MODEL_ENDPOINT", "http://localhost:11434"
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from src.shared.sentiment.sentiment_analyzer import analyze_text

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


@pytest.mark.asyncio
async def test_local_model_endpoint_configuration():
    with (
        patch("src.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"),
        patch("src.shared.config.ai_model.LOCAL_MODEL_NAME", "deepseek-coder:1.5b"),
        patch(
            "src.shared.config.ai_model.LOCAL_MODEL_ENDPOINT", "http://localhost:11434"
        ),
        patch("aiohttp.ClientSession.post") as mock_post,
    ):

        from src.shared.sentiment.sentiment_analyzer import analyze_text

        mock_post.assert_not_called()
        await analyze_text("Test message")

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://localhost:11434/api/generate"
        assert kwargs["json"]["model"] == "deepseek-coder:1.5b"
