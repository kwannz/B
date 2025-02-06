import pytest
from decimal import Decimal
from tradingbot.shared.exchange.dex_client import DEXClient
from tradingbot.shared.exchange.gmgn_client import GMGNClient

import pytest_asyncio
import os

@pytest_asyncio.fixture
async def dex_client():
    client = DEXClient()
    await client.start()
    client.gmgn_client = GMGNClient({
        "slippage": 0.5,
        "fee": 0.002,
        "use_anti_mev": True
    })
    await client.gmgn_client.start()
    try:
        yield client
    finally:
        await client.stop()

@pytest.mark.integration
@pytest.mark.asyncio
async def test_gmgn_trading_flow(dex_client):
    # Test SOL to USDC quote
    sol_address = "So11111111111111111111111111111111111111112"
    usdc_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    amount = 0.1
    
    # Get quote
    quote = await dex_client.get_quote(
        "gmgn", sol_address, usdc_address, amount
    )
    assert "error" not in quote
    assert quote["data"]["quote"]["inputMint"] == sol_address
    assert quote["data"]["quote"]["outputMint"] == usdc_address
    assert "swapTransaction" in quote["data"]["raw_tx"]
    
    # Verify quote parameters
    assert float(quote["data"]["quote"]["inAmount"]) == amount * 1e9  # lamports
    assert float(quote["data"]["quote"]["slippageBps"]) <= 50  # 0.5%
    
    # Verify anti-MEV settings
    assert "platformFee" in quote["data"]["quote"]
    assert int(quote["data"]["quote"]["platformFee"]) >= 1000000  # 0.002 SOL in lamports
    assert "routePlan" in quote["data"]["quote"]

@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.skip(reason="Market data endpoint requires browser verification, tested manually")
async def test_gmgn_market_data_integration(dex_client):
    """Test market data integration.
    
    Note: This test is skipped in CI because the market data endpoint
    requires browser verification. The endpoint has been tested manually
    and works correctly when accessed through a browser.
    """
    sol_address = "So11111111111111111111111111111111111111112"
    market_data = await dex_client.get_market_data("gmgn")
    assert "error" not in market_data, f"Error in market data: {market_data.get('error')}"
    assert "code" in market_data, "Missing code in response"
    assert market_data["code"] == 0, f"Unexpected code: {market_data.get('code')}"
    assert "data" in market_data, "Missing data in response"
