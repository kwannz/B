"""
Test sentiment analyzer implementation
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from tradingbot.shared.news_collector.sentiment_analyzer import NewsSentimentAnalyzer


@pytest.fixture
async def sentiment_analyzer():
    """Create sentiment analyzer instance"""
    analyzer = NewsSentimentAnalyzer()
    await analyzer.initialize()
    yield analyzer
    await analyzer.close()


@pytest.mark.asyncio
async def test_english_sentiment_analysis(sentiment_analyzer):
    """Test English text sentiment analysis"""
    # Test positive sentiment
    text = "The cryptocurrency market shows strong growth potential with increasing adoption."
    result = await sentiment_analyzer.analyze_english(text)
    assert result["language"] == "en"
    assert isinstance(result["score"], float)
    assert result["sentiment"] in ["positive", "negative", "neutral"]

    # Test negative sentiment
    text = "Market crash leads to significant losses in cryptocurrency investments."
    result = await sentiment_analyzer.analyze_english(text)
    assert result["language"] == "en"
    assert isinstance(result["score"], float)
    assert result["sentiment"] in ["positive", "negative", "neutral"]


@pytest.mark.asyncio
async def test_chinese_sentiment_analysis(sentiment_analyzer):
    """Test Chinese text sentiment analysis"""
    with patch.object(sentiment_analyzer, "_call_deepseek") as mock_deepseek:
        # Mock DeepSeek response
        mock_deepseek.return_value = {
            "choices": [
                {
                    "message": {
                        "content": '{"sentiment": "positive", "score": 0.8, "analysis": "积极信号"}'
                    }
                }
            ]
        }

        text = "比特币价格突破历史新高，市场信心增强。"
        result = await sentiment_analyzer.analyze_chinese(text)
        assert result["language"] == "zh"
        assert isinstance(result["score"], float)
        assert result["sentiment"] in ["positive", "negative", "neutral"]


@pytest.mark.asyncio
async def test_auto_language_detection(sentiment_analyzer):
    """Test automatic language detection"""
    # Test Chinese detection
    text = "加密货币市场持续上涨"
    result = await sentiment_analyzer.analyze_text(text)
    assert result["language"] == "zh"

    # Test English detection
    text = "Cryptocurrency market continues to rise"
    result = await sentiment_analyzer.analyze_text(text)
    assert result["language"] == "en"


@pytest.mark.asyncio
async def test_deepseek_api_retry(sentiment_analyzer):
    """Test DeepSeek API retry mechanism"""
    with patch.object(sentiment_analyzer, "_call_deepseek") as mock_deepseek:
        # Simulate API failure then success
        mock_deepseek.side_effect = [
            None,  # First call fails
            {  # Second call succeeds
                "choices": [
                    {"message": {"content": '{"sentiment": "neutral", "score": 0.5}'}}
                ]
            },
        ]

        text = "测试重试机制"
        result = await sentiment_analyzer.analyze_chinese(text)
        assert result["language"] == "zh"
        assert isinstance(result["score"], float)
        assert mock_deepseek.call_count == 2


@pytest.mark.asyncio
async def test_error_handling(sentiment_analyzer):
    """Test error handling"""
    # Test with empty text
    result = await sentiment_analyzer.analyze_text("")
    assert result["sentiment"] == "neutral"
    assert result["score"] == 0.0

    # Test with invalid language
    result = await sentiment_analyzer.analyze_text("test", language="invalid")
    assert result["sentiment"] == "neutral"
    assert result["score"] == 0.0


if __name__ == "__main__":
    pytest.main(["-v", __file__])
