import asyncio
import asyncio
import logging
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
sys.path.insert(0, project_root)

from src.tradingbot.shared.exchange.dex_client import DEXClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def run_trading_system(duration_minutes: int = 10):
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=duration_minutes)
    
    dex_client = DEXClient()
    await dex_client.start()
    
    try:
        trade_count = 0
        while datetime.now() < end_time:
            remaining_time = (end_time - datetime.now()).total_seconds()
            logger.info(f"Time remaining: {remaining_time:.1f} seconds")
            
            # Execute SOL -> USDC swap
            try:
                trade_count += 1
                amount = Decimal("0.01")  # 0.01 SOL per trade
                
                logger.info(f"\n=== Executing Trade #{trade_count} ===")
                
                # Get quote
                quote = await dex_client.get_quote(
                    "gmgn",
                    "So11111111111111111111111111111111111111112",  # SOL
                    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
                    float(amount)
                )
                
                if "error" in quote:
                    logger.error(f"Error getting quote: {quote['error']}")
                    continue
                
                logger.info(f"Quote received: {quote}")
                
                # Create keypair from wallet key
                from solders.keypair import Keypair
                import base58
                
                wallet_key = os.environ.get("walletkey")
                key_bytes = base58.b58decode(wallet_key)
                keypair = Keypair.from_bytes(key_bytes)
                
                # Execute swap
                result = await dex_client.execute_swap(
                    "gmgn",
                    quote,
                    keypair,
                    {
                        "slippage": 0.5,
                        "fee": 0.002,
                        "use_anti_mev": True
                    }
                )
                
                if "error" in result:
                    logger.error(f"Error executing swap: {result['error']}")
                    continue
                
                tx_hash = result["data"]["tx_hash"]
                logger.info(f"Transaction {trade_count} Hash: {tx_hash}")
                logger.info(f"Solscan Link: https://solscan.io/tx/{tx_hash}")
                
                # Report trade to user
                print(f"\n交易 #{trade_count} 执行成功:")
                print(f"- 金额: {amount} SOL")
                print(f"- 交易哈希: {tx_hash}")
                print(f"- Solscan链接: https://solscan.io/tx/{tx_hash}\n")
                
            except Exception as e:
                logger.error(f"Error during trade execution: {str(e)}")
            
            # Wait between trades
            if datetime.now() < end_time:
                wait_time = min(5, (end_time - datetime.now()).total_seconds())
                if wait_time > 0:
                    await asyncio.sleep(wait_time)
    
    finally:
        await dex_client.stop()
        logger.info(f"Trading system stopped. Total trades executed: {trade_count}")

if __name__ == "__main__":
    try:
        asyncio.run(run_trading_system(10))
    except KeyboardInterrupt:
        logger.info("Trading system stopped by user")
    except Exception as e:
        logger.error(f"Trading system error: {str(e)}")
        raise
