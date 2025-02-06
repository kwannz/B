import asyncio
import os
from tradingbot.backend.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.dex_client import DEXClient

async def execute_trade_test():
    print("Initializing real-time trade test...")
    
    # Initialize wallet
    wallet_manager = WalletManager()
    private_key = os.environ.get("walletkey")
    if not private_key:
        raise ValueError("Wallet key not found in environment")
    
    wallet_manager.initialize_wallet(private_key)
    print(f"Wallet initialized with public key: {wallet_manager.get_public_key()}")
    
    # Initialize DEX client
    dex_client = DEXClient()
    await dex_client.start()
    
    try:
        # Test parameters
        sol_address = "So11111111111111111111111111111111111111112"
        usdc_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        amount = 0.01  # Small test amount
        
        # Get quote
        print("\nFetching quote...")
        quote = await dex_client.get_quote(
            "gmgn", sol_address, usdc_address, amount
        )
        print(f"Quote received: {quote}")
        
        if "error" in quote:
            raise ValueError(f"Error getting quote: {quote['error']}")
            
        # Execute swap
        print("\nExecuting swap...")
        result = await dex_client.execute_swap(
            "gmgn",
            quote,
            wallet_manager._keypair,
            {
                "slippage": 0.5,  # 0.5% slippage tolerance
                "is_anti_mev": True,  # Enable anti-MEV protection
                "fee": 0.002  # 0.2% fee
            }
        )
        print(f"Swap result: {result}")
        
        # Monitor transaction
        if "txHash" in result:
            print(f"\nMonitoring transaction: {result['txHash']}")
            status = await dex_client.get_transaction_status(
                "gmgn",
                result['txHash']
            )
            print(f"Transaction status: {status}")
    
    finally:
        await dex_client.stop()
        
    print("\nTrade test complete")

if __name__ == "__main__":
    asyncio.run(execute_trade_test())
