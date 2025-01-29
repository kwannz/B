import pytest
import json
from unittest.mock import patch, AsyncMock
from tradingbot.shared.sentiment.sentiment_analyzer import analyze_text
from tradingbot.shared.config.ai_model import AI_MODEL_MODE

@pytest.mark.asyncio
async def test_local_sentiment_analysis():
    test_text = "This is a very positive message!"
    mock_response = {
        "response": json.dumps({
            "score": 0.9,
            "label": "positive"
        })
    }
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_post.return_value = mock_context
        
        with patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"):
            result = await analyze_text(test_text)
            
            assert result["score"] == 0.9
            assert result["sentiment"] == "positive"
            assert "timestamp" in result
            assert result["language"] == "en"

@pytest.mark.asyncio
async def test_remote_sentiment_analysis():
    test_text = "This is a negative message."
    mock_response = {
        "choices": [{
            "score": 0.2
        }]
    }
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_post.return_value = mock_context
        
        with patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "REMOTE"):
            result = await analyze_text(test_text)
            
            assert result["score"] == 0.2
            assert result["sentiment"] == "negative"
            assert "timestamp" in result
            assert result["language"] == "en"

@pytest.mark.asyncio
async def test_sentiment_analysis_error_handling():
    test_text = "Test message"
    mock_response = {"invalid": "response"}
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_post.return_value = mock_context
        
        with patch("tradingbot.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"):
            result = await analyze_text(test_text)
            
            assert result["score"] == 0.5
            assert result["sentiment"] == "neutral"
            assert "timestamp" in result
