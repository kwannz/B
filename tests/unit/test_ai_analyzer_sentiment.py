import pytest
from tradingbot.src.shared.ai_analyzer import AIAnalyzer

@pytest.fixture(scope="function")
async def ai_analyzer():
    """Fixture for AI Analyzer instance."""
    analyzer = AIAnalyzer()
    await analyzer.start()
    try:
        yield analyzer
    finally:
        await analyzer.stop()

async def test_analyze_market_sentiment(ai_analyzer):
    data_sources = {
        "news": {
            "articles": [
                {"title": "Bitcoin Adoption Growing", "sentiment": 0.8},
                {"title": "Market Volatility Concerns", "sentiment": -0.3}
            ]
        },
        "social_media": {
            "posts": [
                {"text": "Bullish on crypto", "sentiment": 0.7},
                {"text": "Market uncertainty", "sentiment": -0.2}
            ]
        }
    }
    
    result = await ai_analyzer.analyze_market_sentiment(data_sources)
    
    assert isinstance(result, dict)
    assert 'overall_sentiment' in result
    assert 'confidence' in result
    assert 'sources' in result
    assert isinstance(result['overall_sentiment'], float)
    assert isinstance(result['confidence'], float)
    assert 0 <= result['overall_sentiment'] <= 1
    assert 0 <= result['confidence'] <= 1

async def test_analyze_news_sentiment(ai_analyzer):
    news_articles = [
        {
            "title": "Bitcoin Adoption Growing",
            "content": "Major institutions are adopting cryptocurrency",
            "source": "CryptoNews",
            "date": "2024-01-01"
        },
        {
            "title": "Market Volatility Concerns",
            "content": "Experts warn about market volatility",
            "source": "CryptoDaily",
            "date": "2024-01-02"
        }
    ]
    
    result = await ai_analyzer.analyze_news_sentiment(news_articles)
    
    assert isinstance(result, dict)
    assert 'sentiment_score' in result
    assert 'key_topics' in result
    assert 'source_credibility' in result
    assert isinstance(result['sentiment_score'], float)
    assert isinstance(result['key_topics'], list)
    assert isinstance(result['source_credibility'], float)
    assert 0 <= result['sentiment_score'] <= 1
    assert 0 <= result['source_credibility'] <= 1

async def test_analyze_social_sentiment(ai_analyzer):
    social_posts = [
        {
            "text": "Bullish on crypto",
            "platform": "Twitter",
            "timestamp": "2024-01-01",
            "engagement": 100
        },
        {
            "text": "Market uncertainty",
            "platform": "Reddit",
            "timestamp": "2024-01-02",
            "engagement": 50
        }
    ]
    
    result = await ai_analyzer.analyze_social_sentiment(social_posts)
    
    assert isinstance(result, dict)
    assert 'sentiment_score' in result
    assert 'trending_topics' in result
    assert 'platform_breakdown' in result
    assert isinstance(result['sentiment_score'], float)
    assert isinstance(result['trending_topics'], list)
    assert isinstance(result['platform_breakdown'], dict)
    assert 0 <= result['sentiment_score'] <= 1

async def test_analyze_sentiment_trends(ai_analyzer):
    historical_sentiment = [
        {
            "date": "2024-01-01",
            "sentiment": 0.8,
            "volume": 1000
        },
        {
            "date": "2024-01-02",
            "sentiment": 0.6,
            "volume": 1200
        }
    ]
    
    result = await ai_analyzer.analyze_sentiment_trends(historical_sentiment)
    
    assert isinstance(result, dict)
    assert 'trend_direction' in result
    assert 'volatility' in result
    assert 'correlation_with_price' in result
    assert 'significant_changes' in result
    assert isinstance(result['volatility'], float)
    assert isinstance(result['correlation_with_price'], float)
    assert 0 <= result['volatility'] <= 1
    assert -1 <= result['correlation_with_price'] <= 1

async def test_analyze_sentiment_impact(ai_analyzer):
    sentiment_data = {
        "overall": 0.8,
        "news": 0.7,
        "social": 0.9
    }
    market_data = {
        "price": 19000,
        "volume": 1000000
    }
    
    result = await ai_analyzer.analyze_sentiment_impact(sentiment_data, market_data)
    
    assert isinstance(result, dict)
    assert 'price_impact' in result
    assert 'volume_impact' in result
    assert 'confidence' in result
    assert isinstance(result['price_impact'], float)
    assert isinstance(result['volume_impact'], float)
    assert isinstance(result['confidence'], float)
    assert -1 <= result['price_impact'] <= 1
    assert -1 <= result['volume_impact'] <= 1
    assert 0 <= result['confidence'] <= 1

async def test_analyze_regional_sentiment(ai_analyzer):
    regional_data = {
        "US": {
            "sentiment": 0.8,
            "volume": 1000
        },
        "EU": {
            "sentiment": 0.6,
            "volume": 800
        },
        "Asia": {
            "sentiment": 0.7,
            "volume": 1200
        }
    }
    
    result = await ai_analyzer.analyze_regional_sentiment(regional_data)
    
    assert isinstance(result, dict)
    assert 'global_sentiment' in result
    assert 'regional_breakdown' in result
    assert 'dominant_regions' in result
    assert isinstance(result['global_sentiment'], float)
    assert isinstance(result['regional_breakdown'], dict)
    assert isinstance(result['dominant_regions'], list)
    assert 0 <= result['global_sentiment'] <= 1

async def test_analyze_sentiment_divergence(ai_analyzer):
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
    assert 'divergence_score' in result
    assert 'conflicting_sources' in result
    assert 'confidence_adjustment' in result
    assert isinstance(result['divergence_score'], float)
    assert isinstance(result['conflicting_sources'], list)
    assert isinstance(result['confidence_adjustment'], float)
    assert 0 <= result['divergence_score'] <= 1
    assert -1 <= result['confidence_adjustment'] <= 1

async def test_generate_sentiment_report(ai_analyzer):
    sentiment_data = {
        "overall": 0.8,
        "news": 0.7,
        "social": 0.9,
        "technical": 0.6
    }
    
    result = await ai_analyzer.generate_sentiment_report(sentiment_data)
    
    assert isinstance(result, dict)
    assert 'summary' in result
    assert 'detailed_analysis' in result
    assert 'recommendations' in result
    assert 'confidence_score' in result
    assert isinstance(result['summary'], str)
    assert isinstance(result['recommendations'], list)
    assert isinstance(result['confidence_score'], float)
    assert 0 <= result['confidence_score'] <= 1
