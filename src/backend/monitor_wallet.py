import asyncio
import logging
import os
from datetime import datetime, timedelta
from pymongo import MongoClient
from tradingbot.backend.trading_agent.agents.wallet_manager import WalletManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def monitor_wallet_and_trades():
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=10)
    
    try:
        wallet = WalletManager()
        key = os.environ.get("walletkey")
        if not key:
            logger.error("walletkey not set")
            return
            
        address = str(wallet._keypair.pubkey())
        balance = await wallet.get_balance()
        
        logger.info(f"Wallet Address: {address}")
        logger.info(f"Current Balance: {balance} SOL")
    except Exception as e:
        logger.error(f"Failed to initialize wallet: {e}")
        return
    
    client = MongoClient('mongodb://localhost:27017')
    db = client.tradingbot
    
    while datetime.now() < end_time:
        latest_trades = list(db.trades.find().sort('timestamp', -1).limit(1))
        if latest_trades:
            trade = latest_trades[0]
            logger.info(f"Latest Trade - Symbol: {trade.get('symbol')}, Size: {trade.get('size')}, Price: {trade.get('price')}, Time: {trade.get('timestamp')}")
        
        balance = await wallet.get_balance()
        logger.info(f"Current Balance: {balance} SOL")
        await asyncio.sleep(30)
    
    logger.info("10-minute monitoring period completed")

if __name__ == "__main__":
    asyncio.run(monitor_wallet_and_trades())
