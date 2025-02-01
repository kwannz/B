import os
import json
import pytest
import asyncio
import nest_asyncio
from typing import Dict, Any
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import create_engine, MetaData
from tradingbot.shared.ai_analyzer import AIAnalyzer
from tradingbot.shared.models.sentiment import Base, SentimentAnalysis

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create test database tables."""
    engine = create_engine(os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/test_db"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

# Enable nested event loops for testing
nest_asyncio.apply()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

MOCK_RESPONSE = {
    "sentiment_score": 0.8,
    "confidence": 0.45,  # Low confidence to trigger fallback
    "model_used": "deepseek-v3",
    "fallback_used": False,
    "strategy_type": "momentum",
    "max_drawdown": 0.15,
    "drawdown_periods": [{"start": "2024-01-01", "end": "2024-01-02", "depth": 0.1}],
    "recovery_analysis": {"avg_recovery": "2d", "max_recovery": "5d"},
    "risk_metrics": {"calmar_ratio": 1.2, "ulcer_index": 0.3},
    "max_loss": 5000.0,
    "confidence_level": 0.95,
    "total_returns": 0.25,
    "trade_count": 100,
    "win_rate": 0.65,
    "profit_factor": 1.8,
    "sharpe_ratio": 1.5,
    "worst_case_loss": 5000.0,
    "risk_tolerance_breach": False,
    "stress_metrics": {"stress_var": 60000, "stress_sharpe": 1.2},
    "scenario_results": [
        {
            "name": "market_crash",
            "price_change": -0.3,
            "impact": -0.3,
            "affected_assets": ["BTC"]
        },
        {
            "name": "high_volatility",
            "volatility": 0.5,
            "impact": -0.2,
            "affected_assets": ["BTC", "ETH"]
        }
    ],
    "parameters": {"lookback": 20, "entry_price": 45000},
    "risk_assessment": {"risk_score": 0.35, "max_loss": 2000.0},
    "validation_metrics": {"backtest_performance": 0.8},
    "optimization_suggestions": [{"parameter": "lookback", "value": 25}],
    "recommended_size": 0.1,
    "time_horizon": "1d",
    "optimized_parameters": {
        "lookback": 25,
        "entry_threshold": 0.02,
        "exit_threshold": 0.01
    },
    "expected_improvement": {
        "sharpe_ratio": 0.2,
        "max_drawdown": -0.05,
        "returns": 0.1
    },
    "parameters": {
        "lookback": 20,
        "entry_price": 45000,
        "stop_loss": 43000,
        "take_profit": 48000,
        "position_size": 0.1
    },
    "signals": ["MACD golden cross", "RSI oversold"],
    "indicators": {
        "macd": {"value": 0.5, "signal": 0.2},
        "rsi": {"value": 30, "signal": "oversold"},
        "bollinger_bands": {"upper": 46000, "middle": 45000, "lower": 44000}
    },
    "performance_metrics": {
        "sharpe": 1.5,
        "sortino": 2.0,
        "max_drawdown": 0.1,
        "volatility": 0.2,
        "returns": 0.25,
        "win_rate": 0.7,
        "profit_factor": 1.8,
        "avg_trade_return": 0.015
    },
    "risk_metrics": {
        "max_drawdown": 0.1,
        "var": 50000,
        "expected_shortfall": 55000,
        "beta": 1.2
    },
    "risk_assessment": {
        "risk_score": 0.35,
        "max_loss": 2000,
        "position_sizing_recommendation": "Reduce position size by 10%"
    },
    "weights": [
        {"name": "momentum", "parameters": {"lookback": 20}, "weight": 0.6},
        {"name": "mean_reversion", "parameters": {"window": 10}, "weight": 0.4}
    ],
    "expected_performance": {
        "return": 0.15,
        "sharpe_ratio": 1.8,
        "max_drawdown": 0.12,
        "win_rate": 0.65
    },
    "optimization_suggestions": [
        {"parameter": "lookback", "current": 20, "suggested": 25, "reason": "Improved Sharpe ratio"},
        {"parameter": "stop_loss", "current": 43000, "suggested": 43500, "reason": "Better risk-reward"}
    ],
    "validation_results": {
        "strategy_consistency": 0.85,
        "market_fit": 0.75,
        "robustness_score": 0.8
    },
    "market_risk": {
        "volatility": "medium",
        "liquidity": "high",
        "trend_strength": 0.7
    },
    "position_risk": {
        "size_risk": 0.3,
        "exposure_risk": 0.4,
        "correlation_risk": 0.2
    },
    "worst_case_loss": 5000,
    "risk_tolerance_breach": False,
    "stress_metrics": {
        "stress_var": 60000,
        "stress_sharpe": 1.2,
        "max_drawdown_stress": 0.15
    },
    "scenario_results": [
        {
            "scenario": "high_volatility",
            "impact": -0.2,
            "affected_assets": ["BTC", "ETH"],
            "impact_score": 0.7
        }
    ],
    "overall_sentiment": 0.8,
    "sources": {"news": 0.7, "social": 0.9},
    "key_topics": ["adoption", "regulation"],
    "source_credibility": 0.85,
    "trending_topics": ["DeFi", "NFTs"],
    "platform_breakdown": {"twitter": 0.8, "reddit": 0.7},
    "trend_direction": "positive",
    "volatility": 0.3,
    "correlation_with_price": 0.6,
    "significant_changes": ["positive shift"],
    "price_impact": 0.4,
    "volume_impact": 0.3,
    "global_sentiment": 0.75,
    "regional_breakdown": {"US": 0.8, "Asia": 0.7},
    "dominant_regions": ["US", "EU"],
    "divergence_score": 0.2,
    "conflicting_sources": ["news vs social"],
    "confidence_adjustment": -0.1,
    "summary": "Positive market sentiment",
    "detailed_analysis": "Market shows strong bullish signals",
    "recommendations": ["Consider long position"],
    "market_trend": "bullish",
    "support_levels": [9000, 8500],
    "resistance_levels": [10000, 10500],
    "trend_analysis": {"direction": "up", "strength": 0.8},
    "prediction": {"next_target": 10000, "confidence": 0.85},
    "volume_by_price": {"9000": 1000, "9500": 1500},
    "high_volume_nodes": [9000, 9500],
    "low_volume_nodes": [8500, 10000],
    "bid_ask_ratio": 1.2,
    "liquidity_score": 0.8,
    "imbalance_indicator": "balanced",
    "risk_level": 0.4,
    "risk_factors": ["market volatility", "news impact"],
    "market_conditions": {"trend": "bullish", "volatility": "medium"},
    "volatility_metrics": {"historical": 0.2, "implied": 0.25},
    "liquidity_metrics": {"spread": 0.1, "depth": 1000000},
    "var_value": 50000,
    "correlation_matrix": [[1.0, 0.5], [0.5, 1.0]],
    "diversification_score": 0.7,
    "high_correlation_pairs": [["BTC", "ETH"]],
    "overall_risk": 0.4,
    "risk_breakdown": {"market": 0.3, "position": 0.5},
    "metrics": {"var": 50000, "sharpe": 1.5},
    "drawdown_periods": [{"start": "2024-01-01", "end": "2024-01-02", "amount": 0.1}],
    "recovery_analysis": {"avg_recovery": "2d", "max_recovery": "5d"},
    "adapted_parameters": {"lookback": 25},
    "adaptation_reason": "increased volatility",
    "confidence_score": 0.85,
    "overall_risk_score": 0.4,
    "risk_score": 0.35
}

@pytest.fixture(scope="function")
def mock_deepseek_api():
    """Mock DeepSeek API responses."""
    mock = AsyncMock()
    mock.return_value = {
        "choices": [{
            "message": {
                "content": json.dumps(MOCK_RESPONSE)
            }
        }]
    }
    return mock

@pytest.fixture(scope="function")
def ai_analyzer(mock_deepseek_api):
    """Fixture for AI Analyzer instance."""
    async def _init():
        analyzer = AIAnalyzer(api_key="test_key", mock_api=mock_deepseek_api)
        await analyzer.start()
        return analyzer
    return asyncio.run(_init())
