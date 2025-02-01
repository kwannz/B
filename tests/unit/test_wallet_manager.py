import pytest
import os
import json
import base58
import asyncio
from decimal import Decimal
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock
from solana.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
from trading_agent.wallet.manager import WalletManager, MIN_SOL_BALANCE, TX_FEE_RESERVE

# Constants for testing
TEST_RPC_URL = "https://api.mainnet-beta.solana.com"
TEST_WALLET_A_PRIVATE_KEY = "test_private_key"
TEST_WALLET_A_ADDRESS = "test_wallet_a_address"
TEST_WALLET_B_ADDRESS = "test_wallet_b_address"
TEST_FEE_WALLET_ADDRESS = "test_fee_wallet_address"


@pytest.fixture
async def mock_client():
    """Mock Solana client for testing."""
    with patch("solana.rpc.async_api.AsyncClient") as mock:
        client = mock.return_value
        # Mock get_version
        client.get_version = AsyncMock(return_value={"solana-core": "1.7.14"})
        # Mock get_balance
        client.get_balance = AsyncMock(
            return_value={"result": {"value": int(1e9)}}
        )  # 1 SOL
        # Mock get_account_info
        client.get_account_info = AsyncMock(return_value={"result": {"value": {}}})
        # Mock send_transaction
        client.send_transaction = AsyncMock(return_value={"result": "test_signature"})
        # Mock get_signatures_for_address
        client.get_signatures_for_address = AsyncMock(
            return_value={
                "result": [
                    MagicMock(
                        signature="test_sig",
                        err=None,
                        memo=None,
                        block_time=int(datetime.now().timestamp()),
                    )
                ]
            }
        )
        # Mock get_transaction
        client.get_transaction = AsyncMock(
            return_value={
                "result": {
                    "blockTime": int(datetime.now().timestamp()),
                    "meta": {"fee": int(0.000005 * 1e9)},  # 0.000005 SOL fee
                }
            }
        )
        yield client


@pytest.fixture
async def wallet_manager(mock_client):
    """Create WalletManager instance with mocked client."""
    with (
        patch.dict(
            os.environ,
            {
                "SOLANA_RPC_URL": TEST_RPC_URL,
                "WALLET_A_PRIVATE_KEY": TEST_WALLET_A_PRIVATE_KEY,
                "WALLET_A_ADDRESS": TEST_WALLET_A_ADDRESS,
                "WALLET_B_ADDRESS": TEST_WALLET_B_ADDRESS,
                "FEE_WALLET_ADDRESS": TEST_FEE_WALLET_ADDRESS,
            },
        ),
        patch("solana.rpc.async_api.AsyncClient", return_value=mock_client),
    ):
        manager = WalletManager()
        await manager.initialize()
        yield manager
        await manager.close()


@pytest.mark.asyncio
async def test_initialization(wallet_manager, mock_client):
    """Test WalletManager initialization."""
    assert wallet_manager.rpc_url == TEST_RPC_URL
    assert wallet_manager.wallet_a_private_key == TEST_WALLET_A_PRIVATE_KEY
    assert wallet_manager.wallet_a_address == TEST_WALLET_A_ADDRESS
    assert wallet_manager.wallet_b_address == TEST_WALLET_B_ADDRESS
    assert wallet_manager.fee_wallet_address == TEST_FEE_WALLET_ADDRESS
    mock_client.get_version.assert_called_once()


@pytest.mark.asyncio
async def test_create_wallet(wallet_manager):
    """Test wallet creation."""
    wallet = await wallet_manager.create_wallet()
    assert wallet is not None
    assert "public_key" in wallet
    assert "private_key" in wallet
    assert "balance" in wallet
    assert "created_at" in wallet
    assert wallet["balance"] == 1.0  # 1 SOL from mock
    # Verify base58 encoding
    assert (
        len(base58.b58decode(wallet["private_key"])) == 64
    )  # Solana private key length


@pytest.mark.asyncio
async def test_get_balance(wallet_manager, mock_client):
    """Test getting wallet balance."""
    balance = await wallet_manager.get_balance("test_address")
    assert balance == 1.0  # 1 SOL from mock
    mock_client.get_balance.assert_called_once_with("test_address")


@pytest.mark.asyncio
async def test_transfer_tokens(wallet_manager, mock_client):
    """Test token transfer."""
    result = await wallet_manager.transfer_tokens(
        TEST_WALLET_A_PRIVATE_KEY, TEST_WALLET_B_ADDRESS, 0.5  # 0.5 SOL
    )
    assert result is not None
    assert result["signature"] == "test_signature"
    assert result["from_address"] == str(
        Keypair.from_secret_key(base58.b58decode(TEST_WALLET_A_PRIVATE_KEY)).public_key
    )
    assert result["to_address"] == TEST_WALLET_B_ADDRESS
    assert result["amount"] == 0.5
    assert "timestamp" in result


@pytest.mark.asyncio
async def test_get_transaction_history(wallet_manager, mock_client):
    """Test getting transaction history."""
    history = await wallet_manager.get_transaction_history("test_address")
    assert history is not None
    assert len(history) == 1
    tx = history[0]
    assert "signature" in tx
    assert "block_time" in tx
    assert "success" in tx
    assert "fee" in tx
    assert "timestamp" in tx
    assert tx["fee"] == 0.000005  # 0.000005 SOL from mock


