import pytest
from unittest.mock import patch, AsyncMock
from tradingbot.shared.exchange.dex_client import DEXClient

@pytest.fixture
def mock_session():
    session = AsyncMock()
    
    # Mock GET response for market data
    get_response = {
        "code": 0,
        "msg": "success",
        "data": {
            "markets": [{"symbol": "SOL/USDC", "price": "100.0", "volume": "1000000"}]
        }
    }
    session.get.return_value.__aenter__.return_value.json.return_value = get_response
    
    # Mock POST response for swap
    post_response = {
        "code": 0,
        "msg": "success",
        "data": {
            "quote": {
                "inputMint": "So11111111111111111111111111111111111111112",
                "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "inAmount": "1000000",
                "outAmount": "202217"
            },
            "raw_tx": {
                "swapTransaction": "test_tx",
                "lastValidBlockHeight": 123456789,
                "recentBlockhash": "test_blockhash"
            }
        }
    }
    session.post.return_value.__aenter__.return_value.json.return_value = post_response
    return session

@pytest.mark.asyncio
async def test_dex_client_initialization(mock_session):
    client = DEXClient()
    client.session = mock_session
    assert client.session is not None, "HTTP session not initialized"
    assert "gmgn" in client.base_urls, "GMGN base URL not configured"

@pytest.mark.asyncio
async def test_dex_client_quote(mock_session):
    client = DEXClient()
    client.session = mock_session
    quote = await client.get_quote(
        "gmgn",
        "So11111111111111111111111111111111111111112",  # SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
        0.001
    )
    assert "error" not in quote, f"Error getting quote: {quote.get('error')}"
    assert "data" in quote, "Quote response missing data"
    assert "quote" in quote["data"], "Quote data missing quote info"

@pytest.mark.asyncio
async def test_dex_client_market_data(mock_session):
    mock_session.get.return_value.__aenter__.return_value.json.return_value = {
        "code": 0,
        "msg": "success",
        "data": {
            "markets": [{"symbol": "SOL/USDC", "price": "100.0", "volume": "1000000"}]
        }
    }
    client = DEXClient()
    client.gmgn_client = AsyncMock()
    client.gmgn_client.get_market_data = AsyncMock(return_value={
        "code": 0,
        "msg": "success",
        "data": {
            "markets": [{"symbol": "SOL/USDC", "price": "100.0", "volume": "1000000"}]
        }
    })
    
    market_data = await client.get_market_data("gmgn")
    assert isinstance(market_data, dict), "Market data should be a dictionary"
    assert "code" in market_data, "Market data missing code field"
    assert "data" in market_data, "Market data missing data field"
    assert "markets" in market_data["data"], "Market data missing markets info"
    
@pytest.mark.asyncio
async def test_dex_client_error_handling(mock_session):
    mock_session.get.side_effect = Exception("Network error")
    client = DEXClient()
    client.session = mock_session
    client.gmgn_client = AsyncMock()
    client.gmgn_client.get_market_data = AsyncMock(return_value={"error": "Network error"})
    
    result = await client.get_market_data("gmgn")
    assert "error" in result, "Expected error response"
    assert isinstance(result["error"], str), "Error should be a string"
    assert result["error"] == "Network error", "Expected network error message"

@pytest.mark.asyncio
async def test_dex_client_execute_swap(mock_session):
    client = DEXClient()
    client.gmgn_client = AsyncMock()
    client.gmgn_client.execute_swap = AsyncMock(return_value={
        "code": 0,
        "msg": "success",
        "data": {
            "tx_hash": "test_hash",
            "raw_tx": {
                "swapTransaction": "test_tx",
                "lastValidBlockHeight": 123456789
            }
        }
    })
    
    quote = {
        "data": {
            "quote": {
                "inputMint": "So11111111111111111111111111111111111111112",
                "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "inAmount": "1000000",
                "outAmount": "202217"
            },
            "raw_tx": {
                "swapTransaction": "test_tx",
                "lastValidBlockHeight": 123456789
            }
        }
    }
    result = await client.execute_swap("gmgn", quote, None, {"slippage": 0.5})
    assert "error" not in result, "Unexpected error in swap execution"
    assert "code" in result, "Missing code in response"
    assert result["code"] == 0, "Expected success code"
    assert "data" in result, "Missing data in response"
    assert "tx_hash" in result["data"], "Missing tx_hash in data"
    assert result["data"]["tx_hash"] == "test_hash", "Missing transaction hash"

@pytest.mark.asyncio
async def test_dex_client_execute_swap_error(mock_session):
    mock_session.post.side_effect = Exception("Network error")
    client = DEXClient()
    client.session = mock_session
    
    result = await client.execute_swap("gmgn", {}, None, {})
    assert "error" in result, "Expected error response"
