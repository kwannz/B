import asyncio
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

async def test_wallet():
    wallet = WalletManager()
    print(f'\nWallet Address: {wallet.get_public_key()}')
    balance = await wallet.get_balance()
    print(f'Balance: {balance} SOL')
    
    expected_address = "4BKPzFyjBaRP3L1PNDf3xTerJmbbxxESmDmZJ2CZYdQ5"
    if wallet.get_public_key() == expected_address:
        print("✓ Wallet verification successful")
    else:
        print("✗ Wallet verification failed")
        print(f"Expected: {expected_address}")
        print(f"Got: {wallet.get_public_key()}")

if __name__ == "__main__":
    asyncio.run(test_wallet())
