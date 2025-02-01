import pytest
from unittest.mock import AsyncMock, patch
from trading_agent.strategies.dex_strategy import DEXStrategy


@pytest.fixture
async def strategy():
    strategy = DEXStrategy()
    await strategy.initialize()
    yield strategy
    await strategy.close()


@pytest.mark.asyncio
async def test_analyze_market_with_promoted_words():
    """Test that analyze_market passes promoted words to AI analyzer"""
    strategy = DEXStrategy()
    await strategy.initialize()

    promoted_words = "test strategy keywords"

    # Mock dependencies
    with (
        patch.object(
            strategy.dex, "get_market_summary", new_callable=AsyncMock
        ) as mock_market,
        patch.object(
            strategy.analyzer, "analyze_market", new_callable=AsyncMock
        ) as mock_analyze,
        patch.object(
            strategy.wallet, "get_wallet_info", new_callable=AsyncMock
        ) as mock_wallet,
        patch.object(
            strategy.risk, "get_risk_metrics", new_callable=AsyncMock
        ) as mock_risk,
    ):

        mock_market.return_value = {"price": 100.0}
        mock_analyze.return_value = {"signal": "buy", "confidence": 0.8}
        mock_wallet.return_value = {"balance": 1.0}
        mock_risk.return_value = {"risk_score": 0.5}

        result = await strategy.analyze_market(promoted_words=promoted_words)

        assert result is not None
        # Verify promoted words were passed to analyzer
        mock_analyze.assert_called_once()
        assert mock_analyze.call_args[0][0].get("promoted_words") == promoted_words


@pytest.mark.asyncio
async def test_execute_trade_respects_wallet_requirements():
    """Test that execute_trade respects wallet balance requirements"""
    strategy = DEXStrategy()
    await strategy.initialize()

    analysis = {
        "analysis": {"action": "buy", "confidence": 0.9},
        "market_data": {"sol_price": 100.0},
        "wallet_info": {"balance": 0.6},  # Just above minimum balance
    }

    # Mock dependencies
    with (
        patch.object(
            strategy.dex, "execute_trade", new_callable=AsyncMock
        ) as mock_trade,
        patch.object(
            strategy.risk, "check_trade", new_callable=AsyncMock
        ) as mock_check,
    ):

        mock_check.return_value = {"passed": True}
        mock_trade.return_value = {"status": "executed", "pnl": 0.1}

        result = await strategy.execute_trade(analysis)

        assert result is not None
        # Verify trade amount respects minimum balance
        trade_params = strategy._build_trade_params(analysis)
        assert (
            trade_params["amount"] <= analysis["wallet_info"]["balance"] - 0.5
        )  # Minimum balance
