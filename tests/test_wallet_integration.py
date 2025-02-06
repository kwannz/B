import asyncio
import os
from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager

async def test_wallet_integration():
    print("Testing wallet integration...")
    
    wallet_manager = WalletManager()
    private_key = os.environ.get("walletkey")
    if not private_key:
        raise ValueError("Wallet key not found in environment")
        
    wallet_manager.initialize_wallet(private_key)
    
    if not wallet_manager.is_initialized():
        raise ValueError("Wallet initialization failed")
        
    print(f"Public Key: {wallet_manager.get_public_key()}")
    balance = await wallet_manager.get_balance()
    print(f"Current Balance: {balance} SOL")
    
    print("Wallet integration test complete")

if __name__ == "__main__":
    asyncio.run(test_wallet_integration())
