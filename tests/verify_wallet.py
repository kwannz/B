from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

import os
import pytest

@pytest.mark.asyncio
async def test_verify_wallet():
    wm = WalletManager()
    assert wm.get_public_key() is not None, "Failed to get public key"
    assert wm.get_private_key() is not None, "Failed to get private key"
    balance = await wm.get_balance()
    assert isinstance(balance, float), "Failed to get balance"
