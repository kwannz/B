"""Tests for fee deduction functionality."""

import os
import sys
import pytest
from decimal import Decimal
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

# Mock environment variables with valid base58 addresses
os.environ.update(
    {
        "FEE_WALLET_ADDRESS": "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
        "WALLET_A_PRIVATE_KEY": "4NMwxzmYj2uvHuq8xoqhY8RXg63KSVJM1DXkpbmkUY7YQWuoyQgFnnzn6yo3CMna9mYVqRJchQr2K2HBkcQnpXEG",
        "WALLET_A_ADDRESS": "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
        "WALLET_B_ADDRESS": "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
    }
)

# Mock solana modules
mock_solana = MagicMock()
mock_transaction = MagicMock()
mock_keypair = MagicMock()
mock_confirmed = MagicMock()
mock_transfer = MagicMock()
sys.modules["solana.rpc.async_api"] = MagicMock()
sys.modules["solana.transaction"] = mock_transaction
sys.modules["solana.keypair"] = mock_keypair
sys.modules["solana.rpc.commitment"] = mock_confirmed
sys.modules["solana.system_program"] = mock_transfer

# Mock strategy_executor
mock_strategy_executor = MagicMock()
mock_strategy_executor._log_fee_transaction = AsyncMock()
sys.modules["shared.strategy_executor"] = MagicMock()
sys.modules["shared.strategy_executor"].strategy_executor = mock_strategy_executor

from trading_agent.trading_bot.python.executor import (
    TradingExecutor,
    TradeOrder,
    OrderResult,
)
from trading_agent.wallet.manager import WalletManager


@pytest.fixture
async def executor(mock_wallet_manager):
    """Create trading executor instance with mocked configuration."""
    executor = TradingExecutor()

    # Mock API keys
    executor.api_keys = {
        "binance": {"api_key": "mock_api_key", "api_secret": "mock_api_secret"}
    }

    # Set up wallet manager
    executor.wallet_manager = mock_wallet_manager
    executor.wallet_a_private_key = os.environ["WALLET_A_PRIVATE_KEY"]

    # Create mock session with proper async context manager
    mock_response = {
        "orderId": "test123",
        "executedQty": "1.0",
        "price": "50000",
        "status": "FILLED",
    }

    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_response)

    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_response_obj

    mock_session = MagicMock()
    mock_session.post = AsyncMock(return_value=mock_context)
    executor.session = mock_session

    await executor.start()
    yield executor
    await executor.stop()


@pytest.fixture
def mock_wallet_manager():
    """Mock wallet manager for testing."""
    with patch("trading_agent.trading_bot.python.executor.WalletManager") as mock:
        # Mock initialization
        mock.return_value.client = AsyncMock()
        mock.return_value.wallet_a_private_key = os.environ["WALLET_A_PRIVATE_KEY"]
        mock.return_value.wallet_a_address = os.environ["WALLET_A_ADDRESS"]
        mock.return_value.wallet_b_address = os.environ["WALLET_B_ADDRESS"]

        # Mock Solana client methods
        mock.return_value.client.get_balance = AsyncMock(
            return_value={"result": {"value": int(100 * 1e9)}}  # 100 SOL in lamports
        )
        mock.return_value.client.send_transaction = AsyncMock(
            return_value={"result": "mock_signature"}
        )

        # Mock transfer_tokens method for fee transfers
        mock.return_value.transfer_tokens = AsyncMock(
            return_value={
                "signature": "mock_signature",
                "from_address": os.environ["WALLET_A_ADDRESS"],
                "to_address": os.environ["FEE_WALLET_ADDRESS"],
                "amount": None,  # Will be set by actual fee calculation
                "timestamp": datetime.now().isoformat(),
            }
        )

        # Mock get_balance method
        mock.return_value.get_balance = AsyncMock(return_value=100.0)

        # Mock close method
        mock.return_value.close = AsyncMock()

        # Mock verify_wallet method
        mock.return_value.verify_wallet = AsyncMock(return_value=True)

        yield mock.return_value


@pytest.mark.asyncio
async def test_fee_deduction_before_trade(executor, mock_wallet_manager):
    """Test that 3% fee is deducted before trade execution."""
    # Create test order
    order = TradeOrder(
        exchange="binance",
        symbol="BTC-USDT",
        side="buy",
        type="limit",
        quantity=Decimal("1.0"),
        price=Decimal("50000"),
        leverage=None,
        stop_loss=None,
        take_profit=None,
        time_in_force="GTC",
        reduce_only=False,
        post_only=False,
        client_order_id="test123",
        metadata={"tenant_id": "test"},
    )

    # Mock successful Binance API response
    mock_response = {
        "orderId": "test123",
        "executedQty": "0.97",  # Quantity after 3% fee
        "price": "50000",
        "status": "FILLED",
    }

    mock_response_obj = MagicMock()
    mock_response_obj.status = 200
    mock_response_obj.json = AsyncMock(return_value=mock_response)

    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_response_obj

    mock_session = MagicMock()
    mock_session.post = AsyncMock(return_value=mock_context)
    executor.session = mock_session

    # Execute order
    result = await executor.execute_order(order)

    # Verify fee transfer
    mock_wallet_manager.transfer_tokens.assert_called_once()
    fee_amount = float(Decimal("50000") * Decimal("1.0") * Decimal("0.03"))
    assert mock_wallet_manager.transfer_tokens.call_args[1]["amount"] == fee_amount

    # Verify trade execution
    assert result.success is True
    assert result.order_id == "test123"
    # Verify quantity was reduced by 3%
    assert float(result.filled_quantity) == float(Decimal("1.0") * Decimal("0.97"))


# End of fee deduction tests