@pytest.mark.asyncio
async def test_monitor_balance(wallet_manager):
    """Test balance monitoring."""
    callback_called = False

    async def callback(data):
        nonlocal callback_called
        callback_called = True
        assert "address" in data
        assert "previous_balance" in data
        assert "current_balance" in data
        assert "change" in data
        assert "timestamp" in data

    # Mock get_balance to return different values
    with patch.object(wallet_manager, "get_balance") as mock_balance:
        mock_balance.side_effect = [
            1.0,
            2.0,
        ]  # First call returns 1.0, second call returns 2.0

        # Start monitoring in background
        monitor_task = asyncio.create_task(
            wallet_manager.monitor_balance("test_address", callback)
        )

        # Wait a bit for the monitor to run
        await asyncio.sleep(0.1)

        # Cancel the monitoring task
        monitor_task.cancel()

        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

        assert callback_called
        assert mock_balance.call_count >= 2


@pytest.mark.asyncio
async def test_verify_wallet(wallet_manager, mock_client):
    """Test wallet verification."""
    # Test valid wallet
    assert await wallet_manager.verify_wallet("valid_address")
    mock_client.get_account_info.assert_called_with("valid_address")

    # Test invalid address format
    assert not await wallet_manager.verify_wallet("invalid")

    # Test with minimum balance requirement
    assert await wallet_manager.verify_wallet(
        "valid_address", min_balance=0.5
    )  # Should pass (mock returns 1.0 SOL)
    assert not await wallet_manager.verify_wallet(
        "valid_address", min_balance=2.0
    )  # Should fail (mock returns 1.0 SOL)


@pytest.mark.asyncio
async def test_verify_fee_wallet(wallet_manager):
    """Test fee wallet verification."""
    assert await wallet_manager.verify_fee_wallet()

    # Test with missing fee wallet address
    with patch.object(wallet_manager, "fee_wallet_address", None):
        assert not await wallet_manager.verify_fee_wallet()


@pytest.mark.asyncio
async def test_get_wallet_info(wallet_manager):
    """Test getting wallet info."""
    info = await wallet_manager.get_wallet_info("test_address")
    assert info is not None
    assert "address" in info
    assert "balance" in info
    assert "last_checked" in info


@pytest.mark.asyncio
async def test_create_wallet_checks_minimum_balance():
    """Test that create_wallet enforces minimum balance requirement"""
    manager = WalletManager()

    # Mock get_balance to return less than minimum
    with patch.object(manager, "get_balance", new_callable=AsyncMock) as mock_balance:
        mock_balance.return_value = MIN_SOL_BALANCE - 0.1
        wallet = await manager.create_wallet()

        assert wallet is not None
        assert wallet["balance_warning"] is not None
        assert str(MIN_SOL_BALANCE) in wallet["balance_warning"]
        assert wallet["min_balance"] == MIN_SOL_BALANCE


@pytest.mark.asyncio
async def test_transfer_tokens_reserves_fee():
    """Test that transfer_tokens reserves the correct fee percentage"""
    manager = WalletManager()
    amount = 1.0  # 1 SOL

    # Mock dependencies
    with (
        patch.object(manager, "get_balance", new_callable=AsyncMock) as mock_balance,
        patch.object(
            manager.client, "send_transaction", new_callable=AsyncMock
        ) as mock_send,
    ):

        mock_balance.return_value = amount + 0.1  # Enough balance for transfer
        mock_send.return_value = {"result": "mock_signature"}

        result = await manager.transfer_tokens(
            "mock_private_key", "mock_public_key", amount
        )

        assert result is not None
        # Verify that the actual transfer amount was reduced by TX_FEE_RESERVE
        expected_amount = amount * (1 - TX_FEE_RESERVE)
        assert abs(result["amount"] - expected_amount) < 0.000001


@pytest.mark.asyncio
async def test_transfer_tokens_enforces_minimum_balance():
    """Test that transfer_tokens enforces minimum balance requirement"""
    manager = WalletManager()
    current_balance = MIN_SOL_BALANCE + 0.1  # Just above minimum
    transfer_amount = 0.2  # Would put balance below minimum

    # Mock get_balance
    with patch.object(manager, "get_balance", new_callable=AsyncMock) as mock_balance:
        mock_balance.return_value = current_balance

        # Attempt transfer that would put balance below minimum
        with pytest.raises(ValueError) as exc_info:
            await manager.transfer_tokens(
                "mock_private_key", "mock_public_key", transfer_amount
            )

        assert "insufficient balance" in str(exc_info.value).lower()
        assert str(MIN_SOL_BALANCE) in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_total_funds():
    """Test getting total funds across wallets."""
    manager = WalletManager()
    manager.wallet_a_address = "wallet_a"
    manager.wallet_b_address = "wallet_b"

    with patch.object(manager, "get_balance", new_callable=AsyncMock) as mock_balance:
        mock_balance.side_effect = [10.0, 5.0]  # wallet_a: 10 SOL, wallet_b: 5 SOL
        total = await manager.get_total_funds()
        assert total == 15.0
        assert mock_balance.call_count == 2


# Market maker allocation tests removed as per requirements
