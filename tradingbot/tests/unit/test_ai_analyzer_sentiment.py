import pytest
from tradingbot.shared.ai_analyzer import AIAnalyzer

@pytest.fixture
def ai_analyzer():
    return AIAnalyzer()

@pytest.mark.asyncio
async def test_analyze_news_sentiment(ai_analyzer):
    """Test news sentiment analysis"""
    await ai_analyzer.start()
    
    news_articles = [
        {
            "title": "Bitcoin Adoption Soars",
            "content": "Major institutions are adopting cryptocurrency",
            "source": "CryptoNews",
            "timestamp": "2024-01-24T12:00:00Z"
        },
        {
            "title": "Market Analysis",
            "content": "Neutral market conditions persist",
            "source": "TradingView",
            "timestamp": "2024-01-24T13:00:00Z"
        }
    ]
    
    result = await ai_analyzer.analyze_news_sentiment(news_articles)
    
    assert isinstance(result, dict)
    assert "sentiment_score" in result
    assert "key_topics" in result
    assert "source_credibility" in result
    assert isinstance(result["key_topics"], list)
    assert 0 <= result["sentiment_score"] <= 1
    assert 0 <= result["source_credibility"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_social_sentiment(ai_analyzer):
    """Test social media sentiment analysis"""
    await ai_analyzer.start()
    
    social_posts = [
        {
            "platform": "twitter",
            "content": "Bullish on crypto! 🚀",
            "timestamp": "2024-01-24T12:00:00Z",
            "engagement": {"likes": 100, "retweets": 50}
        },
        {
            "platform": "reddit",
            "content": "Market looks uncertain",
            "timestamp": "2024-01-24T13:00:00Z",
            "engagement": {"upvotes": 75, "comments": 30}
        }
    ]
    
    result = await ai_analyzer.analyze_social_sentiment(social_posts)
    
    assert isinstance(result, dict)
    assert "sentiment_score" in result
    assert "trending_topics" in result
    assert "platform_breakdown" in result
    assert isinstance(result["trending_topics"], list)
    assert isinstance(result["platform_breakdown"], dict)
    assert 0 <= result["sentiment_score"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_sentiment_trends(ai_analyzer):
    """Test sentiment trends analysis"""
    await ai_analyzer.start()
    
    historical_sentiment = [
        {
            "timestamp": "2024-01-23T00:00:00Z",
            "sentiment": 0.8,
            "volume": 1000
        },
        {
            "timestamp": "2024-01-24T00:00:00Z",
            "sentiment": 0.6,
            "volume": 1200
        }
    ]
    
    result = await ai_analyzer.analyze_sentiment_trends(historical_sentiment)
    
    assert isinstance(result, dict)
    assert "trend_direction" in result
    assert "volatility" in result
    assert "correlation_with_price" in result
    assert "significant_changes" in result
    assert isinstance(result["significant_changes"], list)
    assert 0 <= result["volatility"] <= 1
    assert -1 <= result["correlation_with_price"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_sentiment_impact(ai_analyzer):
    """Test sentiment impact analysis"""
    await ai_analyzer.start()
    
    sentiment_data = {
        "current": 0.8,
        "previous": 0.6,
        "change": 0.2,
        "volume": 1000
    }
    
    market_data = {
        "price": 20000,
        "volume": 1000,
        "timestamp": "2024-01-24T12:00:00Z"
    }
    
    result = await ai_analyzer.analyze_sentiment_impact(sentiment_data, market_data)
    
    assert isinstance(result, dict)
    assert "price_impact" in result
    assert "volume_impact" in result
    assert "confidence" in result
    assert -1 <= result["price_impact"] <= 1
    assert -1 <= result["volume_impact"] <= 1
    assert 0 <= result["confidence"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_regional_sentiment(ai_analyzer):
    """Test regional sentiment analysis"""
    await ai_analyzer.start()
    
    regional_data = {
        "US": {
            "sentiment": 0.8,
            "volume": 1000,
            "sources": ["twitter", "reddit"]
        },
        "EU": {
            "sentiment": 0.6,
            "volume": 800,
            "sources": ["twitter", "telegram"]
        },
        "Asia": {
            "sentiment": 0.7,
            "volume": 1200,
            "sources": ["weibo", "telegram"]
        }
    }
    
    result = await ai_analyzer.analyze_regional_sentiment(regional_data)
    
    assert isinstance(result, dict)
    assert "global_sentiment" in result
    assert "regional_breakdown" in result
    assert "dominant_regions" in result
    assert isinstance(result["regional_breakdown"], dict)
    assert isinstance(result["dominant_regions"], list)
    assert 0 <= result["global_sentiment"] <= 1
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_analyze_sentiment_divergence(ai_analyzer):
    """Test sentiment divergence analysis"""
    await ai_analyzer.start()
    
    sentiment_data = {
        "news": {
            "sentiment": 0.8,
            "confidence": 0.9
        },
        "social": {
            "sentiment": 0.4,
            "confidence": 0.7
        },
        "technical": {
            "sentiment": 0.6,
            "confidence": 0.8
        }
    }
    
    result = await ai_analyzer.analyze_sentiment_divergence(sentiment_data)
    
    assert isinstance(result, dict)
    assert "divergence_score" in result
    assert "conflicting_sources" in result
    assert "confidence_adjustment" in result
    assert isinstance(result["conflicting_sources"], list)
    assert 0 <= result["divergence_score"] <= 1
    assert isinstance(result["confidence_adjustment"], (int, float))
    
    await ai_analyzer.stop()

@pytest.mark.asyncio
async def test_generate_sentiment_report(ai_analyzer):
    """Test sentiment report generation"""
    await ai_analyzer.start()
    
    sentiment_data = {
        "overall": 0.7,
        "news": 0.8,
        "social": 0.6,
        "technical": 0.7,
        "regional": {
            "US": 0.8,
            "EU": 0.6,
            "Asia": 0.7
        },
        "trends": {
            "direction": "increasing",
            "volatility": 0.3
        }
    }
    
    result = await ai_analyzer.generate_sentiment_report(sentiment_data)
    
    assert isinstance(result, dict)
    assert "summary" in result
    assert "detailed_analysis" in result
    assert "recommendations" in result
    assert "confidence_score" in result
    assert isinstance(result["recommendations"], list)
    assert 0 <= result["confidence_score"] <= 1
    
    await ai_analyzer.stop()
