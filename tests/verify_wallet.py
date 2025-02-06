from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager

import os
import pytest

def test_verify_wallet():
    wm = WalletManager()
    wm.initialize_wallet(os.environ.get("walletkey"))
    assert wm.get_public_key() is not None, "Failed to initialize wallet"
