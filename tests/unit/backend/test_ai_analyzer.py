from datetime import datetime

import pytest

from src.shared.ai_analyzer import AIAnalyzer


@pytest.mark.asyncio
async def test_validate_trade_with_r1_model(mock_deepseek_api):
    analyzer = AIAnalyzer(mock_api=mock_deepseek_api)
    await analyzer.start()
    try:
        trade_data = {
            "id": f"test_trade_{int(datetime.now().timestamp())}",
            "type": "market",
            "side": "buy",
            "amount": 1.0,
            "market_data": {
                "price": 50000.0,
                "volume_24h": 1000000.0,
                "price_change_24h": 0.05,
            },
        }

        result = await analyzer.validate_trade(trade_data)

        # Verify response structure
        assert isinstance(result, dict)
        assert "is_valid" in result
        assert isinstance(result["is_valid"], bool)
        assert "confidence" in result
        assert isinstance(result["confidence"], float)
        assert 0 <= result["confidence"] <= 1

        # Verify risk assessment
        assert "risk_assessment" in result
        risk = result["risk_assessment"]
        assert isinstance(risk, dict)
        assert all(
            k in risk
            for k in ["risk_level", "max_loss", "position_size", "volatility_exposure"]
        )
        assert all(isinstance(v, float) for v in risk.values())

        # Verify validation metrics
        assert "validation_metrics" in result
        metrics = result["validation_metrics"]
        assert isinstance(metrics, dict)
        assert all(
            k in metrics
            for k in [
                "expected_return",
                "risk_reward_ratio",
                "market_conditions_alignment",
            ]
        )
        assert all(isinstance(v, float) for v in metrics.values())

        # Verify recommendations and reason
        assert "recommendations" in result
        assert isinstance(result["recommendations"], list)
        assert "reason" in result
        assert isinstance(result["reason"], str)

    finally:
        await analyzer.stop()


@pytest.mark.asyncio
async def test_validate_trade_with_market_analysis(mock_deepseek_api):
    analyzer = AIAnalyzer(mock_api=mock_deepseek_api)
    await analyzer.start()
    try:
        trade_data = {
            "id": f"test_trade_{int(datetime.now().timestamp())}",
            "type": "limit",
            "side": "sell",
            "amount": 0.5,
            "price": 49000.0,
            "market_data": {
                "price": 49000.0,
                "volume_24h": 1000000.0,
                "price_change_24h": -0.02,
            },
        }

        market_analysis = {
            "trend": "bullish",
            "volatility": "medium",
            "support_levels": [48000.0, 47000.0],
            "resistance_levels": [50000.0, 51000.0],
            "volume_profile": "increasing",
            "risk_level": 0.6,
        }

        result = await analyzer.validate_trade(trade_data, market_analysis)

        # Core validation checks
        assert isinstance(result["is_valid"], bool)
        assert isinstance(result["confidence"], float)
        assert 0 <= result["confidence"] <= 1

        # Risk assessment validation
        risk = result["risk_assessment"]
        assert 0 <= risk["risk_level"] <= 1
        assert risk["max_loss"] >= 0
        assert risk["position_size"] > 0
        assert risk["volatility_exposure"] >= 0

        # Metrics validation
        metrics = result["validation_metrics"]
        assert metrics["expected_return"] != 0
        assert metrics["risk_reward_ratio"] > 0
        assert 0 <= metrics["market_conditions_alignment"] <= 1

        # Content validation
        assert len(result["recommendations"]) > 0
        assert len(result["reason"]) > 0

    finally:
        await analyzer.stop()


@pytest.mark.asyncio
async def test_validate_trade_error_handling(mock_deepseek_api):
    analyzer = AIAnalyzer(mock_api=mock_deepseek_api)
    await analyzer.start()
    try:
        # Test with invalid trade data
        with pytest.raises(ValueError):
            await analyzer.validate_trade({})

        # Test with missing required fields
        with pytest.raises(ValueError):
            await analyzer.validate_trade({"type": "market"})

        # Test with invalid market analysis
        with pytest.raises(ValueError):
            await analyzer.validate_trade(
                {"id": "test", "type": "market", "amount": 1.0}, {"invalid": "data"}
            )

        # Test with missing market data
        with pytest.raises(ValueError):
            await analyzer.validate_trade(
                {"id": "test", "type": "market", "side": "buy", "amount": 1.0}
            )
    finally:
        await analyzer.stop()
