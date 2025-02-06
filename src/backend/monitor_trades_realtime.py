import asyncio
import logging
import motor.motor_asyncio
from datetime import datetime, timedelta
from solana.rpc.async_api import AsyncClient
from solders.signature import Signature
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def monitor_trades(duration_minutes: int = 10):
    try:
        # Initialize MongoDB and Solana RPC clients
        mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            "mongodb://localhost:27017",
            serverSelectionTimeoutMS=5000
        )
        db = mongo_client.tradingbot
        client = AsyncClient("https://api.mainnet-beta.solana.com")
        
        # Initialize wallet
        wallet = WalletManager()
        address = wallet.get_public_key()
        logger.info(f"Monitoring trades for wallet: {address}")
        
        start_time = datetime.utcnow()
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        while datetime.utcnow() < end_time:
            try:
                # Get latest trades
                latest_trades = await db.trades.find().sort("timestamp", -1).limit(5).to_list(5)
                if latest_trades:
                    logger.info("\nLatest Trades:")
                    for trade in latest_trades:
                        # Validate transaction status
                        if "signature" in trade:
                            sig = Signature.from_string(trade["signature"])
                            status = await client.get_signature_statuses([sig])
                            if status.value[0]:
                                conf_status = status.value[0].confirmation_status
                                logger.info(f"Trade: {trade['symbol']}, Size: {trade['size']}, Price: {trade['price']}, Status: {conf_status}")
                            else:
                                logger.warning(f"Trade status not found: {trade['signature']}")
                
                # Get wallet balance
                balance = await wallet.get_balance()
                logger.info(f"\nCurrent Balance: {balance} SOL")
                
                # Get risk metrics
                risk_metrics = await db.risk_metrics.find_one(
                    {"timestamp": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}},
                    sort=[("timestamp", -1)]
                )
                if risk_metrics:
                    logger.info("\nRisk Metrics:")
                    logger.info(f"Total Exposure: {risk_metrics.get('total_exposure', 0)} USDC")
                    logger.info(f"Margin Used: {risk_metrics.get('margin_used', 0)} USDC")
                
                await asyncio.sleep(30)  # Update every 30 seconds
                
            except Exception as e:
                logger.error(f"Error monitoring trades: {e}")
                await asyncio.sleep(5)
                continue
                
    except Exception as e:
        logger.error(f"Fatal error in trade monitoring: {e}")
    finally:
        mongo_client.close()
        await client.close()
        logger.info("Trade monitoring stopped")

if __name__ == "__main__":
    try:
        asyncio.run(monitor_trades())
    except KeyboardInterrupt:
        logger.info("Trade monitoring interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error in trade monitoring: {e}")
