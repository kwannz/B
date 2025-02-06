import pytest
import asyncio
from tradingbot.shared.exchange.jupiter_client import JupiterClient

@pytest.mark.asyncio
async def test_jupiter_quote():
    client = JupiterClient({
        "slippage_bps": 200,  # 2% slippage
        "retry_count": 3,
        "retry_delay": 1000
    })
    
    await client.start()
    try:
        quote = await client.get_quote(
            input_mint="So11111111111111111111111111111111111111112",  # SOL
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=100000000  # 0.1 SOL
        )
        
        assert "error" not in quote, f"Quote error: {quote.get('error')}"
        assert float(quote["outAmount"]) > 0, "Output amount must be greater than 0"
        assert quote["slippageBps"] == 200, "Slippage must be 200 bps"
        assert "routePlan" in quote, "Quote must include route plan"
        assert len(quote["routePlan"]) > 0, "Route plan must not be empty"
    finally:
        await client.stop()

@pytest.mark.asyncio
async def test_jupiter_rate_limit():
    client = JupiterClient({
        "slippage_bps": 200,
        "retry_count": 3,
        "retry_delay": 1000
    })
    
    await client.start()
    try:
        # Test rate limiting by making multiple requests quickly
        tasks = []
        for _ in range(3):
            tasks.append(client.get_quote(
                input_mint="So11111111111111111111111111111111111111112",
                output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                amount=100000000
            ))
        
        results = await asyncio.gather(*tasks)
        successful = sum(1 for r in results if "error" not in r)
        assert successful >= 1, "At least one request should succeed with rate limiting"
    finally:
        await client.stop()

@pytest.mark.asyncio
async def test_jupiter_retry_mechanism():
    client = JupiterClient({
        "slippage_bps": 200,
        "retry_count": 3,
        "retry_delay": 1000
    })
    
    await client.start()
    try:
        # Force a failure by using an invalid mint address
        quote = await client.get_quote(
            input_mint="invalid_mint_address",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount=100000000
        )
        
        assert "error" in quote, "Should fail with invalid mint address"
        assert client.circuit_breaker_failures > 0, "Should increment circuit breaker failures"
    finally:
        await client.stop()
