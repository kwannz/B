import os

import pytest

from src.shared.sentiment.sentiment_analyzer import analyze_text


@pytest.mark.asyncio
async def test_analyze_text_english():
    text = "Bitcoin price surges to new all-time high as institutional adoption grows"
    result = await analyze_text(text, language="en")
    assert isinstance(result, dict)
    assert "language" in result
    assert "score" in result
    assert "sentiment" in result
    assert "raw_score" in result
    assert "analysis" in result
    assert result["language"] == "en"
    assert isinstance(result["score"], float)
    assert result["sentiment"] in ["positive", "negative", "neutral"]


@pytest.mark.asyncio
async def test_analyze_text_chinese():
    text = "比特币价格创下新高，机构采用率持续增长"
    result = await analyze_text(text, language="zh")
    assert isinstance(result, dict)
    assert "language" in result
    assert "score" in result
    assert "sentiment" in result
    assert "raw_score" in result
    assert "analysis" in result
    assert result["language"] == "zh"
    assert isinstance(result["score"], float)
    assert result["sentiment"] in ["positive", "negative", "neutral"]


@pytest.mark.asyncio
async def test_analyze_text_error_handling():
    # Test empty text
    with pytest.raises(ValueError, match="Text cannot be empty"):
        await analyze_text("")

    # Test invalid language
    with pytest.raises(ValueError, match="Unsupported language"):
        await analyze_text("Some text", language="invalid_lang")

    # Test missing API key
    original_key = os.environ.get("DEEPSEEK_API_KEY")
    try:
        os.environ["DEEPSEEK_API_KEY"] = ""
        with pytest.raises(
            ValueError, match="DEEPSEEK_API_KEY environment variable not set"
        ):
            await analyze_text("Some text")
    finally:
        if original_key:
            os.environ["DEEPSEEK_API_KEY"] = original_key
