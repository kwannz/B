import pytest
from unittest.mock import Mock, patch, AsyncMock
import base64
from decimal import Decimal
from solana.transaction import Transaction

from tradingbot.shared.exchange.gmgn_client import GMGNClient

@pytest.fixture
async def gmgn_client():
    client = GMGNClient({
        "slippage": 0.5,
        "fee": 0.002,
        "use_anti_mev": True,
        "wallet_address": "test_wallet"
    })
    await client.start()
    yield client
    await client.stop()

@pytest.fixture
async def mock_response():
    mock = AsyncMock()
    mock.status = 200
    return mock

async def test_get_quote(gmgn_client, mock_response):
    expected_quote = {
        "data": {
            "quote": {
                "inputMint": "So11111111111111111111111111111111111111112",
                "inAmount": "50000000",
                "outputMint": "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs",
                "outAmount": "77920478752"
            },
            "raw_tx": {
                "swapTransaction": "base64_encoded_transaction"
            }
        }
    }
    
    with patch.object(gmgn_client.session, 'get') as mock_get:
        mock_response.json = AsyncMock(return_value=expected_quote)
        mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.get_quote(
            "So11111111111111111111111111111111111111112",
            "7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs",
            0.1
        )
        
        assert result == expected_quote
        mock_get.assert_called_once()

async def test_execute_swap(gmgn_client, mock_response):
    quote = {
        "data": {
            "raw_tx": {
                "swapTransaction": base64.b64encode(b"test_transaction").decode()
            }
        }
    }
    
    mock_wallet = Mock()
    mock_wallet.payer = Mock()
    
    with patch('solana.transaction.Transaction.deserialize') as mock_deserialize, \
         patch.object(gmgn_client.session, 'post') as mock_post:
        
        mock_tx = Mock()
        mock_tx.serialize = Mock(return_value=b"signed_transaction")
        mock_tx.sign = Mock()
        mock_deserialize.return_value = mock_tx
        
        mock_response.json = AsyncMock(return_value={"success": True})
        mock_post.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.execute_swap(quote, mock_wallet)
        
        assert result == {"success": True}
        mock_post.assert_called_once()
        mock_tx.sign.assert_called_once_with([mock_wallet.payer])

async def test_transaction_status(gmgn_client, mock_response):
    expected_status = {
        "data": {
            "success": True,
            "expired": False
        }
    }
    
    with patch.object(gmgn_client.session, 'get') as mock_get:
        mock_response.json = AsyncMock(return_value=expected_status)
        mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.get_transaction_status(
            "test_hash",
            12345
        )
        
        assert result == expected_status
        mock_get.assert_called_once()

async def test_transaction_status_expired(gmgn_client, mock_response):
    status_response = {
        "data": {
            "success": False,
            "expired": True
        }
    }
    
    with patch.object(gmgn_client.session, 'get') as mock_get:
        mock_response.json = AsyncMock(return_value=status_response)
        mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.get_transaction_status(
            "test_hash",
            12345
        )
        
        assert result == {"error": "Transaction expired", "expired": True}
        mock_get.assert_called_once()

async def test_get_quote_session_error(gmgn_client):
    gmgn_client.session = None
    result = await gmgn_client.get_quote("token1", "token2", 1.0)
    assert result == {"error": "Session not initialized"}

async def test_execute_swap_session_error(gmgn_client):
    gmgn_client.session = None
    result = await gmgn_client.execute_swap({}, Mock())
    assert result == {"error": "Session not initialized"}

async def test_transaction_status_session_error(gmgn_client):
    gmgn_client.session = None
    result = await gmgn_client.get_transaction_status("hash", 123)
    assert result == {"error": "Session not initialized"}

async def test_get_quote_api_error(gmgn_client, mock_response):
    with patch.object(gmgn_client.session, 'get') as mock_get:
        mock_response.status = 400
        mock_response.text = AsyncMock(return_value="Bad Request")
        mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.get_quote("token1", "token2", 1.0)
        assert "error" in result
        assert result["status"] == 400

async def test_execute_swap_deserialize_error(gmgn_client, mock_response):
    quote = {
        "data": {
            "raw_tx": {
                "swapTransaction": "invalid_base64"
            }
        }
    }
    
    result = await gmgn_client.execute_swap(quote, Mock())
    assert "error" in result

async def test_execute_swap_api_error(gmgn_client, mock_response):
    quote = {
        "data": {
            "raw_tx": {
                "swapTransaction": base64.b64encode(b"test_transaction").decode()
            }
        }
    }
    
    with patch('solana.transaction.Transaction.deserialize') as mock_deserialize, \
         patch.object(gmgn_client.session, 'post') as mock_post:
        mock_tx = Mock()
        mock_tx.serialize = Mock(return_value=b"signed_transaction")
        mock_tx.sign = Mock()
        mock_deserialize.return_value = mock_tx
        
        mock_response.status = 400
        mock_response.text = AsyncMock(return_value="Bad Request")
        mock_post.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.execute_swap(quote, Mock())
        assert "error" in result
        assert result["status"] == 400

async def test_transaction_status_api_error(gmgn_client, mock_response):
    with patch.object(gmgn_client.session, 'get') as mock_get:
        mock_response.status = 400
        mock_response.text = AsyncMock(return_value="Bad Request")
        mock_get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        
        result = await gmgn_client.get_transaction_status("hash", 123)
        assert "error" in result
        assert result["status"] == 400

async def test_get_quote_network_error(gmgn_client):
    with patch.object(gmgn_client.session, 'get', side_effect=Exception("Network error")):
        result = await gmgn_client.get_quote("token1", "token2", 1.0)
        assert result == {"error": "Network error"}

async def test_execute_swap_network_error(gmgn_client):
    quote = {
        "data": {
            "raw_tx": {
                "swapTransaction": base64.b64encode(b"test_transaction").decode()
            }
        }
    }
    with patch('solana.transaction.Transaction.deserialize') as mock_deserialize, \
         patch.object(gmgn_client.session, 'post', side_effect=Exception("Network error")):
        mock_tx = Mock()
        mock_tx.serialize = Mock(return_value=b"signed_transaction")
        mock_tx.sign = Mock()
        mock_deserialize.return_value = mock_tx
        
        result = await gmgn_client.execute_swap(quote, Mock())
        assert result == {"error": "Network error"}
