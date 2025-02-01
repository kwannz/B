"""
Test keyword extraction functionality
"""

import pytest
import spacy

from tradingbot.shared.keyword_extractor import KeywordExtractor


@pytest.fixture
def extractor():
    """Create keyword extractor instance"""
    ext = KeywordExtractor()
    ext.initialize()
    return ext


def test_english_extraction(extractor):
    """Test English keyword extraction"""
    text = """
    Bitcoin price surges to new all-time high as institutional investors 
    continue to show strong interest in cryptocurrency markets. The rally 
    was partly driven by news of major companies adding Bitcoin to their 
    balance sheets.
    """

    keywords = extractor.extract_keywords(text, language="en")
    assert len(keywords) > 0

    # Check structure
    for kw in keywords:
        assert "keyword" in kw
        assert "score" in kw
        assert "pos" in kw
        assert isinstance(kw["score"], float)
        assert 0 <= kw["score"] <= 1

    # Check content
    keywords_text = {k["keyword"].lower() for k in keywords}
    assert any("bitcoin" in kw for kw in keywords_text)
    assert any("price" in kw for kw in keywords_text)


def test_chinese_extraction(extractor):
    """Test Chinese keyword extraction"""
    text = """
    比特币价格创下新高，机构投资者继续对加密货币市场表现出浓厚兴趣。
    这轮涨势部分受到主要公司将比特币纳入资产负债表的消息推动。
    """

    keywords = extractor.extract_keywords(text, language="zh")
    assert len(keywords) > 0

    # Check structure
    for kw in keywords:
        assert "keyword" in kw
        assert "score" in kw
        assert "pos" in kw
        assert isinstance(kw["score"], float)
        assert 0 <= kw["score"] <= 1

    # Check content
    keywords_text = {k["keyword"] for k in keywords}
    assert "比特币" in keywords_text


def test_auto_language_detection(extractor):
    """Test automatic language detection"""
    en_text = "Bitcoin price reaches new heights"
    zh_text = "比特币价格创下新高"

    en_keywords = extractor.extract_keywords(en_text)
    zh_keywords = extractor.extract_keywords(zh_text)

    assert len(en_keywords) > 0
    assert len(zh_keywords) > 0


def test_empty_text(extractor):
    """Test empty text handling"""
    keywords = extractor.extract_keywords("")
    assert len(keywords) == 0


def test_invalid_text(extractor):
    """Test invalid text handling"""
    keywords = extractor.extract_keywords("!@#$%^&*()")
    assert len(keywords) == 0


def test_initialization_failure(monkeypatch):
    """Test handling of initialization failures"""

    def mock_load(*args, **kwargs):
        raise ImportError("Mock import error")

    monkeypatch.setattr(spacy, "load", mock_load)

    extractor = KeywordExtractor()
    with pytest.raises(RuntimeError) as exc_info:
        extractor.initialize()
    assert "Failed to initialize" in str(exc_info.value)
    assert not extractor.initialized


def test_multiple_initialization(extractor):
    """Test multiple initialization calls"""
    # First initialization already done in fixture
    assert extractor.initialized

    # Second initialization should be safe
    extractor.initialize()
    assert extractor.initialized

    # Keywords should still work
    keywords = extractor.extract_keywords("Test text")
    assert len(keywords) > 0


if __name__ == "__main__":
    pytest.main(["-v", __file__])
