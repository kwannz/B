import asyncio
import os
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

async def test_wallet():
    wallet = WalletManager()
    try:
        if not os.getenv("walletkey"):
            print("✗ Configuration not found")
            return
            
        if not wallet.get_public_key():
            print("✗ Initialization failed")
            return
            
        balance = await wallet.get_balance()
        if balance is not None:
            print("✓ Verification successful")
    except Exception as e:
        print("✗ Verification failed")

if __name__ == "__main__":
    asyncio.run(test_wallet())
