import pytest
import asyncio
import os
from tradingbot.shared.exchange.solscan_client import SolscanClient

def skip_if_no_api_key():
    if not os.getenv("SOLSCAN_API_KEY"):
        pytest.skip("SOLSCAN_API_KEY environment variable not set")

@pytest.mark.asyncio
async def test_solscan_token_info():
    skip_if_no_api_key()
    client = SolscanClient({
        "api_key": os.getenv("SOLSCAN_API_KEY")
    })
    
    await client.start()
    try:
        # Test with USDC token address
        token_info = await client.get_token_info("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
        assert token_info is not None
        assert "decimals" in token_info
        assert "symbol" in token_info
        assert token_info["symbol"] == "USDC"
    finally:
        await client.stop()

@pytest.mark.asyncio
async def test_solscan_market_info():
    skip_if_no_api_key()
    client = SolscanClient({
        "api_key": os.getenv("SOLSCAN_API_KEY")
    })
    
    await client.start()
    try:
        # Test with SOL token address
        market_info = await client.get_market_info("So11111111111111111111111111111111111111112")
        assert market_info is not None
        assert "priceUsdt" in market_info
        assert float(market_info["priceUsdt"]) > 0
    finally:
        await client.stop()

@pytest.mark.asyncio
async def test_solscan_transaction_info():
    skip_if_no_api_key()
    client = SolscanClient({
        "api_key": os.getenv("SOLSCAN_API_KEY")
    })
    
    await client.start()
    try:
        # Test with a known transaction signature
        tx_info = await client.get_transaction_info("5dpTv3goK6UTnSZKAPSxD84kwgKbQSxf2syxbakNG1XCuLn85MGpQru3YqZD4hiM5KoWDUABxxVBuhfGY9NjHv4Y")
        assert tx_info is not None
        assert "status" in tx_info
        assert tx_info["status"] == "Success"
    finally:
        await client.stop()
