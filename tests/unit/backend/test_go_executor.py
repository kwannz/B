from datetime import datetime
from unittest.mock import MagicMock, patch

import aiohttp
import pytest

from src.backend.trading.executor.go_executor_client import execute_trade_in_go
from src.backend.trading.executor.trade_executor import TradeExecutor
from src.shared.errors import TradingError


@pytest.mark.asyncio
async def test_trade_executor_with_go():
    wallet_manager = MagicMock()
    wallet_manager.is_initialized.return_value = True
    wallet_manager.get_public_key.return_value = "test_wallet"
    wallet_manager.get_balance = MagicMock(return_value=1.0)

    executor = TradeExecutor({"test": "config"})
    executor.wallet_manager = wallet_manager

    trade_params = {
        "amount": 1.5,
        "symbol": "SOL/USDT",
        "side": "buy",
        "use_go_executor": True,
    }

    result = await executor.execute_trade(trade_params)

    assert result["status"] in ["executed", "failed"]
    assert "id" in result
    assert "wallet" in result
    assert result["wallet"] == "test_wallet"
    assert "timestamp" in result


@pytest.mark.asyncio
async def test_trade_executor_without_amount():
    wallet_manager = MagicMock()
    wallet_manager.is_initialized.return_value = True
    wallet_manager.get_public_key.return_value = "test_wallet"
    wallet_manager.get_balance = MagicMock(return_value=1.0)

    executor = TradeExecutor({"test": "config"})
    executor.wallet_manager = wallet_manager

    trade_params = {"symbol": "SOL/USDT", "side": "buy", "use_go_executor": True}

    result = await executor.execute_trade(trade_params)

    assert result["status"] == "failed"
    assert "error" in result
    assert "amount" in result["error"].lower()


@pytest.mark.asyncio
async def test_trade_executor_with_insufficient_balance():
    wallet_manager = MagicMock()
    wallet_manager.is_initialized.return_value = True
    wallet_manager.get_public_key.return_value = "test_wallet"
    wallet_manager.get_balance = MagicMock(return_value=0.4)  # Below 0.5 minimum

    executor = TradeExecutor({"test": "config"})
    executor.wallet_manager = wallet_manager

    trade_params = {
        "amount": 1.5,
        "symbol": "SOL/USDT",
        "side": "buy",
        "use_go_executor": True,
    }

    with pytest.raises(TradingError) as exc_info:
        await executor.execute_trade(trade_params)
    assert "Insufficient balance" in str(exc_info.value)
