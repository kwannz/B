"""
新闻情感分析器测试
"""

import pytest
import torch
import numpy as np
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime

from tradingbot.shared.news_sentiment_analyzer import NewsSentimentAnalyzer

# 测试数据
MOCK_ARTICLE = {
    "title": "Bitcoin Reaches New All-Time High",
    "content": "Bitcoin has reached a new all-time high price...",
    "source": "coindesk",
    "published_at": "2024-02-25T00:00:00Z",
}

MOCK_SENTIMENT_RESPONSE = {
    "sentiment_score": 0.8,
    "confidence": 0.9,
    "trend_direction": "positive",
    "factors": ["price increase", "market optimism"],
    "recommendations": ["consider buying"],
}


# FinBERT模拟数据
MOCK_FINBERT_LOGITS = torch.tensor([[0.1, 0.8, 0.1]])  # [negative, positive, neutral]


@pytest.fixture
def mock_tokenizer():
    """模拟tokenizer"""
    mock = Mock()
    mock.return_value = {
        "input_ids": torch.ones((1, 10)),
        "attention_mask": torch.ones((1, 10)),
    }
    return mock


@pytest.fixture
def mock_model():
    """模拟FinBERT模型"""
    mock = Mock()
    outputs = Mock()
    outputs.logits = MOCK_FINBERT_LOGITS
    mock.return_value = outputs
    mock.eval = Mock()
    mock.to = Mock(return_value=mock)
    return mock


@pytest.fixture
async def sentiment_analyzer(mock_tokenizer, mock_model):
    """创建情感分析器实例"""
    with patch(
        "transformers.AutoTokenizer.from_pretrained", return_value=mock_tokenizer
    ), patch(
        "transformers.AutoModelForSequenceClassification.from_pretrained",
        return_value=mock_model,
    ):
        analyzer = NewsSentimentAnalyzer()
        await analyzer.initialize()
        yield analyzer
        await analyzer.close()


@pytest.mark.asyncio
async def test_initialization(sentiment_analyzer):
    """测试初始化"""
    assert sentiment_analyzer.ai_analyzer is not None
    assert sentiment_analyzer.tokenizer is not None
    assert sentiment_analyzer.model is not None
    assert isinstance(sentiment_analyzer.device, torch.device)


@pytest.mark.asyncio
async def test_finbert_analysis(sentiment_analyzer):
    """测试FinBERT分析"""
    score = await sentiment_analyzer.analyze_article(MOCK_ARTICLE)
    assert score is not None
    assert -1 <= score <= 1  # FinBERT分数范围
    assert score > 0  # 应该是正面情感（基于MOCK_FINBERT_LOGITS）


@pytest.mark.asyncio
async def test_deepseek_fallback(sentiment_analyzer):
    """测试FinBERT失败后的DeepSeek回退"""
    # 模拟FinBERT错误
    sentiment_analyzer.tokenizer.side_effect = Exception("FinBERT Error")

    with patch(
        "src.shared.ai_analyzer.AIAnalyzer.get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.return_value = MOCK_SENTIMENT_RESPONSE
        score = await sentiment_analyzer.analyze_article(MOCK_ARTICLE)
        assert score == 0.8  # DeepSeek分数


@pytest.mark.asyncio
async def test_low_confidence_analysis(sentiment_analyzer):
    """测试低置信度情况"""
    # 模拟FinBERT低置信度
    outputs = Mock()
    outputs.logits = torch.tensor([[0.34, 0.33, 0.33]])  # 均匀分布，低置信度
    sentiment_analyzer.model.return_value = outputs

    # 测试FinBERT低置信度
    score = await sentiment_analyzer.analyze_article(MOCK_ARTICLE)
    assert score is None  # 应该因为低置信度而返回None

    # 测试DeepSeek低置信度
    with patch(
        "src.shared.ai_analyzer.AIAnalyzer.get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.return_value = {
            "sentiment_score": 0.5,
            "confidence": 0.3,  # 低于阈值
        }

        score = await sentiment_analyzer.analyze_article(MOCK_ARTICLE)
        assert score is None  # DeepSeek也因为低置信度返回None


@pytest.mark.asyncio
async def test_batch_analysis(sentiment_analyzer):
    """测试批量分析"""
    # 准备测试数据
    articles = [
        {
            "url": "https://test.com/1",
            "title": "Article 1",
            "content": "Content 1",
            "source": "coindesk",
            "published_at": "2024-02-25T00:00:00Z",
        },
        {
            "url": "https://test.com/2",
            "title": "Article 2",
            "content": "Content 2",
            "source": "cointelegraph",
            "published_at": "2024-02-25T01:00:00Z",
        },
        {
            "url": "https://test.com/3",  # 无内容文章
            "title": "",
            "content": "",
            "source": "decrypt",
            "published_at": "2024-02-25T02:00:00Z",
        },
    ]

    # 设置不同的FinBERT响应
    outputs1 = Mock()
    outputs1.logits = torch.tensor([[0.1, 0.8, 0.1]])  # 正面情感
    outputs2 = Mock()
    outputs2.logits = torch.tensor([[0.8, 0.1, 0.1]])  # 负面情感

    sentiment_analyzer.model.return_value = outputs1  # 默认正面情感

    # 测试批处理
    results = await sentiment_analyzer.analyze_batch(articles)

    # 验证结果
    assert len(results) == 2  # 空文章应被跳过
    assert all(-1 <= score <= 1 for score in results.values())  # 分数范围检查
    assert any(score > 0 for score in results.values())  # 至少有一个正面情感

    # 验证批处理大小
    assert sentiment_analyzer.batch_size == 8  # 默认批处理大小


@pytest.mark.asyncio
async def test_error_handling(sentiment_analyzer):
    """测试错误处理"""
    # 测试FinBERT初始化错误
    with patch("transformers.AutoTokenizer.from_pretrained") as mock_tokenizer:
        mock_tokenizer.side_effect = Exception("Failed to load tokenizer")
        analyzer = NewsSentimentAnalyzer()
        await analyzer.initialize()
        score = await analyzer.analyze_article(MOCK_ARTICLE)
        assert score is None
        await analyzer.close()

    # 测试FinBERT和DeepSeek都失败的情况
    sentiment_analyzer.tokenizer.side_effect = Exception("FinBERT Error")
    with patch(
        "src.shared.ai_analyzer.AIAnalyzer.get_market_sentiment"
    ) as mock_sentiment:
        mock_sentiment.side_effect = Exception("DeepSeek Error")
        score = await sentiment_analyzer.analyze_article(MOCK_ARTICLE)
        assert score is None

    # 测试空文章处理
    empty_article = {
        "title": "",
        "content": "",
        "source": "test",
        "published_at": "2024-02-25T00:00:00Z",
    }
    score = await sentiment_analyzer.analyze_article(empty_article)
    assert score is None


if __name__ == "__main__":
    pytest.main(["-v", __file__])
