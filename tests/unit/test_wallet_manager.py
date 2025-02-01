import pytest
import base58
from unittest.mock import AsyncMock, patch, Mock
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

@pytest.fixture
def wallet_manager():
    return WalletManager()

@pytest.mark.asyncio
async def test_get_balance(wallet_manager):
    """Test get balance"""
    balance = await wallet_manager.get_balance()
    assert balance == 10.0  # Default mock balance

@pytest.mark.asyncio
async def test_get_balance_error(wallet_manager):
    """Test get balance error handling"""
    with patch.object(wallet_manager, 'get_balance', side_effect=Exception("Test error")):
        with pytest.raises(Exception):
            await wallet_manager.get_balance()

def test_get_public_key(wallet_manager):
    """Test get public key"""
    public_key = wallet_manager.get_public_key()
    assert public_key == base58.b58encode(b"mock_public_key").decode()

def test_get_private_key(wallet_manager):
    """Test get private key"""
    private_key = wallet_manager.get_private_key()
    assert private_key == base58.b58encode(b"mock_private_key").decode()

@pytest.mark.asyncio
async def test_send_transaction_success(wallet_manager):
    """Test successful transaction"""
    initial_balance = await wallet_manager.get_balance()
    amount = 5.0
    to_address = "test_address"
    
    tx_hash = await wallet_manager.send_transaction(to_address, amount)
    assert tx_hash == base58.b58encode(b"mock_tx_hash").decode()
    
    new_balance = await wallet_manager.get_balance()
    assert new_balance == initial_balance - amount

@pytest.mark.asyncio
async def test_send_transaction_insufficient_funds(wallet_manager):
    """Test transaction with insufficient funds"""
    amount = 20.0  # More than default balance
    to_address = "test_address"
    
    with pytest.raises(ValueError, match="Insufficient funds"):
        await wallet_manager.send_transaction(to_address, amount)

@pytest.mark.asyncio
async def test_sign_message(wallet_manager):
    """Test message signing"""
    message = b"test message"
    signature = await wallet_manager.sign_message(message)
    assert signature == base58.b58encode(b"mock_signature")

@pytest.mark.asyncio
async def test_sign_message_with_empty_message(wallet_manager):
    """Test signing empty message"""
    message = b""
    signature = await wallet_manager.sign_message(message)
    assert signature == base58.b58encode(b"mock_signature")

def test_wallet_initialization():
    """Test wallet initialization"""
    wallet = WalletManager()
    assert wallet._balance == 10.0
    assert wallet._public_key == base58.b58encode(b"mock_public_key").decode()
    assert wallet._private_key == base58.b58encode(b"mock_private_key").decode()
