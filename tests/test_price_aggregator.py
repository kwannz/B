import pytest
import asyncio
import os
from tradingbot.shared.exchange.price_aggregator import PriceAggregator

def skip_if_no_api_key():
    if not os.getenv("SOLSCAN_API_KEY"):
        pytest.skip("SOLSCAN_API_KEY environment variable not set")

@pytest.mark.asyncio
async def test_price_aggregation():
    skip_if_no_api_key()
    aggregator = PriceAggregator({
        "jupiter": {
            "slippage_bps": 200,
            "retry_count": 3,
            "retry_delay": 1000
        },
        "solscan": {
            "api_key": os.getenv("SOLSCAN_API_KEY")
        },
        "max_price_diff": 0.05,
        "circuit_breaker": 0.10
    })
    
    await aggregator.start()
    try:
        result = await aggregator.get_aggregated_price(
            token_in="So11111111111111111111111111111111111111112",  # SOL
            token_out="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=0.1  # 0.1 SOL
        )
        assert "error" not in result, f"Error in result: {result.get('error')}"
        assert "price" in result, "Price not in result"
        if not result.get("fallback"):
            assert "validation_price" in result, "Validation price not in result"
            assert "price_diff" in result, "Price difference not in result"
            assert result["price_diff"] < 0.05, f"Price difference too large: {result['price_diff']:.2%}"
    finally:
        await aggregator.stop()

@pytest.mark.asyncio
async def test_circuit_breaker():
    aggregator = PriceAggregator({
        "jupiter": {
            "slippage_bps": 200,
            "retry_count": 3,
            "retry_delay": 1000
        },
        "solscan": {
            "api_key": os.getenv("SOLSCAN_API_KEY")
        },
        "max_price_diff": 0.05,
        "circuit_breaker": 0.10
    })
    
    await aggregator.start()
    try:
        # Test with large amount to trigger price impact
        result = await aggregator.get_aggregated_price(
            token_in="So11111111111111111111111111111111111111112",  # SOL
            token_out="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=1000  # 1000 SOL (large amount)
        )
        if not result.get("fallback"):
            assert "error" in result, "Should trigger circuit breaker"
            assert "Circuit breaker triggered" in result["error"], "Wrong error message"
            assert "price_diff" in result, "Missing price difference in error"
            assert float(result["price_diff"]) > 0.10, "Circuit breaker threshold not met"
    finally:
        await aggregator.stop()

@pytest.mark.asyncio
async def test_error_handling():
    aggregator = PriceAggregator({
        "jupiter": {
            "slippage_bps": 200,
            "retry_count": 1,
            "retry_delay": 100
        },
        "solscan": {
            "api_key": "invalid_key"
        },
        "max_price_diff": 0.05,
        "circuit_breaker": 0.10
    })
    
    await aggregator.start()
    try:
        result = await aggregator.get_aggregated_price(
            token_in="So11111111111111111111111111111111111111112",  # SOL
            token_out="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=0.1
        )
        if not result.get("fallback"):
            assert "error" in result, "Should fail with invalid API key"
            assert "All price sources failed" in result["error"], "Wrong error message"
            assert "jupiter_error" in result, "Missing Jupiter error details"
            assert "solscan_error" in result, "Missing Solscan error details"
    finally:
        await aggregator.stop()
