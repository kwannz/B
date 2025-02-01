"""
Test sentiment analysis with keyword extraction
"""

import pytest

from tradingbot.shared.sentiment.sentiment_analyzer import NewsSentimentAnalyzer


@pytest.mark.asyncio
async def test_english_sentiment_with_keywords():
    """Test English sentiment analysis with keyword extraction"""
    analyzer = NewsSentimentAnalyzer()
    await analyzer.initialize()

    text = """
    Bitcoin price surges to new all-time high as institutional investors 
    continue to show strong interest in cryptocurrency markets.
    """

    result = await analyzer.analyze_text(text, language="en")
    assert "keywords" in result
    assert len(result["keywords"]) > 0

    # Check keyword structure
    for kw in result["keywords"]:
        assert "keyword" in kw
        assert "score" in kw
        assert "pos" in kw

    # Check content
    keywords_text = {k["keyword"].lower() for k in result["keywords"]}
    assert any("bitcoin" in kw for kw in keywords_text)

    await analyzer.close()


@pytest.mark.asyncio
async def test_chinese_sentiment_with_keywords():
    """Test Chinese sentiment analysis with keyword extraction"""
    analyzer = NewsSentimentAnalyzer()
    await analyzer.initialize()

    text = """
    比特币价格创下新高，机构投资者继续对加密货币市场表现出浓厚兴趣。
    """

    result = await analyzer.analyze_text(text, language="zh")
    assert "keywords" in result
    assert len(result["keywords"]) > 0

    # Check keyword structure
    for kw in result["keywords"]:
        assert "keyword" in kw
        assert "score" in kw
        assert "pos" in kw

    # Check content
    keywords_text = {k["keyword"] for k in result["keywords"]}
    assert "比特币" in keywords_text

    await analyzer.close()


@pytest.mark.asyncio
async def test_keyword_extraction_failure():
    """Test handling of keyword extraction failures"""
    analyzer = NewsSentimentAnalyzer()
    await analyzer.initialize()

    # Test with invalid text
    result = await analyzer.analyze_text("", language="en")
    assert "keywords" in result
    assert isinstance(result["keywords"], list)
    assert len(result["keywords"]) == 0

    await analyzer.close()


if __name__ == "__main__":
    pytest.main(["-v", __file__])
