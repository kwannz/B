from decimal import Decimal

import pytest

from src.shared.exchange.jupiter_client import JupiterClient


@pytest.fixture
def jupiter_config():
    return {"slippage_bps": 100}


@pytest.fixture
async def jupiter_client(jupiter_config):
    client = JupiterClient(jupiter_config)
    await client.start()
    yield client
    await client.stop()


@pytest.fixture
def quote_response():
    return {
        "inputMint": "So11111111111111111111111111111111111111112",
        "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "amount": "1000000000",
        "outAmount": "20000000",
        "otherAmountThreshold": "19800000",
        "swapMode": "ExactIn",
        "slippageBps": 100,
        "platformFee": None,
        "priceImpactPct": 0.1,
        "routePlan": [],
        "contextSlot": 1234567,
        "timeTaken": 0.05,
    }


async def test_get_quote(jupiter_client):
    input_mint = "So11111111111111111111111111111111111111112"
    output_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    amount = 1000000000

    quote = await jupiter_client.get_quote(input_mint, output_mint, amount)
    assert "error" not in quote
    assert "outAmount" in quote
    assert "swapMode" in quote
    assert "slippageBps" in quote
    assert int(quote["slippageBps"]) == 100


async def test_get_price(jupiter_client):
    input_mint = "So11111111111111111111111111111111111111112"
    output_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    amount = 1000000000

    price = await jupiter_client.get_price(input_mint, output_mint, amount)
    assert price is not None
    assert isinstance(price, Decimal)
    assert price > 0


async def test_get_routes(jupiter_client):
    input_mint = "So11111111111111111111111111111111111111112"
    output_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    amount = 1000000000

    routes = await jupiter_client.get_routes(input_mint, output_mint, amount)
    assert "error" not in routes
    assert "routes" in routes
    assert len(routes["routes"]) > 0


async def test_get_swap_instruction(jupiter_client, quote_response):
    swap_instruction = await jupiter_client.get_swap_instruction(quote_response)
    assert "error" not in swap_instruction
    assert "swapTransaction" in swap_instruction


async def test_error_handling(jupiter_client):
    input_mint = "invalid_mint"
    output_mint = "invalid_mint"
    amount = 1000000000

    quote = await jupiter_client.get_quote(input_mint, output_mint, amount)
    assert "error" in quote

    price = await jupiter_client.get_price(input_mint, output_mint, amount)
    assert price is None

    routes = await jupiter_client.get_routes(input_mint, output_mint, amount)
    assert "error" in routes
