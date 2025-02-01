import pytest
import pytest_asyncio
import aiohttp
import os
from unittest.mock import patch, AsyncMock, MagicMock
from tradingbot.core.services.sentiment.sentiment_analyzer import SentimentAnalyzer


@pytest_asyncio.fixture
async def mock_session():
    class MockResponse:
        def __init__(self, status=200, json_data=None):
            self.status = status
            self._json = json_data or {"score": 0.8}

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def json(self):
            return self._json

    mock_session = MagicMock()
    mock_session.__aenter__.return_value = mock_session
    mock_session.__aexit__.return_value = None
    mock_session.post = AsyncMock()
    mock_session.post.return_value.__aenter__.return_value = MockResponse()

    with patch("aiohttp.ClientSession", return_value=mock_session):
        yield mock_session


@pytest.mark.asyncio
async def test_local_model_priority(mock_session, monkeypatch):
    monkeypatch.setenv("AI_MODEL_MODE", "LOCAL")
    analyzer = SentimentAnalyzer()

    with (
        patch.object(
            SentimentAnalyzer, "_call_local_model", new_callable=AsyncMock
        ) as mock_local_fn,
        patch.object(
            SentimentAnalyzer, "_call_remote_model", new_callable=AsyncMock
        ) as mock_remote_fn,
    ):

        mock_local_fn.return_value = {"score": 0.8}

        result = await analyzer.analyze_text("Bitcoin price surges to new highs")

        assert result == {"score": 0.8, "model": "local"}
        mock_local_fn.assert_called_once()
        mock_remote_fn.assert_not_called()


@pytest.mark.asyncio
async def test_local_model_fallback(mock_session, monkeypatch):
    monkeypatch.setenv("AI_MODEL_MODE", "LOCAL")
    monkeypatch.setenv("ALLOW_REMOTE_FALLBACK", "true")
    analyzer = SentimentAnalyzer()

    with (
        patch.object(
            SentimentAnalyzer, "_call_local_model", new_callable=AsyncMock
        ) as mock_local_fn,
        patch.object(
            SentimentAnalyzer, "_call_remote_model", new_callable=AsyncMock
        ) as mock_remote_fn,
    ):

        mock_local_fn.side_effect = Exception("Local model unavailable")
        mock_remote_fn.return_value = {"score": 0.7}

        result = await analyzer.analyze_text("Market sentiment remains strong")

        mock_local_fn.assert_called_once()
        mock_remote_fn.assert_called_once()
        assert result == {"score": 0.7, "model": "remote"}


@pytest.mark.asyncio
async def test_complete_fallback_behavior(mock_session, monkeypatch):
    monkeypatch.setenv("AI_MODEL_MODE", "LOCAL")
    monkeypatch.setenv("ALLOW_REMOTE_FALLBACK", "true")
    monkeypatch.setenv("ALLOW_FALLBACK", "true")
    analyzer = SentimentAnalyzer()

    with (
        patch.object(
            SentimentAnalyzer, "_call_local_model", new_callable=AsyncMock
        ) as mock_local_fn,
        patch.object(
            SentimentAnalyzer, "_call_remote_model", new_callable=AsyncMock
        ) as mock_remote_fn,
    ):

        mock_local_fn.side_effect = Exception("Local model unavailable")
        mock_remote_fn.side_effect = Exception("Remote model unavailable")

        result = await analyzer.analyze_text("Test fallback behavior")

        mock_local_fn.assert_called_once()
        mock_remote_fn.assert_called_once()
        assert result == {"score": 0.5, "model": "fallback"}
