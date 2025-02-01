import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch
from src.backend.trading.executor.trade_executor import TradeExecutor
from src.shared.models.errors import TradingError, ValidationError


@pytest.mark.asyncio
async def test_validate_with_ai_success():
    config = {"strategy_type": "momentum", "risk_level": "medium", "trade_size": 1.0}
    executor = TradeExecutor(config)

    mock_validation = {
        "is_valid": True,
        "confidence": 0.85,
        "risk_assessment": {
            "risk_level": 0.6,
            "max_loss": 5.0,
            "position_size": 1.0,
            "volatility_exposure": 0.4,
        },
        "validation_metrics": {
            "expected_return": 2.5,
            "risk_reward_ratio": 2.0,
            "market_conditions_alignment": 0.8,
        },
        "recommendations": ["Consider increasing position size"],
        "reason": "Trade aligns with market conditions",
    }

    with patch(
        "src.shared.ai_analyzer.AIAnalyzer.validate_trade", new_callable=AsyncMock
    ) as mock_validate:
        mock_validate.return_value = mock_validation

        trade_params = {
            "id": f"test_trade_{int(datetime.now().timestamp())}",
            "type": "market",
            "side": "buy",
            "amount": 1.0,
            "max_loss_threshold": 10.0,
        }

        validation = await executor.validate_with_ai(trade_params)
        assert validation == mock_validation
        mock_validate.assert_called_once_with(trade_params)


@pytest.mark.asyncio
async def test_validate_with_ai_invalid_trade():
    config = {"strategy_type": "momentum", "risk_level": "medium", "trade_size": 1.0}
    executor = TradeExecutor(config)

    mock_validation = {
        "is_valid": False,
        "confidence": 0.9,
        "risk_assessment": {
            "risk_level": 0.85,
            "max_loss": 15.0,
            "position_size": 1.0,
            "volatility_exposure": 0.7,
        },
        "validation_metrics": {
            "expected_return": 1.0,
            "risk_reward_ratio": 1.2,
            "market_conditions_alignment": 0.4,
        },
        "recommendations": ["Reduce position size", "Wait for better entry"],
        "reason": "High risk level and poor market conditions",
    }

    with patch(
        "src.shared.ai_analyzer.AIAnalyzer.validate_trade", new_callable=AsyncMock
    ) as mock_validate:
        mock_validate.return_value = mock_validation

        trade_params = {
            "id": f"test_trade_{int(datetime.now().timestamp())}",
            "type": "market",
            "side": "buy",
            "amount": 2.0,
            "max_loss_threshold": 10.0,
        }

        with pytest.raises(TradingError) as exc_info:
            await executor.validate_with_ai(trade_params)
        assert "AI validation failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_validate_with_ai_risk_thresholds():
    config = {"strategy_type": "momentum", "risk_level": "medium", "trade_size": 1.0}
    executor = TradeExecutor(config)

    test_cases = [
        {
            "validation": {
                "is_valid": True,
                "risk_assessment": {"risk_level": 0.9},
                "validation_metrics": {
                    "market_conditions_alignment": 0.7,
                    "risk_reward_ratio": 2.0,
                },
            },
            "expected_error": "Risk level too high",
        },
        {
            "validation": {
                "is_valid": True,
                "risk_assessment": {"risk_level": 0.7, "max_loss": 15.0},
                "validation_metrics": {
                    "market_conditions_alignment": 0.7,
                    "risk_reward_ratio": 2.0,
                },
            },
            "expected_error": "Maximum potential loss exceeds threshold",
        },
        {
            "validation": {
                "is_valid": True,
                "risk_assessment": {"risk_level": 0.7, "max_loss": 5.0},
                "validation_metrics": {
                    "market_conditions_alignment": 0.5,
                    "risk_reward_ratio": 2.0,
                },
            },
            "expected_error": "Poor market conditions alignment",
        },
        {
            "validation": {
                "is_valid": True,
                "risk_assessment": {"risk_level": 0.7, "max_loss": 5.0},
                "validation_metrics": {
                    "market_conditions_alignment": 0.7,
                    "risk_reward_ratio": 1.2,
                },
            },
            "expected_error": "Insufficient risk-reward ratio",
        },
    ]

    for case in test_cases:
        with patch(
            "src.shared.ai_analyzer.AIAnalyzer.validate_trade", new_callable=AsyncMock
        ) as mock_validate:
            mock_validate.return_value = case["validation"]

            trade_params = {
                "id": f"test_trade_{int(datetime.now().timestamp())}",
                "type": "market",
                "side": "buy",
                "amount": 1.0,
                "max_loss_threshold": 10.0,
            }

            with pytest.raises(TradingError) as exc_info:
                await executor.validate_with_ai(trade_params)
            assert case["expected_error"] in str(exc_info.value)
