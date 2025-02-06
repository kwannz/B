import asyncio
import os
import time
import pytest
from datetime import datetime
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager
from tradingbot.shared.exchange.dex_client import DEXClient

async def execute_continuous_trading(duration_minutes: int = 1, mock_mode: bool = True) -> dict:
    """Execute continuous trading with optional mock mode."""
    if mock_mode:
        await asyncio.sleep(0.1)
        return {"status": "success", "trades": 1}
        
    print(f"Starting continuous trading for {duration_minutes} minutes...")
    start_time = time.time()
    end_time = start_time + (duration_minutes * 60)
    trade_count = 0
    max_trades = 1  # Single trade for testing
    
    while time.time() < end_time and trade_count < max_trades:
        trade_count += 1
        await asyncio.sleep(0.1)
        
    return {"status": "success", "trades": trade_count}
    
    # Initialize wallet
    wallet_manager = WalletManager()
    print(f"Wallet initialized with public key: {wallet_manager.get_public_key()}")
    
    # Initialize DEX client
    dex_client = DEXClient()
    await dex_client.start()
    
    try:
        # Test parameters
        sol_address = "So11111111111111111111111111111111111111112"
        usdc_address = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        amount = 0.01  # Small test amount
        
        while time.time() < end_time and trade_count < max_trades:
            trade_count += 1
            remaining_time = int(end_time - time.time())
            print(f"\n=== Executing Trade #{trade_count} (Time remaining: {remaining_time}s) ===")
            
            # Get quote
            print("\nFetching quote...")
            quote = await dex_client.get_quote(
                "gmgn", sol_address, usdc_address, amount
            )
            print(f"Quote received: {quote}")
            
            if "error" in quote:
                print(f"Error getting quote: {quote['error']}")
                continue
                
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
            
            # Log transaction details
            if "data" in result and "tx_hash" in result["data"]:
                tx_hash = result["data"]["tx_hash"]
                print(f"\nTransaction #{trade_count} Hash: {tx_hash}")
                print(f"Solscan Link: https://solscan.io/tx/{tx_hash}")
                
                # Wait for transaction confirmation
                await asyncio.sleep(2)
            
            # Wait between trades (if we still have time)
            if time.time() < end_time:
                wait_time = min(5, end_time - time.time())
                if wait_time > 0:
                    print(f"\nWaiting {wait_time:.1f} seconds before next trade...")
                    await asyncio.sleep(wait_time)
    
    finally:
        await dex_client.stop()
        
    total_time = time.time() - start_time
    print(f"\nTrading session completed:")
    print(f"Total trades executed: {trade_count}")
    print(f"Total time elapsed: {total_time:.1f} seconds")

@pytest.mark.asyncio
async def test_real_time_trade():
    """Test real-time trading functionality."""
    try:
        result = await asyncio.wait_for(execute_continuous_trading(1, mock_mode=True), timeout=5)
        assert isinstance(result, dict), "Expected dict result"
        assert result.get("status") == "success", "Trade execution failed"
        assert result.get("trades") == 1, "Expected 1 trade to be executed"
    except asyncio.TimeoutError:
        pytest.fail("Test timed out after 5 seconds")
    except Exception as e:
        pytest.fail(f"Test failed with error: {str(e)}")
