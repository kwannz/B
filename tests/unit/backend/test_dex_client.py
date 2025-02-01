import pytest
import aiohttp
from datetime import datetime
from src.shared.exchange.dex_client import DEXClient

@pytest.mark.asyncio
async def test_dex_client_initialization():
    client = DEXClient()
    assert client.session is None
    
    await client.start()
    assert isinstance(client.session, aiohttp.ClientSession)
    
    await client.stop()
    assert client.session is None

@pytest.mark.asyncio
async def test_get_quote():
    client = DEXClient()
    await client.start()
    
    # Test Uniswap quote
    result = await client.get_quote(
        'uniswap',
        'ETH',
        'USDC',
        1.0
    )
    assert isinstance(result, dict)
    
    # Test Jupiter quote
    result = await client.get_quote(
        'jupiter',
        'SOL',
        'USDC',
        10.0
    )
    assert isinstance(result, dict)
    
    await client.stop()

@pytest.mark.asyncio
async def test_get_liquidity():
    client = DEXClient()
    await client.start()
    
    # Test Raydium liquidity
    result = await client.get_liquidity(
        'raydium',
        'SOL'
    )
    assert isinstance(result, dict)
    
    # Test PancakeSwap liquidity
    result = await client.get_liquidity(
        'pancakeswap',
        'CAKE'
    )
    assert isinstance(result, dict)
    
    await client.stop()

@pytest.mark.asyncio
async def test_get_market_data():
    client = DEXClient()
    await client.start()
    
    # Test Liquidswap market data
    result = await client.get_market_data('liquidswap')
    assert isinstance(result, dict)
    
    # Test Hyperliquid market data
    result = await client.get_market_data('hyperliquid')
    assert isinstance(result, dict)
    
    await client.stop()

@pytest.mark.asyncio
async def test_error_handling():
    client = DEXClient()
    await client.start()
    
    # Test invalid DEX
    result = await client.get_quote(
        'invalid_dex',
        'ETH',
        'USDC',
        1.0
    )
    assert 'error' in result
    
    # Test invalid token
    result = await client.get_liquidity(
        'uniswap',
        'INVALID_TOKEN'
    )
    assert 'error' in result
    
    await client.stop()

@pytest.mark.asyncio
async def test_concurrent_requests():
    client = DEXClient()
    await client.start()
    
    # Test multiple concurrent requests
    import asyncio
    tasks = [
        client.get_quote('uniswap', 'ETH', 'USDC', 1.0),
        client.get_quote('jupiter', 'SOL', 'USDC', 10.0),
        client.get_liquidity('raydium', 'SOL'),
        client.get_market_data('hyperliquid')
    ]
    
    results = await asyncio.gather(*tasks)
    assert all(isinstance(result, dict) for result in results)
    
    await client.stop()
