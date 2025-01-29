import pytest
import json
from unittest.mock import patch, AsyncMock
import os
import sys

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from src.shared.sentiment.sentiment_analyzer import analyze_text
from src.shared.config.ai_model import AI_MODEL_MODE, LOCAL_MODEL_NAME, REMOTE_MODEL_NAME

@pytest.mark.asyncio
async def test_local_model_priority():
    test_text = "Bitcoin price hits new all-time high!"
    mock_local_response = {
        "response": json.dumps({
            "score": 0.9,
            "label": "positive"
        })
    }
    
    with patch("src.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"), \
         patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.status = 200
        mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_local_response)
        mock_post.return_value = mock_context
        
        result = await analyze_text(test_text)
        
        assert result["model"] == "local"
        assert result["score"] == 0.9
        assert result["sentiment"] == "positive"
        assert "timestamp" in result

@pytest.mark.asyncio
async def test_remote_fallback():
    test_text = "Market shows mixed signals"
    mock_local_error = Exception("Local model error")
    mock_remote_response = {
        "choices": [{
            "score": 0.5
        }]
    }
    
    with patch("src.shared.sentiment.sentiment_analyzer.AI_MODEL_MODE", "REMOTE"), \
         patch("aiohttp.ClientSession.post") as mock_post:
            mock_context = AsyncMock()
            mock_context.__aenter__.return_value.status = 200
            mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_remote_response)
            mock_post.return_value = mock_context
        
        result = await analyze_text(test_text)
        
        assert result["model"] == "remote"
        assert result["score"] == 0.5
        assert "timestamp" in result

@pytest.mark.asyncio
async def test_strict_local_mode():
    test_text = "Test message"
    mock_local_error = Exception("Local model error")
    
    with patch("src.shared.config.ai_model.AI_MODEL_MODE", "LOCAL"), \
         patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.side_effect = mock_local_error
        mock_post.return_value = mock_context
        
        result = await analyze_text(test_text)
        
        assert result["score"] == 0.5
        assert result["sentiment"] == "neutral"
        assert "timestamp" in result

@pytest.mark.asyncio
async def test_chinese_text():
    test_text = "比特币价格创历史新高！"
    mock_response = {
        "response": json.dumps({
            "score": 0.95,
            "label": "positive"
        })
    }
    
    with patch("aiohttp.ClientSession.post") as mock_post:
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value.status = 200
        mock_context.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_post.return_value = mock_context
        
        result = await analyze_text(test_text, language="zh")
        
        assert result["language"] == "zh"
        assert result["score"] == 0.95
        assert result["sentiment"] == "positive"
        assert "timestamp" in result
