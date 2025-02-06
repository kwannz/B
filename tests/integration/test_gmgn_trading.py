import pytest
from decimal import Decimal
from tradingbot.shared.exchange.dex_client import DEXClient

@pytest.fixture
async def dex_client():
    client = DEXClient()
    await client.start()
    yield client
    await client.stop()

@pytest.mark.integration
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
    assert quote["data"].get("is_anti_mev", False) is True
    assert float(quote["data"].get("fee", 0)) >= 0.002  # Minimum fee

@pytest.mark.integration
async def test_gmgn_market_data_integration(dex_client):
    # Test market data integration
    sol_address = "So11111111111111111111111111111111111111112"
    
    # Get liquidity info
    liquidity = await dex_client.get_liquidity("gmgn", sol_address)
    assert "error" not in liquidity
    assert "data" in liquidity
    
    # Get market data
    market_data = await dex_client.get_market_data("gmgn")
    assert "error" not in market_data
    assert "data" in market_data
